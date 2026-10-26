//! The black screen: the keys view's title and octave on top, the note last
//! played large in the middle, the held notes under it, and the guides in the
//! footer.

use std::rc::Rc;

use fluid::Context;
use fluid_macro::html;
use wasm_bindgen::prelude::*;
use web_sys::Element;

use crate::device::Device;
use crate::notes::note_name;

pub fn screen(ctx: &Context, device: &Rc<Device>) -> Result<Element, JsValue> {
  let octave = device.octave.clone();
  let held = device.held.clone();
  let last = device.last.clone();
  let shift = device.shift.clone();
  Ok(html! {
    div class="screen" {
      div class="screen-line" {
        span class="screen-title" { "Keys" }
        span { #{ |octave| octave_label(*octave.get()) } }
      }
      div class="screen-note" {
        #{ |last| last.get().map(note_name).unwrap_or_else(|| "—".to_string()) }
      }
      div class="screen-held" {
        #{ |held| held.get().values().copied().map(note_name).collect::<Vec<_>>().join(" ") }
      }
      div class="screen-line" {
        span class="screen-hint" { "A – ' play" }
        span class=#{ |shift| if *shift.get() { "screen-hint lit" } else { "screen-hint" } } {
          "⇧ five keys more"
        }
        span class="screen-hint" { "↑ ↓ octave" }
      }
    }
  })
}

fn octave_label(octave: i8) -> String {
  match octave {
    0 => "Octave 0".to_string(),
    _ => format!("Octave {octave:+}"),
  }
}
