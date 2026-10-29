//! Drum beats, as web-react's `drumBeats.ts`: the beats come from
//! `data/beats.json` (see `scripts/export-data.tsx`); turning one into the
//! drum grid's pattern or a preview is ported here.

use std::sync::OnceLock;

use indexmap::IndexMap;
use serde::Deserialize;

use super::pattern::{DrumHit, DrumPattern, pattern_take};
use super::swing::Swing;
use super::timing::{Meter, PlayedNote, Take};

/// A drum beat for the drum grid, on the kit that suits it, with the tempo
/// it is heard at on record: each row a piece, a character a step (X
/// accented, x played, o a ghost note, . rest; spaces only mark the beats),
/// in `meter` at `per_beat` steps a beat, over as many bars as the rows run.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DrumBeat {
  pub id: String,
  pub name: String,
  pub style: String,
  pub kit: String,
  pub meter: Meter,
  pub per_beat: u32,
  pub rows: IndexMap<String, String>,
  /// The swing it is played with, which loading it sets on the tape; none
  /// leaves the tape's as it is.
  #[serde(default)]
  pub swing: Option<Swing>,
}

pub fn drum_beats() -> &'static [DrumBeat] {
  static BEATS: OnceLock<Vec<DrumBeat>> = OnceLock::new();
  BEATS.get_or_init(|| {
    serde_json::from_str(include_str!("../../data/beats.json"))
      .expect("data/beats.json holds beats")
  })
}

pub fn drum_beat(id: &str) -> &'static DrumBeat {
  let all = drum_beats();
  all.iter().find(|beat| beat.id == id).unwrap_or(&all[0])
}

/// A preview plays the beat round until it has run this many bars.
const PREVIEW_BARS: u32 = 4;

fn velocity(mark: char) -> Option<f64> {
  match mark {
    'X' => Some(1.),
    'x' => Some(0.8),
    'o' => Some(0.45),
    _ => None,
  }
}

/// The beat as the drum grid's pattern.
pub fn beat_pattern(beat: &DrumBeat) -> DrumPattern {
  let rows: Vec<(&str, Vec<char>)> = beat
    .rows
    .iter()
    .map(|(piece, row)| {
      (
        piece.as_str(),
        row.chars().filter(|mark| *mark != ' ').collect(),
      )
    })
    .collect();
  let length = rows.iter().map(|(_, row)| row.len()).max().unwrap_or(0);
  let hits = rows
    .iter()
    .flat_map(|(piece, row)| {
      row.iter().enumerate().filter_map(move |(step, &mark)| {
        velocity(mark).map(|velocity| DrumHit {
          piece: (*piece).into(),
          beat: step as f64 / f64::from(beat.per_beat),
          velocity,
        })
      })
    })
    .collect();
  let steps_per_bar = (beat.meter.beats * beat.per_beat) as usize;
  DrumPattern {
    per_beat: beat.per_beat,
    bars: length.div_ceil(steps_per_bar).max(1) as u32,
    hits,
    kit: Some(beat.kit.clone()),
  }
}

/// The beat as the drum grid will play it, on its kit at `bpm`, played
/// round for four bars: what the preview tape auditions.
pub fn beat_preview(beat: &DrumBeat, bpm: f64) -> Take {
  let pattern = beat_pattern(beat);
  let pass = pattern_take(&pattern, &beat.kit, beat.meter, bpm);
  let times = PREVIEW_BARS.div_ceil(pattern.bars);
  let notes = (0..times)
    .flat_map(|time| {
      pass.notes.iter().map(move |note| PlayedNote {
        start: note.start + f64::from(time) * pass.length,
        ..*note
      })
    })
    .collect();
  Take {
    notes,
    length: f64::from(times) * pass.length,
    bpm,
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::logic::pattern::kit_rows;

  #[test]
  fn beats_load_on_their_kits() {
    let beats = drum_beats();
    assert!(beats.len() > 50);
    for beat in beats {
      let rows = kit_rows(&beat.kit);
      for piece in beat.rows.keys() {
        assert!(rows.contains(&piece.as_str()), "{} {piece}", beat.id);
      }
    }
  }

  #[test]
  fn rows_become_hits() {
    let pattern = beat_pattern(drum_beat("boomTss"));
    assert_eq!(pattern.bars, 1);
    let kicks: Vec<f64> = pattern
      .hits
      .iter()
      .filter(|hit| hit.piece == "kick")
      .map(|hit| hit.beat)
      .collect();
    assert_eq!(kicks, vec![0., 2.]);
    let preview = beat_preview(drum_beat("boomTss"), 120.);
    assert_eq!(preview.length, 8000.);
    assert_eq!(preview.notes.len(), 16);
  }
}
