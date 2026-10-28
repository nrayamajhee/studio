//! The Device's screen, as web-react's `DeviceScreen` and `Display`: black
//! glass in a pressed-in bezel. A readout line runs along the top (or the
//! view's pager) and the footer along the bottom, the title leading one of
//! them; the view showing fills the middle; notices take the footer's left,
//! and prompts, levels and the save's progress show over it all.

pub mod module;
pub mod roll;
pub mod scope;
pub mod step_grid;
pub mod tempo;
pub mod tiles;
pub mod tracks;

use fluid_macro::html;
use web_sys::{DocumentFragment, Element};

use super::{blur_active, markup};
use crate::icons::Icon;
use crate::modes::{self, GAP, PagerColor, Piece, Rich, ScreenBadge, Tone};
use crate::state::app;
use crate::state::feedback::ScreenOverlay;
use crate::state::view::ScreenView;

/// A line of the screen's text as nodes: plain runs as text, the others in
/// their knob's colour, and a hint's text and pads (outlined badges) dimmed
/// together.
pub fn rich(line: &Rich) -> DocumentFragment {
  let document = gloo_utils::document();
  let fragment = document.create_document_fragment();
  let mut hint: Option<Element> = None;
  for piece in &line.0 {
    let node: web_sys::Node = match piece {
      Piece::Text(Tone::Plain, text) => document.create_text_node(text).into(),
      Piece::Text(Tone::Hint, text) => {
        let span = hint.get_or_insert_with(|| {
          let span = html! { span class="text-screen-ink/45" {} };
          let _ = fragment.append_child(&span);
          span
        });
        let _ = span.append_child(&document.create_text_node(text));
        continue;
      }
      Piece::Text(tone, text) => {
        let class = match tone {
          Tone::Seek => "text-synth-green",
          Tone::Level => "text-synth-red",
          _ => "text-synth-blue",
        };
        let span = html! { span class={ class } { { text.clone() } } };
        span.into()
      }
      Piece::Pad { label, icon } => {
        let pad = html! {
          span
          class="mx-[2px] inline-grid h-[15px] place-items-center rounded-[4px] border border-current/45 px-[4px] align-top [&_svg]:size-[10px]"
          role="img"
          aria-label={ label.as_str() }
          { { markup(&icon.markup()) } }
        };
        let span = hint.get_or_insert_with(|| {
          let span = html! { span class="text-screen-ink/45" {} };
          let _ = fragment.append_child(&span);
          span
        });
        let _ = span.append_child(&pad);
        continue;
      }
    };
    hint = None;
    let _ = fragment.append_child(&node);
  }
  fragment
}

/// The screen's top: the pager's tabs, or the readout line.
#[derive(Clone, PartialEq)]
struct Head {
  pager: Option<(Vec<String>, usize, PagerColor)>,
  title: String,
  unsaved: bool,
  status_left: Option<Rich>,
  status: Rich,
}

/// The screen's bottom: the footer, or a badge in its place.
#[derive(Clone, PartialEq)]
struct Foot {
  title_below: bool,
  title: String,
  unsaved: bool,
  footer: (Rich, Rich),
  badges: Option<Vec<ScreenBadge>>,
  caption: bool,
}

const READOUT: &str = "absolute top-[9px] right-[20px] left-[20px] flex items-baseline justify-between gap-[16px] font-screen text-[14px] leading-[18px] font-medium tracking-[0.08em] whitespace-nowrap text-screen-ink/60 first-letter:uppercase";
const PAGER: &str = "absolute top-[9px] right-[20px] left-[20px] flex items-center gap-[6px] font-screen text-[14px] leading-[18px] font-medium tracking-[0.08em] whitespace-nowrap text-screen-ink/60 first-letter:uppercase";
const PAGE_ARROW: &str = "-my-[6px] grid size-[27px] shrink-0 cursor-pointer place-items-center rounded-[11px] text-screen-ink/70 [corner-shape:squircle] hover:bg-screen-ink/15 hover:text-screen-ink active:bg-screen-ink/75 active:text-screen disabled:cursor-default disabled:bg-transparent disabled:text-screen-ink/60 disabled:opacity-25 [&_svg]:size-[18px]";
// A tab's own classes, then those of a tab to step to; the current tab
// takes its colours instead, as tailwind-merge leaves them in web-react.
const PAGE_TAB: &str = "-my-[4px] max-w-full truncate rounded-[10px] px-[7px] py-[3px] font-screen text-[14px] leading-[18px] font-semibold tracking-[0.02em] first-letter:uppercase [corner-shape:squircle]";
const OTHER_TAB: &str = "cursor-pointer text-screen-ink/45 hover:bg-screen-ink/15 hover:text-screen-ink active:bg-screen-ink/75 active:text-screen";

