//! The synth view's graphs, as web-react's `synthGraphs.ts`: each module's
//! picture drawn in a 100 × 100 box stretched over the screen. Lines keep
//! their pixel width however it stretches, and labels are laid over it in
//! screen type at the same coordinates (0 left/top, 100 right/bottom).

// It follows the TypeScript line by line, `Math.max(lo, Math.min(hi, x))`
// included, which unlike `clamp` turns NaN into a bound.
#![allow(clippy::manual_clamp)]

use std::f64::consts::{FRAC_1_SQRT_2, PI};

use sound_engine::dsp::generators::Noise;
use sound_engine::dsp::math::{clamp, fold_note, key_table, lerp, midi_to_hz};
use sound_engine::dsp::nonlinear::{bow_table, drive as saturate, jet_table, reed_table};
use sound_engine::models::bowed::{BODY_SECTIONS, STK_RATE};
use sound_engine::models::exciters::{HammerOptions, PluckOptions, hammer, pluck, stick};
use sound_engine::models::string_loop::StringLoop;
use sound_engine::patches::{BodySpec, DrumPieceSpec, Patch};

use super::js::{number, round, to_fixed};
use super::presets::Values;
use super::synth_pages::{CHAIN_STOPS, SynthPage};

/// The colours a graph draws in: the screen's ink, dimmer and fainter, and
/// the knobs'.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Tone {
  /// The screen's ink.
  Ink,
  /// The ink, dimmer: captions and axes' labels.
  Dim,
  /// The ink, fainter: grids and baselines.
  Faint,
  /// The green knob's colour.
  Green,
  /// The red knob's colour.
  Red,
  /// The blue knob's colour.
  Blue,
}

/// How a path is drawn: its width (the default unless set), dashed or not, or
/// filled.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Stroke {
  pub width: Option<f64>,
  pub dashed: bool,
  /// Filled instead of stroked: a light wash, or `solid`.
  pub fill: bool,
  pub solid: bool,
}

/// A line `width` pixels wide.
fn width(width: f64) -> Stroke {
  Stroke {
    width: Some(width),
    ..Stroke::default()
  }
}

/// A dashed line.
fn dashed() -> Stroke {
  Stroke {
    dashed: true,
    ..Stroke::default()
  }
}

/// A dashed line `width` pixels wide.
fn dashed_width(width: f64) -> Stroke {
  Stroke {
    width: Some(width),
    dashed: true,
    ..Stroke::default()
  }
}

/// A light wash filling the shape.
fn fill() -> Stroke {
  Stroke {
    fill: true,
    ..Stroke::default()
  }
}

/// A path of a graph: its SVG path data, its colour and how it's drawn.
#[derive(Clone, Debug, PartialEq)]
pub struct ScenePath {
  pub d: String,
  pub tone: Tone,
  pub stroke: Stroke,
}

/// How a label lines up on its x: its start, its middle or its end there.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Align {
  /// Its start at x.
  Start,
  /// Its middle at x.
  Middle,
  /// Its end at x.
  End,
}

/// Which edge sits at y: the text's top, its middle or its baseline.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Anchor {
  /// Its top at y.
  Top,
  /// Its middle at y.
  Middle,
  /// Its baseline at y.
  Bottom,
}

/// A label laid over a graph, in screen type at the box's coordinates.
#[derive(Clone, Debug, PartialEq)]
pub struct SceneLabel {
  pub x: f64,
  pub y: f64,
  pub text: String,
  pub tone: Tone,
  pub align: Align,
  pub anchor: Anchor,
}

/// A graph: its paths, and the labels laid over them.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct GraphScene {
  pub paths: Vec<ScenePath>,
  pub labels: Vec<SceneLabel>,
}

/// The knobs' colours in knob order, as the readouts draw them.
pub const KNOB_TONES: [Tone; 4] = [Tone::Ink, Tone::Green, Tone::Red, Tone::Blue];

/// What a graph is drawn from: the patch, the param values, the note, and the
/// colour of the knob that sets each param.
pub struct GraphInput<'a> {
  pub patch: &'a Patch,
  pub values: &'a Values,
  /// The note the graphs are drawn for.
  pub note: i32,
  /// The colour of the knob that sets a param on its page, so what a knob
  /// moves is drawn in its colour.
  pub tone_of: &'a dyn Fn(&str) -> Tone,
}

/// The sample rate the graphs' models run at.
const FS: f64 = 48000.;
/// The velocity the graphs play at: mezzo-forte.
const VELOCITY: f64 = 0.8;

/// `v` with two decimals, as the paths write numbers.
fn n2(v: f64) -> String {
  to_fixed(v, 2)
}

/// A path through `points`, in order.
fn polyline(points: &[(f64, f64)]) -> String {
  if points.is_empty() {
    return String::new();
  }
  let parts: Vec<String> = points
    .iter()
    .map(|&(x, y)| format!("{} {}", n2(x), n2(y)))
    .collect();
  format!("M{}", parts.join(" L"))
}

/// A path through `count + 1` points of `point(t)`, t from 0 to 1.
fn sample(count: usize, point: impl Fn(f64) -> (f64, f64)) -> String {
  let points: Vec<(f64, f64)> = (0..=count)
    .map(|i| point(i as f64 / count as f64))
    .collect();
  polyline(&points)
}

/// A rectangle's path, from (x0, y0) to (x1, y1).
fn rect(x0: f64, y0: f64, x1: f64, y1: f64) -> String {
  format!(
    "M{} {} H{} V{} H{} Z",
    n2(x0),
    n2(y0),
    n2(x1),
    n2(y1),
    n2(x0)
  )
}

/// A vertical line at `x`, from y0 to y1.
fn vline(x: f64, y0: f64, y1: f64) -> String {
  format!("M{} {} V{}", n2(x), n2(y0), n2(y1))
}

/// A horizontal line at `y`, from x0 to x1.
fn hline(y: f64, x0: f64, x1: f64) -> String {
  format!("M{} {} H{}", n2(x0), n2(y), n2(x1))
}

/// A graph being drawn.
#[derive(Default)]
struct Scene {
  paths: Vec<ScenePath>,
  labels: Vec<SceneLabel>,
}

impl Scene {
  /// Adds a path, unless it's empty.
  fn path(&mut self, d: impl Into<String>, tone: Tone, stroke: Stroke) {
    let d = d.into();
    if !d.is_empty() {
      self.paths.push(ScenePath { d, tone, stroke });
    }
  }

  /// Adds a plain line.
  fn line(&mut self, d: impl Into<String>, tone: Tone) {
    self.path(d, tone, Stroke::default());
  }

  /// Adds a label, unless it's empty.
  fn label_at(
    &mut self,
    x: f64,
    y: f64,
    text: impl Into<String>,
    tone: Tone,
    align: Align,
    anchor: Anchor,
  ) {
    let text = text.into();
    if !text.is_empty() {
      self.labels.push(SceneLabel {
        x,
        y,
        text,
        tone,
        align,
        anchor,
      });
    }
  }

  /// Adds a label hanging from `y`.
  fn label(&mut self, x: f64, y: f64, text: impl Into<String>, tone: Tone, align: Align) {
    self.label_at(x, y, text, tone, align, Anchor::Top);
  }

  /// Adds a dim caption from (x, y).
  fn caption(&mut self, x: f64, y: f64, text: impl Into<String>) {
    self.label(x, y, text, Tone::Dim, Align::Start);
  }

  /// The graph as drawn.
  fn done(self) -> GraphScene {
    GraphScene {
      paths: self.paths,
      labels: self.labels,
    }
  }
}

/// The value of `id`, or `fallback`.
fn get(values: &Values, id: &str, fallback: f64) -> f64 {
  values.get(id).copied().unwrap_or(fallback)
}

/// Whether the values set `id`.
fn has(values: &Values, id: &str) -> bool {
  values.contains_key(id)
}

/// A gain in dB (floored a little above silence).
fn db(gain: f64) -> f64 {
  20. * gain.max(1e-9).log10()
}

/// A fraction as a whole percentage.
fn percent(v: f64) -> String {
  format!("{}%", number(round(v * 100.)))
}

/// Seconds as ms (one decimal under 10 ms) or, from a second, s.
fn ms(seconds: f64) -> String {
  if seconds < 0.01 {
    format!("{} ms", to_fixed(seconds * 1000., 1))
  } else if seconds < 1. {
    format!("{} ms", number(round(seconds * 1000.)))
  } else {
    format!("{} s", to_fixed(seconds, 2))
  }
}

/// A frequency in Hz, or kHz from 1000.
fn hz(f: f64) -> String {
  if f >= 1000. {
    format!(
      "{} kHz",
      to_fixed(f / 1000., if f >= 10000. { 0 } else { 1 })
    )
  } else {
    format!("{} Hz", number(round(f)))
  }
}

/// The note an instrument's graphs are drawn at: middle C, moved by octaves
/// into its range.
pub fn graph_note(patch: &Patch) -> i32 {
  let (low, high) = patch.base().range;
  fold_note(60, low, high)
}

/// The magnitude of `signal` at `cycles` cycles per sample.
fn dft(signal: &[f32], length: usize, cycles: f64) -> f64 {
  let mut re = 0.;
  let mut im = 0.;
  let w = 2. * PI * cycles;
  for (k, &x) in signal[..length].iter().enumerate() {
    re += x as f64 * (w * k as f64).cos();
    im -= x as f64 * (w * k as f64).sin();
  }
  re.hypot(im)
}

/// Harmonic bars across the right of the box, in dB below the strongest (60
/// dB tall), with dashed gaps where a strike or pluck position silences
/// harmonics.
fn harmonic_bars(scene: &mut Scene, amps: &[f64], title: &str, gaps: Option<(f64, Tone)>) {
  let x0 = 50.;
  let span = 50.;
  let peak = amps.iter().copied().fold(1e-9, f64::max);
  let count = amps.len() as f64;
  let x = |n: f64| x0 + ((n - 0.5) / count) * span;
  if let Some((beta, tone)) = gaps {
    let mut d = String::new();
    let mut k = 1.;
    while k / beta <= count + 0.5 {
      d += &vline(x(k / beta), 14., 92.);
      k += 1.;
    }
    scene.path(d, tone, dashed_width(1.));
    let every = 1. / beta;
    scene.label(
      100.,
      2.,
      format!(
        "gaps every {}",
        if every.fract() == 0. {
          number(every)
        } else {
          to_fixed(every, 1)
        }
      ),
      tone,
      Align::End,
    );
  }
  let mut bars = String::new();
  for (i, &a) in amps.iter().enumerate() {
    let top = 92. - ((db(a / peak).max(-60.) + 60.) / 60.) * 76.;
    if top < 91.5 {
      bars += &vline(x(i as f64 + 1.), 92., top);
    }
  }
  scene.line(hline(92., x0, 100.), Tone::Faint);
  scene.path(bars, Tone::Ink, width(3.));
  scene.caption(x0, 2., title);
  scene.label_at(x0, 100., "1", Tone::Dim, Align::Start, Anchor::Bottom);
  scene.label_at(
    100.,
    100.,
    amps.len().to_string(),
    Tone::Dim,
    Align::End,
    Anchor::Bottom,
  );
}

