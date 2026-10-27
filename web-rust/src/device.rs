//! The Device's state, as fluid signals.
//!
//! The UI and the browser listeners write here; fluid effects read it and
//! redraw only the attributes and text bound to what changed.

use std::cell::Cell;
use std::collections::{BTreeMap, BTreeSet};
use std::rc::Rc;

use fluid::{Memo, Signal};
use gloo_timers::callback::Timeout;
use gloo_utils::window;

use crate::notes;
use crate::pads::CHORDS;
use crate::presets::{PRESETS, Param, Preset};

/// Every knob turns through eleven steps, 0–100% in tens, unless a
/// parameter has fewer.
pub const KNOB_STEPS: usize = 11;
/// How long the volume or level shows over the screen after a turn.
const OVERLAY_MS: u32 = 1200;

/// A keybed key held down: the keys it lights (its chord's notes) and the
/// MIDI note of each.
pub type HeldKey = Vec<(u8, u8)>;

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

  pub fn name(self) -> &'static str {
    match self {
      Self::System => "system",
      Self::Light => "light",
      Self::Dark => "dark",
    }
  }

  pub fn is_dark(self, system_dark: bool) -> bool {
    match self {
      Self::System => system_dark,
      Self::Light => false,
      Self::Dark => true,
    }
  }

  /// The theme the toggle switches to: the other one from what shows now,
  /// as web-react's toggle does.
  pub fn next(self, system_dark: bool) -> Self {
    if self.is_dark(system_dark) {
      Self::Light
    } else {
      Self::Dark
    }
  }
}

pub struct Device {
  pub theme: Rc<Signal<Theme>>,
  /// Whether the system prefers dark, followed by the `System` theme.
  pub system_dark: Rc<Signal<bool>>,
  /// The preset the instrument pads picked, an index into [`PRESETS`].
  pub preset: Rc<Signal<usize>>,
  /// The octave shift, kept as far as the next preset reaches.
  pub octave: Rc<Signal<i8>>,
  /// The held keybed keys by the key pressed, each with the notes it
  /// started; a key lets go of those even if the octave or chord changed
  /// while it was down.
  pub held: Rc<Signal<BTreeMap<u8, HeldKey>>>,
  /// The chord a chord key holds while down, and the one a click latched.
  pub chord_key: Rc<Signal<Option<usize>>>,
  pub latched_chord: Rc<Signal<Option<usize>>>,
  /// The pads held down, from the pointer or their keys.
  pub held_pads: Rc<Signal<BTreeSet<usize>>>,
  pub shift_key: Rc<Signal<bool>>,
  /// Shift latched by its pad, for the pads' Shift jobs.
  pub latched: Rc<Signal<bool>>,
  /// The white knob's volume and the red knob's level, in knob steps.
  pub volume: Rc<Signal<usize>>,
  pub level: Rc<Signal<usize>>,
  /// The parameter the green knob picked, an index into the preset's.
  pub selected: Rc<Signal<usize>>,
  /// Each preset's parameter values, in knob steps.
  pub values: Rc<Signal<Vec<Vec<usize>>>>,
  /// The volume or level just turned, over the screen for a moment.
  pub overlay: Rc<Signal<Option<(&'static str, usize)>>>,
  /// The chord the keys play: the one a key holds, else the latched one.
  pub active_chord: Memo<Option<usize>>,
  /// The keybed keys lit by what is held, chords included.
  pub lit: Memo<BTreeSet<u8>>,
  /// Whether the preset's parameters moved off its own values.
  pub unsaved: Memo<bool>,
  /// The keybed keys the pointer holds, a bit each, so leaving one held
  /// from the keyboard keeps it sounding.
  pub pointer_keys: Cell<u32>,
  overlay_shown: Cell<u32>,
}

/// The Device for the page's lifetime, shared through fluid's context: a
/// `&'static` reference is `Copy`, so closures capture it without clones.
pub fn device() -> &'static Device {
  fluid::use_context().expect("the Device is provided at the root scope")
}

