//! Takes and their timing, as web-react's `noteRecorder.ts`.
//!
//! A take is kept as played, with the tempo it was played at, so it plays
//! back with the same timing at any tempo or time signature later,
//! stretched to it. Presses are timed to the millisecond whatever the meter.

use serde::{Deserialize, Serialize};

use super::swing::{Swing, swing_notes, swing_on};

/// A note as played: MIDI note, when it started and how long it was held
/// (ms from the start of the take), and how hard (0–1, a MIDI velocity /
/// 127). On a kit the note names the piece struck (`PIECE_NOTES`), not the
/// key it was on.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct PlayedNote {
  pub note: i32,
  pub start: f64,
  pub duration: f64,
  pub velocity: f64,
}

/// A time signature: beats to the bar, and the note that gets the beat (4 a
/// quarter, 8 an eighth). The tempo counts these beats.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Meter {
  pub beats: u32,
  pub unit: u32,
}

const fn meter(beats: u32, unit: u32) -> Meter {
  Meter { beats, unit }
}

pub const METERS: [Meter; 7] = [
  meter(2, 4),
  meter(3, 4),
  meter(4, 4),
  meter(5, 4),
  meter(6, 8),
  meter(7, 8),
  meter(12, 8),
];

pub const FOUR_FOUR: Meter = METERS[2];

impl Meter {
  pub fn label(&self) -> String {
    format!("{}/{}", self.beats, self.unit)
  }

  /// Where a time signature is in [`METERS`] (stored ones are copies).
  pub fn index(&self) -> usize {
    METERS.iter().position(|meter| meter == self).unwrap_or(0)
  }
}

/// Where beats and bars fall, and on a drum-grid track the steps a beat it
/// was drawn on: 0 for the piano roll, whose takes keep their own timing.
/// Its swing bends the time it plays in; none is straight.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Timing {
  pub bpm: f64,
  pub meter: Meter,
  pub per_beat: u32,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub swing: Option<Swing>,
}

pub const DEFAULT_TIMING: Timing = Timing {
  bpm: 96.,
  meter: FOUR_FOUR,
  per_beat: 0,
  swing: None,
};

impl Timing {
  pub fn beat_ms(&self) -> f64 {
    beat_ms(self.bpm)
  }

  pub fn bar_ms(&self) -> f64 {
    f64::from(self.meter.beats) * self.beat_ms()
  }

  /// Steps a beat as a note value: in 4/4, 4 steps a beat are sixteenths
  /// and 3 are eighth-note triplets.
  pub fn grid_label(&self) -> String {
    if self.per_beat == 0 {
      return "Off".into();
    }
    let value = self.meter.unit * self.per_beat;
    if value.is_multiple_of(3) {
      format!("1/{}T", value / 3 * 2)
    } else {
      format!("1/{value}")
    }
  }
}

pub fn beat_ms(bpm: f64) -> f64 {
  60_000. / bpm
}

/// The longest a take records for, and the longest a track's repeats run.
pub const MAX_TAKE_MS: f64 = 60. * 60. * 1000.;

/// A take as played, with the tempo it was played at. It plays back with
/// the timing it was played with, stretched to the tempo, and loops in
/// whole bars of the meter.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Take {
  pub notes: Vec<PlayedNote>,
  pub length: f64,
  pub bpm: f64,
}

impl Take {
  pub fn empty(bpm: f64) -> Self {
    Self {
      notes: Vec::new(),
      length: 0.,
      bpm,
    }
  }
}

/// A take on its own timeline in ms.
#[derive(Clone, Debug, Default, PartialEq, Serialize)]
pub struct Timeline {
  pub length: f64,
  pub notes: Vec<PlayedNote>,
}

/// A take on its own timeline in ms at `timing`: its notes as played,
/// stretched from the tempo they were played at, keeping their beats, and
/// swung by its swing, over whole bars of the meter. A take stopped within
/// a sixteenth after a bar line ends on it, and a note held past the end
/// stops there.
pub fn timeline(take: Option<&Take>, timing: &Timing) -> Timeline {
  let Some(take) = take else {
    return Timeline::default();
  };
  let stretch = take.bpm / timing.bpm;
  let bar = timing.bar_ms();
  let length = ((take.length * stretch - timing.beat_ms() / 4.) / bar)
    .ceil()
    .max(1.)
    * bar;
  let stretched: Vec<PlayedNote> = take
    .notes
    .iter()
    .map(|note| PlayedNote {
      start: note.start * stretch,
      duration: note.duration * stretch,
      ..*note
    })
    .collect();
  let notes = match swing_on(timing.swing, timing.per_beat) {
    Some(swing) => swing_notes(&stretched, timing.beat_ms(), swing),
    None => stretched,
  };
  Timeline {
    length,
    notes: notes
      .into_iter()
      .filter(|note| note.start < length)
      .map(|note| PlayedNote {
        duration: note.duration.min(length - note.start),
        ..note
      })
      .collect(),
  }
}

