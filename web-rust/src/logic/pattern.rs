//! Drum patterns, as web-react's `drumPattern.ts`: the drum grid's hits,
//! a kit's rows, and moving a pattern or a take between kits.

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use sound_engine::patches::Patch;

use super::js::round;
use super::params::patch;
use super::timing::{Meter, PlayedNote, Take, Timing};

/// The keybed's first key, F3.
const F3_MIDI: i32 = 53;

/// A hit on the drum grid: which piece, how hard (0–1), and where, in
/// beats from the pattern's start. Kept in beats, so a change of resolution
/// moves it to the nearest step without losing where it was.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct DrumHit {
  pub piece: String,
  pub beat: f64,
  pub velocity: f64,
}

/// A drum pattern: `bars` bars of the meter, on a grid of `per_beat` steps
/// a beat, its hits written for `kit`. Hits past its end are kept for when
/// it grows again.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DrumPattern {
  pub per_beat: u32,
  pub bars: u32,
  pub hits: Vec<DrumHit>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub kit: Option<String>,
}

/// Steps a beat the blue knob picks from: eighths to 32nds, and triplets.
pub const STEP_RESOLUTIONS: [u32; 5] = [2, 3, 4, 6, 8];
pub const MAX_STEP_BARS: u32 = 8;

impl Default for DrumPattern {
  fn default() -> Self {
    Self {
      per_beat: 4,
      bars: 1,
      hits: Vec::new(),
      kit: None,
    }
  }
}

fn kit_keys(kit: &str) -> &'static [String] {
  match patch(kit) {
    Patch::Drums(kit) => &kit.keys,
    _ => &[],
  }
}

/// A kit's rows, top to bottom: its pieces as the keybed plays them from
/// its lowest key (F) up, each once, turned over so the lowest key's piece
/// (the kick) sits at the bottom, as on a piano roll.
pub fn kit_rows(kit: &str) -> Vec<&'static str> {
  let keys = kit_keys(kit);
  let mut rows: Vec<&'static str> = Vec::new();
  for i in 0..keys.len() {
    let piece = keys[(F3_MIDI as usize + i) % 12].as_str();
    if !rows.contains(&piece) {
      rows.push(piece);
    }
  }
  rows.reverse();
  rows
}

/// A drum hit's note in a take, fixed by the piece's name rather than the
/// key a kit puts it on: the General MIDI drum map for the kit pieces, and
/// a run from middle C for the hand-drum bols.
pub const PIECE_NOTES: [(&str, i32); 26] = [
  ("kick", 36),
  ("sticks", 31),
  ("stick", 37),
  ("snare", 38),
  ("clap", 39),
  ("sweep", 40),
  ("closedHat", 42),
  ("lowTom", 45),
  ("openHat", 46),
  ("crash", 49),
  ("highTom", 50),
  ("ride", 51),
  ("bell", 53),
  ("tambourine", 54),
  ("cowbell", 56),
  ("dha", 60),
  ("dhin", 61),
  ("na", 62),
  ("ta", 63),
  ("tin", 64),
  ("tun", 65),
  ("te", 66),
  ("ti", 67),
  ("ge", 68),
  ("ke", 69),
  ("ka", 70),
];

pub fn piece_note(piece: &str) -> i32 {
  PIECE_NOTES
    .iter()
    .find(|(name, _)| *name == piece)
    .map_or(0, |(_, note)| *note)
}

/// The piece a take's note strikes on a kit, if it is one.
pub fn note_piece(note: i32) -> Option<&'static str> {
  PIECE_NOTES
    .iter()
    .find(|(_, at)| *at == note)
    .map(|(piece, _)| *piece)
}

/// Where a stroke lands on a drum and how: the open bass, a slap on it, the
/// open treble, its rim with the fundamental damped, a slap on it, or bass
/// and treble at once.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Stroke {
  OpenBass,
  BassSlap,
  OpenTreble,
  TrebleRim,
  TrebleSlap,
  Both,
}

