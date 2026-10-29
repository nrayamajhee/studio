//! The single-delay-loop string the string model's voices are made of, tuned
//! exactly and damped by T60.

use crate::dsp::delay_line::DelayLine;
use crate::dsp::math::{TWO_PI, js_round};
use crate::dsp::phase_delay::{
  allpass1_for_delay, allpass1_phase_delay, one_pole_magnitude, one_pole_phase_delay,
};

/// The most dispersion allpasses a loop runs, for a stiff string's stretched
/// partials.
const MAX_STAGES: usize = 8;
/// The highest loop gain, so no string rings forever.
const MAX_LOOP_GAIN: f64 = 0.99999;

/// The largest loss pole that still lets the loop gain stay below
/// MAX_LOOP_GAIN, for high notes with long T60s.
fn lightest_loss(p: f64, w0: f64, per_period: f64) -> f64 {
  if per_period / one_pole_magnitude(p, w0) <= MAX_LOOP_GAIN {
    return p;
  }
  let mut lo = 0.;
  let mut hi = p;
  for _ in 0..40 {
    let mid = 0.5 * (lo + hi);
    if per_period / one_pole_magnitude(mid, w0) <= MAX_LOOP_GAIN {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  lo
}

/// A partial of the loop: its frequency and how long it rings.
#[derive(Clone, Copy, Debug)]
pub struct Partial {
  pub hz: f64,
  pub t60: f64,
}

/// Single-delay-loop string (extended Karplus-Strong): delay → dispersion
/// allpasses → one-pole loss·g → fractional tuning allpass → (jawari) →
/// + excitation → back into the delay.
pub struct StringLoop {
  pub delay: DelayLine,
  fs: f64,
  ap_x1: [f64; MAX_STAGES],
  ap_y1: [f64; MAX_STAGES],
  stages: usize,
  ap_a: f64,
  p: f64,
  lp: f64,
  g: f64,
  g_target: f64,
  g_coef: f64,
  t_a: f64,
  t_x1: f64,
  t_y1: f64,
  n_int: usize,
  f0: f64,
  w0: f64,
  jawari: bool,
  contact: f64,
  contact_norm: f64,
  gap: f64,
  bridge: f64,
  /// Nominal loop length in samples, for pickup and pluck-position combs.
  pub period: f64,
}

impl StringLoop {
  /// A silent loop at `fs` with room for the lowest note, `lowest_hz`.
  pub fn new(fs: f64, lowest_hz: f64) -> Self {
    Self {
      delay: DelayLine::new(fs / lowest_hz + 8.),
      fs,
      ap_x1: [0.; MAX_STAGES],
      ap_y1: [0.; MAX_STAGES],
      stages: 0,
      ap_a: 0.,
      p: 0.,
      lp: 0.,
      g: 0.,
      g_target: 0.,
      g_coef: 1.,
      t_a: 0.,
      t_x1: 0.,
      t_y1: 0.,
      n_int: 2,
      f0: 440.,
      w0: 0.,
      jawari: false,
      contact: 0.,
      contact_norm: 1.,
      gap: 0.,
      bridge: 0.,
      period: 100.,
    }
  }

  /// A jawari bridge: the allpass coefficient while the string touches it,
  /// and how far it swings before it does. Set before tune().
  pub fn set_jawari(&mut self, contact: f64, gap: f64) {
    self.jawari = true;
    self.contact = contact;
    self.contact_norm = (1. - contact * contact).sqrt();
    self.gap = gap;
  }

  /// Tunes the loop so its fundamental lands exactly on f0.
  pub fn tune(&mut self, f0: f64, t60: f64, brightness: f64, stages: f64, coef: f64) {
    let fs = self.fs;
    self.f0 = f0;
    self.ap_a = coef;
    let w0 = (TWO_PI * f0) / fs;
    self.w0 = w0;
    let p = lightest_loss(brightness, w0, 10f64.powf(-3. / (f0 * t60)));
    self.p = p;
    let tau_loss = one_pole_phase_delay(p, w0);
    // At rest the jawari is an allpass at 0: exactly one sample.
    let bridge = if self.jawari { 1. } else { 0. };
    let mut m = js_round(stages).min(MAX_STAGES as f64).max(0.) as usize;
    let mut d = fs / f0 - tau_loss - bridge - m as f64 * allpass1_phase_delay(coef, w0);
    // Keep at least two samples of pure delay by dropping dispersion stages.
    while m > 0 && (d - 0.5).floor() < 2. {
      m -= 1;
      d = fs / f0 - tau_loss - bridge - m as f64 * allpass1_phase_delay(coef, w0);
    }
    self.stages = m;
    self.n_int = (d - 0.5).floor().max(1.) as usize;
    self.t_a = allpass1_for_delay(d - self.n_int as f64, w0);
    self.period = fs / f0;
    let g = self.loop_gain(t60);
    self.g = g;
    self.g_target = g;
    self.g_coef = 1.;
  }

  /// The first `count` partials of the tuned loop: each where the round
  /// trip holds a whole number of cycles (so stiffness stretches them
  /// sharp), and how long it rings (T60, s) through the loss filter at its
  /// frequency.
  pub fn partials(&self, count: usize) -> Vec<Partial> {
    let fs = self.fs;
    let round_trip = |w: f64| {
      self.n_int as f64
        + self.stages as f64 * allpass1_phase_delay(self.ap_a, w)
        + one_pole_phase_delay(self.p, w)
        + allpass1_phase_delay(self.t_a, w)
        + if self.jawari { 1. } else { 0. }
    };
    let mut result = Vec::new();
    for n in 1..=count {
      let mut w = n as f64 * self.w0;
      let mut i = 0;
      while i < 30 && w < std::f64::consts::PI {
        w = (TWO_PI * n as f64) / round_trip(w);
        i += 1;
      }
      if w >= std::f64::consts::PI {
        break;
      }
      let per_trip = self.g_target * one_pole_magnitude(self.p, w);
      let t60 = (-3. / per_trip.log10()) * (round_trip(w) / fs);
      result.push(Partial {
        hz: (w * fs) / TWO_PI,
        t60,
      });
    }
    result
  }

  /// Ramps the loop gain toward the value for a new T60 over `ramp` seconds.
  pub fn set_decay(&mut self, t60: f64, ramp: f64) {
    self.g_target = self.loop_gain(t60);
    self.g_coef = if ramp > 0. {
      1. - (-1. / (ramp * self.fs)).exp()
    } else {
      1.
    };
  }

  /// Runs one sample round the loop, adding `excitation` on its way back into
  /// the delay; returns what goes in.
  #[inline]
  pub fn tick(&mut self, excitation: f64) -> f64 {
    let mut y = self.delay.read_int(self.n_int);
    let a = self.ap_a;
    for s in 0..self.stages {
      let out = a * y + self.ap_x1[s] - a * self.ap_y1[s];
      self.ap_x1[s] = y;
      self.ap_y1[s] = out;
      y = out;
    }
    self.lp = (1. - self.p) * y + self.p * self.lp;
    self.g += (self.g_target - self.g) * self.g_coef;
    let lossy = self.lp * self.g;
    let mut tuned = self.t_a * lossy + self.t_x1 - self.t_a * self.t_y1;
    self.t_x1 = lossy;
    self.t_y1 = tuned;
    if self.jawari {
      // Normalized-ladder allpass: (a·x + c·s, c·x − a·s) is a rotation.
      let a = if self.bridge > self.gap {
        self.contact
      } else {
        0.
      };
      let c = if a == 0. { 1. } else { self.contact_norm };
      let through = a * tuned + c * self.bridge;
      self.bridge = c * tuned - a * self.bridge;
      tuned = through;
    }
    let out = tuned + excitation;
    self.delay.write(out);
    out
  }

  /// Silences the loop, keeping its tuning.
  pub fn clear(&mut self) {
    self.delay.clear();
    self.ap_x1 = [0.; MAX_STAGES];
    self.ap_y1 = [0.; MAX_STAGES];
    self.lp = 0.;
    self.t_x1 = 0.;
    self.t_y1 = 0.;
    self.bridge = 0.;
  }

  /// g = 10^(−3/(f0·T60)) / |H_loss(ω0)|: loses 60 dB after f0·T60 periods.
  fn loop_gain(&self, t60: f64) -> f64 {
    let per_period = 10f64.powf(-3. / (self.f0 * t60));
    MAX_LOOP_GAIN.min(per_period / one_pole_magnitude(self.p, self.w0))
  }
}
