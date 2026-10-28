//! The port checked against web-react: `tests/fixtures.json` holds what
//! web-react's own functions give for a spread of inputs (see
//! `scripts/export-fixtures.tsx`), and each test here gets the same from
//! the Rust.

use serde::Serialize;
use serde_json::Value;

use super::beats::{beat_pattern, beat_preview, drum_beat};
use super::export::{MidiPart, mix_to_midi};
use super::flac::FlacEncoder;
use super::modules::{ModuleSettings, module_values, modules_of};
use super::params::{format_param, step_to_value, value_to_step};
use super::pattern::{DrumPattern, carry_note, carry_pattern, pattern_take, take_pattern};
use super::play_styles::{PlayStyle, chord_notes};
use super::presets::{KNOB_STEPS, PresetPaging, device_presets, preset_pages};
use super::progressions::{progression, progression_take};
use super::starter::starter_tapes;
use super::timing::{PlayedNote, Take, Timing, timeline};
use super::tracks::{Track, TrackLoop, clip_of, cut_to_loop, pass_of, starts_of};
use crate::store::library::{PresetLibrary, all_presets};
use crate::store::storage::js_numbers;

fn fixtures() -> &'static Value {
  use std::sync::OnceLock;
  static FIXTURES: OnceLock<Value> = OnceLock::new();
  FIXTURES.get_or_init(|| {
    serde_json::from_str(include_str!("../../tests/fixtures.json")).expect("fixtures parse")
  })
}

fn value<T: Serialize>(value: &T) -> Value {
  let mut value = serde_json::to_value(value).expect("serializes");
  js_numbers(&mut value);
  value
}

fn parse<T: serde::de::DeserializeOwned>(value: &Value) -> T {
  serde_json::from_value(value.clone()).expect("fixture parses")
}

/// Whether two JSON values agree, numbers to within rounding.
fn same(rust: &Value, react: &Value, path: &str) {
  match (rust, react) {
    (Value::Number(a), Value::Number(b)) => {
      let (a, b) = (a.as_f64().unwrap(), b.as_f64().unwrap());
      assert!(
        (a - b).abs() <= 1e-9 * a.abs().max(b.abs()).max(1.),
        "{path}: {a} ≠ {b}"
      );
    }
    (Value::Array(a), Value::Array(b)) => {
      assert_eq!(a.len(), b.len(), "{path}: lengths differ");
      for (i, (a, b)) in a.iter().zip(b).enumerate() {
        same(a, b, &format!("{path}[{i}]"));
      }
    }
    (Value::Object(a), Value::Object(b)) => {
      for key in a.keys().chain(b.keys()) {
        same(
          a.get(key).unwrap_or(&Value::Null),
          b.get(key).unwrap_or(&Value::Null),
          &format!("{path}.{key}"),
        );
      }
    }
    (a, b) => assert_eq!(a, b, "{path}"),
  }
}

#[test]
fn params_format_and_step_alike() {
  for case in fixtures()["params"].as_array().unwrap() {
    let patch = super::params::patch(case["patch"].as_str().unwrap());
    let spec = patch
      .base()
      .params
      .iter()
      .find(|spec| spec.id == case["id"])
      .unwrap();
    let steps = spec.options.as_ref().map_or(KNOB_STEPS, Vec::len);
    let path = format!("{}:{}", case["patch"], spec.id);
    for (step, expected) in case["steps"].as_array().unwrap().iter().enumerate() {
      let value = step_to_value(spec, step, steps);
      same(&Value::from(value), &expected[0], &path);
      assert_eq!(format_param(spec, value), expected[1], "{path} step {step}");
    }
    assert_eq!(
      value_to_step(spec, spec.default, steps),
      case["defaultStep"],
      "{path}"
    );
    assert_eq!(
      format_param(spec, spec.default),
      case["defaultText"],
      "{path}"
    );
  }
}

