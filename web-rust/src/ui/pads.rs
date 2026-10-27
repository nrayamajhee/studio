//! The three rows of twelve pads, as web-react's `Pad`: a keycap legend in
//! the top-right corner, an LED top-left on the pads with a state to show,
//! pressed in while held from the pointer or its key.

use std::rc::Rc;

use fluid::{Context, add_event_and_forget};
use fluid_macro::html;
use wasm_bindgen::prelude::*;
use web_sys::{Element, PointerEvent};

use super::keep_focus;
use crate::device::Device;
use crate::icons;
use crate::input::press_pad;
use crate::pads::{CHORDS, Job, PADS, Pad};
use crate::presets::PRESETS;

const PAD: &str = "relative inline-flex size-[68px] cursor-pointer touch-manipulation items-center justify-center rounded-[12px] bg-pad text-center text-pad-ink shadow-pad select-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#2f7de1] focus-visible:outline-solid";
const PAD_HELD: &str = "relative inline-flex size-[68px] cursor-pointer touch-manipulation items-center justify-center rounded-[12px] bg-pad-held text-center text-pad-ink shadow-pad-held select-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#2f7de1] focus-visible:outline-solid";
const PAD_LIT: &str = "relative inline-flex size-[68px] cursor-pointer touch-manipulation items-center justify-center rounded-[12px] bg-(--pad-accent) text-center text-white shadow-pad-lit select-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#2f7de1] focus-visible:outline-solid";
const PAD_LIT_HELD: &str = "relative inline-flex size-[68px] cursor-pointer touch-manipulation items-center justify-center rounded-[12px] bg-[color-mix(in_srgb,var(--pad-accent),#000000_12%)] text-center text-white shadow-pad-lit-held select-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#2f7de1] focus-visible:outline-solid";
const LED: &str = "absolute top-[9px] left-[9px] size-[7px] rounded-[50%] bg-current/25";
const LED_ON: &str = "absolute top-[9px] left-[9px] size-[7px] rounded-[50%] bg-(--pad-accent) shadow-[0_0_6px_var(--pad-accent)]";
const HOTKEY: &str = "absolute top-[6px] right-[6px] grid h-[13px] min-w-[13px] place-items-center rounded-[4px] border border-current/35 px-[3px] text-[8px] leading-none font-semibold [font-family:inherit]";
const FACE: &str = "grid place-items-center text-[15px] leading-none font-bold tracking-[0.01em] [&_svg]:size-[22px]";

pub fn pads(ctx: &Context, device: &Rc<Device>) -> Result<Element, JsValue> {
  let grid = html! { div role="group" class="grid grid-cols-[repeat(12,68px)] gap-inset" {} };
  grid.set_attribute("aria-label", "Pads")?;
  let pads = PADS
    .iter()
    .enumerate()
    .map(|(index, spec)| pad(ctx, device, index, spec));
  super::append(&grid, pads.collect::<Result<Vec<_>, _>>()?)?;
  Ok(grid)
}

/// ⌘ on a Mac, Ctrl elsewhere, as the Save pad's legend shows.
fn command_legend() -> &'static str {
  let mac = gloo_utils::window()
    .navigator()
    .platform()
    .is_ok_and(|platform| platform.starts_with("Mac"));
  if mac { "⌘S" } else { "Ctrl S" }
}

fn pad(
  ctx: &Context,
  device: &Rc<Device>,
  index: usize,
  spec: &'static Pad,
) -> Result<Element, JsValue> {
  let held_pads = device.held_pads.clone();
  let shift_key = device.shift_key.clone();
  let latched = device.latched.clone();
  let chord_key = device.chord_key.clone();
  let latched_chord = device.latched_chord.clone();
  let is_shift = spec.job == Job::Shift;
  let legend = spec.legend.unwrap_or_else(command_legend);
  let style = format!("--pad-accent:{}", spec.accent);
  let element = html! {
    button
    class=#{ |held_pads, shift_key, latched, chord_key, latched_chord| {
      let held = held_pads.get().contains(&index) || (is_shift && (*shift_key.get() || *latched.get()));
      let active = chord_key.get().or(*latched_chord.get());
      let lit = matches!(spec.job, Job::Chord(chord) if active == Some(chord));
      match (lit, held) {
        (true, true) => PAD_LIT_HELD,
        (true, false) => PAD_LIT,
        (false, true) => PAD_HELD,
        (false, false) => PAD,
      }
    } }
    style={ &style }
    {
      kbd class={ HOTKEY } { { legend } }
      span class={ FACE } {}
    }
  };
  element.set_attribute("aria-keyshortcuts", legend)?;
  if let Some(face) = element.last_element_child() {
    face.set_attribute("aria-hidden", "true")?;
    face.set_inner_html(icons::PADS[index]);
  }
  if let Some(kbd) = element.first_element_child() {
    kbd.set_attribute("aria-hidden", "true")?;
  }

  if spec.led {
    let preset = device.preset.clone();
    let led = html! {
      span class=#{ |preset| if spec.job == Job::Preset(*preset.get()) { LED_ON } else { LED } } {}
    };
    led.set_attribute("aria-hidden", "true")?;
    element.insert_before(&led, element.first_child().as_ref())?;
  }

  let label = {
    let element = element.clone();
    move |label: &str| {
      let _ = element.set_attribute("aria-label", label);
      let _ = element.set_attribute("title", &format!("{label} ({legend})"));
    }
  };
  match spec.job {
    Job::Preset(at) => {
      let preset = device.preset.clone();
      ctx.create_effect(move || {
        let name = PRESETS[at].name;
        if *preset.get() == at {
          label(&format!("{name} (playing)"));
        } else {
          label(&format!("Switch to {name}"));
        }
      });
    }
    Job::Shift => {
      let latched = device.latched.clone();
      ctx.create_effect(move || {
        label(if *latched.get() {
          "Let go of Shift (latched)"
        } else {
          spec.label
        });
      });
    }
    Job::Chord(chord) => {
      let device = device.clone();
      let element = element.clone();
      ctx.create_effect(move || {
        let name = CHORDS[chord].name;
        if *device.latched_chord.get() == Some(chord) {
          label(&format!("Let go of {name} chords"));
        } else {
          label(&format!("Play {name} chords on the keys"));
        }
        let pressed = device.active_chord() == Some(chord);
        let _ = element.set_attribute("aria-pressed", if pressed { "true" } else { "false" });
      });
    }
    _ => label(spec.label),
  }

  {
    let device = device.clone();
    add_event_and_forget(&element, "pointerdown", move |event| {
      if event
        .dyn_ref::<PointerEvent>()
        .is_some_and(|event| event.button() == 0)
      {
        press_pad(&device, index, false);
      }
    });
  }
  for name in ["pointerup", "pointercancel", "pointerleave"] {
    let device = device.clone();
    add_event_and_forget(&element, name, move |_| device.hold_pad(index, false));
  }
  keep_focus(&element);
  Ok(element)
}
