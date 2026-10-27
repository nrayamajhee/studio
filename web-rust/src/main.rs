//! # web-rust
//!
//! The Device in Rust: a Trunk-built wasm app whose UI is made with
//! [fluid](https://github.com/nrayamajhee/fluid) signals and its `html!` macro.
//!
//! - [`device`]: the state, as signals and memos, shared through fluid's
//!   context.
//! - [`input`]: browser listeners that write to it.
//! - [`ui`]: the page, whose effects read it.
//! - [`keymap`], [`notes`] and [`pads`]: plain logic, tested natively with
//!   `cargo test`.
//! - [`presets`] and [`icons`]: the presets and icons as web-react ships them.
//!
//! Sound comes later from the `sound-engine` crate; see
//! `docs/development/monorepo.md`.

mod device;
mod icons;
mod input;
mod keymap;
mod notes;
mod pads;
mod presets;
mod ui;

use fluid::Context;
use gloo_utils::body;

use crate::device::Device;

fn main() {
  // The root scope owns the Device's memos and every effect on the page.
  let page = Context::new().run(|| {
    let device = Device::install();
    ui::apply_theme(device);
    input::listen_to_page(device);
    ui::page()
  });
  if let Err(err) = body().append_child(&page) {
    gloo_console::error!("Couldn't mount the Device", err);
  }
}