/// The title, with an asterisk after it while the preset has unsaved
/// edits, as editors mark a file with changes.
fn titled(title: &str, unsaved: bool) -> DocumentFragment {
  let fragment = gloo_utils::document().create_document_fragment();
  let title = html! { span aria-live="polite" { { title.to_owned() } } };
  let _ = fragment.append_child(&title);
  if unsaved {
    let mark = html! {
      span class="ml-[2px] inline-grid place-items-center align-top text-screen-ink/75 [&_svg]:size-[0.9em]" title="Unsaved changes" {
        { markup(&Icon::Lucide("Asterisk").markup()) }
        span class="sr-only" { "Unsaved" }
      }
    };
    let _ = fragment.append_child(&mark);
  }
  fragment
}

fn pick_page(page: usize) {
  if let Some(pager) = modes::current().screen.pager.as_ref() {
    pager.on_pick.call(page);
  }
}

fn pager((pages, at, color): (Vec<String>, usize, PagerColor)) -> Element {
  let last = pages.len().saturating_sub(1);
  let tabs: Vec<Element> = (0..3)
    .map(|i| {
      let place = match i {
        0 => "justify-self-start",
        1 => "justify-self-stretch text-center",
        _ => "justify-self-end",
      };
      let page = (at + i).checked_sub(1);
      let name = page.and_then(|page| pages.get(page)).cloned();
      match (page, name) {
        (Some(page), Some(name)) if page == at => {
          let current = match color {
            PagerColor::Red => "cursor-default bg-synth-red text-white hover:bg-synth-red hover:text-white active:bg-synth-red active:text-white",
            PagerColor::Green => "cursor-default bg-synth-green text-white hover:bg-synth-green hover:text-white active:bg-synth-green active:text-white",
            PagerColor::Ink => "cursor-default bg-screen-ink text-screen hover:bg-screen-ink hover:text-screen active:bg-screen-ink active:text-screen",
          };
          html! { span class={ format!("{PAGE_TAB} {place} {current}") } aria-live="polite" { { name } } }
        }
        (Some(page), Some(name)) => html! {
          button
          type="button"
          aria-label={ format!("Go to {name}") }
          class={ format!("{PAGE_TAB} {OTHER_TAB} {place}") }
          @mousedown.prevent={ |_| blur_active() }
          @click={ move |_| pick_page(page) }
          {
            // A button's text sits as web-react's `Button` sets it.
            span class="flex min-w-0 flex-col items-center" {
              span class="truncate text-base leading-snug font-semibold tracking-tight text-inherit transition-colors !text-sm" { { name } }
            }
          }
        },
        _ => html! { span {} },
      }
    })
    .collect();
  html! {
    div class={ PAGER } {
      button
      type="button"
      aria-label="Back a page"
      class={ PAGE_ARROW }
      disabled={ at == 0 }
      @mousedown.prevent={ |_| blur_active() }
      @click={ move |_| pick_page(at.saturating_sub(1)) }
      { { markup(&Icon::Lucide("ChevronLeft").markup()) } }
      span class="grid min-w-0 flex-1 grid-cols-3 items-center" { { tabs } }
      button
      type="button"
      aria-label="Forward a page"
      class={ PAGE_ARROW }
      disabled={ at >= last }
      @mousedown.prevent={ |_| blur_active() }
      @click={ move |_| pick_page(at + 1) }
      { { markup(&Icon::Lucide("ChevronRight").markup()) } }
    }
  }
}

