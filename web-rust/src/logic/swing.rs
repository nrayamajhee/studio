//! Swing: every second eighth or sixteenth pushed late. Within each pair the
//! first takes `amount` percent of the pair's time and the second the rest,
//! so 50 is straight and 75 a hard shuffle. It bends time rather than moving
//! notes: anything played, recorded or written plays through it, and a
//! triplet grid, already swung by where its steps fall, is left alone.

use serde::{Deserialize, Serialize};

use super::timing::{PlayedNote, Take};

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Swing {
  pub amount: f64,
  /// The steps a beat it swings: 2 for eighths, 4 for sixteenths (in 4/4).
  pub per_beat: u32,
}

pub const STRAIGHT: Swing = Swing {
  amount: 50.,
  per_beat: 4,
};
pub const MIN_SWING: f64 = 50.;
pub const MAX_SWING: f64 = 75.;
pub const SWING_UNITS: [u32; 2] = [2, 4];

impl Swing {
  /// Whether it is a swing web-react would keep (`isSwing`).
  pub fn is_valid(&self) -> bool {
    (MIN_SWING..=MAX_SWING).contains(&self.amount) && SWING_UNITS.contains(&self.per_beat)
  }
}

/// The swing that applies on a grid of `per_beat` steps (0 for the piano
/// roll's none), or `None` when it plays straight: no swing, or a triplet
/// grid.
pub fn swing_on(swing: Option<Swing>, per_beat: u32) -> Option<Swing> {
  swing.filter(|swing| swing.amount > MIN_SWING && (per_beat == 0 || !per_beat.is_multiple_of(3)))
}

/// `t` (ms from a beat) as `swing` plays it at `beat_ms` a beat.
pub fn swing_time(t: f64, beat_ms: f64, swing: Swing) -> f64 {
  let pair = 2. * beat_ms / f64::from(swing.per_beat);
  let share = swing.amount / 100.;
  let from = (t / pair).floor() * pair;
  let x = t - from;
  from
    + if x < pair / 2. {
      x * 2. * share
    } else {
      share * pair + (x - pair / 2.) * 2. * (1. - share)
    }
}

/// Where a time `swing_time` gives back came from: what was played swung,
/// as it would be straight.
pub fn straight_time(t: f64, beat_ms: f64, swing: Swing) -> f64 {
  let pair = 2. * beat_ms / f64::from(swing.per_beat);
  let share = swing.amount / 100.;
  let from = (t / pair).floor() * pair;
  let x = t - from;
  from
    + if x < share * pair {
      x / (2. * share)
    } else {
      pair / 2. + (x - share * pair) / (2. * (1. - share))
    }
}

/// Notes moved through `shift`, each end with its start.
fn moved(notes: &[PlayedNote], shift: impl Fn(f64) -> f64) -> Vec<PlayedNote> {
  notes
    .iter()
    .map(|note| {
      let start = shift(note.start);
      PlayedNote {
        start,
        duration: shift(note.start + note.duration) - start,
        ..*note
      }
    })
    .collect()
}

/// Notes on a straight timeline (ms from a beat) as `swing` plays them.
pub fn swing_notes(notes: &[PlayedNote], beat_ms: f64, swing: Swing) -> Vec<PlayedNote> {
  moved(notes, |t| swing_time(t, beat_ms, swing))
}

/// A take written straight, at its own tempo, as `swing` plays it (none
/// leaves it straight): for a preview, which plays the notes as they are.
pub fn swung_take(take: Take, swing: Option<Swing>) -> Take {
  match swing {
    Some(swing) => Take {
      notes: swing_notes(&take.notes, 60_000. / take.bpm, swing),
      ..take
    },
    None => take,
  }
}

/// Notes as played through `swing`, put back straight.
pub fn straighten_notes(notes: &[PlayedNote], beat_ms: f64, swing: Swing) -> Vec<PlayedNote> {
  moved(notes, |t| straight_time(t, beat_ms, swing))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn swing_pushes_the_second_of_each_pair() {
    let swing = Swing {
      amount: 66.,
      per_beat: 2,
    };
    // At 500 ms a beat, eighths: the off-beat lands two-thirds through.
    assert!((swing_time(250., 500., swing) - 330.).abs() < 1e-9);
    assert_eq!(swing_time(500., 500., swing), 500.);
    for t in [0., 100., 250., 330., 420., 777.] {
      let back = straight_time(swing_time(t, 500., swing), 500., swing);
      assert!((back - t).abs() < 1e-9, "{t}");
    }
  }

  #[test]
  fn triplets_and_straight_play_straight() {
    assert!(swing_on(Some(STRAIGHT), 4).is_none());
    let swing = Swing {
      amount: 60.,
      per_beat: 4,
    };
    assert!(swing_on(Some(swing), 3).is_none());
    assert!(swing_on(Some(swing), 4).is_some());
    assert!(swing_on(Some(swing), 0).is_some());
  }
}
