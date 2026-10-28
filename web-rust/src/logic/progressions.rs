//! Chord progressions, as web-react's `progressions.ts`: the progressions
//! themselves come from `data/progressions.json` (see
//! `scripts/export-data.tsx`); writing one into a take is ported here.

use std::sync::OnceLock;

use serde::Deserialize;

use super::js::round;
use super::play_styles::{PlayStyle, chord_notes};
use super::timing::{PlayedNote, Take, Timing};

/// The keybed has no velocity; every press plays mezzo-forte.
pub const KEY_VELOCITY: f64 = 0.8;

/// A chord of a progression: its root in semitones above the home note,
/// what it is built as, and, for an inversion, its bass note in semitones
/// above the root.
#[derive(Clone, Debug, PartialEq, Deserialize)]
pub struct Step(pub i32, pub String, pub i32);

/// A chord progression, a bar a chord, named for what it is called or the
/// song it is known for, in that song's key where one stands out.
#[derive(Clone, Debug, PartialEq, Deserialize)]
pub struct Progression {
  pub id: String,
  pub name: String,
  /// Roman numerals, case for quality (I major, i minor).
  pub numerals: String,
  pub group: String,
  pub key: String,
  pub chords: Vec<Step>,
}

pub fn progressions() -> &'static [Progression] {
  static PROGRESSIONS: OnceLock<Vec<Progression>> = OnceLock::new();
  PROGRESSIONS.get_or_init(|| {
    serde_json::from_str(include_str!("../../data/progressions.json"))
      .expect("data/progressions.json holds progressions")
  })
}

pub fn progression(id: &str) -> &'static Progression {
  let all = progressions();
  all
    .iter()
    .find(|progression| progression.id == id)
    .unwrap_or(&all[0])
}

/// A quality's intervals. An 11 is voiced as pop plays it, a 9sus4, with no
/// third under the 11th.
fn intervals(quality: &str) -> &'static [i32] {
  match quality {
    "maj" => &[0, 4, 7],
    "min" => &[0, 3, 7],
    "dim" => &[0, 3, 6],
    "aug" => &[0, 4, 8],
    "sus2" => &[0, 2, 7],
    "sus4" => &[0, 5, 7],
    "maj6" => &[0, 4, 7, 9],
    "min6" => &[0, 3, 7, 9],
    "maj7" => &[0, 4, 7, 11],
    "min7" => &[0, 3, 7, 10],
    "dom7" => &[0, 4, 7, 10],
    "minMaj7" => &[0, 3, 7, 11],
    "dim7" => &[0, 3, 6, 9],
    "dom9" => &[0, 4, 7, 10, 14],
    "dom11" => &[0, 5, 7, 10, 14],
    _ => &[0],
  }
}

/// A key's tonic, by name, as semitones above C.
fn tonic(key: &str) -> i32 {
  match key {
    "C" => 0,
    "C♯" | "D♭" => 1,
    "D" => 2,
    "E♭" => 3,
    "E" => 4,
    "F" => 5,
    "F♯" => 6,
    "G" => 7,
    "A♭" => 8,
    "A" => 9,
    "B♭" => 10,
    "B" => 11,
    _ => 0,
  }
}

/// The lowest note a progression's home lands on: every progression is
/// written with its home from G3 up to F♯4.
const HOME_LOW: i32 = 55;

/// The note a progression is auditioned on: its key's tonic.
pub fn preview_home(progression: &Progression) -> i32 {
  60 + tonic(&progression.key)
}

/// The tempo a progression is auditioned at: a little faster than the
/// tape's, by more the slower it is (×1.4 at 60 BPM, ×1.14 at 120, ×1.05
/// at 240).
pub fn preview_tempo(bpm: f64) -> f64 {
  round(bpm * (1. + 0.4 / (bpm / 60.).powf(1.5)))
}

/// The progression as a take at `timing`'s tempo, on `note` (moved by
/// octaves into the home range), played in `style` as the chord pads would
/// play it: each chord a bar long, its root moved by octaves to within a
/// half-octave of home, over its bass an octave down.
pub fn progression_take(
  progression: &Progression,
  note: i32,
  timing: &Timing,
  style: &PlayStyle,
) -> Take {
  let home = HOME_LOW + (note - HOME_LOW).rem_euclid(12);
  let bar = timing.bar_ms();
  let step_ms = timing.beat_ms() / f64::from(style.per_beat);
  // Each chord lets go just before the next, so it speaks again.
  let hold = bar - (timing.beat_ms() / 4.).min(40.);
  let mut notes: Vec<PlayedNote> = Vec::new();
  for (index, Step(offset, quality, bass)) in progression.chords.iter().enumerate() {
    // Written below home or an octave up, a root stays where it is put.
    let root = home
      + if *offset < 0 {
        *offset
      } else if *offset >= 12 {
        offset - 12
      } else {
        (offset + 5) % 12 - 5
      };
    let voicing: Vec<i32> = std::iter::once(root + bass - 12)
      .chain(intervals(quality).iter().map(|interval| root + interval))
      .filter(|note| (0..=127).contains(note))
      .collect();
    for played in chord_notes(&voicing, style, step_ms, hold, KEY_VELOCITY) {
      notes.push(PlayedNote {
        start: played.start + index as f64 * bar,
        ..played
      });
    }
  }
  Take {
    notes,
    length: progression.chords.len() as f64 * bar,
    bpm: timing.bpm,
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::logic::timing::DEFAULT_TIMING;

  #[test]
  fn progressions_load() {
    let all = progressions();
    assert!(all.len() > 50);
    assert_eq!(all[0].id, "axis");
    assert_eq!(progression("fastCar").numerals, "IV I vi V");
  }

  #[test]
  fn takes_lay_a_chord_a_bar() {
    let timing = Timing {
      bpm: 120.,
      ..DEFAULT_TIMING
    };
    let take = progression_take(progression("axis"), 60, &timing, &PlayStyle::default());
    assert_eq!(take.length, 8000.);
    // I on C4: C3 in the bass, then C4 E4 G4, held to just before the bar.
    let first: Vec<_> = take
      .notes
      .iter()
      .filter(|note| note.start == 0.)
      .map(|note| note.note)
      .collect();
    assert_eq!(first, vec![48, 60, 64, 67]);
    assert_eq!(take.notes[0].duration, 2000. - 40.);
    // V on G: within a half-octave of home, so below it.
    let second: Vec<_> = take
      .notes
      .iter()
      .filter(|note| note.start == 2000.)
      .map(|note| note.note)
      .collect();
    assert_eq!(second, vec![43, 55, 59, 62]);
  }

  #[test]
  fn previews_run_faster_when_slow() {
    assert_eq!(preview_tempo(60.), 84.);
    assert_eq!(preview_tempo(120.), 137.);
  }
}
