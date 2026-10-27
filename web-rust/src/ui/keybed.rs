//! The keybed: two octaves of keys from F3, shifted by the octave arrows,
//! played with the pointer or the home row. Each key shows its letter over
//! its note, or with a kit the piece it strikes.

use std::cell::Cell;
use std::rc::Rc;

use fluid::{Context, add_event_and_forget};
use fluid_macro::html;
use wasm_bindgen::prelude::*;
use web_sys::{Element, PointerEvent};

use super::keep_focus;
use crate::device::Device;
use crate::keymap::legend;
use crate::notes::{self, BLACK_KEYS, WHITE_KEYS};
use crate::presets::PRESETS;

struct KeyStyle {
  rest: &'static str,
  lit: &'static str,
  labels: &'static str,
  hotkey: &'static str,
  note: &'static str,
}

// Each black key centres on the 4px gap before white key --slot.
const WHITE: KeyStyle = KeyStyle {
  rest: "absolute top-0 left-[calc(var(--slot)_*_var(--key-pitch))] inline-flex h-[var(--white-key-height,210px)] w-[var(--white-key-width,50px)] cursor-pointer touch-none items-center justify-center rounded-b-[8px] bg-key-white text-center text-[#5f5d57] shadow-key-white select-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#2f7de1] focus-visible:outline-solid",
  lit: "absolute top-0 left-[calc(var(--slot)_*_var(--key-pitch))] inline-flex h-[var(--white-key-height,210px)] w-[var(--white-key-width,50px)] cursor-pointer touch-none items-center justify-center rounded-b-[8px] bg-key-white-lit text-center text-[#5f5d57] shadow-key-white-lit select-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#2f7de1] focus-visible:outline-solid",
  labels: "pointer-events-none absolute right-0 bottom-[16px] left-0 flex flex-col items-center gap-[6px] leading-none",
  hotkey: "grid h-[18px] min-w-[18px] place-items-center rounded-[5px] border border-current/35 px-[4px] text-[10px] font-semibold [font-family:inherit]",
  note: "text-[13px] font-bold tracking-[0.01em] [&_svg]:block [&_svg]:size-[18px]",
};
const BLACK: KeyStyle = KeyStyle {
  rest: "absolute top-0 left-[calc(var(--slot)_*_var(--key-pitch)_-_2px_-_var(--black-key-width)_/_2)] z-2 inline-flex h-[var(--black-key-height,128px)] w-[var(--black-key-width,30px)] cursor-pointer touch-none items-center justify-center rounded-b-[6px] bg-key-black text-center text-white/72 shadow-key-black select-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#2f7de1] focus-visible:outline-solid",
  lit: "absolute top-0 left-[calc(var(--slot)_*_var(--key-pitch)_-_2px_-_var(--black-key-width)_/_2)] z-2 inline-flex h-[var(--black-key-height,128px)] w-[var(--black-key-width,30px)] cursor-pointer touch-none items-center justify-center rounded-b-[6px] bg-key-black-lit text-center text-white/72 shadow-key-black-lit select-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#2f7de1] focus-visible:outline-solid",
  labels: "pointer-events-none absolute right-0 bottom-[16px] left-0 flex flex-col items-center gap-[5px] leading-none",
  hotkey: "grid h-[16px] min-w-[16px] place-items-center rounded-[5px] border border-current/35 px-[3px] text-[10px] font-semibold [font-family:inherit]",
  note: "text-[10px] font-bold tracking-[0.01em] [&_svg]:block [&_svg]:size-[16px]",
};

