//! The instruments the Device plays, as web-react's `deviceEngine.ts`
//! defines them: the built-in presets, how the library pages them, and what
//! a preset sounds like before any edit.

use std::sync::OnceLock;

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use sound_engine::patches::Patch;

use super::params::{Family, family, patch};

/// Param values by id, in the order they were set.
pub type Values = IndexMap<String, f64>;

/// Every knob turns through eleven steps, 0–100% in tens, unless a param
/// has fewer.
pub const KNOB_STEPS: usize = 11;

/// An instrument as the keys play it: which, at what octave, with which
/// params overridden.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DevicePreset {
  pub id: String,
  pub name: String,
  /// Key into the preset icons; anything else shows on the pad as text.
  pub icon: String,
  /// Saved from the Device rather than built in.
  #[serde(default, skip_serializing_if = "std::ops::Not::not")]
  pub user: bool,
  pub target: String,
  /// Semitones added to keybed notes so each instrument plays in its
  /// register.
  pub octave: i32,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub overrides: Option<Values>,
  /// The instrument pad (0–5) a built-in starts on, and the one it starts
  /// on as a Shift alternate: instruments on 0–2, kits on 3–5.
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub pad: Option<usize>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub shift_pad: Option<usize>,
}

/// A built-in preset as the table writes it.
struct Builtin {
  id: &'static str,
  icon: &'static str,
  name: &'static str,
  target: &'static str,
  octave: i32,
  overrides: &'static [(&'static str, f64)],
  pad: Option<usize>,
  shift_pad: Option<usize>,
}

/// A built-in preset on `target` at `octave`, with no overrides or pads.
const fn builtin(
  id: &'static str,
  icon: &'static str,
  name: &'static str,
  target: &'static str,
  octave: i32,
) -> Builtin {
  Builtin {
    id,
    icon,
    name,
    target,
    octave,
    overrides: &[],
    pad: None,
    shift_pad: None,
  }
}

/// The preset, on instrument pad `pad`.
const fn on_pad(preset: Builtin, pad: usize) -> Builtin {
  Builtin {
    pad: Some(pad),
    ..preset
  }
}

/// The preset, on instrument pad `pad` with Shift.
const fn on_shift_pad(preset: Builtin, pad: usize) -> Builtin {
  Builtin {
    shift_pad: Some(pad),
    ..preset
  }
}

/// The preset, with `overrides` over its instrument's defaults.
const fn with(preset: Builtin, overrides: &'static [(&'static str, f64)]) -> Builtin {
  Builtin {
    overrides,
    ..preset
  }
}

/// Fingertips rather than a pick: warmer and rounder, over the soundhole.
const FINGERS: &[(&str, f64)] = &[
  ("exciter.pluck", 1.),
  ("exciter.hardness", 0.35),
  ("exciter.position", 0.22),
];

/// The built-in presets. The library groups them by model, keeping this
/// order within each.
const BUILTINS: [Builtin; 35] = [
  on_pad(builtin("piano", "piano", "Grand piano", "piano", 0), 0),
  builtin("harmonium", "harmonium", "Harmonium", "harmonium", 0),
  builtin(
    "electricGuitar",
    "electric",
    "Picked electric",
    "electricGuitar",
    0,
  ),
  on_pad(
    with(
      builtin(
        "electricFinger",
        "electric",
        "Fingerstyle electric",
        "electricGuitar",
        0,
      ),
      FINGERS,
    ),
    1,
  ),
  builtin("guitar", "guitar", "Picked guitar", "guitar", 0),
  with(
    builtin("guitarFinger", "guitar", "Fingerstyle guitar", "guitar", 0),
    FINGERS,
  ),
  builtin("bass", "bass", "Bass guitar", "bass", -24),
  builtin("nylonGuitar", "nylon", "Nylon guitar", "nylonGuitar", 0),
  builtin("ukulele", "ukulele", "Ukulele", "ukulele", 0),
  builtin("banjo", "banjo", "Banjo", "banjo", 0),
  on_pad(builtin("violin", "violin", "Violin", "violin", 0), 2),
  builtin("cello", "cello", "Cello", "cello", -12),
  on_shift_pad(
    builtin("uprightBass", "upright", "Upright bass", "uprightBass", -24),
    1,
  ),
  builtin("harp", "harp", "Harp", "harp", 0),
  builtin("sitar", "sitar", "Sitar", "sitar", 0),
  builtin("trumpet", "trumpet", "Trumpet", "trumpet", 0),
  builtin(
    "bassTrumpet",
    "bassTrumpet",
    "Bass trumpet",
    "bassTrumpet",
    -12,
  ),
  builtin("trombone", "trombone", "Trombone", "trombone", -12),
  on_shift_pad(builtin("flute", "wind", "Flute", "flute", 12), 2),
  builtin("clarinet", "clarinet", "Clarinet", "clarinet", 0),
  builtin("saxophone", "sax", "Alto sax", "saxophone", 0),
  builtin("harmonica", "harmonica", "Harmonica", "harmonica", 12),
  builtin("accordion", "accordion", "Accordion", "accordion", 0),
  builtin("xylophone", "xylophone", "Xylophone", "xylophone", 12),
  builtin("steelPan", "steelPan", "Steel pan", "steelPan", 0),
  builtin("kalimba", "kalimba", "Kalimba", "kalimba", 0),
  builtin("drums", "drum", "Drum kit", "drums", 0),
  on_pad(builtin("rockDrums", "rock", "Rock kit", "rockDrums", 0), 3),
  on_shift_pad(builtin("jazzDrums", "jazz", "Jazz kit", "jazzDrums", 0), 3),
  builtin(
    "jazzStickDrums",
    "jazzSticks",
    "Jazz stick kit",
    "jazzStickDrums",
    0,
  ),
  on_pad(builtin("drums808", "drum808", "808 kit", "drums808", 0), 4),
  on_shift_pad(builtin("drums909", "drum909", "909 kit", "drums909", 0), 4),
  on_pad(builtin("madal", "madal", "Madal", "madal", 0), 5),
  on_shift_pad(builtin("tabla", "tabla", "Tabla", "tabla", 0), 5),
  on_shift_pad(
    builtin("oscillator", "waveform", "Oscillator", "oscillator", 0),
    0,
  ),
];