/// The hand drums' strokes by where they land; the first of each kind is
/// the one a stroke from elsewhere becomes.
fn hand_strokes(kit: &str) -> Option<&'static [(&'static str, Stroke)]> {
  use Stroke::*;
  match kit {
    "madal" => Some(&[
      ("dhin", OpenBass),
      ("ka", BassSlap),
      ("ta", OpenTreble),
      ("tin", TrebleRim),
      ("ti", TrebleSlap),
      ("dha", Both),
    ]),
    "tabla" => Some(&[
      ("ge", OpenBass),
      ("ke", BassSlap),
      ("tin", OpenTreble),
      ("tun", OpenTreble),
      ("na", TrebleRim),
      ("te", TrebleSlap),
      ("dha", Both),
      ("dhin", Both),
    ]),
    _ => None,
  }
}

/// A drum kit's pieces by the stroke that stands in for each on a hand
/// drum.
fn kit_stroke(piece: &str) -> Option<Stroke> {
  use Stroke::*;
  Some(match piece {
    "kick" => OpenBass,
    "closedHat" | "ride" | "bell" | "cowbell" => BassSlap,
    "openHat" => OpenTreble,
    "highTom" | "lowTom" => TrebleRim,
    "snare" | "clap" | "stick" | "sticks" | "tambourine" => TrebleSlap,
    "crash" => Both,
    _ => return None,
  })
}

/// The piece each stroke comes back as on a drum kit.
fn kit_piece(stroke: Stroke) -> &'static str {
  match stroke {
    Stroke::OpenBass | Stroke::Both => "kick",
    Stroke::BassSlap => "closedHat",
    Stroke::OpenTreble => "openHat",
    Stroke::TrebleRim => "highTom",
    Stroke::TrebleSlap => "snare",
  }
}

/// What `piece`, played on `from`, becomes on `to`: the same piece between
/// drum kits (each keeps its own), and to or from a hand drum the piece or
/// stroke landing the same way, where the kit has one.
fn carry_piece<'a>(piece: &'a str, from: &str, to: &str) -> &'a str {
  let from_hand = hand_strokes(from);
  let to_hand = hand_strokes(to);
  if from_hand.is_none() && to_hand.is_none() {
    return piece;
  }
  let stroke = match from_hand {
    Some(strokes) => strokes
      .iter()
      .find(|(name, _)| *name == piece)
      .map(|(_, stroke)| *stroke),
    None => kit_stroke(piece),
  };
  let Some(stroke) = stroke else {
    return piece;
  };
  let carried = match to_hand {
    Some(strokes) => strokes
      .iter()
      .find(|(_, other)| *other == stroke)
      .map(|(name, _)| *name),
    None => Some(kit_piece(stroke)),
  };
  match carried {
    Some(carried) if kit_rows(to).contains(&carried) => carried,
    _ => piece,
  }
}

/// The louder of two hits landing together, keyed `piece@where`, in the
/// order each key first landed.
fn keep_louder(hits: &mut IndexMap<String, DrumHit>, key: String, hit: DrumHit) {
  match hits.get_mut(&key) {
    Some(there) if there.velocity < hit.velocity => *there = hit,
    Some(_) => {}
    None => {
      hits.insert(key, hit);
    }
  }
}

/// The pattern written for `kit`: each hit moved to the piece or stroke
/// that plays it there (a kick to the madal's dhin, the madal's dhin to the
/// tabla's ge, and back), the louder kept where two land together.
pub fn carry_pattern(pattern: &DrumPattern, kit: &str) -> DrumPattern {
  let Some(from) = pattern.kit.as_deref() else {
    return DrumPattern {
      kit: Some(kit.into()),
      ..pattern.clone()
    };
  };
  if from == kit {
    return pattern.clone();
  }
  let mut hits = IndexMap::new();
  for hit in &pattern.hits {
    let piece = carry_piece(&hit.piece, from, kit);
    let key = format!("{piece}@{}", hit.beat);
    keep_louder(
      &mut hits,
      key,
      DrumHit {
        piece: piece.into(),
        ..hit.clone()
      },
    );
  }
  DrumPattern {
    kit: Some(kit.into()),
    hits: hits.into_values().collect(),
    ..pattern.clone()
  }
}

