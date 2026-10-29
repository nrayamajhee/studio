//! Tracks, as web-react's `tracks.ts`: a take kept on the tracks view with
//! the sound that played it, its timing, and where and how often it plays.

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

use super::modules::{ModuleSettings, module_values, modules_of};
use super::pattern::carry_note;
use super::presets::{Values, is_kit};
use super::timing::{MAX_TAKE_MS, PlayedNote, Take, Timeline, Timing, timeline};

/// An instrument as it was set up to play: which, at what octave, with
/// which params (its own and the master's), by owner.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct DeviceSound {
  pub target: String,
  pub octave: i32,
  pub overrides: IndexMap<String, Values>,
}

/// `sound` rendered through `modules` in place of the ones it was saved
/// with.
pub fn with_modules(sound: &DeviceSound, modules: &ModuleSettings) -> DeviceSound {
  let mut sound = sound.clone();
  let master = sound.overrides.entry("master".into()).or_default();
  for (id, value) in module_values(modules) {
    master.insert(id, value);
  }
  sound
}

/// A section of a track's take that plays in place of the whole take, in
/// the take's own beats from its start. It is kept while off, so it comes
/// back as it was.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct TrackLoop {
  pub start: f64,
  pub end: f64,
  pub on: bool,
}

/// The whole track again, from `start` (beats), its take (or clip) played
/// `repeats` times back to back.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct TrackCopy {
  pub start: f64,
  pub repeats: u32,
}

/// Where a track was made, and so the one place it opens again.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TrackSource {
  /// The piano roll: a take kept as a track.
  Roll,
  /// The drum grid: a pattern kept as a track.
  DrumGrid,
}

/// A take kept on the tracks view, with the sound and preset that played
/// it and its timing: its own tempo, which it plays at unless it follows
/// the tape's, and the meter and grid it was recorded on. `start` slides it
/// along the timeline, in the tape's beats.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
  pub id: String,
  pub name: String,
  pub color: String,
  pub preset_id: String,
  pub sound: DeviceSound,
  /// Missing on tracks saved before they kept their own; see
  /// [`track_modules`].
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub modules: Option<ModuleSettings>,
  /// Missing on tracks saved before they kept it; see [`track_source`].
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub source: Option<TrackSource>,
  pub take: Take,
  /// The instrument the take was played on; it plays on the track's own now
  /// (see [`track_take`]).
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub take_target: Option<String>,
  pub timing: Timing,
  /// Plays at the tape's tempo instead of its own; see [`follows_tape`].
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub follow_tape: Option<bool>,
  pub start: f64,
  /// 0–1, set in tenths by the red knob.
  pub volume: f64,
  pub muted: bool,
  pub soloed: bool,
  #[serde(default, rename = "loop", skip_serializing_if = "Option::is_none")]
  pub loop_: Option<TrackLoop>,
  /// How many times the take (or its loop) plays back to back; once if
  /// unset.
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub repeats: Option<u32>,
  /// The track again later on, after its first copy, in order along the
  /// timeline: with gaps between, never overlapping.
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub copies: Option<Vec<TrackCopy>>,
}

/// Note colours, one per track in turn, bright enough for the black screen.
pub const TRACK_COLORS: [&str; 6] = [
  "#f2884b", "#2f7de1", "#4ba078", "#a78bfa", "#ec4899", "#eab308",
];

/// A track's ADSR, LFO and FX, or for an older track the ones baked into
/// it.
pub fn track_modules(track: &Track) -> ModuleSettings {
  track
    .modules
    .clone()
    .unwrap_or_else(|| modules_of(track.sound.overrides.get("master")))
}

/// Where a track was made, or for an older track where it must have been:
/// the drum grid keeps a pattern as a kit's take with every note on the
/// grid, one step long.
pub fn track_source(track: &Track) -> TrackSource {
  if let Some(source) = track.source {
    return source;
  }
  let per_beat = track.timing.per_beat;
  if !is_kit(&track.sound.target) || per_beat == 0 {
    return TrackSource::Roll;
  }
  let step = 60_000. / track.take.bpm / f64::from(per_beat);
  let near = |a: f64, b: f64| (a - b).abs() < 1e-6 * step;
  let on_grid = track.take.notes.iter().all(|note| {
    near(note.start, super::js::round(note.start / step) * step) && near(note.duration, step)
  });
  if on_grid {
    TrackSource::DrumGrid
  } else {
    TrackSource::Roll
  }
}

/// Gives a track `modules`, and renders it through them.
pub fn set_modules(track: &mut Track, modules: ModuleSettings) {
  track.sound = with_modules(&track.sound, &modules);
  track.modules = Some(modules);
}