/// A string from nut (x 2) to bridge (x 42) at y 58, and where along it a
/// position (fraction from the bridge) falls, named along the bottom.
const NUT: f64 = 2.;
/// Where the string's bridge is drawn.
const BRIDGE: f64 = 42.;
/// Where the string runs across the box.
const STRING_Y: f64 = 58.;

/// Where on the drawn string a position falls, as a fraction from the bridge.
fn string_at(beta: f64) -> f64 {
  BRIDGE - beta * (BRIDGE - NUT)
}

/// The string diagram: nut, bridge and string, with `beta` marked on it.
fn string_diagram(
  scene: &mut Scene,
  title: &str,
  title_tone: Tone,
  beta: f64,
  position_tone: Tone,
) {
  scene.label(2., 2., title, title_tone, Align::Start);
  scene.path(vline(NUT, 53., 63.), Tone::Dim, width(2.));
  scene.path(vline(BRIDGE, 50., 66.), Tone::Dim, width(3.));
  let at = string_at(beta);
  scene.path(
    vline(at, STRING_Y - 4., STRING_Y + 4.),
    position_tone,
    width(3.),
  );
  scene.label_at(
    2.,
    100.,
    format!("{} from the bridge", percent(beta)),
    position_tone,
    Align::Start,
    Anchor::Bottom,
  );
  scene.label_at(
    BRIDGE,
    100.,
    "bridge",
    Tone::Dim,
    Align::End,
    Anchor::Bottom,
  );
}

/// A string's exciter: the pluck or hammer as it leaves the finger or felt,
/// where it strikes, and the harmonics that position leaves.
fn string_exciter(scene: &mut Scene, input: &GraphInput) {
  let Patch::String(patch) = input.patch else {
    return;
  };
  let (values, note, tone_of) = (input.values, input.note, input.tone_of);
  let hardness = get(values, "exciter.hardness", 0.5);
  let beta = get(values, "exciter.position", 0.15);
  let strength = get(values, "exciter.strength", 0.8);
  let finger = if has(values, "exciter.pluck") {
    get(values, "exciter.pluck", 0.) >= 0.5
  } else {
    patch.exciter == "finger"
  };
  let period = FS / midi_to_hz(note as f64);
  let mut buffer = vec![0f32; (0.014 * FS + period).ceil() as usize + 8];
  let length = if patch.exciter == "hammer" {
    hammer(
      &mut buffer,
      &HammerOptions {
        period,
        velocity: VELOCITY,
        hardness,
        position: beta,
        strength,
        mass: patch
          .hammer_mass
          .as_ref()
          .map_or(1., |mass| key_table(mass, note as f64)),
        fs: FS,
      },
    )
    .0
  } else {
    pluck(
      &mut buffer,
      &mut Noise::new(1000),
      &PluckOptions {
        period,
        velocity: VELOCITY,
        hardness,
        position: beta,
        strength,
        finger,
      },
    )
  };
  let at = string_at(beta);
  let position = tone_of("exciter.position");
  if patch.exciter == "hammer" {
    string_diagram(
      scene,
      "a felt hammer strikes the string",
      Tone::Dim,
      beta,
      position,
    );
    scene.path(hline(STRING_Y, NUT, BRIDGE), Tone::Ink, width(1.6));
    scene.path(
      rect(at - 1.4, STRING_Y - 16., at + 1.4, STRING_Y - 5.),
      tone_of("exciter.hardness"),
      Stroke {
        fill: true,
        solid: true,
        ..Stroke::default()
      },
    );
    scene.path(
      vline(at, STRING_Y - 34., STRING_Y - 16.),
      Tone::Dim,
      width(2.),
    );
  } else {
    string_diagram(
      scene,
      if finger {
        "a fingertip lets go: a soft bump"
      } else {
        "a pick lets go: a sharp corner"
      },
      tone_of("exciter.pluck"),
      beta,
      position,
    );
    scene.path(hline(STRING_Y, NUT, BRIDGE), Tone::Faint, dashed());
    let half = ((0.5 - 0.35 * hardness) * 19.).max(2.);
    let shape = if finger {
      sample(80, |t| {
        let x = NUT + t * (BRIDGE - NUT);
        let d = (x - at).abs();
        let bump = if d < half {
          0.5 + 0.5 * ((PI * d) / half).cos()
        } else {
          0.
        };
        (x, STRING_Y - 30. * bump)
      })
    } else {
      polyline(&[(NUT, STRING_Y), (at, STRING_Y - 30.), (BRIDGE, STRING_Y)])
    };
    scene.path(shape, Tone::Ink, width(1.8));
  }
  let amps: Vec<f64> = (0..32)
    .map(|i| dft(&buffer, length, (i as f64 + 1.) / period))
    .collect();
  harmonic_bars(scene, &amps, "harmonics it starts", Some((beta, position)));
}

/// How long a strike touches: its own, and the softest and hardest.
struct Contact {
  seconds: f64,
  soft: f64,
  hard: f64,
}

/// A half-sine stick pulse over time (left), its spectrum over the note's
/// modes (right).
fn strike_exciter(scene: &mut Scene, contact: Contact, modes: &[f64], f0: f64, input: &GraphInput) {
  let tone_of = input.tone_of;
  let longest = contact.soft * 1.3;
  // Area-normalized, so the shortest (hardest) contact is the tallest.
  let pulse = |scene: &mut Scene, seconds: f64, tone: Tone, stroke: Stroke| {
    let height = (contact.hard / seconds) * 40.;
    scene.path(
      sample(40, |t| {
        (
          2. + ((t * seconds) / longest) * 38.,
          50. - height * (PI * t).sin(),
        )
      }),
      tone,
      stroke,
    );
  };
  scene.caption(2., 2., "the strike: force over time");
  scene.line(hline(50., 2., 40.), Tone::Faint);
  pulse(scene, contact.soft, Tone::Faint, dashed());
  pulse(scene, contact.hard, Tone::Faint, dashed());
  pulse(
    scene,
    contact.seconds,
    tone_of("exciter.hardness"),
    width(2.),
  );
  scene.label(
    40.,
    54.,
    format!("touches for {}", ms(contact.seconds)),
    tone_of("exciter.hardness"),
    Align::End,
  );
  // Spectrum of the pulse from f0/2 to 24·f0, with the note's modes marked.
  let lo = (f0 / 2.).log10();
  let hi = (f0 * 24.).log10();
  let x = |f: f64| 50. + ((f.log10() - lo) / (hi - lo)) * 50.;
  let length = round(contact.seconds * FS).max(1.) as usize;
  let mut buffer = vec![0f32; length];
  stick(&mut buffer, contact.seconds, 1., FS);
  let dc = dft(&buffer, length, 0.);
  scene.line(hline(92., 50., 100.), Tone::Faint);
  let ticks: String = modes
    .iter()
    .map(|ratio| vline(x(f0 * ratio), 14., 92.))
    .collect();
  scene.path(ticks, Tone::Faint, dashed());
  scene.path(
    sample(120, |t| {
      let f = 10f64.powf(lo + (hi - lo) * t);
      let level = db(dft(&buffer, length, f / FS) / dc).max(-48.);
      (x(f), 16. - (level / 48.) * 76.)
    }),
    Tone::Ink,
    width(2.),
  );
  scene.caption(50., 2., "how high it reaches (dashed: the modes)");
}

/// A bar's exciter: the mallet's contact and the modes it reaches.
fn bar_exciter(scene: &mut Scene, input: &GraphInput) {
  let Patch::Bar(patch) = input.patch else {
    return;
  };
  let (soft, hard) = patch.contact;
  let hardness = get(input.values, "exciter.hardness", 0.5);
  let seconds = (lerp(soft, hard, hardness) / 1000.) * (1. + 0.3 * (0.5 - VELOCITY));
  let modes: Vec<f64> = patch.modes.iter().map(|&(ratio, _, _)| ratio).collect();
  strike_exciter(
    scene,
    Contact {
      seconds,
      soft: soft / 1000.,
      hard: hard / 1000.,
    },
    &modes,
    midi_to_hz(input.note as f64),
    input,
  );
}

/// The kit's lowest drum: the kick, or the first head that has a pitch.
fn main_piece(patch: &Patch) -> Option<&DrumPieceSpec> {
  let Patch::Drums(kit) = patch else {
    return None;
  };
  kit
    .pieces
    .get("kick")
    .or_else(|| {
      kit.pieces.values().find(|piece| {
        matches!(
          piece,
          DrumPieceSpec::Membrane { .. } | DrumPieceSpec::Loaded { .. }
        )
      })
    })
    .or_else(|| kit.pieces.values().next())
}

/// A membrane's modes against its fundamental.
const MEMBRANE_RATIOS: [f64; 8] = [1., 1.593, 2.136, 2.295, 2.653, 2.917, 3.155, 3.5];

/// A drum's exciter: the stick's contact and the drum's modes it reaches.
fn drum_exciter(scene: &mut Scene, input: &GraphInput) {
  let (values, tone_of) = (input.values, input.tone_of);
  let Some(piece) = main_piece(input.patch) else {
    return;
  };
  let ((soft, hard), f0, ratios) = match piece {
    DrumPieceSpec::Membrane { stick, f0, .. } => (*stick, *f0, MEMBRANE_RATIOS.to_vec()),
    DrumPieceSpec::Loaded {
      stick,
      f0,
      partials,
      ..
    } => (
      *stick,
      *f0,
      partials.iter().map(|&(ratio, _, _)| ratio).collect(),
    ),
    DrumPieceSpec::Metal { stick, .. } => (*stick, 400., vec![1.]),
    DrumPieceSpec::Combo { .. } | DrumPieceSpec::Noise { .. } => return,
  };
  let hardness = get(values, "exciter.hardness", 0.6);
  let seconds = lerp(soft, hard, hardness * VELOCITY) / 1000.;
  strike_exciter(
    scene,
    Contact {
      seconds,
      soft: soft / 1000.,
      hard: hard / 1000.,
    },
    &ratios,
    f0,
    input,
  );
  let position = get(values, "exciter.position", 0.3);
  scene.label_at(
    100.,
    100.,
    format!(
      "struck {} out from the centre · click {}×",
      percent(position),
      to_fixed(get(values, "exciter.click", 1.), 2)
    ),
    tone_of("exciter.position"),
    Align::End,
    Anchor::Bottom,
  );
}