#[test]
fn timelines_alike() {
  let take: Take = parse(&fixtures()["take"]);
  for case in fixtures()["timelines"].as_array().unwrap() {
    let timing: Timing = parse(&case["timing"]);
    same(
      &value(&timeline(Some(&take), &timing)),
      &case["timeline"],
      "timeline",
    );
  }
}

#[test]
fn chords_lay_out_alike() {
  let chords: Vec<Vec<i32>> = parse(&fixtures()["chords"]);
  for case in fixtures()["styles"].as_array().unwrap() {
    let style: PlayStyle = parse(&case["style"]);
    for (midis, expected) in chords.iter().zip(case["notes"].as_array().unwrap()) {
      let notes = chord_notes(midis, &style, 187.5, 2000., 0.8);
      same(&value(&notes), expected, &format!("{} {midis:?}", style.id));
    }
  }
}

#[test]
fn progressions_alike() {
  for case in fixtures()["progressions"].as_array().unwrap() {
    let timing: Timing = parse(&case["timing"]);
    let style: PlayStyle = parse(&case["style"]);
    let take = progression_take(
      progression(case["id"].as_str().unwrap()),
      case["note"].as_i64().unwrap() as i32,
      &timing,
      &style,
    );
    same(&value(&take), &case["take"], case["id"].as_str().unwrap());
  }
}

#[test]
fn beats_and_patterns_alike() {
  for (i, case) in fixtures()["beats"].as_array().unwrap().iter().enumerate() {
    let id = case["id"].as_str().unwrap();
    let beat = drum_beat(id);
    let pattern = beat_pattern(beat);
    same(&value(&pattern), &case["pattern"], id);
    same(
      &value(&beat_preview(beat, 100. + i as f64)),
      &case["preview"],
      id,
    );
    let kit = case["carried"]["kit"].as_str().unwrap();
    let carried = carry_pattern(&pattern, kit);
    same(&value(&carried), &case["carried"]["pattern"], id);
    same(
      &value(&pattern_take(&carried, kit, beat.meter, 120.)),
      &case["take"],
      id,
    );
    let back = take_pattern(
      &pattern_take(&pattern, &beat.kit, beat.meter, 97.),
      &beat.kit,
      &Timing {
        bpm: 97.,
        meter: beat.meter,
        per_beat: beat.per_beat,
        swing: None,
      },
    );
    let expected: DrumPattern = parse(&case["back"]);
    same(&value(&back), &value(&expected), id);
  }
}

#[test]
fn notes_carry_alike() {
  for case in fixtures()["carries"].as_array().unwrap() {
    let (from, to) = (case["from"].as_str().unwrap(), case["to"].as_str().unwrap());
    let notes: Vec<Option<i32>> = (0..128).map(|note| carry_note(note, from, to)).collect();
    same(&value(&notes), &case["notes"], &format!("{from} → {to}"));
  }
}

#[test]
fn starter_tapes_alike() {
  same(
    &value(&starter_tapes()),
    &fixtures()["starterTapes"],
    "starterTapes",
  );
}

#[test]
fn tracks_play_alike() {
  let tapes = starter_tapes();
  let tracks: Vec<&Track> = tapes.iter().flat_map(|tape| &tape.tracks).collect();
  for (case, track) in fixtures()["tracks"].as_array().unwrap().iter().zip(tracks) {
    let i = track_index(&tapes, &track.id);
    let looped = Track {
      loop_: Some(TrackLoop {
        start: 1. + i as f64 * 0.5,
        end: 3. + i as f64,
        on: true,
      }),
      ..track.clone()
    };
    let bpm = case["bpm"].as_f64().unwrap();
    let pass = pass_of(&looped, bpm);
    let id = &track.id;
    same(&value(&pass), &case["pass"], id);
    same(
      &value(&starts_of(&looped, &pass, bpm, 64.)),
      &case["starts"],
      id,
    );
    same(&value(&clip_of(&looped, bpm)), &case["clip"], id);
    same(&value(&cut_to_loop(&looped, bpm)), &case["cut"], id);
    same(&value(&pass_of(track, bpm)), &case["whole"], id);
  }
}

