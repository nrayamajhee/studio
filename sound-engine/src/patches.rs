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

/// One param of a patch (or of the master): what the synth view shows and the
/// engine clamps it to.
#[derive(Deserialize, Clone, Debug)]
pub struct ParamSpec {
  /// Its id, as `section.name` (`exciter.hardness`), which events name it by.
  pub id: String,
  /// Its label on the synth view.
  pub label: String,
  /// The synth view's page it's on: exciter, resonator, body, envelope, filter,
  /// vibrato, output or master.
  pub section: String,
  /// The lowest value.
  pub min: f64,
  /// The highest value.
  pub max: f64,
  /// Its value until something sets it.
  pub default: f64,
  /// The unit its value is shown in (ms, Hz, cents…), if any.
  pub unit: Option<String>,
  /// "log" when its knob moves through the range logarithmically.
  pub scale: Option<String>,
  /// The names of its steps, for a param that picks one of several (a wave, a
  /// shape).
  pub options: Option<Vec<String>>,
}

/// A radiation body's presence peak: its frequency, Q and gain in dB.
#[derive(Deserialize, Clone, Copy, Debug)]
pub struct Presence {
  pub freq: f64,
  pub q: f64,
  #[serde(rename = "gainDb")]
  pub gain_db: f64,
}

/// How an instrument's body colours its bus.
#[derive(Deserialize, Clone, Debug)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum BodySpec {
  /// No body.
  None,
  /// A soundboard or top plate: modes as (frequency, T60, level).
  Modal { modes: Vec<(f64, f64, f64)> },
  /// The radiation of an open end or bell: a highpass at `highpass` hertz, with
  /// an optional presence peak.
  Radiation {
    highpass: f64,
    presence: Option<Presence>,
  },
}

/// Where a patch sits in the stereo field.
#[derive(Deserialize, Clone, Copy, Debug)]
pub struct Pan {
  /// Its centre, −1 (left) to 1 (right).
  pub center: f64,
  /// How far its notes spread either side of the centre, low notes to the left.
  pub spread: f64,
}

/// What every patch has.
#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BasePatch {
  /// The id events name the instrument by.
  pub id: String,
  /// The name the instrument picker shows.
  pub name: String,
  /// The lowest and highest MIDI notes it plays; notes outside fold in by
  /// octaves.
  pub range: (i32, i32),
  /// The bus's output gain, which levels the instruments against each other.
  pub output_gain: f64,
  /// Where it sits in the stereo field.
  pub pan: Pan,
  /// Its body.
  pub body: BodySpec,
  /// Its params, in the synth view's order.
  pub params: Vec<ParamSpec>,
}

/// A guitar string's two polarizations: the second detuned by `detune_cents`,
/// decaying `decay` times as long, and the pluck's `split` between them.
#[derive(Deserialize, Clone, Copy, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Polarization {
  pub detune_cents: f64,
  pub decay: f64,
  pub split: f64,
}

/// A sitar's jawari bridge: the allpass coefficient while the string touches it
/// (`contact`), and how far it swings before it does (`gap`).
#[derive(Deserialize, Clone, Copy, Debug)]
pub struct Jawari {
  pub contact: f64,
  pub gap: f64,
}

/// A piano, guitar or bass: the exciter (hammer, pick or finger), whether notes
/// take a key or a string, the open strings and frets, and per-key tables of
/// unison strings, decay, brightness, dispersion and dampers.
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

/// A flute, saxophone, brass or clarinet: which STK model, the breath pressure
/// from the softest note to the hardest, and the tuning tables measured at each
/// sample rate.
#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BorePatch {
  #[serde(flatten)]
  pub base: BasePatch,
  pub model: String,
  pub pressure: (f64, f64),
  pub tuning_cents: TuningTables,
}

/// A violin: its polyphony and the tuning tables measured at each sample rate.
#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BowedPatch {
  #[serde(flatten)]
  pub base: BasePatch,
  pub polyphony: usize,
  pub tuning_cents: TuningTables,
}