impl Device {
  /// Builds the Device and provides it to the current scope. Its memos
  /// belong to that scope, so call it inside the root `Context::run`.
  pub fn install() -> &'static Device {
    let device: &'static Device = Box::leak(Box::new(Device::new()));
    fluid::provide_context(device);
    device
  }

  fn new() -> Self {
    let chord_key = Rc::new(Signal::new(None));
    let latched_chord = Rc::new(Signal::new(None));
    let held = Rc::new(Signal::new(BTreeMap::new()));
    let preset = Rc::new(Signal::new(0));
    let values = Rc::new(Signal::new(
      PRESETS
        .iter()
        .map(|preset| preset.params.iter().map(|param| param.step).collect())
        .collect::<Vec<Vec<usize>>>(),
    ));
    let active_chord = fluid::create_memo({
      let (key, latched) = (chord_key.clone(), latched_chord.clone());
      move || key.value().or(latched.value())
    });
    let lit = fluid::create_memo({
      let held = held.clone();
      move || {
        held.with(|held: &BTreeMap<u8, HeldKey>| {
          held
            .values()
            .flatten()
            .map(|&(semitone, _)| semitone)
            .collect()
        })
      }
    });
    let unsaved = fluid::create_memo({
      let (preset, values) = (preset.clone(), values.clone());
      move || values.with(|values| unsaved(preset.value(), values))
    });
    Self {
      theme: Rc::new(Signal::new(Theme::stored())),
      system_dark: Rc::new(Signal::new(system_dark())),
      preset,
      octave: Rc::new(Signal::new(0)),
      held,
      chord_key,
      latched_chord,
      held_pads: Rc::new(Signal::new(BTreeSet::new())),
      shift_key: Rc::new(Signal::new(false)),
      latched: Rc::new(Signal::new(false)),
      volume: Rc::new(Signal::new(KNOB_STEPS - 1)),
      level: Rc::new(Signal::new(8)),
      selected: Rc::new(Signal::new(0)),
      values,
      overlay: Rc::new(Signal::new(None)),
      active_chord,
      lit,
      unsaved,
      pointer_keys: Cell::new(0),
      overlay_shown: Cell::new(0),
    }
  }

  pub fn current(&self) -> &'static Preset {
    &PRESETS[self.preset.value()]
  }

  pub fn shift(&self) -> bool {
    self.shift_key.value() || self.latched.value()
  }

  /// Presses a keybed key: its note, or with a chord active the chord built
  /// on it.
  pub fn press(&self, root: u8) {
    if self.held.with(|held| held.contains_key(&root)) {
      return;
    }
    let intervals = self
      .active_chord
      .value()
      .map_or(&[0][..], |chord| CHORDS[chord].intervals);
    let octave = self.octave.value();
    let notes = intervals
      .iter()
      .map(|interval| root + interval)
      .map(|semitone| (semitone, notes::midi(semitone, octave)))
      .collect();
    self.held.update(|held| held.insert(root, notes));
  }

  pub fn release(&self, semitone: u8) {
    if self.held.with(|held| held.contains_key(&semitone)) {
      self.held.update(|held| held.remove(&semitone));
    }
  }

  pub fn release_all(&self) {
    fluid::batch(|| {
      self.held.set_if_changed(BTreeMap::new());
      self.held_pads.set_if_changed(BTreeSet::new());
    });
  }

  pub fn hold_pad(&self, pad: usize, down: bool) {
    if self.held_pads.with(|held| held.contains(&pad)) != down {
      self.held_pads.update(|held| {
        if down {
          held.insert(pad);
        } else {
          held.remove(&pad);
        }
      });
    }
  }

  /// Shifts the keybed an octave, as far as the preset reaches.
  pub fn step_octave(&self, by: i8) {
    self.set_octave(self.octave.value() + by);
  }

  fn set_octave(&self, octave: i8) {
    let (lowest, highest) = self.current().octaves;
    self.octave.set_if_changed(octave.clamp(lowest, highest));
  }

  /// Switches the instrument, keeping the octave as far as it reaches and
  /// the picked parameter when it has one by that name. One batch, so no
  /// effect sees the new preset with the old parameter index.
  pub fn select_preset(&self, preset: usize) {
    if preset == self.preset.value() {
      return;
    }
    let picked = self.param().0.name;
    let selected = PRESETS[preset]
      .params
      .iter()
      .position(|param| param.name == picked)
      .unwrap_or(0);
    fluid::batch(|| {
      self.preset.set(preset);
      self.selected.set(selected);
      self.set_octave(self.octave.value());
    });
  }

  /// A chord pad's click latches its chord, or lets go of it.
  pub fn toggle_chord(&self, chord: usize) {
    self.latched_chord.update(|latched| {
      *latched = if *latched == Some(chord) {
        None
      } else {
        Some(chord)
      }
    });
  }

  /// A chord key holds its chord while down. It drops a latched chord, so
  /// that doesn't come back when the key is let go.
  pub fn hold_chord(&self, chord: usize) {
    fluid::batch(|| {
      self.latched_chord.set_if_changed(None);
      self.chord_key.set(Some(chord));
    });
  }

  pub fn release_chord(&self, chord: usize) {
    if self.chord_key.value() == Some(chord) {
      self.chord_key.set(None);
    }
  }

  pub fn toggle_latch(&self) {
    self.latched.update(|latched| *latched = !*latched);
  }

  /// The parameter the green knob picked, with its value's knob step.
  pub fn param(&self) -> (&'static Param, usize) {
    let (preset, selected) = (self.preset.value(), self.selected.value());
    let step = self.values.with(|values| values[preset][selected]);
    (&PRESETS[preset].params[selected], step)
  }

  pub fn set_value(&self, step: usize) {
    let (preset, selected) = (self.preset.value(), self.selected.value());
    self.values.update(|values| values[preset][selected] = step);
  }

  pub fn set_volume(&'static self, step: usize) {
    self.volume.set(step);
    self.show_overlay("Volume", step);
  }

  pub fn set_level(&'static self, step: usize) {
    self.level.set(step);
    self.show_overlay("Level", step);
  }

  /// Shows a level over the screen; each turn starts its time over.
  fn show_overlay(&'static self, label: &'static str, step: usize) {
    self.overlay.set(Some((label, step)));
    let shown = self.overlay_shown.get() + 1;
    self.overlay_shown.set(shown);
    Timeout::new(OVERLAY_MS, move || {
      if self.overlay_shown.get() == shown {
        self.overlay.set(None);
      }
    })
    .forget();
  }

  pub fn cycle_theme(&self) {
    let theme = self.theme.value().next(self.system_dark.value());
    theme.store();
    self.theme.set(theme);
  }
}

