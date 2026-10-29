//! The page, built with fluid's `html!` as web-react's home route lays it
//! out. Each part is a function returning its element, placed in its
//! parent's `html!` as a child (`{ pads() }`). They reach the Device's
//! state through [`app`], a `&'static` reference, so closures capture it
//! without cloning.
//!
//! Styling is Tailwind only, built by Trunk from `src/tailwind.css`, which
//! scans these sources for class names: write every class out whole, never
//! pieced together from parts.

mod corner;
pub mod debug;
pub mod docs;
pub mod focus;
mod grille;
pub mod keybed;
mod knob;
mod midi;
pub mod pads;
mod screen;
mod sky;

use fluid_macro::html;
use wasm_bindgen::JsCast;
use web_sys::{DocumentFragment, Element, HtmlElement, HtmlTemplateElement};

use crate::chrome::{Chrome, chrome};
use crate::modes::Knob;
use crate::state::app;
use knob::knob;

/// The home page: the Device on the sky, the footer, the corner buttons and
/// the Debug panel.
pub fn page() -> Element {
  let chrome = chrome();
  // Leaving the page lets go of every key, as web-react's unmount does.
  fluid::on_cleanup(move || {
    let a = app();
    a.hotkeys.release_all();
    a.performance.release_all();
  });
  html! {
    div class="relative h-dvh w-full overflow-hidden select-none" {
      { sky::sky() }
      main class="absolute inset-0 z-10 py-20" { { synth() } }
      { footer() }
      { corner::corner() }
      if |chrome| chrome.debug.value() { { debug::overlay() } }
      if |chrome| chrome.midi.value() { { midi::panel() } }
    }
  }
}

/// The Device at its native size (1001px wide; the screen's height at
/// --screen-aspect plus 517px of bezels, pad rows, insets and key well, less
/// the 21px the screen reaches up into the bezel), scaled to fit its stage
/// by CSS alone: tan(atan2(a, b)) divides two lengths into a plain number.
/// The screen sits over the middle eight pad columns, a grille either side
/// of it and the knob pairs out past them, lined up with the pads' edges.
fn synth() -> Element {
  let a = app();
  // It freezes, inert, while the mix saves.
  let busy = fluid::create_memo(move || a.feedback.progress.with(Option::is_some));
  let (busy_aria, busy_inert) = (busy.clone(), busy);
  html! {
    div class="grid size-full place-items-center px-[clamp(calc(var(--spacing-bezel)_/_2),4.5vw,calc(2_*_var(--spacing-bezel)))] [--screen-aspect:2.39] [container-type:size]" {
      div class="relative h-[calc(var(--device-height)_*_var(--scale))] w-[calc(1001px_*_var(--scale))] [--device-height:calc(621px_/_var(--screen-aspect)_+_517px)] [--scale:min(1,tan(atan2(100cqw,1001px)),tan(atan2(100cqh,var(--device-height))))]" {
        div
        role="group"
        aria-label="Synthesizer"
        aria-busy={ move || if busy_aria.value() { "true" } else { "false" } }
        inert={ move || busy_inert.value() }
        class="absolute top-0 left-0 flex h-(--device-height) w-[1001px] origin-top-left scale-(--scale) flex-col gap-inset overflow-clip rounded-[88px] bg-device p-bezel shadow-device select-none [corner-shape:squircle]"
        // Browsers keep audio off until a gesture; any on the Device starts it.
        @pointerup={ move |_| a.engine.unlock() }
        {
          div class="grid h-[calc(621px_/_var(--screen-aspect)_-_var(--spacing-bezel)_+_var(--spacing-inset))] grid-cols-[91px_45px_621px_45px_91px] gap-x-inset" {
            div class="-mt-bezel -mb-inset flex flex-col items-start justify-evenly [--knob-size:81.6px]" {
              { knob(Knob::Chalk) }
              { knob(Knob::Green) }
            }
            { grille::grille() }
            { screen::screen() }
            { grille::grille() }
            div class="-mt-bezel -mb-inset flex flex-col items-end justify-evenly [--knob-size:81.6px]" {
              { knob(Knob::Red) }
              { knob(Knob::Blue) }
            }
          }
          { pads::pads() }
          { keybed::keybed() }
        }
      }
    }
  }
}

/// A footer link: plain, underlined.
const LINK: &str =
  "font-medium underline decoration-current/40 underline-offset-4 hover:decoration-current";

/// The home page's footer: the credit, Docs, Rust docs and the Debug toggle.
fn footer() -> Element {
  let chrome = chrome();
  html! {
    footer class="absolute inset-x-0 bottom-6 z-10 flex items-end justify-between gap-4 px-6 text-sm text-sky-ink select-text sm:px-8" {
      span {
        "A quiet place for loud ideas by "
        br class="sm:hidden" {}
        a class={ LINK } href="https://nishan.rayamajhee.com/" target="_blank" rel="noopener noreferrer" { "Nishan Rayamajhee" }
        " | "
        a class={ LINK } href="/docs" { "Docs" }
        " | "
        // rustdoc's pages, not one of the app's: the link loads them.
        a class={ LINK } href="/rust-doc/" { "Rust docs" }
        " | "
        button
        class="cursor-pointer font-medium underline decoration-current/40 underline-offset-4 hover:decoration-current"
        aria-expanded={ move || chrome.debug.value().to_string() }
        @click={ move |_| chrome.toggle_debug() }
        {
          span { "Debug" }
        }
      }
      span class="shrink-0 whitespace-nowrap" {
        a class={ LINK } href="https://github.com/nrayamajhee/studio" target="_blank" rel="noopener noreferrer" { "GitHub" }
        " | "
        a class={ LINK } href="https://buymeacoffee.com/nrayamajhee" target="_blank" rel="noopener noreferrer" { "Buy me a coffee!" }
      }
    }
  }
}

/// Puts `.dark` on the root element while the theme is dark; the theme
/// tokens cross-fade the Device's colours from it.
pub fn apply_theme(chrome: &'static Chrome) {
  fluid::create_effect(move || {
    let dark = chrome.theme.value().is_dark(chrome.system_dark.value());
    if let Some(root) = gloo_utils::document().document_element() {
      let _ = root.class_list().toggle_with_force("dark", dark);
    }
  });
}

/// A lucide icon (`icons::*`, its name and inner markup) as web-react renders
/// it, with `class` after lucide's own.
pub fn icon((name, paths): (&str, &str), class: &str) -> DocumentFragment {
  markup(&format!(
    r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-{name} {class}" aria-hidden="true">{paths}</svg>"#
  ))
}

/// ⌘ on a Mac, Ctrl elsewhere, as web-react's keycaps show it.
pub fn is_mac() -> bool {
  gloo_utils::window()
    .navigator()
    .platform()
    .is_ok_and(|platform| {
      ["Mac", "iPhone", "iPad"]
        .iter()
        .any(|name| platform.contains(name))
    })
}

/// Trusted markup (the icons web-react renders, a note's name) as nodes, to
/// place as an `html!` child without a wrapper.
pub fn markup(html: &str) -> DocumentFragment {
  let template: HtmlTemplateElement = gloo_utils::document()
    .create_element("template")
    .expect("a template element")
    .unchecked_into();
  template.set_inner_html(html);
  template.content()
}

/// A pointer press must not leave a control focused: Space or Return would
/// then press it again natively, and Space is the Device's Play key. Bound
/// with `@mousedown.prevent`.
pub fn blur_active() {
  if let Some(active) = gloo_utils::document().active_element()
    && let Some(active) = active.dyn_ref::<HtmlElement>()
  {
    let _ = active.blur();
  }
}
