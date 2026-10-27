//! The keybed: two octaves of keys from F3, shifted by the octave arrows,
//! played with the pointer or the home row. Each key shows its letter over
//! its note, or with a kit the piece it strikes.

use fluid_macro::html;
use web_sys::{Element, PointerEvent};

use super::{blur_active, markup};
use crate::device::{Device, device};
use crate::keymap::legend;
use crate::notes::{self, BLACK_KEYS, WHITE_KEYS};

/// A recess cut into the bottom edge, like a laptop's lid notch: rounded at
/// the top and running out through the bezel. Fourteen white keys 4px apart
/// fill its 915px inside an inset gutter. Black keys come last, so they sit
/// on top of the white ones.
pub fn keybed() -> Element {
  let keys: Vec<Element> = WHITE_KEYS
    .iter()
    .map(|&semitone| key(semitone, false))
    .chain(BLACK_KEYS.iter().map(|&semitone| key(semitone, true)))
    .collect();
  html! {
    div class="-mb-bezel flex justify-center rounded-t-[18px] bg-keybed px-inset pb-inset shadow-keybed [--black-key-height:150px] [--black-key-width:37px] [--key-pitch:calc(var(--white-key-width)_+_4px)] [--white-key-height:247px] [--white-key-width:calc((915px_-_13_*_4px)_/_14)]" {
      div role="group" aria-label="Piano keys" class="relative h-[247px] w-[915px]" {
        { keys }
      }
    }
  }
}

/// The key's note at the current octave, or the kit piece it strikes.
fn face(device: &Device, semitone: u8) -> String {
  match device.current().pieces {
    Some(pieces) => pieces[semitone as usize].face.to_string(),
    None => notes::engraved(notes::midi(semitone, device.octave.value())),
  }
}

fn label(device: &Device, semitone: u8) -> String {
  let spoken = notes::spoken(notes::midi(semitone, device.octave.value()));
  match device.current().pieces {
    Some(pieces) => format!("{} ({spoken})", pieces[semitone as usize].name),
    None => spoken,
  }
}

// Each black key centres on the 4px gap before white key --slot.
const WHITE: &str = "absolute top-0 left-[calc(var(--slot)_*_var(--key-pitch))] inline-flex h-[var(--white-key-height,210px)] w-[var(--white-key-width,50px)] cursor-pointer touch-none items-center justify-center rounded-b-[8px] text-center text-[#5f5d57] select-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#2f7de1] focus-visible:outline-solid";
const BLACK: &str = "absolute top-0 left-[calc(var(--slot)_*_var(--key-pitch)_-_2px_-_var(--black-key-width)_/_2)] z-2 inline-flex h-[var(--black-key-height,128px)] w-[var(--black-key-width,30px)] cursor-pointer touch-none items-center justify-center rounded-b-[6px] text-center text-white/72 select-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#2f7de1] focus-visible:outline-solid";

fn key(semitone: u8, black: bool) -> Element {
  let device = device();
  let legend = legend(semitone);
  let lit = fluid::create_memo(move || device.lit.with(|lit| lit.contains(&semitone)));
  let (labels, hotkey, note) = if black {
    (
      "pointer-events-none absolute right-0 bottom-[16px] left-0 flex flex-col items-center gap-[5px] leading-none",
      "grid h-[16px] min-w-[16px] place-items-center rounded-[5px] border border-current/35 px-[3px] text-[10px] font-semibold [font-family:inherit]",
      "text-[10px] font-bold tracking-[0.01em] [&_svg]:block [&_svg]:size-[16px]",
    )
  } else {
    (
      "pointer-events-none absolute right-0 bottom-[16px] left-0 flex flex-col items-center gap-[6px] leading-none",
      "grid h-[18px] min-w-[18px] place-items-center rounded-[5px] border border-current/35 px-[4px] text-[10px] font-semibold [font-family:inherit]",
      "text-[13px] font-bold tracking-[0.01em] [&_svg]:block [&_svg]:size-[18px]",
    )
  };
  // Held down, the pointer slides from key to key, playing each one it
  // enters. Touch captures its pointer by default, so it lets go to slide
  // too. Only the pointer's own press is let go when it leaves, so a key held
  // from the keyboard keeps sounding.
  let press = move || {
    device
      .pointer_keys
      .set(device.pointer_keys.get() | 1 << semitone);
    device.press(semitone);
  };
  let release = move || {
    let mask = 1 << semitone;
    if device.pointer_keys.get() & mask != 0 {
      device.pointer_keys.set(device.pointer_keys.get() & !mask);
      device.release(semitone);
    }
  };
  html! {
    button
    class={ if black { BLACK } else { WHITE } }
    class:"bg-key-white shadow-key-white"=#{ |lit| !black && !lit.value() }
    class:"bg-key-white-lit shadow-key-white-lit"=#{ |lit| !black && lit.value() }
    class:"bg-key-black shadow-key-black"=#{ |lit| black && !lit.value() }
    class:"bg-key-black-lit shadow-key-black-lit"=#{ |lit| black && lit.value() }
    style={ format!("--slot:{}", notes::slot(semitone)) }
    aria-label={ move || label(device, semitone) }
    aria-keyshortcuts={ legend.as_str() }
    @pointerdown={ move |event: PointerEvent| {
      if event.button() != 0 {
        return;
      }
      if let Some(key) = event.current_target().and_then(|target| wasm_bindgen::JsCast::dyn_into::<Element>(target).ok())
        && key.has_pointer_capture(event.pointer_id())
      {
        let _ = key.release_pointer_capture(event.pointer_id());
      }
      press();
    } }
    @pointerenter={ move |event: PointerEvent| if event.buttons() & 1 == 1 { press() } }
    @pointerleave={ move |_| release() }
    @pointerup={ move |_| release() }
    @pointercancel={ move |_| release() }
    @mousedown.prevent={ |_| blur_active() }
    {
      span aria-hidden="true" class={ labels } {
        kbd class={ hotkey } { { legend.clone() } }
        span class={ note } { { move || markup(&face(device, semitone)) } }
      }
    }
  }
}
