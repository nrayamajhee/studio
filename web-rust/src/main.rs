//! # web-rust
//!
//! The Device in Rust: a Trunk-built wasm app whose UI is made with
//! [fluid](https://github.com/nrayamajhee/fluid) signals and its `html!` macro.
//!
//! - [`router`]: the two pages, the Device at `/` and the docs under
//!   `/docs`, moved between in place.
//! - [`device`]: the state, as signals and memos, shared through fluid's
//!   context.
//! - [`input`]: browser listeners that write to it.
//! - [`ui`]: the page, whose effects read it.
//! - [`keymap`], [`notes`] and [`pads`]: plain logic, tested natively with
//!   `cargo test`.
//! - [`sound`]: what the Device plays, sent to the `sound-engine` crate's
//!   engine, which runs in an AudioWorklet.
//! - [`presets`] and [`icons`]: the presets and icons as web-react ships them.
//! - [`docs`]: the docs, rendered from the repo's markdown at build time.

mod device;
mod docs;
mod icons;
mod input;
mod keymap;
// Wired into the Device as the port's next steps land.
#[allow(dead_code)]
mod logic;
mod notes;
mod pads;
mod presets;
mod router;
mod sound;
#[allow(dead_code)]
mod store;
mod ui;

use fluid::Context;
use gloo_utils::body;

use crate::device::Device;
use crate::router::{Page, Router};

fn main() {
  // The root scope owns the Device's memos and every effect on the page.
  // Each page lives in its own scope, disposed when the route leaves it;
  // the Device's state outlives both.
  let page = Context::new().run(|| {
    let device = Device::install();
    let router = Router::install();
    ui::apply_theme(device);
    input::listen_to_page(device, router);
    fluid::show(
      move || router.page(),
      |page| match page {
        Page::Home => ui::page(),
        Page::Docs => ui::docs::page(),
      },
    )
  });
  if let Err(err) = body().append_child(&page) {
    gloo_console::error!("Couldn't mount the Device", err);
  }
}