/// A bowed string's exciter: the bow on the string, and the stick-slip its
/// pressure and speed give.
fn bow_exciter(scene: &mut Scene, input: &GraphInput) {
  let (values, tone_of) = (input.values, input.tone_of);
  let pressure = get(values, "exciter.pressure", 0.75);
  let beta = get(values, "exciter.position", 0.18);
  let speed = get(values, "exciter.speed", 1.);
  string_diagram(
    scene,
    "the bow on the string",
    Tone::Dim,
    beta,
    tone_of("exciter.position"),
  );
  scene.path(hline(STRING_Y, NUT, BRIDGE), Tone::Ink, width(1.6));
  let at = string_at(beta);
  let half = 0.8 + 1.8 * pressure;
  scene.path(
    rect(at - half, 16., at + half, 84.),
    tone_of("exciter.pressure"),
    fill(),
  );
  scene.line(
    rect(at - half, 16., at + half, 84.),
    tone_of("exciter.pressure"),
  );
  let arrow = 10. + 16. * (speed - 0.5);
  let ax = at + half + 3.;
  scene.path(
    format!(
      "{} M{} {} L{} {} L{} {}",
      vline(ax, STRING_Y - arrow, STRING_Y + arrow),
      n2(ax - 1.),
      n2(STRING_Y - arrow + 5.),
      n2(ax),
      n2(STRING_Y - arrow),
      n2(ax + 1.),
      n2(STRING_Y - arrow + 5.)
    ),
    tone_of("exciter.speed"),
    width(1.6),
  );
  scene.label(
    ax + 1.5,
    STRING_Y - arrow,
    "speed",
    tone_of("exciter.speed"),
    Align::Start,
  );
  // STK's bow table: pressure maps the friction slope from 5 down to 1.
  let curve = |slope: f64| {
    sample(160, |t| {
      let x = -1. + 2. * t;
      (50. + t * 50., 92. - bow_table(x, 0.001, slope) * 76.)
    })
  };
  scene.line(
    format!("{} {}", hline(92., 50., 100.), vline(75., 14., 92.)),
    Tone::Faint,
  );
  scene.path(curve(5.), Tone::Faint, dashed());
  scene.path(curve(1.), Tone::Faint, dashed());
  scene.path(
    curve(5. - 4. * pressure),
    tone_of("exciter.pressure"),
    width(2.),
  );
  scene.label(
    50.,
    2.,
    if pressure > 0.6 {
      "a wide grip: it sticks, edgy"
    } else if pressure < 0.3 {
      "a narrow grip: it slips, airy"
    } else {
      "the hair's grip as it slips"
    },
    tone_of("exciter.pressure"),
    Align::Start,
  );
  scene.label_at(
    75.,
    100.,
    "slip speed",
    Tone::Dim,
    Align::Middle,
    Anchor::Bottom,
  );
}

/// A blown pipe's exciter: the breath over time and the jet or reed's response.
fn bore_exciter(scene: &mut Scene, input: &GraphInput) {
  let Patch::Bore(patch) = input.patch else {
    return;
  };
  let (values, tone_of) = (input.values, input.tone_of);
  let pressure = get(values, "exciter.pressure", 1.);
  let noise = get(values, "exciter.noise", 1.);
  let attack = get(values, "envelope.attack", 0.05);
  // Breath over a second: the envelope's attack, then the steady pressure
  // with its turbulence.
  scene.caption(2., 2., "the breath");
  scene.line(hline(92., 2., 42.), Tone::Faint);
  let steady = lerp(patch.pressure.0, patch.pressure.1, VELOCITY) * pressure;
  let scale = 60. / (patch.pressure.1 * 1.25);
  let mut jitter = Noise::new(77);
  let points: Vec<(f64, f64)> = (0..=200)
    .map(|i| {
      let t = i as f64 / 200.;
      let seconds = t * 0.6;
      let rise = (seconds / attack.max(0.005)).min(1.);
      let ripple = 1. + 0.12 * noise * jitter.next();
      (2. + t * 40., 92. - steady * rise * ripple * scale)
    })
    .collect();
  scene.path(polyline(&points), tone_of("exciter.pressure"), width(1.6));
  scene.label_at(
    42.,
    92. - steady * scale - 4.,
    format!("{}× breath", to_fixed(pressure, 2)),
    tone_of("exciter.pressure"),
    Align::End,
    Anchor::Bottom,
  );
  scene.label_at(
    2.,
    100.,
    format!("noise {}×", to_fixed(noise, 2)),
    tone_of("exciter.noise"),
    Align::Start,
    Anchor::Bottom,
  );
  scene.line(
    format!("{} {}", hline(92., 50., 100.), vline(75., 14., 92.)),
    Tone::Faint,
  );
  if patch.model == "brass" {
    // The lips: a resonance near the note, which tension moves.
    let lip = get(values, "exciter.lip", 0.5);
    let ratio = 2f64.powf((lip - 0.5) * 0.1);
    let x = |r: f64| 50. + ((r.log2() + 0.25) / 0.5) * 50.;
    let q = 20.;
    scene.path(
      sample(160, |t| {
        let r = 2f64.powf(-0.25 + 0.5 * t);
        let k = q * (r / ratio - ratio / r);
        (x(r), 92. - (1. / (1. + k * k).sqrt()) * 76.)
      }),
      tone_of("exciter.lip"),
      width(2.),
    );
    scene.path(vline(x(1.), 14., 92.), Tone::Dim, dashed());
    scene.caption(50., 2., "the lips ring near the note (dashed)");
    let cents = 1200. * ratio.log2();
    scene.label(
      100.,
      2.,
      format!(
        "{}{} ¢",
        if cents >= 0. { "+" } else { "" },
        number(round(cents))
      ),
      tone_of("exciter.lip"),
      Align::End,
    );
    return;
  }
  let flute = patch.model == "flute";
  let reed = 0.1 + 0.4 * get(values, "exciter.reed", 0.5);
  let slope = if patch.model == "clarinet" {
    -reed
  } else {
    reed
  };
  scene.path(
    sample(160, |t| {
      let x = (2. * t - 1.) * if flute { 1.6 } else { 1. };
      let y = if flute {
        jet_table(x)
      } else {
        reed_table(x, 0.7, slope)
      };
      (50. + t * 50., 53. - y * 38.)
    }),
    if flute {
      Tone::Ink
    } else {
      tone_of("exciter.reed")
    },
    width(2.),
  );
  scene.caption(
    50.,
    2.,
    if flute {
      "the jet: how the air sheet flips"
    } else {
      "the reed: how far it opens"
    },
  );
  scene.label_at(
    75.,
    100.,
    "pressure across it",
    Tone::Dim,
    Align::Middle,
    Anchor::Bottom,
  );
}

/// A free reed speaks once its drive passes 1, and swings wider the further
/// past it: √((D − 1)/D).
fn free_reed_exciter(scene: &mut Scene, input: &GraphInput) {
  let Patch::Reed(patch) = input.patch else {
    return;
  };
  let (values, tone_of) = (input.values, input.tone_of);
  let pressure = get(values, "exciter.pressure", 1.);
  let span = (patch.pressure.1 * pressure * 1.15).max(3.);
  let x = |d: f64| 2. + (d / span) * 96.;
  let y = |a: f64| 88. - a * 72.;
  let swing = |d: f64| if d > 1. { ((d - 1.) / d).sqrt() } else { 0. };
  scene.caption(2., 2., "how wide the reed swings for each drive");
  scene.line(
    format!("{} {}", hline(88., 2., 98.), vline(x(1.), 14., 88.)),
    Tone::Faint,
  );
  scene.label_at(
    x(1.) + 1.,
    88.,
    "speaks",
    Tone::Dim,
    Align::Start,
    Anchor::Bottom,
  );
  scene.path(
    sample(120, |t| {
      let d = t * span;
      (x(d), y(swing(d)))
    }),
    Tone::Ink,
    width(2.),
  );
  for (velocity, name) in [(0.2, "soft"), (1., "loud")] {
    let d = lerp(patch.pressure.0, patch.pressure.1, velocity) * pressure;
    let a = swing(d);
    scene.path(
      vline(x(d), y(a), 88.),
      tone_of("exciter.pressure"),
      width(2.),
    );
    scene.label_at(
      x(d),
      y(a) - 2.,
      name,
      tone_of("exciter.pressure"),
      Align::Middle,
      Anchor::Bottom,
    );
  }
  scene.label_at(
    98.,
    100.,
    format!(
      "air noise {}×",
      to_fixed(get(values, "exciter.noise", 1.), 2)
    ),
    tone_of("exciter.noise"),
    Align::End,
    Anchor::Bottom,
  );
}

/// One cycle of an oscillator wave at `t` (0–1): sine, triangle, square or saw.
fn wave_at(wave: usize, t: f64) -> f64 {
  match wave {
    0 => (2. * PI * t).sin(),
    1 => 1. - 4. * (t - 0.5).abs(),
    2 => {
      if t < 0.5 {
        1.
      } else {
        -1.
      }
    }
    _ => 2. * t - 1.,
  }
}

/// JavaScript's `%`: the remainder keeps the dividend's sign.
fn rem(a: f64, b: f64) -> f64 {
  a % b
}

