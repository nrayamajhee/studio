//! Exciters: the pulses that set a model ringing (a pick or finger's pluck, a
//! piano's felt hammer, a mallet or stick), written into a buffer the voice
//! then plays into its resonator.

use std::f64::consts::PI;

use crate::dsp::generators::Noise;
use crate::dsp::math::{clamp, js_round, lerp};

/// Velocity response blended by the "strength" macro: 0 ignores velocity,
/// 1 follows velocity^curve.
pub fn velocity_gain(velocity: f64, strength: f64, curve: f64) -> f64 {
  lerp(1., velocity.powf(curve), strength)
}

/// Scales the first `length` samples so their peak is `gain` (silence stays
/// silent).
fn normalize_peak(buffer: &mut [f32], length: usize, gain: f64) {
  let peak = buffer[..length]
    .iter()
    .fold(0f64, |peak, x| peak.max((*x as f64).abs()));
  let scale = if peak > 0. { gain / peak } else { 0. };
  for x in &mut buffer[..length] {
    *x = (*x as f64 * scale) as f32;
  }
}

/// `e[n] − e[n − b]`: removes the harmonics with a node at the pluck or strike
/// point.
fn position_comb(buffer: &mut [f32], length: usize, b: usize) {
  if b < 1 {
    return;
  }
  for n in (b..length).rev() {
    buffer[n] = (buffer[n] as f64 - buffer[n - b] as f64) as f32;
  }
}

/// How to pluck a string, for [`pluck`].
pub struct PluckOptions {
  /// The string's period in samples: the burst is one period long.
  pub period: f64,
  /// How hard (0–1).
  pub velocity: f64,
  /// How hard the pick is (0–1): a harder one is brighter, a finger's pad
  /// narrower.
  pub hardness: f64,
  /// Where along the string (0–0.5 of its length), which notches the harmonics
  /// with a node there.
  pub position: f64,
  /// How much velocity matters (0 not at all, 1 fully).
  pub strength: f64,
  /// A finger's soft pad instead of a pick.
  pub finger: bool,
}

/// Writes one period of pluck excitation; returns its length.
pub fn pluck(buffer: &mut [f32], noise: &mut Noise, o: &PluckOptions) -> usize {
  let length = buffer.len().min(js_round(o.period).max(2.) as usize);
  if o.finger {
    // Raised-cosine pulse: the soft pad of a finger.
    let width = js_round(length as f64 * (0.5 - 0.35 * o.hardness)).max(2.) as usize;
    let mut lp = 0.;
    for n in 0..length {
      lp = 0.9 * lp + 0.1 * noise.next();
      let pulse = if n < width {
        0.5 - 0.5 * ((2. * PI * n as f64) / width as f64).cos()
      } else {
        0.
      };
      buffer[n] = (pulse + 0.1 * lp) as f32;
    }
    let b = js_round(clamp(o.position, 0.02, 0.5) * length as f64) as usize;
    position_comb(buffer, length, b);
  } else {
    // A pick displaces the string into a triangle peaking at the pluck
    // point, plus the scrape of the pick as noise.
    let p = clamp(0.9 - 0.85 * o.hardness * (0.5 + 0.5 * o.velocity), 0., 0.97);
    let apex = js_round(clamp(o.position, 0.02, 0.5) * length as f64).max(1.) as usize;
    let mut lp = 0.;
    let mut mean = 0.;
    for n in 0..length {
      let shape = if n < apex {
        n as f64 / apex as f64
      } else {
        (length - n) as f64 / (length - apex) as f64
      };
      lp = (1. - p) * (shape + 0.25 * noise.next()) + p * lp;
      buffer[n] = lp as f32;
      mean += lp;
    }
    mean /= length as f64;
    for x in &mut buffer[..length] {
      *x = (*x as f64 - mean) as f32;
    }
  }
  let gain = velocity_gain(o.velocity, o.strength, 1.2);
  normalize_peak(buffer, length, gain);
  if !o.finger {
    // The pick's click: a sharp edge at the start of the burst.
    buffer[0] = (buffer[0] as f64 + 0.3 * o.hardness * gain) as f32;
    if length > 1 {
      buffer[1] = (buffer[1] as f64 - 0.15 * o.hardness * gain) as f32;
    }
  }
  length
}

