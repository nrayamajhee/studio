//! The tracks view, as web-react's `TrackList`, `TrackLane` and `LoopEdge`
//! draw it: a row a track (the take first), its name and flags, its volume
//! strip, then its lane, like a clip on the studio's timeline. Four rows
//! show at once, scrolling to keep the picked one in view; the mix's
//! playhead runs across them all. Rows are kept by track, so dragging a
//! clip's edge keeps hold of it while the clip redraws under it.

use std::cell::Cell;
use std::rc::Rc;

use fluid_macro::html;
use wasm_bindgen::JsCast;
use web_sys::{DocumentFragment, Element, HtmlElement, PointerEvent, WheelEvent};

use super::scope::animate;
use super::step_grid::wheel_pixels;
use crate::icons::Icon;
use crate::logic::js::{number, round};
use crate::logic::tracks::TrackClip;
use crate::modes::{self, ScreenTrack};
use crate::state::app;
use crate::ui::{blur_active, markup};

/// Rows the tracks view shows at once; past them the list scrolls a row at
/// a time to keep the picked one in view.
const TRACKS_SHOWN: usize = 4;
/// Wheel travel (px) that moves the pick one track.
const WHEEL_PER_TRACK: f64 = 40.;
/// The lanes' share of a row: everything but the 168px name, the 5px volume
/// strip, their gaps and the row's padding.
const LANE_INSET: f64 = 197.;
/// Past this many passes the repeats are too narrow to draw one by one (an
/// hour of a short loop runs to thousands), so they show as one faded band
/// labelled with the count. A repeat narrower than this share of the lane
/// has no room for its own label.
const MAX_DRAWN_PASSES: usize = 32;
/// The share of the lane a pass needs for its own count label.
const LABELLED_PASS: f64 = 0.06;

/// Where the mix is, across every lane, in the green of the knob that
/// seeks it; hidden while it is stopped. It starts at the lane's left edge
/// (past the 168px label and 5px volume strip) and spans the lane's width.
const PLAYHEAD: &str = "absolute top-0 bottom-0 left-[calc(193px_+_var(--playhead,-1)_*_(100%_-_197px))] z-1 w-[2px] bg-synth-green opacity-[clamp(0,calc((var(--playhead,-1)_+_1)_*_1000),1)]";

/// A pass of a copy, its right edge parting it from the next.
const PASS: &str = "absolute top-0 bottom-0 rounded-[4px] border-r-2 border-r-screen";
/// A repeat count laid over a pass.
const COUNT: &str = "absolute top-1/2 -translate-1/2 rounded-[3px] bg-screen/70 px-[3px] text-[12px] leading-[15px] font-bold";

/// The timeline the lanes show: its span (beats), bar length, zoom and
/// where the window starts.
#[derive(Clone, Copy, PartialEq)]
struct Window {
  span: f64,
  bar_beats: u32,
  zoom: f64,
  from: f64,
}

/// The timeline the lanes show, from the bindings.
fn window() -> Window {
  modes::with(|bindings| {
    let screen = &bindings.screen;
    Window {
      span: screen.track_span,
      bar_beats: screen.bar_beats.max(1),
      zoom: screen.track_zoom,
      from: screen.track_from,
    }
  })
}

/// `beats` as a percentage of `span`, for CSS.
fn percent(beats: f64, span: f64) -> String {
  format!("{}%", number((beats / span) * 100.))
}

/// Each copy's passes: from its start (or its loop's left edge), back to
/// back, as many as it repeats that start before the end.
fn passes(clip: &TrackClip, span: f64) -> Vec<Vec<f64>> {
  clip
    .copies
    .iter()
    .map(|copy| {
      let mut passes = Vec::new();
      let mut at = copy.start + clip.offset;
      while clip.length > 0. && at < span && passes.len() < copy.repeats as usize {
        passes.push(at);
        at += clip.length;
      }
      passes
    })
    .collect()
}