/// The oscillator's exciter: each wave's cycle, and the two together.
fn oscillator_exciter(scene: &mut Scene, input: &GraphInput) {
  let (values, tone_of) = (input.values, input.tone_of);
  let wave = round(get(values, "exciter.wave", 0.)) as usize;
  let wave2 = round(get(values, "exciter.wave2", 0.)) as usize;
  let level2 = if wave2 > 0 {
    get(values, "exciter.level2", 0.5)
  } else {
    0.
  };
  let phase = get(values, "exciter.phase", 0.) / 360.;
  let at = |f: &dyn Fn(f64) -> f64, t: f64| f(rem(rem(t, 1.) + 1., 1.));
  let cycle = |f: &dyn Fn(f64) -> f64, x0: f64, scale: f64| {
    sample(160, |t| (x0 + t * 28., 50. - at(f, 2. * t) * scale))
  };
  scene.line(hline(50., 2., 98.), Tone::Faint);
  scene.path(
    cycle(&|t| wave_at(wave, t), 2., 30.),
    tone_of("exciter.wave"),
    width(2.),
  );
  scene.label(16., 2., "wave 1", tone_of("exciter.wave"), Align::Middle);
  let second = |t: f64| wave_at(wave2 - 1, rem(t + phase, 1.));
  if wave2 > 0 {
    scene.path(
      cycle(&second, 36., 30. * level2),
      tone_of("exciter.wave2"),
      width(2.),
    );
    scene.label(
      50.,
      2.,
      format!(
        "wave 2 · {} · {}°",
        percent(level2),
        number(round(phase * 360.))
      ),
      tone_of("exciter.wave2"),
      Align::Middle,
    );
  } else {
    scene.label_at(
      50.,
      50.,
      "wave 2 off",
      Tone::Dim,
      Align::Middle,
      Anchor::Middle,
    );
  }
  let sum =
    |t: f64| (wave_at(wave, t) + if wave2 > 0 { level2 * second(t) } else { 0. }) / (1. + level2);
  scene.path(cycle(&sum, 70., 30.), Tone::Ink, width(2.));
  scene.label(84., 2., "together", Tone::Dim, Align::Middle);
}

/// The exciter page's graph, for any instrument.
pub fn exciter_scene(input: &GraphInput) -> GraphScene {
  let mut scene = Scene::default();
  match input.patch {
    Patch::String(_) => string_exciter(&mut scene, input),
    Patch::Bar(_) => bar_exciter(&mut scene, input),
    Patch::Drums(_) => drum_exciter(&mut scene, input),
    Patch::Bowed(_) => bow_exciter(&mut scene, input),
    Patch::Bore(_) => bore_exciter(&mut scene, input),
    Patch::Reed(_) => free_reed_exciter(&mut scene, input),
    Patch::Oscillator(_) => oscillator_exciter(&mut scene, input),
  }
  scene.done()
}

/// A partial for [`partial_bars`]: its ratio to the fundamental, its level (dB)
/// and how long it rings (s).
struct PartialBar {
  ratio: f64,
  level: f64,
  t60: f64,
}

/// Partials or modes as bars against the harmonic series: outlined at the
/// strike, solid `later` seconds on, a dashed line over what is left. Gives
/// back where a ratio falls across.
fn partial_bars(
  scene: &mut Scene,
  partials: &[PartialBar],
  max_ratio: f64,
  later: f64,
  decay_tone: Tone,
) -> impl Fn(f64) -> f64 + use<> {
  let x = move |r: f64| 2. + ((r - 0.5) / (max_ratio - 0.5)) * 96.;
  let y = |level: f64| 92. - ((level.max(-60.) + 60.) / 60.) * 76.;
  let mut ticks = String::new();
  let mut n = 1.;
  while n <= max_ratio {
    ticks += &vline(x(n), 92., 96.);
    n += 1.;
  }
  scene.line(format!("{} {ticks}", hline(92., 2., 98.)), Tone::Faint);
  let mut outline = String::new();
  let mut solid = String::new();
  let mut tops = Vec::new();
  for partial in partials {
    if partial.ratio > max_ratio {
      break;
    }
    let after = partial.level - (60. * later) / partial.t60;
    outline += &vline(x(partial.ratio), 92., y(partial.level));
    if after > -60. {
      solid += &vline(x(partial.ratio), 92., y(after));
    }
    tops.push((x(partial.ratio), y(after)));
  }
  scene.path(outline, Tone::Faint, width(5.));
  scene.path(solid, Tone::Ink, width(3.));
  scene.path(polyline(&tops), decay_tone, dashed_width(1.4));
  scene.caption(
    2.,
    2.,
    format!("at the strike (outline) and {} later (solid)", ms(later)),
  );
  x
}

/// A string's resonator: its partials as the loop rings them.
fn string_resonator(scene: &mut Scene, input: &GraphInput) {
  let Patch::String(patch) = input.patch else {
    return;
  };
  let (values, tone_of) = (input.values, input.tone_of);
  let note = input.note as f64;
  let f0 = midi_to_hz(note);
  let mut string = StringLoop::new(FS, f0);
  if let Some(jawari) = &patch.jawari {
    string.set_jawari(
      jawari.contact * get(values, "resonator.jawari", 0.),
      jawari.gap,
    );
  }
  string.tune(
    f0,
    key_table(&patch.t60, note) * get(values, "resonator.decay", 1.),
    clamp(
      key_table(&patch.brightness, note) - get(values, "resonator.brightness", 0.),
      0.,
      0.95,
    ),
    key_table(&patch.dispersion_stages, note),
    clamp(
      key_table(&patch.dispersion_coef, note) * get(values, "resonator.inharmonicity", 1.),
      -0.95,
      0.,
    ),
  );
  let partials: Vec<PartialBar> = string
    .partials(24)
    .iter()
    .enumerate()
    .map(|(i, partial)| PartialBar {
      ratio: partial.hz / f0,
      level: db(1. / (i as f64 + 1.)),
      t60: partial.t60,
    })
    .collect();
  let x = partial_bars(scene, &partials, 26., 1., tone_of("resonator.brightness"));
  let mut stretch = String::new();
  for (i, partial) in partials.iter().enumerate() {
    let harmonic = i as f64 + 1.;
    if (x(partial.ratio) - x(harmonic)).abs() > 0.15 {
      stretch += &hline(94., x(harmonic), x(partial.ratio));
    }
  }
  scene.path(stretch, tone_of("resonator.inharmonicity"), width(2.));
  if let Some(last) = partials.last() {
    let sharp = 1200. * (last.ratio / partials.len() as f64).log2();
    scene.label(
      98.,
      2.,
      format!(
        "partial {}: {} ¢ sharp",
        partials.len(),
        number(round(sharp))
      ),
      tone_of("resonator.inharmonicity"),
      Align::End,
    );
  }
  let strings = if patch.allocation == "key" {
    round(key_table(&patch.unison, note)).clamp(1., 3.)
  } else if patch.polarization.is_some() {
    2.
  } else {
    1.
  };
  let cents = match &patch.polarization {
    Some(polarization) => polarization.detune_cents,
    None => key_table(&patch.unison_detune, note) * get(values, "resonator.detune", 1.),
  };
  if strings > 1. && cents > 0. {
    let beat = f0 * (2f64.powf(cents / 1200.) - 1.);
    scene.label(
      98.,
      12.,
      format!(
        "{} beat {} Hz",
        if strings == 2. && patch.polarization.is_some() {
          "2 planes".to_owned()
        } else {
          format!("{} strings", number(strings))
        },
        to_fixed(beat, 2)
      ),
      tone_of("resonator.detune"),
      Align::End,
    );
  }
}

/// A bar's resonator: its modes and how long each rings.
fn bar_resonator(scene: &mut Scene, input: &GraphInput) {
  let Patch::Bar(patch) = input.patch else {
    return;
  };
  let (values, tone_of) = (input.values, input.tone_of);
  let brightness = get(values, "resonator.brightness", 0.);
  let scale = key_table(&patch.decay, input.note as f64) * get(values, "resonator.decay", 1.);
  let partials: Vec<PartialBar> = patch
    .modes
    .iter()
    .map(|&(ratio, level, t60)| PartialBar {
      ratio,
      level: db(level * ratio.powf(brightness)),
      t60: t60 * scale,
    })
    .collect();
  let x = partial_bars(scene, &partials, 16., 0.2, tone_of("resonator.brightness"));
  for &(ratio, _, _) in &patch.modes {
    scene.label(
      x(ratio),
      12.,
      format!("×{}", number(ratio)),
      Tone::Dim,
      Align::Middle,
    );
  }
}

/// A legato note sliding in: 1 − e^(−3t/glide), so it is 95% there at
/// `glide`.
fn glide_resonator(scene: &mut Scene, input: &GraphInput) {
  let tone_of = input.tone_of;
  let glide = get(input.values, "resonator.portamento", 0.05);
  let span = (glide * 2.).max(0.2);
  let x = |t: f64| 2. + (t / span) * 96.;
  scene.caption(2., 2., "a legato note slides from the one before");
  scene.path(
    format!("{} {}", hline(24., 2., 98.), hline(82., 2., 98.)),
    Tone::Faint,
    dashed(),
  );
  scene.label_at(98., 22., "new note", Tone::Dim, Align::End, Anchor::Bottom);
  scene.label(98., 84., "held note", Tone::Dim, Align::End);
  scene.path(
    sample(120, |t| {
      let seconds = t * span;
      (
        x(seconds),
        82. - 58. * (1. - ((-3. * seconds) / glide).exp()),
      )
    }),
    tone_of("resonator.portamento"),
    width(2.),
  );
  scene.path(
    vline(x(glide), 20., 86.),
    tone_of("resonator.portamento"),
    dashed(),
  );
  scene.label(
    x(glide) + 1.,
    50.,
    format!("there in {}", ms(glide)),
    tone_of("resonator.portamento"),
    Align::Start,
  );
}

/// The flow through the slot over two swings: narrower pulses as the slot
/// widens (Brightness), and the beat of a second, sharper reed.
fn free_reed_resonator(scene: &mut Scene, input: &GraphInput) {
  let Patch::Reed(patch) = input.patch else {
    return;
  };
  let (values, tone_of) = (input.values, input.tone_of);
  let slot = 0.25 + 0.15 * get(values, "resonator.brightness", 0.);
  let d = lerp(patch.pressure.0, patch.pressure.1, VELOCITY) * get(values, "exciter.pressure", 1.);
  let amplitude = if d > 1. { ((d - 1.) / d).sqrt() } else { 0. };
  let opening = |z: f64| 0.5 * (z + (z * z + 0.0025).sqrt());
  let flow = |t: f64| {
    let x = amplitude * (2. * PI * t).sin();
    0.02 + opening(x - slot) + (1. - patch.asymmetry) * opening(-x - slot)
  };
  scene.caption(2., 2., "air through the slot, two swings");
  scene.line(hline(88., 2., 98.), Tone::Faint);
  scene.path(
    sample(240, |t| (2. + t * 96., 88. - (flow(2. * t) / 0.8) * 72.)),
    tone_of("resonator.brightness"),
    width(2.),
  );
  if patch.reeds.len() > 1 {
    let cents = patch.reeds[1].0 * get(values, "resonator.detune", 1.);
    let beat = midi_to_hz(input.note as f64) * (2f64.powf(cents / 1200.) - 1.);
    scene.label(
      98.,
      2.,
      format!("second reed beats {} Hz", to_fixed(beat, 1)),
      tone_of("resonator.detune"),
      Align::End,
    );
  }
}

