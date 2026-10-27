//! The Device's state, as fluid signals.
//!
//! The UI and the browser listeners write here; fluid effects read it and
//! redraw only the attributes and text bound to what changed.

use std::cell::Cell;
use std::collections::{BTreeMap, BTreeSet};
use std::rc::Rc;

use fluid::{Context, Signal};
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
  overlay_shown: Rc<Cell<u32>>,
}

impl Device {
  pub fn new(ctx: &Context) -> Self {
    Self {
      theme: ctx.create_signal(Theme::stored()),
      system_dark: ctx.create_signal(system_dark()),
      preset: ctx.create_signal(0),
      octave: ctx.create_signal(0),
      held: ctx.create_signal(BTreeMap::new()),
      chord_key: ctx.create_signal(None),
      latched_chord: ctx.create_signal(None),
      held_pads: ctx.create_signal(BTreeSet::new()),
      shift_key: ctx.create_signal(false),
      latched: ctx.create_signal(false),
      volume: ctx.create_signal(KNOB_STEPS - 1),
      level: ctx.create_signal(8),
      selected: ctx.create_signal(0),
      values: ctx.create_signal(
        PRESETS
          .iter()
          .map(|preset| preset.params.iter().map(|param| param.step).collect())
          .collect(),
      ),
      overlay: ctx.create_signal(None),
      overlay_shown: Rc::default(),
    }
  }

  pub fn current(&self) -> &'static Preset {
    &PRESETS[*self.preset.get()]
  }

  /// The chord the keys play: the one a key holds, else the latched one.
  pub fn active_chord(&self) -> Option<usize> {
    let held = *self.chord_key.get();
    held.or(*self.latched_chord.get())
  }

  pub fn shift(&self) -> bool {
    *self.shift_key.get() || *self.latched.get()
  }

  /// Presses a keybed key: its note, or with a chord active the chord built
  /// on it.
  pub fn press(&self, root: u8) {
    if self.held.get().contains_key(&root) {
      return;
    }
    let intervals = self
      .active_chord()
      .map_or(&[0][..], |chord| CHORDS[chord].intervals);
    let octave = *self.octave.get();
    let notes = intervals
      .iter()
      .map(|interval| root + interval)
      .map(|semitone| (semitone, notes::midi(semitone, octave)))
      .collect();
    let mut held = self.held.get().clone();
    held.insert(root, notes);
    self.held.set(held);
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
    if !self.held_pads.get().is_empty() {
      self.held_pads.set(BTreeSet::new());
    }
  }

  pub fn hold_pad(&self, pad: usize, down: bool) {
    if self.held_pads.get().contains(&pad) == down {
      return;
    }
    let mut held = self.held_pads.get().clone();
    if down {
      held.insert(pad);
    } else {
      held.remove(&pad);
    }
    self.held_pads.set(held);
  }

  /// Shifts the keybed an octave, as far as the preset reaches.
  pub fn step_octave(&self, by: i8) {
    let octave = *self.octave.get();
    self.set_octave(octave + by);
  }

  fn set_octave(&self, octave: i8) {
    let (lowest, highest) = self.current().octaves;
    let next = octave.clamp(lowest, highest);
    if next != *self.octave.get() {
      self.octave.set(next);
    }
  }

  /// Switches the instrument, keeping the octave as far as it reaches and
  /// the picked parameter when it has one by that name.
  pub fn select_preset(&self, preset: usize) {
    if preset == *self.preset.get() {
      return;
    }
    let picked = self.param().0.name;
    let selected = PRESETS[preset]
      .params
      .iter()
      .position(|param| param.name == picked)
      .unwrap_or(0);
    self.selected.set(selected);
    self.preset.set(preset);
    let octave = *self.octave.get();
    self.set_octave(octave);
  }

  /// A chord pad's click latches its chord, or lets go of it.
  pub fn toggle_chord(&self, chord: usize) {
    let latched = *self.latched_chord.get();
    self.latched_chord.set(if latched == Some(chord) {
      None
    } else {
      Some(chord)
    });
  }

  /// A chord key holds its chord while down. It drops a latched chord, so
  /// that doesn't come back when the key is let go.
  pub fn hold_chord(&self, chord: usize) {
    if self.latched_chord.get().is_some() {
      self.latched_chord.set(None);
    }
    self.chord_key.set(Some(chord));
  }

  pub fn release_chord(&self, chord: usize) {
    if *self.chord_key.get() == Some(chord) {
      self.chord_key.set(None);
    }
  }

  pub fn toggle_latch(&self) {
    let latched = !*self.latched.get();
    self.latched.set(latched);
  }

  /// The parameter the green knob picked, with its value's knob step.
  pub fn param(&self) -> (&'static Param, usize) {
    let preset = *self.preset.get();
    let selected = *self.selected.get();
    (
      &PRESETS[preset].params[selected],
      self.values.get()[preset][selected],
    )
  }

  pub fn set_value(&self, step: usize) {
    let preset = *self.preset.get();
    let selected = *self.selected.get();
    let mut values = self.values.get().clone();
    values[preset][selected] = step;
    self.values.set(values);
  }

  pub fn set_volume(&self, step: usize) {
    self.volume.set(step);
    self.show_overlay("Volume", step);
  }

  pub fn set_level(&self, step: usize) {
    self.level.set(step);
    self.show_overlay("Level", step);
  }

  /// Shows a level over the screen; each turn starts its time over.
  fn show_overlay(&self, label: &'static str, step: usize) {
    self.overlay.set(Some((label, step)));
    let shown = self.overlay_shown.get() + 1;
    self.overlay_shown.set(shown);
    let (overlay, current) = (self.overlay.clone(), self.overlay_shown.clone());
    Timeout::new(OVERLAY_MS, move || {
      if current.get() == shown {
        overlay.set(None);
      }
    })
    .forget();
  }

  pub fn cycle_theme(&self) {
    let theme = self.theme.get().next(*self.system_dark.get());
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