/// A take's note played on `from`, as `to` plays it: between kits the piece
/// or stroke that plays it there; an instrument's note on a kit the piece
/// its key strikes; a kit's note on an instrument the key on the keybed
/// (from F3) its piece sits on. `None` where nothing plays it.
pub fn carry_note(note: i32, from: &str, to: &str) -> Option<i32> {
  let is_kit = |bus: &str| matches!(patch(bus), Patch::Drums(_));
  if !is_kit(from) {
    return Some(if is_kit(to) {
      piece_note(&kit_keys(to)[note.rem_euclid(12) as usize])
    } else {
      note
    });
  }
  let piece = note_piece(note)?;
  if is_kit(to) {
    return Some(piece_note(carry_piece(piece, from, to)));
  }
  let key = kit_keys(from).iter().position(|key| key == piece)? as i32;
  Some(F3_MIDI + (key - F3_MIDI).rem_euclid(12))
}

pub fn pattern_steps(pattern: &DrumPattern, meter: Meter) -> u32 {
  pattern.bars * meter.beats * pattern.per_beat
}

pub fn hit_step(hit: &DrumHit, per_beat: u32) -> i64 {
  round(hit.beat * f64::from(per_beat)) as i64
}

pub fn hits_at(pattern: &DrumPattern, step: i64) -> Vec<&DrumHit> {
  pattern
    .hits
    .iter()
    .filter(|hit| hit_step(hit, pattern.per_beat) == step)
    .collect()
}

fn lands(pattern: &DrumPattern, piece: &str, step: i64, hit: &DrumHit) -> bool {
  hit.piece == piece && hit_step(hit, pattern.per_beat) == step
}

/// Adds `piece` at `step`, unless it already lands there.
pub fn add_hit(pattern: &DrumPattern, piece: &str, step: i64, velocity: f64) -> DrumPattern {
  let mut next = pattern.clone();
  if !pattern
    .hits
    .iter()
    .any(|hit| lands(pattern, piece, step, hit))
  {
    next.hits.push(DrumHit {
      piece: piece.into(),
      beat: step as f64 / f64::from(pattern.per_beat),
      velocity,
    });
  }
  next
}

/// Takes `piece` off `step` if it lands there, or else adds it.
pub fn toggle_hit(pattern: &DrumPattern, piece: &str, step: i64, velocity: f64) -> DrumPattern {
  if !pattern
    .hits
    .iter()
    .any(|hit| lands(pattern, piece, step, hit))
  {
    return add_hit(pattern, piece, step, velocity);
  }
  DrumPattern {
    hits: pattern
      .hits
      .iter()
      .filter(|hit| !lands(pattern, piece, step, hit))
      .cloned()
      .collect(),
    ..pattern.clone()
  }
}

/// The pattern as a take a track can keep, at `bpm`: each of the kit's hits
/// on its step, played by its key, one step long.
pub fn pattern_take(pattern: &DrumPattern, kit: &str, meter: Meter, bpm: f64) -> Take {
  let steps = i64::from(pattern_steps(pattern, meter));
  let step = 60_000. / bpm / f64::from(pattern.per_beat);
  let rows = kit_rows(kit);
  let mut notes: Vec<PlayedNote> = pattern
    .hits
    .iter()
    .filter(|hit| rows.contains(&hit.piece.as_str()) && hit_step(hit, pattern.per_beat) < steps)
    .map(|hit| PlayedNote {
      note: piece_note(&hit.piece),
      start: hit_step(hit, pattern.per_beat) as f64 * step,
      duration: step,
      velocity: hit.velocity,
    })
    .collect();
  notes.sort_by(|a, b| a.start.total_cmp(&b.start).then(a.note.cmp(&b.note)));
  Take {
    notes,
    length: steps as f64 * step,
    bpm,
  }
}

