//! The page, built with fluid's `html!` as web-react's home route lays it
//! out. Each part is built once; effects (`#{ |signals| ... }`) update only
//! the attributes and text bound to the signals they name.
//!
//! `html!` makes HTML elements but can't take one as a child, so a part
//! with child parts appends them itself, and SVG goes in through
//! `set_inner_html`. Its attribute names are Rust identifiers, so hyphenated
//! ones (`aria-label`) are set with `set_attribute`.
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

use std::rc::Rc;

use fluid::Context;
use fluid_macro::html;
use wasm_bindgen::prelude::*;
use web_sys::Element;

use crate::device::{Device, KNOB_STEPS};
use knob::{Knob, knob};

pub fn page(ctx: &Context, device: &Rc<Device>) -> Result<Element, JsValue> {
  let page = html! { div class="relative h-dvh w-full overflow-hidden select-none" {} };
  let main = html! { main class="absolute inset-0 z-10 py-20" {} };
  append(&main, [synth(ctx, device)?])?;
  append(
    &page,
    [sky::sky()?, main, footer()?, corner::corner(ctx, device)?],
  )?;
  Ok(page)
}

/// The Device at its native size (1001px wide; the screen's height at
/// --screen-aspect plus 517px of bezels, pad rows, insets and key well, less
/// the 21px the screen reaches up into the bezel), scaled to fit its stage
/// by CSS alone: tan(atan2(a, b)) divides two lengths into a plain number.
fn synth(ctx: &Context, device: &Rc<Device>) -> Result<Element, JsValue> {
  let stage = html! {
    div class="grid size-full place-items-center px-[clamp(calc(var(--spacing-bezel)_/_2),4.5vw,calc(2_*_var(--spacing-bezel)))] [--screen-aspect:2.39] [container-type:size]" {}
  };
  let frame = html! {
    div class="relative h-[calc(var(--device-height)_*_var(--scale))] w-[calc(1001px_*_var(--scale))] [--device-height:calc(621px_/_var(--screen-aspect)_+_517px)] [--scale:min(1,tan(atan2(100cqw,1001px)),tan(atan2(100cqh,var(--device-height))))]" {}
  };
  let body = html! {
    div role="group" class="absolute top-0 left-0 flex h-(--device-height) w-[1001px] origin-top-left scale-(--scale) flex-col gap-inset overflow-clip rounded-[88px] bg-device p-bezel shadow-device select-none [corner-shape:squircle]" {}
  };
  body.set_attribute("aria-label", "Synthesizer")?;

  // The screen over the middle eight pad columns, a grille either side of it
  // and the knob pairs out past them, lined up with the pads' outer edges.
  let top = html! {
    div class="grid h-[calc(621px_/_var(--screen-aspect)_-_var(--spacing-bezel)_+_var(--spacing-inset))] grid-cols-[91px_45px_621px_45px_91px] gap-x-inset" {}
  };
  let left = html! { div class="-mt-bezel -mb-inset flex flex-col items-start justify-evenly [--knob-size:81.6px]" {} };
  let right = html! { div class="-mt-bezel -mb-inset flex flex-col items-end justify-evenly [--knob-size:81.6px]" {} };
  let [chalk, green, red, blue] = knobs(device);
  append(&left, [knob(ctx, chalk)?, knob(ctx, green)?])?;
  append(&right, [knob(ctx, red)?, knob(ctx, blue)?])?;
  append(
    &top,
    [
      left,
      grille::grille()?,
      screen::screen(ctx, device)?,
      grille::grille()?,
      right,
    ],
  )?;
  append(
    &body,
    [top, pads::pads(ctx, device)?, keybed::keybed(ctx, device)?],
  )?;
  append(&frame, [body])?;
  append(&stage, [frame])?;
  Ok(stage)
}

/// The main view's knobs: white sets the volume, green picks a parameter,
/// red sets the level and blue the parameter's value.
fn knobs(device: &Rc<Device>) -> [Knob; 4] {
  let (volume, set_volume) = (device.clone(), device.clone());
  let (picked, pick, pick_label) = (device.clone(), device.clone(), device.clone());
  let (level, set_level) = (device.clone(), device.clone());
  let (value, set_value, value_label) = (device.clone(), device.clone(), device.clone());
  [
    Knob {
      colour: "var(--color-synth-chalk)",
      mark: "#141413",
      label: Box::new(move || format!("Volume: {}%", *volume.volume.get() * 10)),
      step: Box::new({
        let device = device.clone();
        move || (*device.volume.get(), KNOB_STEPS)
      }),
      set: Box::new(move |step| set_volume.set_volume(step)),
    },
    Knob {
      colour: "var(--color-synth-green)",
      mark: "#ffffff",
      label: Box::new(move || format!("Parameter: {}", pick_label.param().0.name)),
      step: Box::new(move || (*picked.selected.get(), picked.current().params.len())),
      set: Box::new(move |step| pick.selected.set(step)),
    },
    Knob {
      colour: "var(--color-synth-red)",
      mark: "#ffffff",
      label: Box::new({
        let device = device.clone();
        move || format!("Level: {}%", *device.level.get() * 10)
      }),
      step: Box::new(move || (*level.level.get(), KNOB_STEPS)),
      set: Box::new(move |step| set_level.set_level(step)),
    },
    Knob {
      colour: "var(--color-synth-blue)",
      mark: "#ffffff",
      label: Box::new(move || {
        let (param, step) = value_label.param();
        format!("Value: {} {}", param.name, param.values[step])
      }),
      step: Box::new(move || {
        let (param, step) = value.param();
        (step, param.values.len())
      }),
      set: Box::new(move |step| set_value.set_value(step)),
    },
  ]
}

const LINK: &str =
  "font-medium underline decoration-current/40 underline-offset-4 hover:decoration-current";

fn footer() -> Result<Element, JsValue> {
  let footer = html! {
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
  };
  Ok(footer)
}

fn append(parent: &Element, children: impl IntoIterator<Item = Element>) -> Result<(), JsValue> {
  for child in children {
    parent.append_child(&child)?;
  }
  Ok(())
}

/// Puts `.dark` on the root element while the theme is dark; the theme
/// tokens cross-fade the Device's colours from it.
pub fn apply_theme(ctx: &Context, device: &Rc<Device>) {
  let theme = device.theme.clone();
  let system_dark = device.system_dark.clone();
  ctx.create_effect(move || {
    let dark = theme.get().is_dark(*system_dark.get());
    if let Some(root) = gloo_utils::document().document_element() {
      let _ = root.class_list().toggle_with_force("dark", dark);
    }
  });
}

/// A pointer press must not leave a control focused: Space or Return would
/// then press it again natively, and Space is the Device's Play key.
pub fn keep_focus(element: &Element) {
  fluid::add_event_and_forget(element, "mousedown", |event| {
    event.prevent_default();
    if let Some(active) = gloo_utils::document().active_element()
      && let Some(active) = active.dyn_ref::<web_sys::HtmlElement>()
    {
      let _ = active.blur();
    }
  });
}