/// What a lane draws: everything but its loop's edges, which stay put
/// while they're dragged.
#[derive(Clone, PartialEq)]
struct Drawing {
  clip: TrackClip,
  pattern: Option<TrackClip>,
  color: String,
  copy: Option<usize>,
  picks: bool,
  window: Window,
}

/// An empty span with `class` and `style`.
fn span_of(class: &str, style: String) -> Element {
  html! { span class={ class } style={ style } {} }
}

/// Picks copy `copy` of the track on row `index`, as the bindings do.
fn pick_copy(index: usize, copy: usize) {
  if let Some(pick) = &modes::current().screen.on_select_copy {
    pick.call((index, copy));
  }
}

/// A lane's drawing: each copy's passes, the notes in the track's colour, the
/// drum pattern over the take's, the picked copy outlined and a clip's
/// draggable edges.
fn drawing(index: usize, drawing: Drawing) -> DocumentFragment {
  let Drawing {
    clip,
    pattern,
    color,
    copy,
    picks,
    window,
  } = drawing;
  let span = window.span;
  let fragment = gloo_utils::document().create_document_fragment();
  let add = |element: Element| {
    let _ = fragment.append_child(&element);
  };
  let copies = passes(&clip, span);
  let labelled = clip.length / span >= LABELLED_PASS;
  let pitches: Vec<f64> = clip
    .notes
    .iter()
    .chain(pattern.iter().flat_map(|pattern| pattern.notes.iter()))
    .map(|note| f64::from(note.note))
    .collect();
  let mut low = pitches.iter().copied().fold(f64::INFINITY, f64::min);
  let mut high = pitches.iter().copied().fold(f64::NEG_INFINITY, f64::max);
  if high - low < 12. || pitches.is_empty() {
    let middle = (high + low) / 2.;
    low = middle - 6.;
    high = middle + 6.;
  }
  let top = |note: i32| {
    format!(
      "{}%",
      number(12. + (1. - (f64::from(note) - low) / (high - low)) * 70.)
    )
  };
  if let Some(pattern) = pattern.as_ref().filter(|pattern| pattern.length > 0.) {
    add(span_of(
      &format!(
        "{PASS} rounded-[3px] bg-transparent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-screen-ink)_22%,transparent)]"
      ),
      format!(
        "left: 0px; width: {};",
        percent(pattern.length.min(span), span)
      ),
    ));
    for note in pattern.notes.iter().filter(|note| note.start < span) {
      add(span_of(
        "absolute h-[3px] min-w-[2px] rounded-[1.5px] opacity-45",
        format!(
          "left: {}; width: {}; top: {}; background: {color};",
          percent(note.start, span),
          percent(note.length.min(span - note.start), span),
          top(note.note)
        ),
      ));
    }
  }
  let many = copies.len() > 1;
  for (copy_index, passes) in copies.iter().enumerate() {
    let banded = passes.len() > MAX_DRAWN_PASSES;
    let drawn = if banded { &passes[..1] } else { &passes[..] };
    let band_end = passes
      .last()
      .map_or(span, |last| span.min(last + clip.length));
    if picks && many && !passes.is_empty() {
      let hit = html! {
        span
        class="absolute top-0 bottom-0 z-1"
        style={ format!("left: {}; width: {};", percent(passes[0], span), percent(band_end - passes[0], span)) }
        @pointerdown={ move |_: PointerEvent| pick_copy(index, copy_index) }
        {}
      };
      add(hit);
    }
    for (pass, &at) in drawn.iter().enumerate() {
      let looped = clip.looped && copy_index == 0 && pass == 0;
      add(span_of(
        &if looped {
          format!("{PASS} shadow-[inset_0_0_0_1.5px_var(--color-synth-red)]")
        } else {
          PASS.to_owned()
        },
        format!(
          "left: {}; width: {}; background: color-mix(in srgb, {color} 12%, transparent);",
          percent(at, span),
          percent(clip.length.min(span - at), span)
        ),
      ));
    }
    for (pass, &at) in drawn.iter().enumerate() {
      for note in clip.notes.iter().filter(|note| at + note.start < span) {
        add(span_of(
          if pass > 0 {
            "absolute h-[3px] min-w-[2px] rounded-[1.5px] opacity-55"
          } else {
            "absolute h-[3px] min-w-[2px] rounded-[1.5px] opacity-95"
          },
          format!(
            "left: {}; width: {}; top: {}; background: {color};",
            percent(at + note.start, span),
            percent(
              note.length.min(clip.length - note.start).min(span - at),
              span
            ),
            top(note.note)
          ),
        ));
      }
    }
    if labelled && !banded {
      for (i, &at) in passes.iter().enumerate().skip(1) {
        let count = html! {
          span
          class={ COUNT }
          style={ format!("left: {}; color: {color};", percent(at + clip.length.min(span - at) / 2., span)) }
          { { format!("×{}", i + 1) } }
        };
        add(count);
      }
    }
    if banded {
      add(span_of(
        PASS,
        format!(
          "left: {}; width: {}; background: color-mix(in srgb, {color} 7%, transparent);",
          percent(passes[1], span),
          percent(band_end - passes[1], span)
        ),
      ));
      let count = html! {
        span
        class={ COUNT }
        style={ format!("left: {}; color: {color};", percent((passes[1] + band_end) / 2., span)) }
        { { format!("×{}", passes.len()) } }
      };
      add(count);
    }
  }
  if let Some(picked) = copy
    .filter(|_| many)
    .and_then(|copy| copies.get(copy))
    .filter(|picked| !picked.is_empty())
  {
    let last = picked[picked.len() - 1];
    add(span_of(
      "pointer-events-none absolute top-0 bottom-0 z-1 rounded-[4px] shadow-[inset_0_0_0_1.5px_var(--color-synth-blue)]",
      format!(
        "left: {}; width: {};",
        percent(picked[0], span),
        percent(span.min(last + clip.length) - picked[0], span)
      ),
    ));
  }
  fragment
}