/// A number in base 36, as JavaScript's `toString(36)` writes a whole one.
pub fn base36(mut n: u64) -> String {
  const DIGITS: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
  let mut digits = Vec::new();
  loop {
    digits.push(DIGITS[(n % 36) as usize]);
    n /= 36;
    if n == 0 {
      break;
    }
  }
  digits.reverse();
  String::from_utf8(digits).unwrap_or_default()
}

/// What a new track is made from.
pub struct NewTrack<'a> {
  /// How many tracks the tape has, for its colour.
  pub count: usize,
  pub name: &'a str,
  pub take: &'a Take,
  pub preset_id: &'a str,
  pub sound: &'a DeviceSound,
  pub modules: &'a ModuleSettings,
  pub timing: Timing,
  pub source: TrackSource,
  /// `Date.now()`, for its id.
  pub now: f64,
}

/// The next track from a take, played in the piano roll or drawn in the
/// drum grid: named for its instrument, coloured in turn, unmuted, at the
/// top of the timeline. It keeps its own copy of the take and its effects.
pub fn make_track(new: NewTrack) -> Track {
  Track {
    id: format!("track-{}", base36(new.now as u64)),
    name: new.name.into(),
    color: TRACK_COLORS[new.count % TRACK_COLORS.len()].into(),
    preset_id: new.preset_id.into(),
    sound: with_modules(new.sound, new.modules),
    modules: Some(new.modules.clone()),
    source: Some(new.source),
    take: new.take.clone(),
    take_target: Some(new.sound.target.clone()),
    timing: new.timing,
    follow_tape: Some(false),
    start: 0.,
    volume: 1.,
    muted: false,
    soloed: false,
    loop_: None,
    repeats: Some(1),
    copies: None,
  }
}

/// A track's take as the tracks view draws it, in beats.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct TrackClip {
  /// One pass of the take, in beats.
  pub length: f64,
  /// Where the first pass starts after the track's start: a loop plays
  /// from its left edge.
  pub offset: f64,
  /// Each copy of the track, placed so none overlap.
  pub copies: Vec<TrackCopy>,
  /// The pass is the track's loop.
  pub looped: bool,
  pub notes: Vec<ClipNote>,
}

/// A note of a clip, as the lanes draw it: its pitch, and its start and length
/// in beats.
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
pub struct ClipNote {
  pub note: i32,
  pub start: f64,
  pub length: f64,
}

/// Whether a track plays at the tape's tempo rather than its own. One saved
/// before tracks kept a tempo does as it always did: on a grid it follows
/// the tape, and off one it plays as recorded.
pub fn follows_tape(track: &Track) -> bool {
  track.follow_tape.unwrap_or(track.timing.per_beat > 0)
}

/// The tempo a track plays at on a tape at `bpm`: the tape's, or its own.
pub fn track_bpm(track: &Track, bpm: f64) -> f64 {
  if follows_tape(track) {
    bpm
  } else {
    track.timing.bpm
  }
}

/// One of the take's own beats as the track plays it on a tape at `bpm`,
/// in ms.
fn take_beat_ms(track: &Track, bpm: f64) -> f64 {
  60_000. / track_bpm(track, bpm)
}

/// The take as the track's instrument plays it: the notes it was played
/// with, carried onto the instrument now on the track.
pub fn track_take(track: &Track) -> Take {
  let to = track.sound.target.as_str();
  let from = track.take_target.as_deref().unwrap_or(to);
  if from == to {
    return track.take.clone();
  }
  Take {
    notes: track
      .take
      .notes
      .iter()
      .filter_map(|played| {
        carry_note(played.note, from, to).map(|note| PlayedNote { note, ..*played })
      })
      .collect(),
    ..track.take.clone()
  }
}

/// The whole take as the track plays it on a tape at `bpm`, in ms.
fn played_timeline(track: &Track, bpm: f64) -> Timeline {
  timeline(
    Some(&track_take(track)),
    &Timing {
      bpm: track_bpm(track, bpm),
      ..track.timing
    },
  )
}

/// The whole take at its own tempo, in ms, in whole bars.
fn own_timeline(track: &Track) -> Timeline {
  timeline(
    Some(&track.take),
    &Timing {
      bpm: track.take.bpm,
      ..track.timing
    },
  )
}

/// A place on the timeline (beats at `bpm`) as beats into a track's take.
pub fn take_beats_at(track: &Track, bpm: f64, beats: f64) -> f64 {
  (beats - track.start) * (60_000. / bpm) / take_beat_ms(track, bpm)
}

/// The whole take's length in its own beats: how far a loop can reach.
pub fn take_beats(track: &Track) -> f64 {
  own_timeline(track).length / (60_000. / track.take.bpm)
}

