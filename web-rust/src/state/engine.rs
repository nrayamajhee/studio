//! What the Device plays, as web-react's `deviceEngine.ts`: the preset the
//! keys play and its params, notes and hits, the master's modules and
//! level, and renders of takes, all sent to sound-engine's host.

use std::cell::RefCell;
use std::collections::HashMap;

use indexmap::IndexMap;
use sound_engine::engine::Overrides;
use sound_engine::host::{Scrubber, Status, Synth, TrackMixer};
use sound_engine::messages::EngineEvent;
use web_sys::{AnalyserNode, AudioBuffer};

use crate::logic::params::master_param;
use crate::logic::pattern::{note_piece, piece_note};
use crate::logic::presets::{
  DevicePreset, Values, device_presets, is_kit, key_piece, preset_values,
};
use crate::logic::timing::PlayedNote;
use crate::logic::tracks::DeviceSound;

/// Rendered past a take's end, so its last notes and the reverb ring out
/// (s).
const RENDER_TAIL: f64 = 2.5;

pub struct Engine {
  synth: Synth,
  /// The preset the keys play.
  current: RefCell<DevicePreset>,
  /// What each keybed note started, newest last: the instrument and the
  /// note it played, so its note-off reaches them after a preset change.
  held: RefCell<HashMap<i32, Vec<(String, i32)>>>,
  /// The last value sent for each param, by `target:id`, in the order they
  /// were first sent.
  applied: RefCell<IndexMap<String, f64>>,
}