/// The kit's main drum after a hit: its pitch dropping to rest, and its
/// level.
fn drum_resonator(scene: &mut Scene, input: &GraphInput) {
  let (values, tone_of) = (input.values, input.tone_of);
  let (f0, pitch_drop, pitch_tau, t60) = match main_piece(input.patch) {
    Some(DrumPieceSpec::Membrane {
      f0,
      pitch_drop,
      pitch_tau,
      t60,
      ..
    }) => (*f0, *pitch_drop, *pitch_tau, t60[0]),
    Some(DrumPieceSpec::Loaded {
      f0,
      pitch_drop,
      pitch_tau,
      partials,
      ..
    }) => (
      *f0,
      pitch_drop.unwrap_or(0.),
      pitch_tau.unwrap_or(50.),
      partials[0].1,
    ),
    _ => return,
  };
  let tune = 2f64.powf(get(values, "resonator.tune", 0.) / 12.);
  let decay = get(values, "resonator.decay", 1.);
  let drop_scale = get(values, "resonator.pitchDrop", 1.);
  let f0 = f0 * tune;
  let drop = pitch_drop * VELOCITY * drop_scale;
  let tau = pitch_tau / 1000.;
  let t60 = t60 * decay;
  let span = 0.6;
  let x = |t: f64| 2. + (t / span) * 96.;
  let kick = matches!(input.patch, Patch::Drums(kit) if kit.pieces.contains_key("kick"));
  scene.caption(
    2.,
    2.,
    format!(
      "{} after a hit",
      if kick { "the kick" } else { "the main drum" }
    ),
  );
  scene.line(hline(92., 2., 98.), Tone::Faint);
  scene.path(
    sample(120, |t| {
      let seconds = t * span;
      (x(seconds), 92. - 76. * 10f64.powf((-3. * seconds) / t60))
    }) + &format!(" L{} 92 L2 92 Z", n2(x(span))),
    tone_of("resonator.decay"),
    fill(),
  );
  scene.path(
    sample(120, |t| {
      let seconds = t * span;
      (
        x(seconds),
        60. - 40. * (drop * (-seconds / tau).exp()).min(1.),
      )
    }),
    tone_of("resonator.pitchDrop"),
    width(2.),
  );
  scene.label(
    98.,
    2.,
    format!("settles at {}", hz(f0)),
    tone_of("resonator.tune"),
    Align::End,
  );
  scene.label_at(
    98.,
    100.,
    format!(
      "snare wires {}×",
      to_fixed(get(values, "resonator.wires", 1.), 2)
    ),
    tone_of("resonator.wires"),
    Align::End,
    Anchor::Bottom,
  );
}

/// The resonator page's graph, for any instrument.
pub fn resonator_scene(input: &GraphInput) -> GraphScene {
  let mut scene = Scene::default();
  match input.patch {
    Patch::String(_) => string_resonator(&mut scene, input),
    Patch::Bar(_) => bar_resonator(&mut scene, input),
    Patch::Bore(_) | Patch::Bowed(_) => glide_resonator(&mut scene, input),
    Patch::Reed(_) => free_reed_resonator(&mut scene, input),
    Patch::Drums(_) => drum_resonator(&mut scene, input),
    Patch::Oscillator(_) => {}
  }
  scene.done()
}

/// A log axis from `lo` to `hi` across the box.
fn log_axis(lo: f64, hi: f64) -> impl Fn(f64) -> f64 {
  let a = lo.log10();
  let b = hi.log10();
  move |f: f64| 2. + ((f.log10() - a) / (b - a)) * 96.
}

/// Faint vertical lines at `marks` on a frequency axis, labelled along the
/// bottom.
fn frequency_grid(scene: &mut Scene, x: &dyn Fn(f64) -> f64, marks: &[f64]) {
  let grid: String = marks.iter().map(|&f| vline(x(f), 12., 92.)).collect();
  scene.line(grid, Tone::Faint);
  for &f in marks {
    scene.label_at(
      x(f),
      100.,
      if f >= 1000. {
        format!("{}k", number(f / 1000.))
      } else {
        number(f)
      },
      Tone::Dim,
      Align::Middle,
      Anchor::Bottom,
    );
  }
}

/// The SVF lowpass's response over the note's partials, where the envelope
/// opens it at each note, and where keytrack moves it for this note.
pub fn filter_scene(input: &GraphInput) -> GraphScene {
  let (values, tone_of) = (input.values, input.tone_of);
  let note = input.note as f64;
  let mut scene = Scene::default();
  let q = get(values, "filter.resonance", FRAC_1_SQRT_2);
  let env = get(values, "filter.envAmount", 0.);
  let env_decay = get(values, "filter.envDecay", 0.3);
  let keytrack = get(values, "filter.keytrack", 0.);
  let cutoff = (get(values, "filter.cutoff", 16000.) * 2f64.powf((keytrack * (note - 60.)) / 12.))
    .min(0.45 * FS);
  let x = log_axis(40., 18000.);
  let y = |level: f64| 92. - ((level.min(18.).max(-48.) + 48.) / 66.) * 80.;
  let lowpass = |f: f64, c: f64| {
    let r = f / c.min(0.45 * FS);
    -10. * ((1. - r * r).powi(2) + (r / q).powi(2)).log10()
  };
  frequency_grid(&mut scene, &x, &[100., 1000., 10000.]);
  let drums = matches!(input.patch, Patch::Drums(_));
  if !drums {
    let f0 = midi_to_hz(note);
    let mut before = String::new();
    let mut after = String::new();
    let mut n = 1.;
    while f0 * n <= 18000. {
      let level = -20. * n.log10() - 6.;
      before += &vline(x(f0 * n), 92., y(level));
      after += &vline(x(f0 * n), 92., y(level + lowpass(f0 * n, cutoff)));
      n += 1.;
    }
    scene.path(before, Tone::Faint, width(2.));
    scene.path(after, Tone::Dim, width(2.));
  }
  let curve = |c: f64| {
    sample(200, |t| {
      let f = 40. * (18000f64 / 40.).powf(t);
      (x(f), y(lowpass(f, c)))
    })
  };
  if env > 0. {
    let opened = cutoff * (1. + env);
    scene.path(
      curve(opened),
      tone_of("filter.envAmount"),
      dashed_width(1.5),
    );
    let from = x(opened.min(18000.));
    let to = x(cutoff);
    scene.path(
      format!(
        "{} M{} 13 L{} 16 L{} 19",
        hline(16., from, to + 1.),
        n2(to + 2.),
        n2(to + 0.6),
        n2(to + 2.)
      ),
      tone_of("filter.envDecay"),
      width(1.5),
    );
    scene.label_at(
      (from + to) / 2.,
      13.,
      format!("closes over {}", ms(env_decay)),
      tone_of("filter.envDecay"),
      Align::Middle,
      Anchor::Bottom,
    );
  }
  scene.path(curve(cutoff), tone_of("filter.cutoff"), width(2.));
  if q > 0.75 {
    let peak = cutoff * (1. - 1. / (2. * q * q)).max(0.05).sqrt();
    scene.path(
      vline(
        x(peak),
        y(lowpass(peak, cutoff)) - 3.,
        y(lowpass(peak, cutoff)) + 3.,
      ),
      tone_of("filter.resonance"),
      width(4.),
    );
  }
  scene.caption(
    2.,
    2.,
    if drums {
      "the kit's lowpass"
    } else {
      "the lowpass over the note's partials"
    },
  );
  if keytrack > 0. {
    scene.label(
      98.,
      2.,
      format!("{} at this note", hz(cutoff)),
      tone_of("filter.keytrack"),
      Align::End,
    );
  }
  scene.done()
}

/// Magnitude of the violin's measured body (STK's biquads, at 44.1 kHz).
fn violin_body(f: f64) -> f64 {
  let w = (2. * PI * f) / STK_RATE;
  let mut gain = 1.;
  for [b0, b1, b2, a1, a2] in BODY_SECTIONS {
    let num = (b0 + b1 * w.cos() + b2 * (2. * w).cos()).hypot(-b1 * w.sin() - b2 * (2. * w).sin());
    let den = (1. + a1 * w.cos() + a2 * (2. * w).cos()).hypot(-a1 * w.sin() - a2 * (2. * w).sin());
    gain *= num / den;
  }
  gain
}