fn head(head: Head) -> Element {
  if let Some(tabs) = head.pager {
    return pager(tabs);
  }
  let lead = match head.status_left {
    Some(left) => rich(&left),
    None => titled(&head.title, head.unsaved),
  };
  html! {
    div class={ READOUT } {
      span class="min-w-0 truncate" { { lead } }
      span class="shrink-0" { { rich(&head.status) } }
    }
  }
}

fn foot(foot: Foot) -> DocumentFragment {
  // On the roll the footer's line tightens to fit under the keys.
  let (footer, badges) = if foot.caption {
    (
      "absolute right-[20px] bottom-[10px] left-[20px] flex items-baseline justify-between gap-[16px] font-screen text-[12px] leading-[12px] font-medium tracking-[0.08em] whitespace-nowrap text-screen-ink/60 first-letter:uppercase",
      "absolute right-[20px] bottom-[10px] left-[20px] flex justify-center gap-[16px] font-screen text-[12px] leading-[12px] font-medium tracking-[0.08em] whitespace-nowrap text-screen-ink/60 first-letter:uppercase",
    )
  } else {
    (
      "absolute right-[20px] bottom-[9px] left-[20px] flex items-baseline justify-between gap-[16px] font-screen text-[12px] leading-[15px] font-medium tracking-[0.08em] whitespace-nowrap text-screen-ink/60 first-letter:uppercase",
      "absolute right-[20px] bottom-[9px] left-[20px] flex justify-center gap-[16px] font-screen text-[12px] leading-[15px] font-medium tracking-[0.08em] whitespace-nowrap text-screen-ink/60 first-letter:uppercase",
    )
  };
  let fragment = gloo_utils::document().create_document_fragment();
  if foot.title_below || foot.badges.is_none() {
    let lead = gloo_utils::document().create_document_fragment();
    if foot.title_below {
      let _ = lead.append_child(&titled(&foot.title, foot.unsaved));
      if foot.badges.is_none() && !foot.footer.0.is_empty() {
        let _ = lead.append_child(&gloo_utils::document().create_text_node(GAP));
      }
    }
    if foot.badges.is_none() {
      let _ = lead.append_child(&rich(&foot.footer.0));
    }
    let trail = foot.badges.is_none().then(|| {
      html! { span class="shrink-0" { { rich(&foot.footer.1) } } }
    });
    let line = html! {
      div class={ footer } {
        span class="min-w-0 truncate" { { lead } }
        { trail }
      }
    };
    let _ = fragment.append_child(&line);
  }
  if let Some(list) = foot.badges {
    let items: Vec<Element> = list
      .into_iter()
      .map(|badge| {
        let pill = badge.on.map(|on| {
          let class = if on {
            "min-w-[40px] rounded-[999px] border px-[5px] py-0 text-center text-[12px] leading-[13px] font-semibold border-screen-ink bg-screen-ink text-screen"
          } else {
            "min-w-[40px] rounded-[999px] border border-screen-ink/30 px-[5px] py-0 text-center text-[12px] leading-[13px] font-semibold text-screen-ink/55"
          };
          html! { span class={ class } { { if on { "On" } else { "Off" } } } }
        });
        html! {
          span class="flex items-center gap-[8px]" {
            { badge.label }
            { pill }
          }
        }
      })
      .collect();
    let line = html! { div class={ badges } aria-live="polite" { { items } } };
    let _ = fragment.append_child(&line);
  }
  fragment
}

/// A level over the view, or a message alone, inverted white on black so
/// it punches through.
fn overlay(overlay: ScreenOverlay) -> Element {
  match overlay.value {
    None => html! {
      div class="pointer-events-none absolute inset-0 z-2 grid animate-[overlay-in_120ms_ease-out] place-items-center rounded-[inherit] bg-screen/55" role="status" {
        div class="flex w-auto max-w-[78%] flex-col gap-[10px] rounded-[14px] border border-transparent bg-screen-ink px-[20px] py-[12px] text-screen" {
          div class="text-center font-screen text-[14px] leading-[20px] font-semibold tracking-[0.08em] text-balance first-letter:uppercase" {
            { overlay.label }
          }
        }
      }
    },
    Some(value) => html! {
      div class="pointer-events-none absolute inset-0 z-2 grid animate-[overlay-in_120ms_ease-out] place-items-center rounded-[inherit] bg-screen/55" aria-hidden="true" {
        div class="flex w-[62%] flex-col gap-[10px] rounded-[10px] border border-screen-ink/18 bg-screen/92 px-[18px] pt-[14px] pb-[16px]" {
          div class="flex justify-between font-screen text-[14px] leading-[18px] font-semibold tracking-[0.08em] first-letter:uppercase" {
            span { { overlay.label } }
            span { { overlay.display.unwrap_or_default() } }
          }
          div class="relative h-[12px] overflow-hidden rounded-[3px] bg-screen-ink/12" {
            div
            class="h-full bg-screen-ink transition-[width] duration-160 ease-[ease-out]"
            style={ format!("width: {}%", crate::logic::js::round(value * 100.)) }
            {}
          }
        }
      }
    },
  }
}