impl Engine {
  pub fn new() -> Self {
    Self {
      // The worklet's files sit next to the page.
      synth: Synth::new(""),
      current: RefCell::new(device_presets()[0].clone()),
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

  /// Whether the engine is running, so timed events land when they say.
  pub fn ready(&self) -> bool {
    self.synth.ready()
  }

  /// The audio clock (s), which timed hits are scheduled on.
  pub fn now(&self) -> f64 {
    self.synth.now()
  }

  pub fn analyser(&self) -> Option<AnalyserNode> {
    self.synth.analyser()
  }

  /// Sends a param only when its value actually changes.
  fn set_param(&self, target: &str, id: &str, value: f64) {
    let key = format!("{target}:{id}");
    if self.applied.borrow_mut().insert(key, value) == Some(value) {
      return;
    }
    self.synth.set_param(target, id, value);
  }

  /// Every param of the instrument goes back to its default unless the
  /// preset overrides it or it has been edited since, so switching presets
  /// never leaks settings between them.
  pub fn load_preset(&self, preset: &DevicePreset, edits: Option<&Values>) -> Values {
    *self.current.borrow_mut() = preset.clone();
    let mut values = preset_values(preset);
    for (id, &value) in edits.into_iter().flatten() {
      values.insert(id.clone(), value);
    }
    for (id, &value) in &values {
      self.set_param(&preset.target, id, value);
    }
    values
  }

  /// `midi` is the keybed note; the preset's octave offset is applied here
  /// and remembered so the note-off reaches the same instrument and note.
  pub fn note_on(&self, midi: i32, velocity: f64) {
    let (target, octave) = {
      let current = self.current.borrow();
      (current.target.clone(), current.octave)
    };
    let note = midi + octave;
    self
      .held
      .borrow_mut()
      .entry(midi)
      .or_default()
      .push((target.clone(), note));
    if is_kit(&target) {
      self
        .synth
        .hit(&target, key_piece(&target, midi), velocity, None);
    } else {
      self.synth.note_on(&target, note, velocity, None);
    }
  }

  /// The note a take keeps for a keybed key: on a kit, the piece's own
  /// note, whichever key it sits on; anything else, the key.
  pub fn take_note(&self, midi: i32) -> i32 {
    let current = self.current.borrow();
    if is_kit(&current.target) {
      piece_note(key_piece(&current.target, midi))
    } else {
      midi
    }
  }

  /// A take's note on the current sound, as `take_note` kept it: a kit
  /// strikes its piece; anything else plays it as the keybed note.
  pub fn play_note(&self, note: i32, velocity: f64) {
    let target = self.current.borrow().target.clone();
    if !is_kit(&target) {
      self.note_on(note, velocity);
    } else if let Some(piece) = note_piece(note) {
      self.synth.hit(&target, piece, velocity, None);
    }
  }

  /// A kit's piece, now or at `time` on the audio clock.
  pub fn hit(&self, kit: &str, piece: &str, velocity: f64, time: Option<f64>) {
    self.synth.hit(kit, piece, velocity, time);
  }

  /// A take's note on `target` at `octave` rather than the current
  /// preset's, at `time` on the audio clock: struck with a velocity, or let
  /// go with `None`. A kit hits the note's piece and ignores the let-go.
  pub fn note_at(&self, target: &str, octave: i32, midi: i32, velocity: Option<f64>, time: f64) {
    if is_kit(target) {
      if let (Some(velocity), Some(piece)) = (velocity, note_piece(midi)) {
        self.synth.hit(target, piece, velocity, Some(time));
      }
    } else {
      match velocity {
        None => self.synth.note_off(target, midi + octave, Some(time)),
        Some(velocity) => self
          .synth
          .note_on(target, midi + octave, velocity, Some(time)),
      }
    }
  }

  pub fn note_off(&self, midi: i32) {
    let entry = self.held.borrow_mut().get_mut(&midi).and_then(Vec::pop);
    if let Some((target, note)) = entry
      && !is_kit(&target)
    {
      self.synth.note_off(&target, note, None);
    }
  }

  /// The system volume, after the clipper: louder never clips.
  pub fn set_volume(&self, value: f64) {
    self.synth.set_volume(value);
  }

  /// The synth's level into the clipper, before the system volume: turning
  /// it down gives chords headroom.
  pub fn set_level(&self, value: f64) {
    self.set_param("master", "master.volume", value);
  }

  /// Sends a module's values, or with `None` switches it off by restoring
  /// the engine's defaults for those params.
  pub fn set_master_params(&self, values: &Values) {
    for (id, &value) in values {
      if master_param(id).is_some() {
        self.set_param("master", id, value);
      }
    }
  }

  /// Sets one param of the current instrument.
  pub fn set_value(&self, id: &str, value: f64) {
    let target = self.current.borrow().target.clone();
    self.set_param(&target, id, value);
  }

  pub fn metronome_tick(&self, accent: bool) {
    self.synth.tick(accent, None);
  }

  pub fn all_notes_off(&self) {
    self.held.borrow_mut().clear();
    self.synth.all_notes_off();
  }

  /// The current instrument, its octave and every param sent to it and the
  /// master: what an offline render needs to sound like the Device does
  /// now.
  pub fn sound(&self) -> DeviceSound {
    let current = self.current.borrow();
    let mut overrides: IndexMap<String, Values> = IndexMap::new();
    for (key, &value) in self.applied.borrow().iter() {
      let Some((owner, id)) = key.split_once(':') else {
        continue;
      };
      if owner != current.target && owner != "master" {
        continue;
      }
      overrides
        .entry(owner.to_owned())
        .or_default()
        .insert(id.to_owned(), value);
    }
    DeviceSound {
      target: current.target.clone(),
      octave: current.octave,
      overrides,
    }
  }

  /// A take's notes (ms) rendered offline with `sound`, for scrubbing a take
  /// or mixing tracks. `None` until the engine starts.
  pub async fn render(
    &self,
    notes: &[PlayedNote],
    length: f64,
    sound: &DeviceSound,
  ) -> Option<AudioBuffer> {
    let target = sound.target.as_str();
    let events: Vec<EngineEvent> = notes
      .iter()
      .flat_map(|note| {
        let time = note.start / 1000.;
        if is_kit(target) {
          note_piece(note.note)
            .map(|piece| EngineEvent::Hit {
              kit: target.into(),
              piece: piece.into(),
              velocity: note.velocity,
              time: Some(time),
            })
            .into_iter()
            .collect::<Vec<_>>()
        } else {
          let pitch = f64::from(note.note + sound.octave);
          vec![
            EngineEvent::NoteOn {
              instrument: target.into(),
              note: pitch,
              velocity: note.velocity,
              time: Some(time),
            },
            EngineEvent::NoteOff {
              instrument: target.into(),
              note: pitch,
              time: Some((note.start + note.duration) / 1000.),
            },
          ]
        }
      })
      .collect();
    let overrides: Overrides = sound
      .overrides
      .iter()
      .map(|(owner, values)| {
        (
          owner.clone(),
          values
            .iter()
            .map(|(id, value)| (id.clone(), *value))
            .collect(),
        )
      })
      .collect();
    self
      .synth
      .render(&events, length / 1000. + RENDER_TAIL, &overrides)
      .await
  }

  pub fn scrubber(&self, buffer: &AudioBuffer) -> Option<Scrubber> {
    self.synth.scrubber(buffer)
  }

  pub fn mixer(&self) -> Option<TrackMixer> {
    self.synth.mixer()
  }
}
