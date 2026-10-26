//! The keybed: two octaves of keys from F3, shifted by the octave arrows,
//! played with the pointer or the home row.

use std::rc::Rc;

use fluid::Context;
use fluid_macro::html;
use wasm_bindgen::prelude::*;
use web_sys::Element;

use crate::device::Device;
use crate::keymap::legend;
use crate::notes::{self, BLACK_KEYS, WHITE_KEYS};

pub fn keybed(ctx: &Context, device: &Rc<Device>) -> Result<Element, JsValue> {
  let well = html! { div class="keybed" {} };
  let keys = html! { div class="keys" {} };
  // Black keys last, so they sit on top of the white ones.
  for &semitone in WHITE_KEYS.iter() {
    let key = key(ctx, device, semitone, "white")?;
    keys.append_child(&key)?;
  }
  for &semitone in BLACK_KEYS.iter() {
    let key = key(ctx, device, semitone, "black")?;
    keys.append_child(&key)?;
  }
  well.append_child(&keys)?;
  Ok(well)
}

fn key(ctx: &Context, device: &Rc<Device>, semitone: u8, colour: &str) -> Result<Element, JsValue> {
  let held = device.held.clone();
  let octave = device.octave.clone();
  let (on_down, on_up, on_leave) = (device.clone(), device.clone(), device.clone());
  let class = format!("key {colour}");
  let lit = format!("key {colour} lit");
  let slot = format!("--slot: {}", notes::slot(semitone));
  let legend = legend(semitone);
  let key = html! {
    button
    class=#{ |held| if held.get().contains_key(&semitone) { lit.as_str() } else { class.as_str() } }
    style={ &slot }
    @pointerdown={ move |_| on_down.press(semitone) }
    @pointerup={ move |_| on_up.release(semitone) }
    @pointerleave={ move |_| on_leave.release(semitone) }
    {
      span class="key-note" { #{ |octave| notes::engraved(notes::midi(semitone, *octave.get())) } }
      span class="key-legend" { { &legend } }
    }
  };
  {
    let key = key.clone();
    ctx.create_effect(move || {
      let label = notes::spoken(notes::midi(semitone, *octave.get()));
      let _ = key.set_attribute("aria-label", &label);
    });
  }
  Ok(key)
}
