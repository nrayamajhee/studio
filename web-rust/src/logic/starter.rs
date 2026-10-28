//! The starter tapes a first visit opens on, as web-react's
//! `starterSong.ts`.

use serde::{Deserialize, Serialize};

use super::beats::{beat_pattern, drum_beat};
use super::modules::{ModuleSettings, initial_modules};
use super::pattern::pattern_take;
use super::play_styles::PlayStyle;
use super::presets::{
  DevicePreset, KNOB_STEPS, Values, device_presets, find_preset, preset_values,
};
use super::progressions::{progression, progression_take};
use super::swing::Swing;
use super::timing::{FOUR_FOUR, Meter, Take, Timing};
use super::tracks::{DeviceSound, NewTrack, Track, TrackSource, make_track};

/// A tape: a set of tracks, with the tempo, time signature and swing they
/// play at (straight without one).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Tape {
  pub id: String,
  pub name: String,
  pub bpm: f64,
  pub meter: Meter,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub swing: Option<Swing>,
  pub tracks: Vec<Track>,
}

/// The synth's level the Device starts at, in knob steps.
pub const INITIAL_LEVEL_STEP: usize = 8;
pub const INITIAL_VOLUME_STEP: usize = 10;

/// Starter 1, at 96 BPM: the Suspended progression with D as home in a
/// folk strum on the oscillator's plain sine, three times round; the New
/// jack swing beat from the third bar to a bar past the end; and over the
/// middle round, once, the same strum on the oscillator as it comes.
const TIMING: Timing = Timing {
  bpm: 96.,
  meter: FOUR_FOUR,
  per_beat: 0,
  swing: None,
};
const HOME: i32 = 62;
const ROUNDS: u32 = 3;
const DRUMS_IN: u32 = 2;
const DRUMS_OUT: u32 = 1;
const PLAIN_SINE: &[(&str, f64)] = &[("exciter.wave2", 0.)];

/// Starter 2, at 92 BPM: Homecoming with A as home, folk-strummed on the
/// oscillator, the beat, the bass guitar's up-down from bar 9 and the
/// fingerstyle electric's Alberti from bar 17 through its effects.
const TIMING_2: Timing = Timing { bpm: 92., ..TIMING };
const HOME_2: i32 = 57;
const TRIANGLE_AND_SQUARE: &[(&str, f64)] = &[
  ("exciter.wave", 1.),
  ("exciter.wave2", 3.),
  ("exciter.level2", 0.4),
  ("exciter.phase", 252.),
];

/// A preset's sound as the Device plays it at first: its own values at the
/// synth's starting level, the ADSR, LFO and FX off.
fn sound_of(preset: &DevicePreset, edits: &[(&str, f64)]) -> DeviceSound {
  let mut own = preset_values(preset);
  for &(id, value) in edits {
    own.insert(id.into(), value);
  }
  let mut master = Values::new();
  master.insert(
    "master.volume".into(),
    INITIAL_LEVEL_STEP as f64 / (KNOB_STEPS as f64 - 1.),
  );
  DeviceSound {
    target: preset.target.clone(),
    octave: preset.octave,
    overrides: [(preset.target.clone(), own), ("master".to_owned(), master)]
      .into_iter()
      .collect(),
  }
}

fn kept(
  count: usize,
  preset: &DevicePreset,
  take: &Take,
  sound: &DeviceSound,
  timing: Timing,
  source: TrackSource,
  modules: &ModuleSettings,
) -> Track {
  make_track(NewTrack {
    count,
    name: &preset.name,
    take,
    preset_id: &preset.id,
    sound,
    modules,
    timing,
    source,
    now: 0.,
  })
}

/// A progression on `home` in a play style, a chord to each bar of eighths.
fn played(id: &str, home: i32, timing: &Timing, style: &str) -> Take {
  progression_take(
    progression(id),
    home,
    timing,
    &PlayStyle {
      id: style.into(),
      per_beat: 2,
      ..PlayStyle::default()
    },
  )
}

struct BeatTrack {
  swing: Option<Swing>,
  bars: u32,
  track: Track,
}

/// The New jack swing beat as a track, at `timing`'s tempo with its swing.
fn beat_track(count: usize, timing: &Timing) -> BeatTrack {
  let beat = drum_beat("newJackSwing");
  let pattern = beat_pattern(beat);
  let presets = device_presets();
  let kit = presets
    .iter()
    .find(|preset| preset.target == beat.kit)
    .unwrap_or(&presets[0]);
  BeatTrack {
    swing: beat.swing,
    bars: pattern.bars,
    track: kept(
      count,
      kit,
      &pattern_take(&pattern, &beat.kit, timing.meter, timing.bpm),
      &sound_of(kit, &[]),
      Timing {
        per_beat: pattern.per_beat,
        swing: beat.swing,
        ..*timing
      },
      TrackSource::DrumGrid,
      &initial_modules(),
    ),
  }
}