/// The steps a beat a track's clip edges keep to: a drum-grid track's own,
/// or sixteenths on one from the piano roll.
pub fn grid_steps(track: &Track) -> u32 {
  if track.timing.per_beat == 0 {
    4
  } else {
    track.timing.per_beat
  }
}

/// What a loop's edges move by, in the take's beats: two steps.
pub fn loop_step(track: &Track) -> f64 {
  2. / f64::from(grid_steps(track))
}

/// The notes sounding in [from, to) ms, moved to start at 0, clipped to the
/// edges.
fn section(notes: &[PlayedNote], from: f64, to: f64) -> Vec<PlayedNote> {
  notes
    .iter()
    .filter(|note| note.start < to && note.start + note.duration > from)
    .map(|note| {
      let start = note.start.max(from);
      PlayedNote {
        start: start - from,
        duration: (note.start + note.duration).min(to) - start,
        ..*note
      }
    })
    .collect()
}

/// The track's loop, while it's switched on.
pub fn loop_on(track: &Track) -> Option<TrackLoop> {
  track.loop_.filter(|loop_| loop_.on)
}

/// One pass of a track's take on a tape at `bpm`, in ms: the whole take,
/// or while it loops just the loop.
pub fn pass_of(track: &Track, bpm: f64) -> Timeline {
  let pass = played_timeline(track, bpm);
  let Some(loop_) = loop_on(track) else {
    return pass;
  };
  let beat = take_beat_ms(track, bpm);
  let from = (loop_.start * beat).min(pass.length);
  let to = (loop_.end * beat).min(pass.length);
  Timeline {
    length: to - from,
    notes: section(&pass.notes, from, to),
  }
}

/// How many times the track plays back to back at its start (once, unless set).
pub fn repeats_of(track: &Track) -> u32 {
  track.repeats.unwrap_or(1)
}

/// Every copy of a track, the first its own start and repeats.
pub fn copies_of(track: &Track) -> Vec<TrackCopy> {
  let mut copies = vec![TrackCopy {
    start: track.start,
    repeats: repeats_of(track),
  }];
  copies.extend(track.copies.iter().flatten().copied());
  copies
}

/// Gives a track `copies`, the first as its own start and repeats.
pub fn set_copies(track: &mut Track, copies: &[TrackCopy]) {
  track.start = copies[0].start;
  track.repeats = Some(copies[0].repeats);
  track.copies = Some(copies[1..].to_vec());
}

/// `copies` in order with none overlapping, a pass `length` beats long:
/// each starts where it is or, if the one before reaches past that, where
/// it ends.
pub fn settle_copies(copies: &[TrackCopy], length: f64) -> Vec<TrackCopy> {
  let mut end = 0.;
  copies
    .iter()
    .map(|copy| {
      let at = copy.start.max(end);
      end = at + length * f64::from(copy.repeats);
      TrackCopy {
        start: at,
        repeats: copy.repeats,
      }
    })
    .collect()
}

/// A track's copies as they play at `bpm`, settled so none overlap.
pub fn placed_copies(track: &Track, bpm: f64) -> Vec<TrackCopy> {
  settle_copies(
    &copies_of(track),
    pass_of(track, bpm).length / (60_000. / bpm),
  )
}

/// Where each pass starts (ms) on a timeline `span` beats long at `bpm`:
/// for each copy, from its start (or its loop's left edge), then right
/// after the last, for each of its repeats that starts before the end.
pub fn starts_of(track: &Track, pass: &Timeline, bpm: f64, span: f64) -> Vec<f64> {
  let beat = 60_000. / bpm;
  let offset = loop_on(track).map_or(0., |loop_| loop_.start * take_beat_ms(track, bpm));
  let mut starts = Vec::new();
  for copy in settle_copies(&copies_of(track), pass.length / beat) {
    let mut at = copy.start * beat + offset;
    let mut played = 0;
    while pass.length > 0. && at < span * beat && played < copy.repeats {
      starts.push(at);
      at += pass.length;
      played += 1;
    }
  }
  starts
}

/// As many repeats as fit in an hour at `bpm`, the longest a take records.
pub fn max_repeats(track: &Track, bpm: f64) -> u32 {
  let length = pass_of(track, bpm).length;
  if length > 0. {
    ((MAX_TAKE_MS / length).floor() as u32).max(1)
  } else {
    1
  }
}

/// A track's take as the tracks view draws it at `bpm`, in beats.
pub fn clip_of(track: &Track, bpm: f64) -> TrackClip {
  let pass = pass_of(track, bpm);
  let beat = 60_000. / bpm;
  let looped = loop_on(track);
  TrackClip {
    length: pass.length / beat,
    offset: looped.map_or(0., |loop_| loop_.start * take_beat_ms(track, bpm) / beat),
    copies: settle_copies(&copies_of(track), pass.length / beat),
    looped: looped.is_some(),
    notes: pass
      .notes
      .iter()
      .map(|note| ClipNote {
        note: note.note,
        start: note.start / beat,
        length: note.duration / beat,
      })
      .collect(),
  }
}