/// A brush on a drum: how long its bristles land for (ms), the hiss's highpass
/// (Hz) and level.
#[derive(Deserialize, Clone, Copy, Debug)]
pub struct DrumBrush {
  pub length: f64,
  pub highpass: f64,
  pub level: f64,
}

/// The click of a stick on a drum: a highpassed noise burst, its cutoff (Hz),
/// length (ms) and level.
#[derive(Deserialize, Clone, Copy, Debug)]
pub struct DrumClick {
  pub highpass: f64,
  pub length: f64,
  pub level: f64,
}

/// A snare's wires buzzing under the head: their level, highpass (Hz) and
/// release (s).
#[derive(Deserialize, Clone, Copy, Debug)]
pub struct DrumWires {
  pub level: f64,
  pub highpass: f64,
  pub release: f64,
}

/// A cymbal's wash: highpassed noise, its cutoff (Hz), decay (s) and level.
#[derive(Deserialize, Clone, Copy, Debug)]
pub struct DrumNoise {
  pub highpass: f64,
  pub decay: f64,
  pub level: f64,
}

/// How a cymbal's modes are laid out.
#[derive(Deserialize, Clone, Debug)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum MetalModes {
  /// `count` modes spread log-uniformly from `low` to `high` hertz, from a
  /// fixed `seed`.
  Seeded {
    seed: u32,
    count: usize,
    low: f64,
    high: f64,
  },
  /// Modes listed by frequency and level.
  Table { freqs: Vec<f64>, amps: Vec<f64> },
}

/// One piece of a kit, by the model that plays it.
#[derive(Deserialize, Clone, Debug)]
#[serde(tag = "model", rename_all = "camelCase")]
pub enum DrumPieceSpec {
  /// A drum head: the ideal membrane's modes over `f0`, a pitch that drops as
  /// it settles, a stick (contact times soft to hard, ms), and optionally a
  /// click, snare wires, a shell mode and a brush.
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
  /// A cymbal or bell: metal modes, their T60, a wash of noise, and the pieces
  /// striking it chokes.
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
  /// A tuned drum (a tabla's): partials as (ratio, T60, level) over `f0`, with
  /// an optional pitch drop and click.
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
  /// Several pieces struck at once, at `level`.
  Combo { pieces: Vec<String>, level: f64 },
  /// A clap: noise bursts at the listed times (ms), then a decaying tail (or
  /// one swelling in to its start), through a bandpass.
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

/// A drum kit: its pieces, and the piece each pitch class plays.
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

/// An oscillator synth: its polyphony.
#[derive(Deserialize, Clone, Debug)]
pub struct OscillatorPatch {
  #[serde(flatten)]
  pub base: BasePatch,
  pub polyphony: usize,
}

/// A harmonium or harmonica: its reeds as (cents, level), the breath pressure
/// from the softest note to the hardest, how long each key's reeds take to
/// settle, their asymmetry, and the tuning tables measured at each sample rate.
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

/// A xylophone, steel pan or kalimba: how it's struck (mallet or thumb), its
/// modes as (ratio, level, T60), their decay per key, and the strike's contact
/// time from soft to hard (ms).
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

/// A patch, by its family, which picks the model that plays it.
#[derive(Deserialize, Clone, Debug)]
#[serde(tag = "family", rename_all = "camelCase")]
pub enum Patch {
  /// Strings: piano, guitar, basses.
  String(StringPatch),
  /// Bores: flutes, saxophone, brass, clarinet.
  Bore(BorePatch),
  /// A bowed string: the violin.
  Bowed(BowedPatch),
  /// A drum kit.
  Drums(DrumKitPatch),
  /// Oscillators.
  Oscillator(OscillatorPatch),
  /// Free reeds: harmonium, harmonica.
  Reed(ReedPatch),
  /// Struck bars: xylophone, steel pan, kalimba.
  Bar(BarPatch),
}

impl Patch {
  /// The part every patch has: its id, name, range, pan, body and params.
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

  /// The patch's id, which events name its instrument by.
  pub fn id(&self) -> &str {
    &self.base().id
  }
}

/// Everything in `data/patches.json`: every instrument's patch, in the Device's
/// order, and the master's params.
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

/// A drum piece's place in [`PIECE_ORDER`], by its name.
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