/// The built-in presets, made once.
pub fn device_presets() -> &'static [DevicePreset] {
  static PRESETS: OnceLock<Vec<DevicePreset>> = OnceLock::new();
  PRESETS.get_or_init(|| {
    BUILTINS
      .iter()
      .map(|builtin| DevicePreset {
        id: builtin.id.into(),
        name: builtin.name.into(),
        icon: builtin.icon.into(),
        user: false,
        target: builtin.target.into(),
        octave: builtin.octave,
        overrides: (!builtin.overrides.is_empty()).then(|| {
          builtin
            .overrides
            .iter()
            .map(|&(id, value)| (id.to_owned(), value))
            .collect()
        }),
        pad: builtin.pad,
        shift_pad: builtin.shift_pad,
      })
      .collect()
  })
}

/// A built-in preset by id, or the first.
pub fn find_preset(id: &str) -> &'static DevicePreset {
  let presets = device_presets();
  presets
    .iter()
    .find(|preset| preset.id == id)
    .unwrap_or(&presets[0])
}

/// The library is grouped by the engine's models, in this order: a built-in
/// sits with the others its instrument's model plays.
fn model_name(family: Family) -> &'static str {
  match family {
    Family::String => "Struck & plucked",
    Family::Bowed => "Bowed",
    Family::Bore => "Blown",
    Family::Reed => "Free reeds",
    Family::Bar => "Tuned percussion",
    Family::Drums => "Drums",
    Family::Oscillator => "Oscillator",
  }
}

/// Saved presets come last, in a group of their own.
pub const PRESET_CATEGORIES: [&str; 8] = [
  "Struck & plucked",
  "Bowed",
  "Blown",
  "Free reeds",
  "Tuned percussion",
  "Drums",
  "Oscillator",
  "Saved",
];

/// The model a preset is listed under (or Saved, for one saved from the
/// Device).
pub fn preset_category(preset: &DevicePreset) -> &'static str {
  if preset.user {
    "Saved"
  } else {
    model_name(family(patch(&preset.target)))
  }
}

/// The library's other way of paging: by the band each built-in plays in,
/// in this order. Saved presets still come last.
const PRESET_BANDS: [(&str, &[&str]); 7] = [
  (
    "Rock band",
    &[
      "rockDrums",
      "drums",
      "electricGuitar",
      "electricFinger",
      "bass",
    ],
  ),
  (
    "Jazz combo",
    &[
      "jazzDrums",
      "jazzStickDrums",
      "piano",
      "uprightBass",
      "saxophone",
      "trumpet",
      "trombone",
      "clarinet",
    ],
  ),
  (
    "Orchestra",
    &[
      "violin",
      "cello",
      "harp",
      "flute",
      "bassTrumpet",
      "xylophone",
    ],
  ),
  (
    "Folk",
    &[
      "guitar",
      "guitarFinger",
      "nylonGuitar",
      "ukulele",
      "banjo",
      "harmonica",
      "accordion",
    ],
  ),
  ("South Asian", &["sitar", "harmonium", "tabla", "madal"]),
  ("World", &["steelPan", "kalimba"]),
  ("Electronic", &["drums808", "drums909", "oscillator"]),
];

/// How the library pages its presets: by the model that plays them, or by
/// the band they play in.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum PresetPaging {
  /// By the model that plays them: Strings, Winds and so on.
  #[default]
  Model,
  /// By the band they play in.
  Band,
}

/// The band a preset is listed under (or Saved, for one saved from the Device).
pub fn preset_band(preset: &DevicePreset) -> &'static str {
  if preset.user {
    return "Saved";
  }
  PRESET_BANDS
    .iter()
    .find(|(_, ids)| ids.contains(&preset.id.as_str()))
    .map_or("Saved", |(name, _)| name)
}

/// The category a preset is listed under with `paging`.
pub fn page_of(preset: &DevicePreset, paging: PresetPaging) -> &'static str {
  match paging {
    PresetPaging::Model => preset_category(preset),
    PresetPaging::Band => preset_band(preset),
  }
}

