//! The events the engine plays, in the same JSON shape as web-react's
//! `EngineEvent` (`web-react/app/lib/physical/messages.ts`), so the host
//! can send them as text and a test can play one list through both engines.

use serde::{Deserialize, Serialize};

/// One thing for the engine to do, tagged by `type` in JSON. Every event but
/// the last two may carry a `time` in seconds on the audio clock; without one
/// it plays as soon as possible.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum EngineEvent {
  /// Plays `note` (a MIDI note) on the instrument with the id `instrument`, at
  /// `velocity` (0–1).
  NoteOn {
    instrument: String,
    note: f64,
    velocity: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    time: Option<f64>,
  },
  /// Releases `note` on the instrument with the id `instrument`.
  NoteOff {
    instrument: String,
    note: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    time: Option<f64>,
  },
  /// Hits the kit's `piece` (kick, snare…) at `velocity` (0–1).
  Hit {
    kit: String,
    piece: String,
    velocity: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    time: Option<f64>,
  },
  /// Presses (`down`) or lets go of the instrument's sustain pedal.
  Sustain {
    instrument: String,
    down: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    time: Option<f64>,
  },
  /// A metronome click, accented on the bar's first beat.
  Tick {
    accent: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    time: Option<f64>,
  },
  /// Sets the param `id` of `target` (an instrument's id, or "master") to
  /// `value`, clamped to its range.
  Param {
    target: String,
    id: String,
    value: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    time: Option<f64>,
  },
  /// Releases every instrument's notes.
  AllNotesOff,
  /// Silences every voice and the reverb at once.
  Panic,
}

impl EngineEvent {
  /// When it plays, in seconds of the audio clock; None for as soon as
  /// possible.
  pub fn time(&self) -> Option<f64> {
    match self {
      Self::NoteOn { time, .. }
      | Self::NoteOff { time, .. }
      | Self::Hit { time, .. }
      | Self::Sustain { time, .. }
      | Self::Tick { time, .. }
      | Self::Param { time, .. } => *time,
      Self::AllNotesOff | Self::Panic => None,
    }
  }
}

/// What the engine reports back, as web-react's `EngineStats`.
#[derive(Serialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EngineStats {
  pub active_voices: usize,
  pub reverb_awake: bool,
}
