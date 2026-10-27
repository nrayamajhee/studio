//! The Device's sound, made as web-react's `deviceEngine` makes it: the
//! keybed's notes, the presets and the knobs sent to the engine, which
//! sound-engine runs in an AudioWorklet.

use std::cell::RefCell;
use std::collections::{BTreeMap, HashMap};

use sound_engine::host::{Status, Synth};
use web_sys::AnalyserNode;

use crate::device::KNOB_STEPS;
use crate::notes::F3_MIDI;
use crate::presets::Preset;

/// The keybed has no velocity; every press plays mezzo-forte.
pub const KEY_VELOCITY: f64 = 0.8;

pub struct Sound {
  synth: Synth,
  /// What each keybed note started, newest last: the instrument and the
  /// note it played, so its note-off reaches them after a preset change.
  held: RefCell<BTreeMap<u8, Vec<(&'static Preset, i32)>>>,
  /// The last value sent for each param, so only changes go out.
  applied: RefCell<HashMap<(&'static str, &'static str), f64>>,
}

impl Sound {
  pub fn new() -> Self {
    Self {
      // The worklet's files sit next to the page.
      synth: Synth::new(""),
      held: RefCell::default(),
      applied: RefCell::default(),
    }
  }

  /// Starts the engine on the first gesture, or resumes it.
  pub fn unlock(&self) {
    if self.synth.ready() {
      self.synth.resume();
    } else {
      self.synth.start();
    }
  }

  /// What the engine is doing, for the Debug panel.
  pub fn status(&self) -> Status {
    self.synth.status()
  }

  /// The output the scope draws, once the engine runs.
  pub fn analyser(&self) -> Option<AnalyserNode> {
    self.synth.analyser()
  }

  /// Sends every param of the preset's instrument: the knobs' at their
  /// steps, the rest at the preset's values, so switching presets never
  /// leaks settings between them.
  pub fn load_preset(&self, preset: &'static Preset, steps: &[usize]) {
    for (param, &step) in preset.params.iter().zip(steps) {
      self.set_param(preset.target, param.id, param.sends[step]);
    }
    for &(id, value) in preset.others {
      self.set_param(preset.target, id, value);
    }
  }

  pub fn set_value(&self, preset: &'static Preset, param: usize, step: usize) {
    let param = &preset.params[param];
    self.set_param(preset.target, param.id, param.sends[step]);
  }

  /// `midi` is the keybed's note; the preset's octave is added here. A kit
  /// strikes the piece on the key instead.
  pub fn note_on(&self, preset: &'static Preset, midi: u8) {
    let note = i32::from(midi) + preset.octave;
    self
      .held
      .borrow_mut()
      .entry(midi)
      .or_default()
      .push((preset, note));
    match preset.pieces {
      Some(pieces) => {
        let key = (i32::from(midi) - i32::from(F3_MIDI)).rem_euclid(12);
        self
          .synth
          .hit(preset.target, pieces[key as usize].id, KEY_VELOCITY);
      }
      None => self.synth.note_on(preset.target, note, KEY_VELOCITY),
    }
  }

  pub fn note_off(&self, midi: u8) {
    let entry = self.held.borrow_mut().get_mut(&midi).and_then(Vec::pop);
    if let Some((preset, note)) = entry
      && preset.pieces.is_none()
    {
      self.synth.note_off(preset.target, note);
    }
  }

  /// Lets go of everything still sounding.
  pub fn all_notes_off(&self) {
    self.held.borrow_mut().clear();
    self.synth.all_notes_off();
  }

  /// The system volume, after the clipper: louder never clips.
  pub fn set_volume(&self, step: usize) {
    self.synth.set_volume(amount(step));
  }

  /// The synth's level into the clipper, before the system volume: turning
  /// it down gives chords headroom.
  pub fn set_level(&self, step: usize) {
    self.set_param("master", "master.volume", amount(step));
  }

  fn set_param(&self, target: &'static str, id: &'static str, value: f64) {
    if self.applied.borrow_mut().insert((target, id), value) == Some(value) {
      return;
    }
    self.synth.set_param(target, id, value);
  }
}

/// A knob's step as a fraction of its travel.
fn amount(step: usize) -> f64 {
  step as f64 / (KNOB_STEPS - 1) as f64
}