fn starter_one() -> Tape {
  let beats = f64::from(TIMING.meter.beats);
  let strum = played("suspended", HOME, &TIMING, "folkStrum");
  let round_bars = progression("suspended").chords.len() as u32;
  let oscillator = find_preset("oscillator");
  let beat = beat_track(1, &TIMING);
  let song_bars = ROUNDS * round_bars;
  let modules = initial_modules();
  Tape {
    id: "tape-starter-1".into(),
    name: "Starter 1".into(),
    bpm: TIMING.bpm,
    meter: TIMING.meter,
    // The beat's, as loading it into the drum grid leaves it.
    swing: beat.swing,
    tracks: vec![
      Track {
        id: "starter-oscillator".into(),
        repeats: Some(ROUNDS),
        ..kept(
          0,
          oscillator,
          &strum,
          &sound_of(oscillator, PLAIN_SINE),
          TIMING,
          TrackSource::Roll,
          &modules,
        )
      },
      Track {
        id: "starter-drums".into(),
        start: f64::from(DRUMS_IN) * beats,
        repeats: Some((song_bars + DRUMS_OUT - DRUMS_IN).div_ceil(beat.bars)),
        ..beat.track
      },
      Track {
        id: "starter-sine-and-saw".into(),
        start: f64::from(round_bars) * beats,
        // Saved after the beat, with its swing.
        ..kept(
          2,
          oscillator,
          &strum,
          &sound_of(oscillator, &[]),
          Timing {
            swing: beat.swing,
            ..TIMING
          },
          TrackSource::Roll,
          &modules,
        )
      },
    ],
  }
}

fn starter_two() -> Tape {
  let bar = |n: u32| f64::from((n - 1) * TIMING_2.meter.beats);
  let beat = beat_track(0, &TIMING_2);
  let timing = Timing {
    swing: beat.swing,
    ..TIMING_2
  };
  let oscillator = find_preset("oscillator");
  let electric = find_preset("electricFinger");
  let bass = find_preset("bass");
  let initial = initial_modules();
  // FX on, its knobs on drive 4, chorus 10, delay 1 and reverb 6 (of 10).
  let mut electric_fx = initial.clone();
  electric_fx.on.fx = true;
  electric_fx.steps.fx = vec![4, 10, 1, 6];
  Tape {
    id: "tape-starter-2".into(),
    name: "Starter 2".into(),
    bpm: TIMING_2.bpm,
    meter: TIMING_2.meter,
    swing: beat.swing,
    tracks: vec![
      Track {
        id: "starter-2-drums".into(),
        follow_tape: Some(true),
        start: bar(3),
        // To the bass's last bar, 40.
        repeats: Some(38),
        ..beat.track
      },
      Track {
        id: "starter-2-oscillator".into(),
        follow_tape: Some(true),
        volume: 0.8,
        repeats: Some(3),
        ..kept(
          2,
          oscillator,
          &played("homecoming", HOME_2, &timing, "folkStrum"),
          &sound_of(oscillator, TRIANGLE_AND_SQUARE),
          timing,
          TrackSource::Roll,
          &initial,
        )
      },
      Track {
        id: "starter-2-electric".into(),
        follow_tape: Some(true),
        start: bar(17),
        volume: 0.7,
        repeats: Some(2),
        ..kept(
          2,
          electric,
          &played("homecoming", HOME_2, &timing, "alberti"),
          &sound_of(electric, &[]),
          timing,
          TrackSource::Roll,
          &electric_fx,
        )
      },
      Track {
        id: "starter-2-bass".into(),
        follow_tape: Some(true),
        start: bar(9),
        repeats: Some(4),
        ..kept(
          3,
          bass,
          &played("homecoming", HOME_2, &timing, "upDown"),
          &sound_of(bass, &[]),
          timing,
          TrackSource::Roll,
          &initial,
        )
      },
    ],
  }
}

/// The tapes a first visit holds, Starter 1 open.
pub fn starter_tapes() -> Vec<Tape> {
  vec![starter_one(), starter_two()]
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn starters_hold_their_tracks() {
    let tapes = starter_tapes();
    assert_eq!(tapes[0].tracks.len(), 3);
    assert_eq!(tapes[1].tracks.len(), 4);
    let drums = &tapes[0].tracks[1];
    assert_eq!(drums.start, 8.);
    assert!(drums.timing.swing.is_some());
    assert_eq!(drums.source, Some(TrackSource::DrumGrid));
    assert_eq!(
      tapes[1].tracks[2]
        .modules
        .as_ref()
        .map(|modules| modules.on.fx),
      Some(true)
    );
  }
}
