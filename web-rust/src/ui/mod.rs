//! The page, built with fluid's `html!`. Each part is built once; effects
//! (`#{ |signals| ... }`) update only the attributes and text bound to the
//! signals they name.
//!
//! `html!` makes elements but can't take one as a child, so a part with
//! child parts appends them itself.

mod keybed;
mod screen;

use std::rc::Rc;

use fluid::Context;
use fluid_macro::html;
use wasm_bindgen::prelude::*;
use web_sys::Element;

use crate::device::Device;

pub fn page(ctx: &Context, device: &Rc<Device>) -> Result<Element, JsValue> {
  let scale = device.scale.clone();
  let page = html! { main class="page" {} };
  let body = html! {
    div class="device" style=#{ |scale| &format!("zoom: {}", scale.get()) } {}
  };
  let top = html! { div class="device-top" {} };
  for part in [
    knobs(["chalk", "green"])?,
    screen::screen(ctx, device)?,
    knobs(["red", "blue"])?,
  ] {
    top.append_child(&part)?;
  }
  body.append_child(&top)?;
  let keybed = keybed::keybed(ctx, device)?;
  body.append_child(&keybed)?;
  page.append_child(&body)?;
  let footer = footer(ctx, device)?;
  page.append_child(&footer)?;
  Ok(page)
}

// TODO: the knobs turn nothing yet; their jobs come with the screen's views.
fn knobs(colours: [&str; 2]) -> Result<Element, JsValue> {
  let [upper, lower] = colours.map(|colour| format!("knob {colour}"));
  Ok(html! {
    div class="knobs" {
      div class={ &upper } {}
      div class={ &lower } {}
    }
  })
}

fn footer(ctx: &Context, device: &Rc<Device>) -> Result<Element, JsValue> {
  let theme = device.theme.clone();
  let on_theme = device.clone();
  Ok(html! {
    footer class="page-footer" {
      button
      class="theme-button"
      @click={ move |_| on_theme.cycle_theme() }
      { #{ |theme| theme.get().label() } }
    }
  })
}

/// Puts `.dark` on the root element while the theme is dark; the CSS
/// cross-fades the Device's colours from it.
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
