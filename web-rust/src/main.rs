//! # web-rust
//!
//! The Device in Rust: a Trunk-built wasm app whose UI is made with
//! [fluid](https://github.com/nrayamajhee/fluid) signals and its `html!` macro.
//!
//! - [`device`]: the state, as signals.
//! - [`input`]: browser listeners that write to it.
//! - [`ui`]: the page, whose effects read it.
//! - [`keymap`] and [`notes`]: plain logic, tested natively with `cargo test`.
//!
//! Sound comes later from the `sound-engine` crate; see
//! `docs/development/monorepo.md`.

mod device;
mod input;
mod keymap;
mod notes;
mod ui;

use std::rc::Rc;

use fluid::Context;
use gloo_utils::body;
use wasm_bindgen::JsValue;

use crate::device::Device;

fn main() {
  if let Err(err) = start() {
    gloo_console::error!("Couldn't start the Device", err);
  }
}

fn start() -> Result<(), JsValue> {
  let ctx = Context::new();
  let device = Rc::new(Device::new(&ctx));
  ui::apply_theme(&ctx, &device);
  input::listen(&device);
  let page = ui::page(&ctx, &device)?;
  body().append_child(&page)?;
  Ok(())
}
