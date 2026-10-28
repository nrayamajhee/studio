//! The instruments' patches and the master params, as web-react defines
//! them, from `data/patches.json` (see `scripts/export-patches.ts`).

use std::collections::BTreeMap;
use std::sync::OnceLock;

use indexmap::IndexMap;
use serde::Deserialize;

use crate::dsp::math::KeyTable;

/// Measured pitch corrections (cents) keyed by sample rate.
pub type TuningTables = BTreeMap<String, KeyTable>;

/// The table measured nearest `fs`.
pub fn pick_tuning(tables: &TuningTables, fs: f64) -> KeyTable {
  let mut best: KeyTable = vec![(0., 0.)];
  let mut distance = f64::INFINITY;
  for (rate, table) in tables {
    let d = (rate.parse::<f64>().unwrap_or(0.) - fs).abs();
    if d < distance {
      distance = d;
      best = table.clone();
    }
  }
  best
}

#[derive(Deserialize, Clone, Debug)]
pub struct ParamSpec {
  pub id: String,
  pub label: String,
  pub section: String,
  pub min: f64,
  pub max: f64,
  pub default: f64,
  pub unit: Option<String>,
  pub scale: Option<String>,
  pub options: Option<Vec<String>>,
}

#[derive(Deserialize, Clone, Copy, Debug)]
pub struct Presence {
  pub freq: f64,
  pub q: f64,
  #[serde(rename = "gainDb")]
  pub gain_db: f64,
}

#[derive(Deserialize, Clone, Debug)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum BodySpec {
  None,
  Modal {
    modes: Vec<(f64, f64, f64)>,
  },
  Radiation {
    highpass: f64,
    presence: Option<Presence>,
  },
}

#[derive(Deserialize, Clone, Copy, Debug)]
pub struct Pan {
  pub center: f64,
  pub spread: f64,
}

/// What every patch has.
#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BasePatch {
  pub id: String,
  pub name: String,
  pub range: (i32, i32),
  pub output_gain: f64,
  pub pan: Pan,
  pub body: BodySpec,
  pub params: Vec<ParamSpec>,
}

#[derive(Deserialize, Clone, Copy, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Polarization {
  pub detune_cents: f64,
  pub decay: f64,
  pub split: f64,
}