/// Collects note-ons and note-offs into played notes. A pitch pressed again
/// while it is still down (a chord pad over a held key) stacks, and each
/// note-off ends the oldest press. Times are `performance.now()` ms.
#[derive(Clone, Debug)]
pub struct NoteRecorder {
  pub origin: f64,
  /// Each pitch's presses still down (start, velocity), the pitches in the
  /// order they were first pressed, as a JavaScript `Map` keeps them.
  held: Vec<(i32, Vec<(f64, f64)>)>,
  played: Vec<PlayedNote>,
}

impl NoteRecorder {
  pub fn new(origin: f64) -> Self {
    Self {
      origin,
      held: Vec::new(),
      played: Vec::new(),
    }
  }

  pub fn note_on(&mut self, note: i32, velocity: f64, at: f64) {
    let press = (at - self.origin, velocity);
    match self.held.iter_mut().find(|(pitch, _)| *pitch == note) {
      Some((_, presses)) => presses.push(press),
      None => self.held.push((note, vec![press])),
    }
  }

  pub fn note_off(&mut self, note: i32, at: f64) {
    let Some((_, presses)) = self.held.iter_mut().find(|(pitch, _)| *pitch == note) else {
      return;
    };
    if presses.is_empty() {
      return;
    }
    let (start, velocity) = presses.remove(0);
    self.played.push(PlayedNote {
      note,
      start,
      duration: at - self.origin - start,
      velocity,
    });
  }

  /// Everything so far by start time, with notes still down held until
  /// `at`.
  pub fn take(&self, at: f64) -> Vec<PlayedNote> {
    let end = at - self.origin;
    let mut notes = self.played.clone();
    for (note, presses) in &self.held {
      let note = *note;
      for &(start, velocity) in presses {
        notes.push(PlayedNote {
          note,
          start,
          duration: end - start,
          velocity,
        });
      }
    }
    notes.sort_by(|a, b| a.start.total_cmp(&b.start));
    notes
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn note(note: i32, start: f64, duration: f64) -> PlayedNote {
    PlayedNote {
      note,
      start,
      duration,
      velocity: 0.8,
    }
  }

  #[test]
  fn timelines_fill_whole_bars() {
    let take = Take {
      notes: vec![note(60, 0., 500.), note(62, 2400., 900.)],
      length: 2600.,
      bpm: 120.,
    };
    // 2 s a bar at 120: 2.6 s rounds up to two bars.
    let line = timeline(
      Some(&take),
      &Timing {
        bpm: 120.,
        ..DEFAULT_TIMING
      },
    );
    assert_eq!(line.length, 4000.);
    assert_eq!(line.notes[1].duration, 900.);
    // At 60 it stretches to twice as long.
    let slow = timeline(
      Some(&take),
      &Timing {
        bpm: 60.,
        ..DEFAULT_TIMING
      },
    );
    assert_eq!(slow.length, 8000.);
    assert_eq!(slow.notes[1].start, 4800.);
    // A take stopped just after a bar line ends on it.
    let short = Take {
      length: 2050.,
      ..take
    };
    let line = timeline(
      Some(&short),
      &Timing {
        bpm: 120.,
        ..DEFAULT_TIMING
      },
    );
    assert_eq!(line.length, 2000.);
    assert_eq!(line.notes.len(), 1);
  }

  #[test]
  fn recorder_stacks_presses() {
    let mut recorder = NoteRecorder::new(1000.);
    recorder.note_on(60, 0.8, 1000.);
    recorder.note_on(60, 0.5, 1100.);
    recorder.note_off(60, 1200.);
    let notes = recorder.take(1500.);
    assert_eq!(
      notes,
      vec![
        note(60, 0., 200.),
        PlayedNote {
          velocity: 0.5,
          ..note(60, 100., 400.)
        }
      ]
    );
  }

  #[test]
  fn grid_labels() {
    let timing = |per_beat, meter| Timing {
      per_beat,
      meter,
      ..DEFAULT_TIMING
    };
    assert_eq!(timing(4, FOUR_FOUR).grid_label(), "1/16");
    assert_eq!(timing(3, FOUR_FOUR).grid_label(), "1/8T");
    assert_eq!(timing(0, FOUR_FOUR).grid_label(), "Off");
    assert_eq!(timing(2, METERS[4]).grid_label(), "1/16");
  }
}