/// How to strike a string with a felt hammer, for [`hammer`].
pub struct HammerOptions {
  /// The string's period in samples, for the strike position's comb.
  pub period: f64,
  /// How hard (0–1).
  pub velocity: f64,
  /// How hard the felt is (0–1): a harder one bounces off sooner, brighter.
  pub hardness: f64,
  /// Where along the string (0–0.5 of its length).
  pub position: f64,
  /// How much velocity matters (0 not at all, 1 fully).
  pub strength: f64,
  /// The hammer's mass in kilograms.
  pub mass: f64,
  /// The sample rate.
  pub fs: f64,
}

/// Felt stiffness K and string admittance for a C4 contact of ~1 ms at full
/// velocity with a p = 2.5 felt law.
const FELT_EXPONENT: f64 = 2.5;
/// The felt's stiffness K at middle hardness.
const FELT_STIFFNESS: f64 = 1.775e12;
/// Twice the string's impedance, which the felt pushes against.
const STRING_IMPEDANCE_2Z: f64 = 20000.;
/// The hammer's speed (m/s) at the softest hit.
const V_MIN: f64 = 0.008;
/// The hammer's speed (m/s) at the hardest hit.
const V_MAX: f64 = 1.;
/// The hammer is simulated at four times the sample rate.
const OVERSAMPLE: usize = 4;
/// The longest (s) the felt may stay on the string.
const MAX_CONTACT: f64 = 0.012;

/// Explicit-Euler felt hammer against a string modelled as two semi-infinite
/// halves. Writes the averaged force pulse, applies the strike-position comb
/// and returns the excitation length and how long the felt stayed on (ms).
pub fn hammer(buffer: &mut [f32], o: &HammerOptions) -> (usize, f64) {
  let k = FELT_STIFFNESS * 10f64.powf((o.hardness - 0.5) * 1.5);
  let dt = 1. / (OVERSAMPLE as f64 * o.fs);
  let max_steps = js_round(MAX_CONTACT * OVERSAMPLE as f64 * o.fs) as usize;
  let mut vh = V_MIN + (V_MAX - V_MIN) * o.velocity.powf(1.5);
  let mut yh = 0.;
  let mut ys = 0.;
  let mut contact = false;
  let mut acc = 0.;
  let mut sub = 0;
  let mut n = 0;
  let comb_length = js_round(clamp(o.position, 0.02, 0.5) * o.period) as usize;
  let limit = buffer.len() as i64 - comb_length as i64 - 1;
  let mut step = 0;
  while step < max_steps && (n as i64) < limit {
    let c: f64 = yh - ys;
    let mut force = 0.;
    if c > 0. {
      contact = true;
      force = k * c.powf(FELT_EXPONENT);
    } else if contact {
      break;
    }
    vh -= (force / o.mass) * dt;
    yh += vh * dt;
    ys += (force / STRING_IMPEDANCE_2Z) * dt;
    acc += force;
    sub += 1;
    if sub == OVERSAMPLE {
      buffer[n] = (acc / OVERSAMPLE as f64) as f32;
      n += 1;
      acc = 0.;
      sub = 0;
    }
    step += 1;
  }
  let contact_ms = (n as f64 / o.fs) * 1000.;
  let length = n + comb_length;
  buffer[n..length].fill(0.);
  position_comb(buffer, length, comb_length);
  normalize_peak(buffer, length, velocity_gain(o.velocity, o.strength, 1.3));
  (length, contact_ms)
}

/// Half-sine stick pulse of duration τc, area-normalized so low modes keep
/// their level and only the highs change with hardness.
pub fn stick(buffer: &mut [f32], seconds: f64, gain: f64, fs: f64) -> usize {
  let length = buffer.len().min(js_round(seconds * fs).max(1.) as usize);
  let scale = (gain * PI) / (2. * length as f64);
  for (n, x) in buffer[..length].iter_mut().enumerate() {
    *x = (scale * ((PI * (n as f64 + 0.5)) / length as f64).sin()) as f32;
  }
  length
}