/// A kit's take (a drum track) as a pattern on its grid, or 1/16 for a free
/// one: each note becomes its piece's hit on the nearest step (the louder
/// of two landing together), over as many bars as the take runs, up to the
/// most a pattern has.
pub fn take_pattern(take: &Take, kit: &str, timing: &Timing) -> DrumPattern {
  let per_beat = if STEP_RESOLUTIONS.contains(&timing.per_beat) {
    timing.per_beat
  } else {
    4
  };
  let beat = 60_000. / take.bpm;
  let rows = kit_rows(kit);
  let mut hits = IndexMap::new();
  for note in &take.notes {
    let Some(piece) = note_piece(note.note).filter(|piece| rows.contains(piece)) else {
      continue;
    };
    let step = round(note.start / beat * f64::from(per_beat));
    keep_louder(
      &mut hits,
      format!("{piece}@{step}"),
      DrumHit {
        piece: piece.into(),
        beat: step / f64::from(per_beat),
        velocity: note.velocity,
      },
    );
  }
  let bars = (take.length / beat / f64::from(timing.meter.beats) - 1e-6).ceil();
  DrumPattern {
    per_beat,
    bars: bars.clamp(1., f64::from(MAX_STEP_BARS)) as u32,
    hits: hits.into_values().collect(),
    kit: Some(kit.into()),
  }
}

impl DrumPattern {
  /// Whether it has the shape web-react keeps (`isPattern`).
  pub fn is_valid(&self) -> bool {
    STEP_RESOLUTIONS.contains(&self.per_beat)
      && (1..=MAX_STEP_BARS).contains(&self.bars)
      && self.kit.as_deref().is_none_or(|kit| {
        sound_engine::patches::bus_index(kit).is_some() && matches!(patch(kit), Patch::Drums(_))
      })
      && self
        .hits
        .iter()
        .all(|hit| hit.beat.is_finite() && hit.velocity.is_finite())
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::logic::timing::FOUR_FOUR;

  fn hit(piece: &str, beat: f64) -> DrumHit {
    DrumHit {
      piece: piece.into(),
      beat,
      velocity: 0.8,
    }
  }

  #[test]
  fn kick_sits_at_the_bottom() {
    let rows = kit_rows("drums");
    assert_eq!(rows.last(), Some(&"kick"));
  }

  #[test]
  fn toggling_sets_and_clears() {
    let pattern = DrumPattern::default();
    let set = toggle_hit(&pattern, "kick", 2, 0.8);
    assert_eq!(set.hits, vec![hit("kick", 0.5)]);
    assert_eq!(toggle_hit(&set, "kick", 2, 0.8).hits, vec![]);
    assert_eq!(add_hit(&set, "kick", 2, 1.).hits.len(), 1);
  }

  #[test]
  fn patterns_become_takes_and_back() {
    let pattern = DrumPattern {
      hits: vec![hit("snare", 1.), hit("kick", 0.), hit("kick", 2.)],
      kit: Some("drums".into()),
      ..DrumPattern::default()
    };
    let take = pattern_take(&pattern, "drums", FOUR_FOUR, 120.);
    assert_eq!(take.length, 2000.);
    assert_eq!(
      take
        .notes
        .iter()
        .map(|note| (note.note, note.start))
        .collect::<Vec<_>>(),
      vec![(36, 0.), (38, 500.), (36, 1000.)]
    );
    let timing = Timing {
      bpm: 120.,
      per_beat: 4,
      ..crate::logic::timing::DEFAULT_TIMING
    };
    let back = take_pattern(&take, "drums", &timing);
    assert_eq!(back.bars, 1);
    assert_eq!(back.hits.len(), 3);
  }

  #[test]
  fn kicks_carry_to_the_madal_and_back() {
    let pattern = DrumPattern {
      hits: vec![hit("kick", 0.)],
      kit: Some("drums".into()),
      ..DrumPattern::default()
    };
    let madal = carry_pattern(&pattern, "madal");
    assert_eq!(madal.hits[0].piece, "dhin");
    let tabla = carry_pattern(&madal, "tabla");
    assert_eq!(tabla.hits[0].piece, "ge");
    assert_eq!(carry_pattern(&tabla, "drums").hits[0].piece, "kick");
  }

  #[test]
  fn notes_carry_between_instruments_and_kits() {
    assert_eq!(carry_note(60, "piano", "piano"), Some(60));
    let kick = piece_note("kick");
    assert_eq!(note_piece(kick), Some("kick"));
    let key = carry_note(kick, "drums", "piano").unwrap();
    assert!((53..65).contains(&key));
    assert_eq!(carry_note(key, "piano", "drums"), Some(kick));
  }
}