/// A track's place on its tape, as the fixtures loop it.
fn track_index(tapes: &[super::starter::Tape], id: &str) -> usize {
  tapes
    .iter()
    .find_map(|tape| tape.tracks.iter().position(|track| track.id == id))
    .unwrap()
}

#[test]
fn modules_alike() {
  let case = &fixtures()["modules"];
  let modules: ModuleSettings = parse(&case["modules"]);
  let values = module_values(&modules);
  same(&value(&values), &case["values"], "values");
  same(&value(&modules_of(Some(&values))), &case["back"], "back");
}

#[test]
fn presets_list_alike() {
  let bands: Vec<String> = preset_pages(device_presets(), PresetPaging::Band)
    .into_iter()
    .map(|preset| preset.id)
    .collect();
  same(&value(&bands), &fixtures()["bands"], "bands");
  let all: Vec<String> = all_presets(&PresetLibrary::default())
    .into_iter()
    .map(|preset| preset.id)
    .collect();
  same(&value(&all), &fixtures()["allPresets"], "allPresets");
}

#[test]
fn flac_bytes_alike() {
  let length = fixtures()["flacInput"]["length"].as_u64().unwrap() as usize;
  let left: Vec<f32> = (0..length)
    .map(|i| (0.6 * (i as f64 * 0.031).sin() + 0.2 * (i as f64 * 0.47).sin()) as f32)
    .collect();
  let right: Vec<f32> = (0..length)
    .map(|i| if i < 4096 { left[i] } else { 0.25 })
    .collect();
  let mut encoder = FlacEncoder::new(44100);
  encoder.push(&left, &right);
  let header = encoder.finish();
  let bytes: Vec<u8> = header
    .into_iter()
    .chain(encoder.take_frames().into_iter().flatten())
    .collect();
  let expected: Vec<u8> = parse(&fixtures()["flac"]);
  assert_eq!(bytes.len(), expected.len());
  assert!(bytes == expected, "the FLAC bytes differ");
}

#[test]
fn midi_bytes_alike() {
  let take: Take = parse(&fixtures()["take"]);
  let drum = |note: i32, start: f64, velocity: f64, piece: &'static str| {
    (
      PlayedNote {
        note,
        start,
        duration: 100.,
        velocity,
      },
      Some(piece),
    )
  };
  let file = mix_to_midi(
    &[
      MidiPart {
        name: "Piano".into(),
        target: "piano".into(),
        kit: false,
        volume: 0.8,
        notes: take.notes.iter().map(|note| (*note, None)).collect(),
      },
      MidiPart {
        name: "Drums".into(),
        target: "drums".into(),
        kit: true,
        volume: 1.,
        notes: vec![drum(36, 0., 1., "kick"), drum(38, 500., 0.5, "snare")],
      },
    ],
    123.,
    super::timing::METERS[4],
  );
  let expected: Vec<u8> = parse(&fixtures()["midi"]);
  assert_eq!(file, expected);
}

#[test]
fn the_check_bites() {
  let fixtures = fixtures();
  assert_eq!(fixtures["starterTapes"].as_array().map(Vec::len), Some(2));
  assert!(
    fixtures["progressions"]
      .as_array()
      .is_some_and(|cases| cases.len() > 50)
  );
  let caught = std::panic::catch_unwind(|| {
    same(
      &serde_json::json!({ "a": [1, 2.5] }),
      &serde_json::json!({ "a": [1, 2.6] }),
      "x",
    )
  });
  assert!(caught.is_err());
  let caught =
    std::panic::catch_unwind(|| same(&serde_json::json!({ "a": 1 }), &serde_json::json!({}), "x"));
  assert!(caught.is_err());
}
