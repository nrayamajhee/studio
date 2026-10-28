//! # web-rust
//!
//! The Device in Rust: a Trunk-built wasm app whose UI is made with
//! [fluid](https://github.com/nrayamajhee/fluid) signals and its `html!` macro.
//!
//! - [`logic`]: the Device's logic as plain Rust, tested natively and
//!   checked against web-react's outputs.
//! - [`store`]: what it keeps between visits, under web-react's keys.
//! - [`state`]: its state, a store per web-react provider, and the sound
//!   it sends to the `sound-engine` crate's engine in an AudioWorklet.
//! - [`modes`]: what each control does in each view.
//! - [`ui`]: the page, whose effects read them; [`input`]: the browser
//!   listeners that play it.
//! - [`router`]: the two pages, the Device at `/` and the docs under
//!   `/docs`; [`docs`]: the docs, rendered from the repo's markdown.
//! - [`chrome`]: the theme and the Debug panel's toggle; [`icons`]: the
//!   icons as web-react renders them.

// The stores hold what the views still to be ported read; this goes once
// they are.
#![allow(dead_code)]

mod chrome;
mod docs;
mod icons;
mod input;
mod logic;
mod modes;
mod router;
mod state;
mod store;
mod ui;

use fluid::Context;
use gloo_utils::body;

use crate::chrome::Chrome;
use crate::router::{Page, Router};
use crate::state::App;

fn main() {
  // A panic says what went wrong in the console, rather than only trapping.
  std::panic::set_hook(Box::new(|info| gloo_console::error!(info.to_string())));
  // The root scope owns the Device's effects and every effect on the page.
  // Each page lives in its own scope, disposed when the route leaves it;
  // the Device's state outlives both.
  let page = Context::new().run(|| {
    let chrome = Chrome::install();
    App::install();
    let router = Router::install();
    ui::apply_theme(chrome);
    input::listen_to_page(router);
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