/// The track cut down to its loop: the notes outside it deleted, those
/// across its edges clipped to them (never quantized), and the rest moved
/// up to the take's start, which slides (with every copy) to where the loop
/// was so it still sounds there. The clip is done with: the track plays
/// whole.
pub fn cut_to_loop(track: &Track, bpm: f64) -> Track {
  let Some(loop_) = track.loop_ else {
    return track.clone();
  };
  let beat = 60_000. / track.take.bpm;
  let from = loop_.start * beat;
  let to = (loop_.end * beat).min(own_timeline(track).length);
  // The loop's start in the tape's beats, as the track plays.
  let shift = loop_.start * take_beat_ms(track, bpm) / (60_000. / bpm);
  Track {
    take: Take {
      notes: section(&track.take.notes, from, to),
      length: to - from,
      bpm: track.take.bpm,
    },
    start: track.start + shift,
    copies: track.copies.as_ref().map(|copies| {
      copies
        .iter()
        .map(|copy| TrackCopy {
          start: copy.start + shift,
          ..*copy
        })
        .collect()
    }),
    loop_: None,
    ..track.clone()
  }
}

/// Whether a track is heard: not muted, and soloed whenever any track is.
pub fn audible(track: &Track, tracks: &[Track]) -> bool {
  !track.muted && (track.soloed || !tracks.iter().any(|other| other.soloed))
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::logic::modules::initial_modules;
  use crate::logic::timing::DEFAULT_TIMING;

  fn track(notes: Vec<PlayedNote>, length: f64) -> Track {
    make_track(NewTrack {
      count: 0,
      name: "Grand piano",
      take: &Take {
        notes,
        length,
        bpm: 120.,
      },
      preset_id: "piano",
      sound: &DeviceSound {
        target: "piano".into(),
        octave: 0,
        overrides: IndexMap::new(),
      },
      modules: &initial_modules(),
      timing: Timing {
        bpm: 120.,
        ..DEFAULT_TIMING
      },
      source: TrackSource::Roll,
      now: 1_700_000_000_000.,
    })
  }

  fn note(note: i32, start: f64, duration: f64) -> PlayedNote {
    PlayedNote {
      note,
      start,
      duration,
      velocity: 0.8,
    }
  }

  #[test]
  fn ids_are_base_36() {
    assert_eq!(base36(0), "0");
    assert_eq!(base36(35), "z");
    assert_eq!(base36(36), "10");
    assert_eq!(track(vec![], 0.).id, "track-loyw3v28");
  }

  #[test]
  fn passes_repeat_and_copies_settle() {
    let mut track = track(vec![note(60, 0., 500.)], 2000.);
    // A bar of 4/4 at 120 is 2 s, 4 beats.
    track.repeats = Some(3);
    let pass = pass_of(&track, 120.);
    assert_eq!(pass.length, 2000.);
    assert_eq!(starts_of(&track, &pass, 120., 32.), vec![0., 2000., 4000.]);
    let settled = settle_copies(
      &[
        TrackCopy {
          start: 0.,
          repeats: 2,
        },
        TrackCopy {
          start: 4.,
          repeats: 1,
        },
      ],
      4.,
    );
    assert_eq!(settled[1].start, 8.);
  }

  #[test]
  fn loops_cut_and_slide() {
    let mut track = track(vec![note(60, 0., 500.), note(62, 1000., 1500.)], 4000.);
    track.loop_ = Some(TrackLoop {
      start: 2.,
      end: 4.,
      on: true,
    });
    let pass = pass_of(&track, 120.);
    assert_eq!(pass.length, 1000.);
    assert_eq!(pass.notes, vec![note(62, 0., 1000.)]);
    let cut = cut_to_loop(&track, 120.);
    assert_eq!(cut.start, 2.);
    assert_eq!(cut.take.length, 1000.);
    assert!(cut.loop_.is_none());
  }

  #[test]
  fn solos_silence_the_rest() {
    let a = track(vec![], 0.);
    let mut b = a.clone();
    b.soloed = true;
    let tracks = vec![a.clone(), b.clone()];
    assert!(!audible(&a, &tracks));
    assert!(audible(&b, &tracks));
  }

  #[test]
  fn json_shape_is_web_reacts() {
    let track = track(vec![], 0.);
    let json = serde_json::to_value(&track).unwrap();
    assert_eq!(json["presetId"], "piano");
    assert_eq!(json["takeTarget"], "piano");
    assert_eq!(json["followTape"], false);
    assert!(json.get("loop").is_none());
    let back: Track = serde_json::from_value(json).unwrap();
    assert_eq!(back, track);
  }
}