/// The body's response added to the bare string (0 dB, dashed), with the
/// tone tilt; a kit's body is its stereo spread.
pub fn body_scene(input: &GraphInput) -> GraphScene {
  let (patch, values, tone_of) = (input.patch, input.values, input.tone_of);
  let mut scene = Scene::default();
  let tone = get(values, "body.tone", 0.);
  if let Patch::Drums(kit) = patch {
    let spread = get(values, "body.width", 1.);
    scene.caption(2., 2., "where each piece sits, left to right");
    scene.line(
      format!("{} {}", hline(50., 2., 98.), vline(50., 40., 60.)),
      Tone::Faint,
    );
    let mut marks = String::new();
    for piece in kit.pieces.values() {
      let pan = match piece {
        DrumPieceSpec::Membrane { pan, .. }
        | DrumPieceSpec::Metal { pan, .. }
        | DrumPieceSpec::Loaded { pan, .. }
        | DrumPieceSpec::Noise { pan, .. } => *pan,
        DrumPieceSpec::Combo { .. } => continue,
      };
      let pan = clamp(pan * spread, -1., 1.);
      marks += &vline(50. + pan * 46., 38., 62.);
    }
    scene.path(marks, tone_of("body.width"), width(3.));
    scene.caption(2., 64., "left");
    scene.label(98., 64., "right", Tone::Dim, Align::End);
    if tone != 0. {
      scene.label_at(
        98.,
        100.,
        if tone > 0. {
          "tilted bright"
        } else {
          "tilted dark"
        },
        tone_of("body.tone"),
        Align::End,
        Anchor::Bottom,
      );
    }
    return scene.done();
  }
  let size = get(values, "body.size", 1.);
  let resonance = get(values, "body.resonance", 1.);
  let violin = has(values, "body.violin");
  let mix = if violin {
    get(values, "body.violin", 0.)
  } else {
    get(values, "body.mix", 0.)
  };
  let high = 10f64.powf((tone * 6.) / 20.);
  // The ±6 dB tilt: a one-pole split at 800 Hz, lows over `high`, highs
  // times it.
  let tilt = |f: f64| {
    let r = f / 800.;
    let den = 1. + r * r;
    (
      (1. / high + high * r * r) / den,
      (high * r - r / high) / den,
    )
  };
  let body = &patch.base().body;
  let response = |f: f64| {
    let mut re = 1.;
    let mut im = 0.;
    if violin {
      re = 1. + mix * (violin_body(f) / 4. - 1.);
    } else {
      match body {
        BodySpec::Modal { modes } => {
          for &(freq, t60, amp) in modes {
            let fr = freq * size;
            let qm = (PI * fr * t60 * resonance) / 6.9078;
            let k = qm * (f / fr - fr / f);
            re += (mix * amp) / (1. + k * k);
            im -= (mix * amp * k) / (1. + k * k);
          }
        }
        BodySpec::Radiation { highpass, presence } => {
          let r = f / (highpass * size);
          let mut gain = r / (1. + r * r).sqrt();
          if let Some(presence) = presence {
            let fp = presence.freq * size;
            let k = presence.q * (f / fp - fp / f);
            gain *= 1. + (10f64.powf((presence.gain_db * resonance) / 20.) - 1.) / (1. + k * k);
          }
          re = 1. + mix * (gain - 1.);
        }
        BodySpec::None => {}
      }
    }
    let (tr, ti) = tilt(f);
    db((re * tr - im * ti).hypot(re * ti + im * tr))
  };
  let x = log_axis(50., 6000.);
  let y = |level: f64| 50. - (level.min(12.).max(-12.) / 12.) * 40.;
  frequency_grid(&mut scene, &x, &[100., 1000.]);
  scene.path(hline(y(0.), 2., 98.), Tone::Dim, dashed());
  let curve = sample(300, |t| {
    let f = 50. * (6000f64 / 50.).powf(t);
    (x(f), y(response(f)))
  });
  scene.path(
    format!("{curve} L98 {} L2 {} Z", n2(y(0.)), n2(y(0.))),
    tone_of(if violin { "body.violin" } else { "body.mix" }),
    fill(),
  );
  if tone != 0. {
    scene.path(
      sample(100, |t| {
        let f = 50. * (6000f64 / 50.).powf(t);
        let (tr, ti) = tilt(f);
        (x(f), y(db(tr.hypot(ti))))
      }),
      tone_of("body.tone"),
      dashed_width(1.5),
    );
  }
  scene.path(curve, Tone::Ink, width(2.));
  scene.caption(
    2.,
    2.,
    if violin {
      "the violin's measured body".to_owned()
    } else {
      match body {
        BodySpec::Modal { modes } => {
          format!("what the body adds: {} resonances", modes.len())
        }
        BodySpec::Radiation { .. } => "the bell: lows stay inside, highs radiate".into(),
        BodySpec::None => "the tone tilt".into(),
      }
    },
  );
  if let BodySpec::Modal { modes } = body
    && !violin
  {
    let lowest = modes[0].0 * size;
    scene.label_at(
      x(lowest),
      y(response(lowest)) - 2.,
      hz(lowest),
      tone_of("body.size"),
      Align::Middle,
      Anchor::Bottom,
    );
  }
  scene.done()
}

/// An envelope stage's curve, from 0 to 1 as `t` goes from 0 to 1.
fn curve_ease(t: f64) -> f64 {
  1. - 0.01f64.powf(t)
}

/// The ADSR the model's exciter follows; a string's attack and damper; the
/// oscillator's gate.
pub fn envelope_scene(input: &GraphInput) -> GraphScene {
  let (patch, values, tone_of) = (input.patch, input.values, input.tone_of);
  let note = input.note as f64;
  let mut scene = Scene::default();
  let y = |level: f64| 88. - level * 72.;
  scene.line(hline(88., 2., 98.), Tone::Faint);
  if let Patch::String(patch) = patch {
    let attack = get(values, "envelope.attack", 0.001);
    let t60 = key_table(&patch.t60, note) * get(values, "resonator.decay", 1.);
    let damped = patch
      .no_damper_above
      .is_none_or(|above| input.note <= above);
    let damper = key_table(&patch.damper_t60, note) * get(values, "envelope.release", 1.);
    let key_up = 1.;
    let span = 2.;
    let x = |t: f64| 2. + (t / span) * 96.;
    let level = |t: f64| {
      let rise = (t / attack.max(0.001)).min(1.);
      let held = 10f64.powf((-3. * t.min(key_up)) / t60);
      let after = if t > key_up {
        10f64.powf((-3. * (t - key_up)) / if damped { damper } else { t60 })
      } else {
        1.
      };
      rise * held * after
    };
    scene.path(
      sample(240, |t| (x(t * span), y(level(t * span)))),
      Tone::Ink,
      width(2.),
    );
    let early = (attack * 3.).min(0.2);
    scene.path(
      sample(20, |t| (x(t * early), y(level(t * early)))),
      tone_of("envelope.attack"),
      width(3.),
    );
    scene.path(vline(x(key_up), 14., 88.), Tone::Dim, dashed());
    scene.caption(x(key_up) + 1., 14., "key up");
    scene.path(
      sample(60, |t| (x(key_up + t * 0.6), y(level(key_up + t * 0.6)))),
      tone_of("envelope.release"),
      width(3.),
    );
    scene.caption(
      2.,
      2.,
      "the string's level: rings while held, damped at key up",
    );
    scene.label(
      98.,
      2.,
      if damped {
        format!("damper {}", ms(damper))
      } else {
        "no damper here".into()
      },
      tone_of("envelope.release"),
      Align::End,
    );
    return scene.done();
  }
  let attack = get(values, "envelope.attack", 0.005);
  let release = get(values, "envelope.release", 0.1);
  let gate = !has(values, "envelope.decay");
  let decay = if gate {
    0.
  } else {
    get(values, "envelope.decay", 0.1)
  };
  let sustain = if gate {
    1.
  } else {
    get(values, "envelope.sustain", 0.9)
  };
  let span = |t: f64, max: f64| 6. + 26. * (t / max).sqrt();
  let xa = 2. + span(attack, 0.5);
  let xd = if gate { xa } else { xa + span(decay, 1.) };
  let xr = 98. - span(release, if gate { 2. } else { 1. });
  scene.path(
    sample(20, |t| (2. + (xa - 2.) * t, y(t))),
    tone_of("envelope.attack"),
    width(2.),
  );
  if !gate {
    scene.path(
      sample(30, |t| {
        (xa + (xd - xa) * t, y(1. + (sustain - 1.) * curve_ease(t)))
      }),
      tone_of("envelope.decay"),
      width(2.),
    );
  }
  scene.path(
    hline(y(sustain), xd, xr),
    if gate {
      Tone::Ink
    } else {
      tone_of("envelope.sustain")
    },
    width(2.),
  );
  scene.path(
    sample(30, |t| {
      (xr + (98. - xr) * t, y(sustain * (1. - curve_ease(t))))
    }),
    tone_of("envelope.release"),
    width(2.),
  );
  scene.path(
    format!("{} {}", vline(2., 12., 88.), vline(xr, 12., 88.)),
    Tone::Faint,
    dashed(),
  );
  scene.label_at(
    3.,
    100.,
    "key down",
    Tone::Dim,
    Align::Start,
    Anchor::Bottom,
  );
  scene.label_at(
    xr + 1.,
    100.,
    "key up",
    Tone::Dim,
    Align::Start,
    Anchor::Bottom,
  );
  let drives = match patch {
    Patch::Bore(_) => "breath pressure → the exciter",
    Patch::Bowed(_) => "bow speed → the exciter",
    Patch::Reed(_) => "bellows → the exciter",
    _ => "the gate: full while the key is held",
  };
  scene.label(98., 2., drives, Tone::Dim, Align::End);
  scene.done()
}

/// The random LFO's steps, as the graph draws them.
const RANDOM_STEPS: [f64; 8] = [0.6, -0.35, 0.9, -0.8, 0.15, -0.55, 0.4, -0.1];

/// Where the vibrato's pitch and level depths go on each family: the
/// model's own loop or exciter where it has one, else the voice's output
/// right after the filter.
fn vibrato_destinations(patch: &Patch) -> (&'static str, &'static str) {
  match patch {
    Patch::String(_) | Patch::Bar(_) => ("swept delay", "tremolo"),
    Patch::Reed(_) => ("swept delay", "bellows"),
    Patch::Bore(_) => ("bore length", "breath"),
    Patch::Bowed(_) => ("string length", "bow"),
    Patch::Oscillator(_) => ("oscillators", "tremolo"),
    Patch::Drums(_) => ("", ""),
  }
}

