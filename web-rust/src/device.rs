//! The Device's state, as fluid signals.
//!
//! The UI and the browser listeners write here; fluid effects read it and
//! redraw only the attributes and text bound to what changed.

use std::collections::BTreeMap;
use std::rc::Rc;

use fluid::{Context, Signal};
use gloo_utils::window;

use crate::notes::{self, OCTAVE_RANGE};

/// The Device's native size in CSS pixels. It is zoomed as a whole to fit the
/// window and never reflows.
pub const DEVICE_SIZE: (f64, f64) = (1001., 622.);
/// Room below the Device for the page footer.
const FOOTER_HEIGHT: f64 = 48.;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Theme {
  System,
  Light,
  Dark,
}

impl Theme {
  const STORAGE_KEY: &str = "theme";

  /// Reads the theme as web-react keeps it in `localStorage`: a JSON string.
  fn stored() -> Self {
    let stored = window()
      .local_storage()
      .ok()
      .flatten()
      .and_then(|storage| storage.get_item(Self::STORAGE_KEY).ok().flatten());
    match stored.as_deref().map(|value| value.trim_matches('"')) {
      Some("light") => Self::Light,
      Some("dark") => Self::Dark,
      _ => Self::System,
    }
  }

  fn store(self) {
    if let Ok(Some(storage)) = window().local_storage() {
      let _ = storage.set_item(Self::STORAGE_KEY, &format!("\"{}\"", self.name()));
    }
  }

  fn name(self) -> &'static str {
    match self {
      Self::System => "system",
      Self::Light => "light",
      Self::Dark => "dark",
    }
  }

  pub fn label(self) -> &'static str {
    match self {
      Self::System => "System theme",
      Self::Light => "Light theme",
      Self::Dark => "Dark theme",
    }
  }

  pub fn next(self) -> Self {
    match self {
      Self::System => Self::Light,
      Self::Light => Self::Dark,
      Self::Dark => Self::System,
    }
  }

  pub fn is_dark(self, system_dark: bool) -> bool {
    match self {
      Self::System => system_dark,
      Self::Light => false,
      Self::Dark => true,
    }
  }
}

pub struct Device {
  pub theme: Rc<Signal<Theme>>,
  /// Whether the system prefers dark, followed by the `System` theme.
  pub system_dark: Rc<Signal<bool>>,
  /// How many octaves the keybed is shifted, within ±[`OCTAVE_RANGE`].
  pub octave: Rc<Signal<i8>>,
  /// The held keybed keys, each with the MIDI note it started; a key lets go
  /// of that note even if the octave moved while it was down.
  pub held: Rc<Signal<BTreeMap<u8, u8>>>,
  pub shift: Rc<Signal<bool>>,
  /// The last note played, for the screen.
  pub last: Rc<Signal<Option<u8>>>,
  /// The zoom that fits the Device's native size in the window.
  pub scale: Rc<Signal<f64>>,
}

impl Device {
  pub fn new(ctx: &Context) -> Self {
    Self {
      theme: ctx.create_signal(Theme::stored()),
      system_dark: ctx.create_signal(system_dark()),
      octave: ctx.create_signal(0),
      held: ctx.create_signal(BTreeMap::new()),
      shift: ctx.create_signal(false),
      last: ctx.create_signal(None),
      scale: ctx.create_signal(window_scale()),
    }
  }

  pub fn press(&self, semitone: u8) {
    if self.held.get().contains_key(&semitone) {
      return;
    }
    let note = notes::midi(semitone, *self.octave.get());
    let mut held = self.held.get().clone();
    held.insert(semitone, note);
    self.held.set(held);
    self.last.set(Some(note));
  }

  pub fn release(&self, semitone: u8) {
    if !self.held.get().contains_key(&semitone) {
      return;
    }
    let mut held = self.held.get().clone();
    held.remove(&semitone);
    self.held.set(held);
  }

  pub fn release_all(&self) {
    if !self.held.get().is_empty() {
      self.held.set(BTreeMap::new());
    }
  }

  pub fn step_octave(&self, by: i8) {
    let octave = *self.octave.get();
    let next = (octave + by).clamp(-OCTAVE_RANGE, OCTAVE_RANGE);
    if next != octave {
      self.octave.set(next);
    }
  }

  pub fn cycle_theme(&self) {
    let theme = self.theme.get().next();
    theme.store();
    self.theme.set(theme);
  }
}

pub fn system_dark_query() -> Option<web_sys::MediaQueryList> {
  window()
    .match_media("(prefers-color-scheme: dark)")
    .ok()
    .flatten()
}

fn system_dark() -> bool {
  system_dark_query().is_some_and(|query| query.matches())
}

pub fn window_scale() -> f64 {
  let window = window();
  let size = |value: Result<wasm_bindgen::JsValue, _>| {
    value.ok().and_then(|value| value.as_f64()).unwrap_or(0.)
  };
  fit(size(window.inner_width()), size(window.inner_height()))
}

/// The zoom that fits the Device in a `width` × `height` window with a page
/// margin around it: twice the bezel on wide screens, half of it on phones.
/// Never above 1, so a big screen shows it at its native size.
pub fn fit(width: f64, height: f64) -> f64 {
  let margin = if width >= 1200. { 64. } else { 16. };
  let (device_width, device_height) = DEVICE_SIZE;
  let across = (width - 2. * margin) / device_width;
  let down = (height - 2. * margin - FOOTER_HEIGHT) / device_height;
  across.min(down).clamp(0.1, 1.)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn fits_the_window() {
    assert_eq!(fit(2560., 1440.), 1.);
    let phone = fit(390., 844.);
    assert!(phone > 0.3 && phone < 0.4);
    assert!(DEVICE_SIZE.0 * fit(1100., 900.) <= 1100. - 32.);
  }

  #[test]
  fn themes_cycle() {
    assert_eq!(Theme::System.next().next().next(), Theme::System);
    assert!(Theme::System.is_dark(true));
    assert!(!Theme::Light.is_dark(true));
  }
}