/// An edge of a clip to drag along the lane, trimming it to a loop: an
/// unmarked grab area with a resize cursor. It reports where on the
/// timeline (beats) the pointer is.
fn loop_edge(
  index: usize,
  start: bool,
  track: fluid::Memo<Option<(ScreenTrack, Window)>>,
) -> Element {
  let left = move || {
    track.with(|track| {
      let Some((track, window)) = track else {
        return String::new();
      };
      let first = passes(&track.clip, window.span)
        .into_iter()
        .next()
        .and_then(|passes| passes.first().copied())
        .unwrap_or(0.);
      let at = if start {
        first
      } else {
        window.span.min(first + track.clip.length)
      };
      format!("left: {};", percent(at, window.span))
    })
  };
  let drag = |dragging: bool| {
    if let Some(drag) = &modes::current().screen.on_loop_edge_drag {
      drag.call(dragging);
    }
  };
  html! {
    span
    class="absolute top-0 bottom-0 z-1 w-[12px] -translate-x-1/2 cursor-ew-resize touch-none"
    style={ move || left() }
    @pointerdown={ move |event: PointerEvent| {
      event.stop_propagation();
      event.prevent_default();
      if let Some(target) = event.current_target().and_then(|target| target.dyn_into::<Element>().ok()) {
        let _ = target.set_pointer_capture(event.pointer_id());
      }
      drag(true);
    } }
    @pointermove={ move |event: PointerEvent| {
      let Some(target) = event.current_target().and_then(|target| target.dyn_into::<Element>().ok()) else {
        return;
      };
      if !target.has_pointer_capture(event.pointer_id()) {
        return;
      }
      let Some(lane) = target.parent_element() else {
        return;
      };
      let rect = lane.get_bounding_client_rect();
      let span = fluid::untrack(window).span;
      let beats = ((f64::from(event.client_x()) - rect.left()) / rect.width()).clamp(0., 1.) * span;
      if let Some(on_edge) = &modes::current().screen.on_loop_edge {
        on_edge.call((index, start, beats));
      }
    } }
    @pointerup={ |event: PointerEvent| {
      if let Some(target) = event.current_target().and_then(|target| target.dyn_into::<Element>().ok()) {
        let _ = target.release_pointer_capture(event.pointer_id());
      }
    } }
    @lostpointercapture={ move |_: PointerEvent| drag(false) }
    {}
  }
}

