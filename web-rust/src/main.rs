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
//! - [`midi`]: MIDI input, a controller playing the Device.
//! - [`chrome`]: the theme and which panel is open; [`icons`]: the icons as
//!   web-react renders them.
//!
//! The main structs are re-exported here, so they're listed below: the
//! [`App`] and its stores, the saved stores, the bindings, and the logic's
//! main types.

// The stores are built once, by `App::install`; a `Default` beside each
// `new` would only invite building another.
#![allow(clippy::new_without_default)]

mod chrome;
mod docs;
mod icons;
mod input;
mod logic;
mod midi;
mod modes;
mod router;
mod state;
mod store;
mod ui;

use fluid::Context;
use gloo_utils::body;

use crate::router::Page;

// The main structs, re-exported here so the crate's page lists them all;
// each is documented where it lives, in its part's module.
#[doc(inline)]
pub use crate::chrome::Chrome;
#[doc(inline)]
pub use crate::docs::Doc;
#[doc(inline)]
pub use crate::logic::{
  beats::DrumBeat,
  chords::Chord,
  flac::FlacEncoder,
  modules::{DeviceModule, ModuleSettings},
  pattern::DrumPattern,
  play_styles::PlayStyle,
  presets::DevicePreset,
  progressions::Progression,
  starter::Tape,
  swing::Swing,
  synth_graphs::GraphScene,
  synth_pages::SynthPage,
  timing::{Meter, NoteRecorder, Take, Timeline, Timing},
  tracks::{Track, TrackClip},
};
#[doc(inline)]
pub use crate::midi::{Midi, MidiSettings};
#[doc(inline)]
pub use crate::modes::{Bindings, KnobBinding, PadBinding, Rich, ScreenBinding};
#[doc(inline)]
pub use crate::router::Router;
#[doc(inline)]
pub use crate::state::{
  App,
  browse::Browse,
  drum_grid::DrumGrid,
  engine::Engine,
  feedback::Feedback,
  hotkeys::Hotkeys,
  lanes::Lanes,
  mix::Mix,
  output::Output,
  performance::{ChordPlayer, Performance},
  preview::Preview,
  scrub::Scrub,
  shift::Shift,
  sound::SoundStore,
  take::TakeStore,
  tracks::Tracks,
  transport::Transport,
  view::ViewStore,
};
#[doc(inline)]
pub use crate::store::{
  chords::ChordStore,
  favorites::FavoritesStore,
  library::{LibraryStore, PresetLibrary},
  session::{Session, SessionStore},
};

fn main() {
  // A panic says what went wrong in the console, rather than only trapping.
  std::panic::set_hook(Box::new(|info| gloo_console::error!(info.to_string())));
  // The root scope owns the Device's effects and every effect on the page.
  // Each page lives in its own scope, disposed when the route leaves it;
  // the Device's state outlives both.
  let page = Context::new().run(|| {
    let chrome = Chrome::install();
    App::install();
    midi::Midi::install();
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
