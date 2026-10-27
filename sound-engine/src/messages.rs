//! The events the engine plays, in the same JSON shape as web-react's
//! `EngineEvent` (`app/lib/physical/messages.ts`), so the host can send
//! them as text and a test can play one list through both engines.

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum EngineEvent {
  NoteOn {
    instrument: String,
    note: f64,
    velocity: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    time: Option<f64>,
  },
  NoteOff {
    instrument: String,
    note: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    time: Option<f64>,
  },
  Hit {
    kit: String,
    piece: String,
    velocity: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    time: Option<f64>,
  },
  Sustain {
    instrument: String,
    down: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    time: Option<f64>,
  },
  Tick {
    accent: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    time: Option<f64>,
  },
  Param {
    target: String,
    id: String,
    value: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    time: Option<f64>,
  },
  AllNotesOff,
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