/// A row of the tracks: its name, what plays it, its volume, mute and solo, and
/// its lane.
fn row(index: usize) -> Element {
  let track = fluid::create_memo(move || {
    let window = window();
    modes::with(|bindings| bindings.screen.tracks.get(index).cloned()).map(|track| (track, window))
  });
  let selected =
    fluid::create_memo(move || modes::with(|bindings| bindings.screen.selected == index));
  let read = {
    let track = track.clone();
    move |f: &dyn Fn(&ScreenTrack) -> String| {
      track.with(|track| track.as_ref().map_or(String::new(), |(track, _)| f(track)))
    }
  };
  let label = {
    let read = read.clone();
    move || {
      read(&|track| {
        if track.potential {
          format!("{}, take", track.name)
        } else {
          format!(
            "{}, {}, volume {}%{}{}{}",
            track.name,
            track.detail,
            number(round(track.volume * 100.)),
            if track.muted { ", muted" } else { "" },
            if track.soloed { ", solo" } else { "" },
            if track.clip.copies.len() > 1 {
              format!(", {} copies", track.clip.copies.len())
            } else {
              String::new()
            }
          )
        }
      })
    }
  };
  let heading = {
    let track = track.clone();
    fluid::show(
      move || {
        track.with(|track| {
          track.as_ref().map(|(track, _)| {
            (
              track.name.clone(),
              track.potential,
              track.muted,
              track.soloed,
            )
          })
        })
      },
      move |heading| {
        let (name, potential, muted, soloed) = heading?;
        let mark: Element = if potential {
          let svg = Icon::Device("Take").markup().replacen(
            "<svg ",
            r#"<svg class="mr-[5px] inline-block size-[13px] align-[-2px] text-screen-ink/55" "#,
            1,
          );
          markup(&svg).first_element_child()?
        } else {
          html! { span class="mr-[5px] text-screen-ink/55" { { format!("#{index}") } } }
        };
        let flag = |on: bool, letter: &str| {
          let class = if on {
            "grid size-[18px] place-items-center rounded-[4px] border border-screen-ink bg-screen-ink text-[12px] leading-none font-bold text-screen"
          } else {
            "grid size-[18px] place-items-center rounded-[4px] border border-screen-ink/30 text-[12px] leading-none font-bold text-screen-ink/55"
          };
          html! { span class={ class } { { letter.to_owned() } } }
        };
        let flags = (!potential).then(|| {
          html! {
            span class="flex gap-[3px] self-center" {
              { flag(muted, "M") }
              { flag(soloed, "S") }
            }
          }
        });
        Some(html! {
          span class="flex min-w-0 items-center justify-between gap-[6px] text-left" aria-hidden="true" {
            span class="truncate text-[12px] leading-[15px] font-semibold tracking-[0.02em] first-letter:uppercase" {
              { mark }
              { name }
            }
            { flags }
          }
        })
      },
    )
  };
  let volume = {
    let track = track.clone();
    fluid::show(
      move || {
        track.with(|track| {
          track
            .as_ref()
            .map(|(track, _)| (track.potential, track.volume.to_bits()))
        })
      },
      |strip| {
        let (potential, volume) = strip?;
        let volume = f64::from_bits(volume);
        Some(if potential {
          html! { span class="relative overflow-hidden rounded-[3px] bg-transparent" aria-hidden="true" {} }
        } else {
          html! {
            span class="relative overflow-hidden rounded-[3px] bg-screen-ink/12" aria-hidden="true" {
              span class="absolute inset-x-0 bottom-0 rounded-[3px] bg-synth-red" style={ format!("height: {}%;", number(volume * 100.)) } {}
            }
          }
        })
      },
    )
  };
  let quiet = {
    let track = track.clone();
    move || {
      if track.with(|track| track.as_ref().is_some_and(|(track, _)| track.audible)) {
        "relative overflow-hidden rounded-[4px]"
      } else {
        "relative overflow-hidden rounded-[4px] opacity-30"
      }
    }
  };
  let bars = {
    let track = track.clone();
    move || {
      track.with(|track| {
        track.as_ref().map_or(String::new(), |(_, window)| {
          format!(
            "--bars: {};",
            number(window.span / f64::from(window.bar_beats))
          )
        })
      })
    }
  };
  let drawn = {
    let track = track.clone();
    fluid::show(
      move || {
        let picks = modes::with(|bindings| bindings.screen.on_select_copy.is_some());
        track.with(|track| {
          track.as_ref().map(|(track, window)| Drawing {
            clip: track.clip.clone(),
            pattern: track.pattern.clone(),
            color: track.color.clone(),
            copy: track.copy,
            picks: picks && !track.potential,
            window: *window,
          })
        })
      },
      move |drawn| drawn.map(|drawn| drawing(index, drawn)),
    )
  };
  let edges = {
    let (track, edge_track) = (track.clone(), track.clone());
    fluid::show(
      move || {
        let edges = modes::with(|bindings| bindings.screen.on_loop_edge.is_some());
        track.with(|track| {
          track.as_ref().is_some_and(|(track, window)| {
            edges
              && !track.potential
              && track.clip.looped
              && track.clip.length > 0.
              && passes(&track.clip, window.span)
                .first()
                .is_some_and(|first| !first.is_empty())
          })
        })
      },
      move |shown| {
        shown.then(|| {
          let fragment = gloo_utils::document().create_document_fragment();
          let _ = fragment.append_child(&loop_edge(index, true, edge_track.clone()));
          let _ = fragment.append_child(&loop_edge(index, false, edge_track.clone()));
          fragment
        })
      },
    )
  };
  let copies = {
    let track = track.clone();
    fluid::show(
      move || {
        track.with(|track| {
          track
            .as_ref()
            .map_or(0, |(track, _)| track.clip.copies.len())
        })
      },
      |count| {
        (count > 1).then(|| {
          html! {
            span
            class="absolute top-1/2 right-0 z-2 translate-x-1/2 -translate-y-1/2 rounded-[3px] bg-screen px-[3px] text-[11px] leading-[13px] font-bold text-screen-ink/55 group-aria-pressed:text-synth-blue"
            aria-hidden="true"
            { { format!("×{count}") } }
          }
        })
      },
    )
  };
  let potential = {
    let track = track.clone();
    move || {
      track
        .with(|track| track.as_ref().is_some_and(|(track, _)| track.potential))
        .then_some("true")
    }
  };
  html! {
    button
    type="button"
    class="group relative grid min-h-0 cursor-pointer grid-cols-[168px_5px_minmax(0,1fr)] items-stretch justify-center gap-[8px] rounded-[6px] border border-transparent px-[4px] py-[3px] text-center text-screen-ink select-none aria-pressed:border-synth-blue focus-visible:border-screen-ink focus-visible:ring-2 focus-visible:ring-font-light focus-visible:ring-offset-2 focus-visible:outline-none aria-pressed:focus-visible:border-screen-ink"
    aria-label={ move || label() }
    aria-pressed={ move || if *selected.get() { "true" } else { "false" } }
    data-potential={ move || potential() }
    @mousedown.prevent={ |_| blur_active() }
    @click={ move |_| {
      if let Some(on_select) = &modes::current().screen.on_select {
        on_select.call(index);
      }
    } }
    {
      { heading }
      { volume }
      span class={ move || quiet() } aria-hidden="true" {
        span
        class="absolute top-0 bottom-0 left-[calc(var(--from,0)*var(--zoom,1)*-100%)] w-[calc(var(--zoom,1)*100%)] bg-[linear-gradient(to_right,color-mix(in_srgb,var(--color-screen-ink)_12%,transparent)_1px,transparent_1px)] bg-size-[calc(100%/var(--bars))_100%]"
        style={ move || bars() }
        {
          { drawn }
          { edges }
        }
      }
      { copies }
    }
  }
}