/// A recess cut into the bottom edge, like a laptop's lid notch: rounded at
/// the top and running out through the bezel. Fourteen white keys 4px apart
/// fill its 915px inside an inset gutter.
pub fn keybed(ctx: &Context, device: &Rc<Device>) -> Result<Element, JsValue> {
  let well = html! {
    div class="-mb-bezel flex justify-center rounded-t-[18px] bg-keybed px-inset pb-inset shadow-keybed [--black-key-height:150px] [--black-key-width:37px] [--key-pitch:calc(var(--white-key-width)_+_4px)] [--white-key-height:247px] [--white-key-width:calc((915px_-_13_*_4px)_/_14)]" {}
  };
  let keys = html! { div role="group" class="relative h-[247px] w-[915px]" {} };
  keys.set_attribute("aria-label", "Piano keys")?;
  // Black keys last, so they sit on top of the white ones.
  let white = WHITE_KEYS
    .iter()
    .map(|&semitone| key(ctx, device, semitone, &WHITE));
  let black = BLACK_KEYS
    .iter()
    .map(|&semitone| key(ctx, device, semitone, &BLACK));
  super::append(&keys, white.chain(black).collect::<Result<Vec<_>, _>>()?)?;
  super::append(&well, [keys])?;
  Ok(well)
}

fn key(
  ctx: &Context,
  device: &Rc<Device>,
  semitone: u8,
  style: &'static KeyStyle,
) -> Result<Element, JsValue> {
  let held = device.held.clone();
  let preset = device.preset.clone();
  let octave = device.octave.clone();
  let slot = format!("--slot:{}", notes::slot(semitone));
  let legend = legend(semitone);
  let key = html! {
    button
    class=#{ |held| {
      let lit = held.get().values().flatten().any(|&(lit, _)| lit == semitone);
      if lit { style.lit } else { style.rest }
    } }
    style={ &slot }
    {
      span class={ style.labels } {
        kbd class={ style.hotkey } { { &legend } }
        span class={ style.note } {
          #{ |preset, octave| match PRESETS[*preset.get()].pieces {
            Some(pieces) => pieces[semitone as usize].face.to_string(),
            None => notes::engraved(notes::midi(semitone, *octave.get())),
          } }
        }
      }
    }
  };
  key.set_attribute("aria-keyshortcuts", &legend)?;
  if let Some(labels) = key.first_element_child() {
    labels.set_attribute("aria-hidden", "true")?;
  }
  {
    let key = key.clone();
    let preset = device.preset.clone();
    let octave = device.octave.clone();
    ctx.create_effect(move || {
      let spoken = notes::spoken(notes::midi(semitone, *octave.get()));
      let label = match PRESETS[*preset.get()].pieces {
        Some(pieces) => format!("{} ({spoken})", pieces[semitone as usize].name),
        None => spoken,
      };
      let _ = key.set_attribute("aria-label", &label);
    });
  }

  // Held down, the pointer slides from key to key, playing each one it
  // enters. Touch captures its pointer by default, so it lets go to slide
  // too. Only the pointer's own press is let go when it leaves, so a key held
  // from the keyboard keeps sounding.
  let pointer_held = Rc::new(Cell::new(false));
  {
    let device = device.clone();
    let pointer_held = pointer_held.clone();
    let target = key.clone();
    add_event_and_forget(&key, "pointerdown", move |event| {
      let Some(event) = event.dyn_ref::<PointerEvent>() else {
        return;
      };
      if event.button() != 0 {
        return;
      }
      if target.has_pointer_capture(event.pointer_id()) {
        let _ = target.release_pointer_capture(event.pointer_id());
      }
      pointer_held.set(true);
      device.press(semitone);
    });
  }
  {
    let device = device.clone();
    let pointer_held = pointer_held.clone();
    add_event_and_forget(&key, "pointerenter", move |event| {
      if event
        .dyn_ref::<PointerEvent>()
        .is_some_and(|event| event.buttons() & 1 == 1)
      {
        pointer_held.set(true);
        device.press(semitone);
      }
    });
  }
  for name in ["pointerleave", "pointerup", "pointercancel"] {
    let device = device.clone();
    let pointer_held = pointer_held.clone();
    add_event_and_forget(&key, name, move |_| {
      if pointer_held.replace(false) {
        device.release(semitone);
      }
    });
  }
  keep_focus(&key);
  Ok(key)
}