/// The first 1.2 s of a note's vibrato: silent through its delay, fading
/// in, and three gauges for how far it moves pitch, level and the cutoff.
pub fn vibrato_scene(input: &GraphInput) -> GraphScene {
  let (patch, values, tone_of) = (input.patch, input.values, input.tone_of);
  let mut scene = Scene::default();
  let rate = get(values, "vibrato.rate", 5.);
  let shape = round(get(values, "vibrato.shape", 0.)) as usize;
  let free = matches!(patch, Patch::Reed(_));
  let delay = if free {
    0.
  } else {
    get(values, "vibrato.delay", 0.)
  };
  let fade = if free {
    0.
  } else if matches!(patch, Patch::Bowed(_)) {
    0.4
  } else {
    0.3
  };
  let span = 1.2;
  let x = |t: f64| 2. + (t / span) * 96.;
  let wave = |t: f64| {
    let after = t - delay;
    if after <= 0. {
      return 0.;
    }
    let cycles = after * rate;
    let phase = cycles - cycles.floor();
    let value = if shape < 4 {
      wave_at(shape, phase)
    } else {
      RANDOM_STEPS[cycles.floor() as usize % RANDOM_STEPS.len()]
    };
    value
      * if fade > 0. {
        (after / fade).min(1.)
      } else {
        1.
      }
  };
  if delay > 0. {
    scene.path(rect(2., 10., x(delay), 56.), Tone::Faint, fill());
    scene.caption(3., 12., format!("delay {}", ms(delay)));
  }
  scene.path(hline(33., 2., 98.), Tone::Faint, dashed());
  scene.path(
    sample(600, |t| (x(t * span), 33. - wave(t * span) * 20.)),
    tone_of("vibrato.rate"),
    width(1.8),
  );
  scene.label(
    98.,
    2.,
    if free {
      format!("{} Hz, one cycle for every voice", to_fixed(rate, 1))
    } else {
      format!("{} Hz", to_fixed(rate, 1))
    },
    tone_of("vibrato.rate"),
    Align::End,
  );
  let (pitch, level) = vibrato_destinations(patch);
  let gauges = [
    (
      "Pitch",
      "vibrato.pitch",
      50.,
      format!("±{} ¢", to_fixed(get(values, "vibrato.pitch", 0.), 1)),
      pitch,
    ),
    (
      "Level",
      "vibrato.level",
      0.3,
      format!("±{}", percent(get(values, "vibrato.level", 0.))),
      level,
    ),
    (
      "Filter",
      "vibrato.filter",
      3.,
      format!("±{} oct", to_fixed(get(values, "vibrato.filter", 0.), 1)),
      "cutoff",
    ),
  ];
  for (i, (name, id, max, reading, destination)) in gauges.into_iter().enumerate() {
    let left = 2. + i as f64 * 33.;
    let centre = left + 15.;
    let half = 15. * (get(values, id, 0.) / max).min(1.);
    scene.path(hline(76., left, left + 30.), Tone::Faint, width(6.));
    if half > 0. {
      scene.path(
        hline(76., centre - half, centre + half),
        tone_of(id),
        width(6.),
      );
    }
    scene.line(vline(centre, 71., 81.), Tone::Dim);
    scene.label_at(
      left,
      68.,
      format!("{name} {reading}"),
      tone_of(id),
      Align::Start,
      Anchor::Bottom,
    );
    scene.label_at(
      left,
      100.,
      format!("→ {destination}"),
      Tone::Dim,
      Align::Start,
      Anchor::Bottom,
    );
  }
  scene.done()
}

/// The drive's curve and a wave through it, then how much goes to the mix
/// and to the reverb.
pub fn output_scene(input: &GraphInput) -> GraphScene {
  let (values, tone_of) = (input.values, input.tone_of);
  let mut scene = Scene::default();
  let level = get(values, "output.level", 1.);
  let send = get(values, "space.send", 0.);
  let mut right = 2.;
  if has(values, "output.drive") {
    let amount = get(values, "output.drive", 0.);
    let curve = |a: f64| {
      sample(80, |t| {
        let input = -1. + 2. * t;
        (2. + t * 26., 50. - saturate(input, a) * 36.)
      })
    };
    scene.caption(2., 2., "drive: in → out");
    scene.line(
      format!("{} M2 86 L28 14", rect(2., 14., 28., 86.)),
      Tone::Faint,
    );
    scene.path(curve(1.), Tone::Faint, dashed());
    scene.path(curve(amount), tone_of("output.drive"), width(2.));
    scene.caption(32., 2., "a wave through it");
    scene.line(hline(50., 32., 60.), Tone::Faint);
    scene.line(
      sample(120, |t| {
        (32. + t * 28., 50. - 0.8 * (4. * PI * t).sin() * 36.)
      }),
      Tone::Faint,
    );
    scene.path(
      sample(120, |t| {
        (
          32. + t * 28.,
          50. - saturate(0.8 * (4. * PI * t).sin(), amount) * 36.,
        )
      }),
      tone_of("output.drive"),
      width(2.),
    );
    right = 66.;
  }
  let span = 98. - right;
  scene.caption(right, 2., "where it goes");
  scene.label_at(
    right,
    30.,
    "to the mix",
    Tone::Dim,
    Align::Start,
    Anchor::Bottom,
  );
  scene.label_at(
    98.,
    30.,
    format!("{}×", to_fixed(level, 2)),
    tone_of("output.level"),
    Align::End,
    Anchor::Bottom,
  );
  scene.path(hline(36., right, 98.), Tone::Faint, width(8.));
  scene.path(
    hline(36., right, right + (level / 2.) * span),
    tone_of("output.level"),
    width(8.),
  );
  scene.line(vline(right + span / 2., 31., 41.), Tone::Dim);
  scene.label_at(
    right,
    66.,
    "to the reverb",
    Tone::Dim,
    Align::Start,
    Anchor::Bottom,
  );
  scene.label_at(
    98.,
    66.,
    percent(send),
    tone_of("space.send"),
    Align::End,
    Anchor::Bottom,
  );
  scene.path(hline(72., right, 98.), Tone::Faint, width(8.));
  if send > 0. {
    scene.path(
      hline(72., right, right + send * span),
      tone_of("space.send"),
      width(8.),
    );
  }
  scene.done()
}

/// A chain stop's name, as the overview writes it.
fn stop_name(stop: &str) -> &'static str {
  match stop {
    "exciter" => "EXCITER",
    "resonator" => "RESONATOR",
    "filter" => "FILTER",
    "body" => "BODY",
    "output" => "OUTPUT",
    "envelope" => "ENVELOPE",
    "vibrato" => "VIBRATO",
    _ => "MASTER",
  }
}

/// What each stop is on this instrument.
fn stop_model(patch: &Patch, stop: &str, values: &Values, exciter: &str) -> String {
  match stop {
    "exciter" => exciter.into(),
    "resonator" => match patch {
      Patch::String(_) | Patch::Bowed(_) => "String loop",
      Patch::Bore(_) => "Bore",
      Patch::Reed(_) => "Reed tongue",
      Patch::Drums(_) => "Heads",
      _ => "Modes",
    }
    .into(),
    "filter" => "Lowpass".into(),
    "body" => if has(values, "body.violin") {
      "Violin body"
    } else if matches!(patch, Patch::Drums(_)) {
      "Stereo"
    } else {
      match patch.base().body {
        BodySpec::Modal { .. } => "Resonances",
        BodySpec::Radiation { .. } => "Bell",
        BodySpec::None => "Tone",
      }
    }
    .into(),
    _ => format!("Reverb {}", percent(get(values, "space.send", 0.))),
  }
}

/// A sketch of each stop for its block.
fn stop_sketch(stop: &str, x0: f64, y0: f64, w: f64, h: f64) -> String {
  let at = |t: f64, v: f64| (x0 + t * w, y0 + (1. - v) * h);
  match stop {
    "exciter" => polyline(&[at(0., 0.), at(0.25, 1.), at(1., 0.)]),
    "resonator" => (1..=7)
      .map(|n| {
        let n = n as f64;
        vline(
          x0 + ((n - 0.5) / 7.) * w,
          y0 + h,
          y0 + h - (h * 0.9) / n.powf(0.6),
        )
      })
      .collect(),
    "filter" => sample(30, |t| {
      at(
        t,
        if t < 0.55 {
          0.7 + 0.25 * (t * 3.).sin()
        } else {
          (0.9 - (t - 0.55) * 2.2).max(0.)
        },
      )
    }),
    "body" => sample(40, |t| {
      at(
        t,
        0.35
          + 0.3 * (-((t - 0.25).powi(2)) / 0.004).exp()
          + 0.2 * (-((t - 0.5).powi(2)) / 0.003).exp(),
      )
    }),
    _ => [0.85, 0.6, 0.35]
      .iter()
      .enumerate()
      .map(|(i, v)| vline(x0 + ((i as f64 + 0.5) / 3.) * w, y0 + h, y0 + h - v * h))
      .collect(),
  }
}