#[derive(Deserialize, Clone, Copy, Debug)]
pub struct Jawari {
  pub contact: f64,
  pub gap: f64,
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct StringPatch {
  #[serde(flatten)]
  pub base: BasePatch,
  pub exciter: String,
  pub allocation: String,
  pub polyphony: usize,
  pub open_strings: Option<Vec<i32>>,
  pub max_fret: Option<i32>,
  pub unison: KeyTable,
  pub unison_detune: KeyTable,
  pub unison_decay: Vec<f64>,
  pub polarization: Option<Polarization>,
  pub t60: KeyTable,
  pub brightness: KeyTable,
  pub dispersion_stages: KeyTable,
  pub dispersion_coef: KeyTable,
  pub damper_t60: KeyTable,
  pub no_damper_above: Option<i32>,
  pub pickup: Option<f64>,
  pub hammer_mass: Option<KeyTable>,
  pub jawari: Option<Jawari>,
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BorePatch {
  #[serde(flatten)]
  pub base: BasePatch,
  pub model: String,
  pub pressure: (f64, f64),
  pub tuning_cents: TuningTables,
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BowedPatch {
  #[serde(flatten)]
  pub base: BasePatch,
  pub polyphony: usize,
  pub tuning_cents: TuningTables,
}

#[derive(Deserialize, Clone, Copy, Debug)]
pub struct DrumBrush {
  pub length: f64,
  pub highpass: f64,
  pub level: f64,
}

#[derive(Deserialize, Clone, Copy, Debug)]
pub struct DrumClick {
  pub highpass: f64,
  pub length: f64,
  pub level: f64,
}

#[derive(Deserialize, Clone, Copy, Debug)]
pub struct DrumWires {
  pub level: f64,
  pub highpass: f64,
  pub release: f64,
}

#[derive(Deserialize, Clone, Copy, Debug)]
pub struct DrumNoise {
  pub highpass: f64,
  pub decay: f64,
  pub level: f64,
}

#[derive(Deserialize, Clone, Debug)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum MetalModes {
  Seeded {
    seed: u32,
    count: usize,
    low: f64,
    high: f64,
  },
  Table {
    freqs: Vec<f64>,
    amps: Vec<f64>,
  },
}

#[derive(Deserialize, Clone, Debug)]
#[serde(tag = "model", rename_all = "camelCase")]
pub enum DrumPieceSpec {
  #[serde(rename_all = "camelCase")]
  Membrane {
    f0: f64,
    ratios: usize,
    t60: Vec<f64>,
    pitch_drop: f64,
    pitch_tau: f64,
    stick: (f64, f64),
    click: Option<DrumClick>,
    wires: Option<DrumWires>,
    shell: Option<(f64, f64, f64)>,
    brush: Option<DrumBrush>,
    level: f64,
    pan: f64,
  },
  #[serde(rename_all = "camelCase")]
  Metal {
    modes: MetalModes,
    t60: f64,
    noise: Option<DrumNoise>,
    stick: (f64, f64),
    brush: Option<DrumBrush>,
    chokes: Option<Vec<String>>,
    level: f64,
    pan: f64,
  },
  #[serde(rename_all = "camelCase")]
  Loaded {
    f0: f64,
    partials: Vec<(f64, f64, f64)>,
    pitch_drop: Option<f64>,
    pitch_tau: Option<f64>,
    stick: (f64, f64),
    click: Option<DrumClick>,
    level: f64,
    pan: f64,
  },
  Combo {
    pieces: Vec<String>,
    level: f64,
  },
  #[serde(rename_all = "camelCase")]
  Noise {
    bursts: Vec<f64>,
    burst_length: f64,
    tail_start: f64,
    tail_decay: f64,
    swell: Option<bool>,
    bandpass: (f64, f64),
    level: f64,
    pan: f64,
  },
}

#[derive(Deserialize, Clone, Debug)]
pub struct DrumKitPatch {
  #[serde(flatten)]
  pub base: BasePatch,
  /// In the order web-react lists them, which the synth view's graphs
  /// follow.
  pub pieces: IndexMap<String, DrumPieceSpec>,
  /// The piece each keybed pitch class plays, from C.
  pub keys: Vec<String>,
}

#[derive(Deserialize, Clone, Debug)]
pub struct OscillatorPatch {
  #[serde(flatten)]
  pub base: BasePatch,
  pub polyphony: usize,
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ReedPatch {
  #[serde(flatten)]
  pub base: BasePatch,
  pub polyphony: usize,
  pub reeds: Vec<(f64, f64)>,
  pub pressure: (f64, f64),
  pub settle: KeyTable,
  pub asymmetry: f64,
  pub tuning_cents: TuningTables,
}

#[derive(Deserialize, Clone, Debug)]
pub struct BarPatch {
  #[serde(flatten)]
  pub base: BasePatch,
  pub strike: String,
  pub polyphony: usize,
  pub modes: Vec<(f64, f64, f64)>,
  pub decay: KeyTable,
  pub contact: (f64, f64),
}

#[derive(Deserialize, Clone, Debug)]
#[serde(tag = "family", rename_all = "camelCase")]
pub enum Patch {
  String(StringPatch),
  Bore(BorePatch),
  Bowed(BowedPatch),
  Drums(DrumKitPatch),
  Oscillator(OscillatorPatch),
  Reed(ReedPatch),
  Bar(BarPatch),
}

impl Patch {
  pub fn base(&self) -> &BasePatch {
    match self {
      Self::String(p) => &p.base,
      Self::Bore(p) => &p.base,
      Self::Bowed(p) => &p.base,
      Self::Drums(p) => &p.base,
      Self::Oscillator(p) => &p.base,
      Self::Reed(p) => &p.base,
      Self::Bar(p) => &p.base,
    }
  }

  pub fn id(&self) -> &str {
    &self.base().id
  }
}

#[derive(Deserialize, Debug)]
pub struct PatchData {
  pub patches: Vec<Patch>,
  pub master: Vec<ParamSpec>,
}

/// Every patch and the master params, parsed once.
pub fn data() -> &'static PatchData {
  static DATA: OnceLock<PatchData> = OnceLock::new();
  DATA.get_or_init(|| {
    serde_json::from_str(include_str!("../data/patches.json"))
      .expect("data/patches.json matches the patch types")
  })
}

/// A bus (instrument or kit) by its id, as an index into `data().patches`.
pub fn bus_index(id: &str) -> Option<usize> {
  data().patches.iter().position(|patch| patch.id() == id)
}

/// Every drum piece in a fixed order: it sets each voice's noise seed and the
/// order voices sum in, so a kit sounds the same whichever pieces it defines.
pub const PIECE_ORDER: [&str; 26] = [
  "kick",
  "snare",
  "closedHat",
  "openHat",
  "clap",
  "lowTom",
  "highTom",
  "cowbell",
  "crash",
  "na",
  "ta",
  "tin",
  "tun",
  "te",
  "ti",
  "ge",
  "ke",
  "ka",
  "dha",
  "dhin",
  "ride",
  "sweep",
  "stick",
  "sticks",
  "bell",
  "tambourine",
];

pub fn piece_index(id: &str) -> Option<usize> {
  PIECE_ORDER.iter().position(|piece| *piece == id)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn every_patch_parses() {
    let data = data();
    assert_eq!(data.patches.len(), 33);
    assert_eq!(data.master.len(), 17);
    assert_eq!(bus_index("piano"), Some(0));
    for patch in &data.patches {
      if let Patch::Drums(kit) = patch {
        assert_eq!(kit.keys.len(), 12, "{}", kit.base.id);
        for piece in kit.pieces.keys().chain(&kit.keys) {
          assert!(piece_index(piece).is_some(), "{piece}");
        }
      }
    }
  }
}