/// What the view shows between the readouts.
fn view(view: ScreenView) -> Option<Element> {
  match view {
    ScreenView::Scope => Some(scope::scope()),
    ScreenView::Save
    | ScreenView::Instruments
    | ScreenView::Chords
    | ScreenView::PlayStyle
    | ScreenView::Progressions
    | ScreenView::Beats
    | ScreenView::Tapes
    | ScreenView::Revert => Some(tiles::tiles(view)),
    ScreenView::Synth | ScreenView::Adsr | ScreenView::Lfo | ScreenView::Fx => {
      Some(module::module(view))
    }
    ScreenView::Tempo => Some(tempo::tempo()),
    ScreenView::Roll => Some(roll::roll()),
    ScreenView::DrumGrid => Some(step_grid::step_grid()),
    ScreenView::Tracks => Some(tracks::tracks()),
  }
}

/// The screen as the current mode fills it, with notices in the footer and
/// prompts and levels over it. It reaches up into the bezel, leaving an
/// inset to the top edge.
pub fn screen() -> Element {
  let a = app();
  let head_memo = fluid::create_memo(move || {
    modes::with(|bindings| {
      let screen = &bindings.screen;
      Head {
        pager: screen
          .pager
          .as_ref()
          .map(|pager| (pager.pages.clone(), pager.at, pager.color)),
        title: screen.title.clone(),
        unsaved: screen.unsaved,
        status_left: screen.status_left.clone(),
        status: screen.status.clone(),
      }
    })
  });
  let foot_memo = fluid::create_memo(move || {
    let notice = a.feedback.notice.get();
    modes::with(|bindings| {
      let screen = &bindings.screen;
      let footer = match &notice {
        Some(notice) => (Rich::text(notice.clone()), screen.footer.1.clone()),
        None => screen.footer.clone(),
      };
      let badges = screen
        .badge
        .clone()
        .filter(|_| notice.is_none())
        .map(|badge| vec![badge]);
      Foot {
        title_below: screen.pager.is_some() || screen.status_left.is_some(),
        title: screen.title.clone(),
        unsaved: screen.unsaved,
        footer,
        badges,
        caption: a.views.view() == ScreenView::Roll,
      }
    })
  });
  let overlay_memo = fluid::create_memo(move || {
    a.feedback
      .progress
      .cloned()
      .or_else(|| a.feedback.overlay.get())
      .or_else(|| {
        a.feedback.prompt.get().map(|label| ScreenOverlay {
          label,
          value: None,
          display: None,
        })
      })
  });
  let top = fluid::show(move || head_memo.cloned(), head);
  let middle = fluid::show(move || a.views.view(), view);
  let bottom = fluid::show(move || foot_memo.cloned(), foot);
  let over = fluid::show(move || overlay_memo.cloned(), |shown| shown.map(overlay));
  html! {
    div class="mt-[calc(var(--spacing-inset)_-_var(--spacing-bezel))] aspect-[var(--screen-aspect,2.39)] min-w-0 rounded-[12px] border-t-[1.5px] border-b-[1.5px] border-t-screen-edge border-b-screen-lip bg-screen p-[8px] shadow-screen" {
      div class="relative flex h-full items-center rounded-[4px] px-[20px] text-screen-ink" {
        { top }
        { middle }
        { bottom }
        { over }
      }
    }
  }
}
