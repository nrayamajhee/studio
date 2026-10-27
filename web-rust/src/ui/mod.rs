//! The page, built with fluid's `html!` as web-react's home route lays it
//! out. Each part is a function returning its element, placed in its
//! parent's `html!` as a child (`{ pads() }`). The [`Device`] is shared
//! through fluid's context as a `&'static` reference, so closures capture it
//! without cloning.
//!
//! Styling is Tailwind only, built by Trunk from `src/tailwind.css`, which
//! scans these sources for class names: write every class out whole, never
//! pieced together from parts.

mod corner;
mod grille;
mod keybed;
mod knob;
mod pads;
mod screen;
mod sky;

use fluid_macro::html;
use wasm_bindgen::JsCast;
use web_sys::{DocumentFragment, Element, HtmlElement, HtmlTemplateElement};

use crate::device::{Device, KNOB_STEPS, device};
use knob::{Knob, knob};

pub fn page() -> Element {
  html! {
    div class="relative h-dvh w-full overflow-hidden select-none" {
      { sky::sky() }
      main class="absolute inset-0 z-10 py-20" { { synth() } }
      { footer() }
      { corner::corner() }
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
  let device = device();
  let [chalk, green, red, blue] = knobs(device);
  html! {
    div class="grid size-full place-items-center px-[clamp(calc(var(--spacing-bezel)_/_2),4.5vw,calc(2_*_var(--spacing-bezel)))] [--screen-aspect:2.39] [container-type:size]" {
      div class="relative h-[calc(var(--device-height)_*_var(--scale))] w-[calc(1001px_*_var(--scale))] [--device-height:calc(621px_/_var(--screen-aspect)_+_517px)] [--scale:min(1,tan(atan2(100cqw,1001px)),tan(atan2(100cqh,var(--device-height))))]" {
        div
        role="group"
        aria-label="Synthesizer"
        class="absolute top-0 left-0 flex h-(--device-height) w-[1001px] origin-top-left scale-(--scale) flex-col gap-inset overflow-clip rounded-[88px] bg-device p-bezel shadow-device select-none [corner-shape:squircle]"
        // Browsers keep audio off until a gesture; any on the Device starts it.
        @pointerup={ move |_| device.sound.unlock() }
        {
          div class="grid h-[calc(621px_/_var(--screen-aspect)_-_var(--spacing-bezel)_+_var(--spacing-inset))] grid-cols-[91px_45px_621px_45px_91px] gap-x-inset" {
            div class="-mt-bezel -mb-inset flex flex-col items-start justify-evenly [--knob-size:81.6px]" {
              { knob(chalk) }
              { knob(green) }
            }
            { grille::grille() }
            { screen::screen() }
            { grille::grille() }
            div class="-mt-bezel -mb-inset flex flex-col items-end justify-evenly [--knob-size:81.6px]" {
              { knob(red) }
              { knob(blue) }
            }
          }
          { pads::pads() }
          { keybed::keybed() }
        }
      }
    }
  }
}

/// The main view's knobs: white sets the volume, green picks a parameter,
/// red sets the level and blue the parameter's value.
fn knobs(device: &'static Device) -> [Knob; 4] {
  [
    Knob {
      colour: "var(--color-synth-chalk)",
      mark: "#141413",
      label: Box::new(move || format!("Volume: {}%", device.volume.value() * 10)),
      step: Box::new(move || (device.volume.value(), KNOB_STEPS)),
      set: Box::new(move |step| device.set_volume(step)),
    },
    Knob {
      colour: "var(--color-synth-green)",
      mark: "#ffffff",
      label: Box::new(move || format!("Parameter: {}", device.param().0.name)),
      step: Box::new(move || (device.selected.value(), device.current().params.len())),
      set: Box::new(move |step| device.selected.set(step)),
    },
    Knob {
      colour: "var(--color-synth-red)",
      mark: "#ffffff",
      label: Box::new(move || format!("Level: {}%", device.level.value() * 10)),
      step: Box::new(move || (device.level.value(), KNOB_STEPS)),
      set: Box::new(move |step| device.set_level(step)),
    },
    Knob {
      colour: "var(--color-synth-blue)",
      mark: "#ffffff",
      label: Box::new(move || {
        let (param, step) = device.param();
        format!("Value: {} {}", param.name, param.values[step])
      }),
      step: Box::new(move || {
        let (param, step) = device.param();
        (step, param.values.len())
      }),
      set: Box::new(move |step| device.set_value(step)),
    },
  ]
}

const LINK: &str =
  "font-medium underline decoration-current/40 underline-offset-4 hover:decoration-current";

fn footer() -> Element {
  html! {
    footer class="absolute inset-x-0 bottom-6 z-10 flex items-end justify-between gap-4 px-6 text-sm text-sky-ink select-text sm:px-8" {
      span {
        "A quiet place for loud ideas by "
        br class="sm:hidden" {}
        a class={ LINK } href="https://nishan.rayamajhee.com/" target="_blank" rel="noopener noreferrer" { "Nishan Rayamajhee" }
        " | "
        a class={ LINK } href="https://github.com/nrayamajhee/studio/tree/main/docs" target="_blank" rel="noopener noreferrer" { "Docs" }
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
pub fn apply_theme(device: &'static Device) {
  fluid::create_effect(move || {
    let dark = device.theme.value().is_dark(device.system_dark.value());
    if let Some(root) = gloo_utils::document().document_element() {
      let _ = root.class_list().toggle_with_force("dark", dark);
    }
  });
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