/// The overview: the chain's stops as blocks in signal order, the picked
/// one green, and the instrument's envelope and vibrato wired to where they
/// act.
pub fn chain_scene(
  input: &GraphInput,
  pages: &[SynthPage],
  picked: &str,
  exciter_name: &str,
) -> GraphScene {
  let (patch, values) = (input.patch, input.values);
  let mut scene = Scene::default();
  let stops: Vec<&str> = CHAIN_STOPS
    .iter()
    .copied()
    .filter(|stop| pages.iter().any(|page| page.id == *stop))
    .collect();
  let gap = 3.5;
  let count = stops.len() as f64;
  let block = (96. - gap * (count - 1.)) / count;
  let left = |i: f64| 2. + i * (block + gap);
  let top = 6.;
  let bottom = 50.;
  let centre = |stop: &str| match stops.iter().position(|candidate| *candidate == stop) {
    Some(i) => left(i as f64) + block / 2.,
    None => -1.,
  };
  for (i, &stop) in stops.iter().enumerate() {
    let x0 = left(i as f64);
    let picked_stop = picked == stop;
    if picked_stop {
      scene.path(rect(x0, top, x0 + block, bottom), Tone::Green, fill());
    }
    scene.path(
      rect(x0, top, x0 + block, bottom),
      if picked_stop {
        Tone::Green
      } else {
        Tone::Faint
      },
      width(if picked_stop { 2. } else { 1. }),
    );
    scene.caption(x0 + 1.2, top + 3., stop_name(stop));
    scene.label(
      x0 + 1.2,
      top + 15.,
      stop_model(patch, stop, values, exciter_name),
      Tone::Ink,
      Align::Start,
    );
    scene.path(
      stop_sketch(stop, x0 + 2., top + 28., block - 4., 13.),
      Tone::Dim,
      width(1.4),
    );
    if i < stops.len() - 1 {
      let ax = x0 + block;
      scene.line(
        format!(
          "{} M{} 25 L{} 28 L{} 31",
          hline(28., ax + 0.4, ax + gap - 0.4),
          n2(ax + gap - 1.4),
          n2(ax + gap - 0.4),
          n2(ax + gap - 1.4)
        ),
        Tone::Dim,
      );
    }
  }
  let pill = |scene: &mut Scene, i: f64, text: String, tone: Tone| {
    let x0 = left(i);
    scene.path(rect(x0, 78., x0 + block, 96.), tone, width(1.));
    scene.label_at(
      x0 + block / 2.,
      87.,
      text,
      tone,
      Align::Middle,
      Anchor::Middle,
    );
    x0 + block / 2.
  };
  // A wire from a pill along its lane and up to where it acts (`end`, a
  // block's bottom or the chain between two blocks), labelled beside its
  // last climb.
  let wire = |scene: &mut Scene,
              from: f64,
              to: f64,
              lane: f64,
              label: String,
              tone: Tone,
              label_y: f64,
              end: f64| {
    if to < 0. {
      return;
    }
    scene.path(
      format!(
        "M{} 78 V{} H{} V{} M{} {} L{} {} L{} {}",
        n2(from),
        n2(lane),
        n2(to),
        n2(end),
        n2(to - 0.8),
        n2(end + 4.),
        n2(to),
        n2(end),
        n2(to + 0.8),
        n2(end + 4.)
      ),
      tone,
      width(1.2),
    );
    scene.label_at(to + 1., label_y, label, tone, Align::Start, Anchor::Bottom);
  };
  let quarter = block / 4.;
  // Where the voice's own output stage joins the chain: right after the
  // filter, before the body. The oscillator's gate and any vibrato the
  // model can't take itself (tremolo, the swept delay's pitch) act there.
  let filter_at = stops
    .iter()
    .position(|stop| *stop == "filter")
    .map_or(-1., |i| i as f64);
  let after_filter = left(filter_at) + block + gap / 2.;
  let join = |to: f64| {
    if (to - after_filter).abs() < 1. {
      31.
    } else {
      bottom + 1.
    }
  };
  if let Some(envelope) = pages.iter().find(|page| page.id == "envelope") {
    let from = pill(&mut scene, 0., envelope.label.to_uppercase(), Tone::Green);
    let to = match patch {
      Patch::String(_) => centre("resonator") - quarter,
      Patch::Oscillator(_) => after_filter - 0.6,
      _ => centre("exciter") - quarter,
    };
    wire(
      &mut scene,
      from - quarter,
      to,
      70.,
      envelope.label.to_lowercase(),
      Tone::Green,
      69.,
      join(to),
    );
  }
  if pages.iter().any(|page| page.id == "vibrato") {
    let owns_pitch = matches!(patch, Patch::Bore(_) | Patch::Bowed(_));
    let owns_level = owns_pitch || matches!(patch, Patch::Reed(_));
    let routes = [
      (
        "vibrato.pitch",
        if matches!(patch, Patch::Oscillator(_)) {
          centre("exciter")
        } else if owns_pitch {
          centre("resonator")
        } else {
          after_filter
        },
        "pitch",
      ),
      (
        "vibrato.level",
        if owns_level {
          centre("exciter") + quarter
        } else {
          after_filter
        },
        if owns_level { "level" } else { "tremolo" },
      ),
      ("vibrato.filter", centre("filter"), "cutoff"),
    ];
    let on: Vec<_> = routes
      .iter()
      .filter(|(id, _, _)| get(values, id, 0.) > 0.)
      .collect();
    let from = pill(
      &mut scene,
      1f64.min(count - 1.),
      if on.is_empty() {
        "VIBRATO off".into()
      } else {
        format!(
          "VIBRATO {} Hz",
          to_fixed(get(values, "vibrato.rate", 5.), 1)
        )
      },
      if on.is_empty() { Tone::Dim } else { Tone::Blue },
    );
    // One wire to each place, naming all it moves there, in the order the
    // places first come up.
    let mut targets: Vec<(f64, Vec<&str>)> = Vec::new();
    for &&(_, to, label) in &on {
      match targets.iter_mut().find(|(place, _)| *place == to) {
        Some((_, labels)) => labels.push(label),
        None => targets.push((to, vec![label])),
      }
    }
    for (to, labels) in targets {
      wire(
        &mut scene,
        from,
        to,
        58.,
        labels.join(" · "),
        Tone::Blue,
        bottom + 7.,
        join(to),
      );
    }
  }
  scene.done()
}

/// The graph for a page of the Synth screen.
pub fn page_scene(
  page: &SynthPage,
  input: &GraphInput,
  pages: &[SynthPage],
  picked: &str,
  exciter_name: &str,
) -> GraphScene {
  match page.id {
    "chain" => chain_scene(input, pages, picked, exciter_name),
    "exciter" => exciter_scene(input),
    "resonator" => resonator_scene(input),
    "filter" => filter_scene(input),
    "body" => body_scene(input),
    "envelope" => envelope_scene(input),
    "vibrato" => vibrato_scene(input),
    "output" => output_scene(input),
    _ => GraphScene::default(),
  }
}

#[cfg(test)]
mod tests {
  use serde_json::Value;

  use super::*;
  use crate::logic::params::{family, patch, step_to_value};
  use crate::logic::presets::KNOB_STEPS;
  use crate::logic::synth_pages::synth_pages;

  fn tone_name(tone: Tone) -> &'static str {
    match tone {
      Tone::Ink => "ink",
      Tone::Dim => "dim",
      Tone::Faint => "faint",
      Tone::Green => "green",
      Tone::Red => "red",
      Tone::Blue => "blue",
    }
  }

  fn align_name(align: Align) -> &'static str {
    match align {
      Align::Start => "start",
      Align::Middle => "middle",
      Align::End => "end",
    }
  }

  fn anchor_name(anchor: Anchor) -> &'static str {
    match anchor {
      Anchor::Top => "top",
      Anchor::Middle => "middle",
      Anchor::Bottom => "bottom",
    }
  }

  /// Every page of every instrument, at the defaults and two other knob
  /// steps, drawn as web-react draws it (`tests/graphs.json`, from
  /// `scripts/export-graphs.tsx`).
  #[test]
  fn graphs_draw_as_web_reacts() {
    let cases: Vec<Value> =
      serde_json::from_str(include_str!("../../tests/graphs.json")).expect("graphs parse");
    let variants = [None, Some(7), Some(2)];
    for case in &cases {
      let id = case["patch"].as_str().unwrap();
      let page_id = case["page"].as_str().unwrap();
      let variant = case["variant"].as_u64().unwrap() as usize;
      let patch = patch(id);
      let params = &patch.base().params;
      let pages = synth_pages(params, family(patch));
      let page = pages.iter().find(|page| page.id == page_id).unwrap();
      let values: Values = params
        .iter()
        .map(|spec| {
          let steps = spec.options.as_ref().map_or(KNOB_STEPS, Vec::len);
          let value = match variants[variant] {
            None => spec.default,
            Some(step) => step_to_value(spec, step.min(steps - 1), steps),
          };
          (spec.id.clone(), value)
        })
        .collect();
      let tone_of = |param: &str| {
        let slot = |slots: &[Option<&ParamSpecRef>; 4]| {
          slots
            .iter()
            .position(|spec| spec.is_some_and(|spec| spec.id == param))
        };
        slot(&page.main)
          .or_else(|| slot(&page.shift))
          .map_or(Tone::Dim, |slot| KNOB_TONES[slot])
      };
      let picked = pages[1 + variant % (pages.len() - 1)].id;
      let scene = page_scene(
        page,
        &GraphInput {
          patch,
          values: &values,
          note: graph_note(patch),
          tone_of: &tone_of,
        },
        &pages,
        picked,
        "Exciter",
      );
      let at = format!("{id} {page_id} variant {variant}");
      let paths = case["paths"].as_array().unwrap();
      assert_eq!(scene.paths.len(), paths.len(), "{at}: path count");
      for (i, (path, expected)) in scene.paths.iter().zip(paths).enumerate() {
        let expected = expected.as_array().unwrap();
        same_path(
          &path.d,
          expected[0].as_str().unwrap(),
          &format!("{at}: path {i}"),
        );
        assert_eq!(
          tone_name(path.tone),
          expected[1].as_str().unwrap(),
          "{at}: path {i} tone"
        );
        assert_eq!(
          path.stroke.width,
          expected[2].as_f64(),
          "{at}: path {i} width"
        );
        assert_eq!(
          path.stroke.dashed,
          expected[3].as_bool().unwrap(),
          "{at}: path {i}"
        );
        assert_eq!(
          path.stroke.fill,
          expected[4].as_bool().unwrap(),
          "{at}: path {i}"
        );
        assert_eq!(
          path.stroke.solid,
          expected[5].as_bool().unwrap(),
          "{at}: path {i}"
        );
      }
      let labels = case["labels"].as_array().unwrap();
      assert_eq!(scene.labels.len(), labels.len(), "{at}: label count");
      for (i, (label, expected)) in scene.labels.iter().zip(labels).enumerate() {
        let expected = expected.as_array().unwrap();
        assert!(
          (label.x - expected[0].as_f64().unwrap()).abs() < 1e-9,
          "{at}: label {i} x"
        );
        assert!(
          (label.y - expected[1].as_f64().unwrap()).abs() < 1e-9,
          "{at}: label {i} y"
        );
        assert_eq!(label.text, expected[2].as_str().unwrap(), "{at}: label {i}");
        assert_eq!(
          tone_name(label.tone),
          expected[3].as_str().unwrap(),
          "{at}: label {i}"
        );
        assert_eq!(
          align_name(label.align),
          expected[4].as_str().unwrap(),
          "{at}: label {i}"
        );
        assert_eq!(
          anchor_name(label.anchor),
          expected[5].as_str().unwrap(),
          "{at}: label {i}"
        );
      }
    }
  }

  type ParamSpecRef = sound_engine::patches::ParamSpec;

  /// A path's commands and numbers, the numbers apart.
  fn tokens(d: &str) -> Vec<Result<f64, char>> {
    let mut tokens = Vec::new();
    let mut number = String::new();
    for c in d.chars() {
      if c.is_ascii_digit() || c == '.' || (c == '-' && number.is_empty()) {
        number.push(c);
        continue;
      }
      if !number.is_empty() {
        tokens.push(Ok(number.parse().unwrap()));
        number.clear();
      }
      if c != ' ' {
        tokens.push(Err(c));
      }
    }
    if !number.is_empty() {
      tokens.push(Ok(number.parse().unwrap()));
    }
    tokens
  }

  /// The same path to the hundredth: V8's `pow`, `log2` and the like can
  /// land a point a rounding away from Rust's, which is a twentieth of a
  /// pixel on the screen.
  fn same_path(rust: &str, react: &str, at: &str) {
    let (a, b) = (tokens(rust), tokens(react));
    assert_eq!(a.len(), b.len(), "{at}: {rust} ≠ {react}");
    for (a, b) in a.iter().zip(&b) {
      match (a, b) {
        (Ok(a), Ok(b)) => assert!((a - b).abs() < 0.0101, "{at}: {a} ≠ {b} in {rust}"),
        _ => assert_eq!(a, b, "{at}: {rust} ≠ {react}"),
      }
    }
  }
}