/// The tracks view: the rows in view around the picked one, the playhead across
/// them, and the lanes' wheel and drag panning the timeline.
pub fn tracks() -> Element {
  let top = Rc::new(Cell::new(0usize));
  let shown = fluid::create_memo(move || {
    modes::with(|bindings| {
      let screen = &bindings.screen;
      let count = screen.tracks.len();
      let selected = screen.selected;
      let at = count.saturating_sub(TRACKS_SHOWN).min(
        (selected + 1)
          .saturating_sub(TRACKS_SHOWN)
          .max(selected.min(top.get())),
      );
      top.set(at);
      (at..(at + TRACKS_SHOWN).min(count))
        .map(|index| (index, screen.tracks[index].id.clone()))
        .collect::<Vec<_>>()
    })
  });
  let empty = {
    let shown = shown.clone();
    fluid::show(
      move || shown.with(Vec::is_empty),
      |empty| {
        empty.then(|| {
          html! {
            span class="row-span-full self-center justify-self-center text-[14px] leading-[18px] tracking-[0.08em] text-screen-ink/55 first-letter:uppercase" {
              "Save a take in record mode to add a track"
            }
          }
        })
      },
    )
  };
  let rows = fluid::each(
    move || shown.cloned(),
    Clone::clone,
    |(index, _)| row(index),
  );
  let travel = Rc::new(Cell::new(0f64));
  let list = html! {
    div
    class="absolute top-[30px] right-[20px] bottom-[30px] left-[20px] m-0 grid grid-rows-4 gap-[4px] font-screen"
    role="group"
    aria-label="Tracks"
    style={ move || {
      let window = window();
      format!("--zoom: {}; --from: {};", number(window.zoom), number(window.from / window.span))
    } }
    @wheel.nonpassive.prevent={ move |event: WheelEvent| {
      let Some(element) = event.current_target().and_then(|target| target.dyn_into::<Element>().ok()) else {
        return;
      };
      let bindings = modes::current();
      let screen = &bindings.screen;
      if event.delta_x().abs() > event.delta_y().abs() {
        let pixels = wheel_pixels(&event, event.delta_x(), f64::from(element.client_width()));
        let lanes = f64::from(element.client_width()) - LANE_INSET;
        if lanes > 0.
          && let Some(pan) = &screen.on_pan_tracks
        {
          pan.call((pixels / lanes) * (screen.track_span / screen.track_zoom));
        }
        return;
      }
      if event.delta_y() == 0. {
        return;
      }
      let Some(on_select) = &screen.on_select else {
        return;
      };
      let pixels = wheel_pixels(&event, event.delta_y(), f64::from(element.client_height()));
      // Turning back drops what was left over the other way.
      if pixels.signum() != travel.get().signum() || travel.get() == 0. {
        travel.set(0.);
      }
      travel.set(travel.get() + pixels);
      let tracks = (travel.get() / WHEEL_PER_TRACK).trunc();
      if tracks == 0. {
        return;
      }
      travel.set(travel.get() - tracks * WHEEL_PER_TRACK);
      let last = screen.tracks.len().saturating_sub(1) as i64;
      on_select.call((screen.selected as i64 + tracks as i64).clamp(0, last.max(0)) as usize);
    } }
    {
      { empty }
      { rows }
      span class={ PLAYHEAD } aria-hidden="true" {}
    }
  };
  if let Some(element) = list.dyn_ref::<HtmlElement>().cloned() {
    animate(move |_| {
      let window = fluid::untrack(window);
      let shown = app()
        .mix
        .track_position()
        .map_or(-1., |at| ((at - window.from) / window.span) * window.zoom);
      let playhead = if !(0. ..=1.).contains(&shown) {
        -1.
      } else {
        shown
      };
      let _ = element
        .style()
        .set_property("--playhead", &number(playhead));
    });
  }
  list
}