/// Whether a preset's parameters moved off its own values.
pub fn unsaved(preset: usize, values: &[Vec<usize>]) -> bool {
  PRESETS[preset]
    .params
    .iter()
    .zip(&values[preset])
    .any(|(param, &step)| step != param.step)
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

/// The octave as the screen shows it: `OCT ±0`, `OCT +1`, `OCT −2`.
pub fn octave_label(octave: i8) -> String {
  let sign = match octave {
    1.. => '+',
    ..=-1 => '−',
    0 => '±',
  };
  format!("OCT {sign}{}", octave.unsigned_abs())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn toggle_switches_away_from_what_shows() {
    assert_eq!(Theme::System.next(true), Theme::Light);
    assert_eq!(Theme::System.next(false), Theme::Dark);
    assert_eq!(Theme::Dark.next(false), Theme::Light);
  }

  #[test]
  fn octave_labels() {
    assert_eq!(octave_label(0), "OCT ±0");
    assert_eq!(octave_label(2), "OCT +2");
    assert_eq!(octave_label(-3), "OCT −3");
  }

  #[test]
  fn presets_reach_the_unshifted_keybed() {
    for preset in &PRESETS {
      let (lowest, highest) = preset.octaves;
      assert!((lowest..=highest).contains(&0), "{}", preset.name);
      for param in preset.params {
        assert!(
          param.step < param.values.len(),
          "{} {}",
          preset.name,
          param.name
        );
      }
    }
  }
}