/// `presets` (as the library lists them, by model) in `paging`'s order.
pub fn preset_pages(presets: &[DevicePreset], paging: PresetPaging) -> Vec<DevicePreset> {
  let mut items = presets.to_vec();
  if paging == PresetPaging::Band {
    let order: Vec<&str> = PRESET_BANDS
      .iter()
      .flat_map(|(_, ids)| ids.iter().copied())
      .collect();
    let rank = |preset: &DevicePreset| {
      let band = preset_band(preset);
      let page = PRESET_BANDS
        .iter()
        .position(|(name, _)| *name == band)
        .unwrap_or(PRESET_BANDS.len());
      page * order.len() + order.iter().position(|id| *id == preset.id).unwrap_or(0)
    };
    // Stable, as JavaScript's sort is.
    items.sort_by_key(rank);
  }
  items
}

/// Whether a target is a drum kit, whose keys strike pieces.
pub fn is_kit(target: &str) -> bool {
  matches!(patch(target), Patch::Drums(_))
}

/// With a kit selected, keys play pieces by pitch class, as the kit maps
/// them.
pub fn key_piece(kit: &str, midi: i32) -> &'static str {
  match patch(kit) {
    Patch::Drums(kit) => kit.keys[midi.rem_euclid(12) as usize].as_str(),
    _ => "kick",
  }
}

/// How the instrument's physical model is excited, shown on the screen.
pub fn engine_name(target: &str) -> &'static str {
  match patch(target) {
    Patch::String(string) if string.exciter == "hammer" => "Hammer",
    Patch::String(_) => "Pluck",
    Patch::Bore(bore) if bore.model == "flute" => "Breath",
    Patch::Bore(bore) if bore.model == "brass" => "Lips",
    Patch::Bore(_) => "Reed",
    Patch::Bowed(_) => "Bow",
    Patch::Drums(_) => "Strike",
    Patch::Oscillator(_) => "Oscillator",
    Patch::Reed(_) => "Free reed",
    Patch::Bar(bar) if bar.strike == "thumb" => "Thumb",
    Patch::Bar(_) => "Mallet",
  }
}

/// Every param of the preset's instrument: its override, else the default.
pub fn preset_values(preset: &DevicePreset) -> Values {
  patch(&preset.target)
    .base()
    .params
    .iter()
    .map(|spec| {
      let value = preset
        .overrides
        .as_ref()
        .and_then(|overrides| overrides.get(&spec.id))
        .copied()
        .unwrap_or(spec.default);
      (spec.id.clone(), value)
    })
    .collect()
}

/// The keybed's lowest and highest notes, F3 and E5.
const KEYBED_LOW: i32 = 53;
/// The keybed's highest note, E5.
const KEYBED_HIGH: i32 = 76;

/// How far the octave buttons reach for a preset: the shifted keybed may
/// hang at most 11 notes past either end of its instrument's range, where
/// they fold back in by octaves. The piano gets ±3, the flute ±1. Kits play
/// pieces by pitch class, so shifting their octave would change nothing.
pub fn octave_limits(preset: &DevicePreset) -> (i32, i32) {
  let patch = patch(&preset.target);
  if matches!(patch, Patch::Drums(_)) {
    return (0, 0);
  }
  let (low, high) = patch.base().range;
  (
    ((low - 11 - (KEYBED_LOW + preset.octave)) as f64 / 12.).ceil() as i32,
    ((high + 11 - (KEYBED_HIGH + preset.octave)) as f64 / 12.).floor() as i32,
  )
}

/// `shift` kept within how far the octave buttons reach for `preset`.
pub fn clamp_octave(shift: i32, preset: &DevicePreset) -> i32 {
  let (lowest, highest) = octave_limits(preset);
  shift.max(lowest).min(highest)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn every_builtin_has_a_patch() {
    for preset in device_presets() {
      assert_eq!(patch(&preset.target).id(), preset.target, "{}", preset.id);
    }
    assert_eq!(find_preset("violin").pad, Some(2));
    assert_eq!(find_preset("nope").id, "piano");
  }

  #[test]
  fn octaves_reach_as_web_react_says() {
    assert_eq!(octave_limits(find_preset("piano")), (-3, 3));
    assert_eq!(octave_limits(find_preset("drums")), (0, 0));
    assert_eq!(clamp_octave(5, find_preset("piano")), 3);
  }

  #[test]
  fn pages_by_band() {
    let paged = preset_pages(device_presets(), PresetPaging::Band);
    assert_eq!(paged[0].id, "rockDrums");
    assert_eq!(
      paged.last().map(|preset| preset.id.as_str()),
      Some("oscillator")
    );
    assert_eq!(preset_category(find_preset("cello")), "Bowed");
  }

  #[test]
  fn kits_strike_pieces() {
    assert!(is_kit("drums"));
    assert!(!is_kit("piano"));
    assert_eq!(engine_name("piano"), "Hammer");
    assert_eq!(engine_name("flute"), "Breath");
  }
}
