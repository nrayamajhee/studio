//! The engine's state-variable filter, as lowpass, bandpass, highpass or a
//! peaking bell.

use std::f64::consts::{PI, SQRT_2};

/// What the filter passes.
#[derive(Clone, Copy, PartialEq)]
pub enum SvfMode {
  /// Below the cutoff.
  Lowpass,
  /// Around the cutoff.
  Bandpass,
  /// Above the cutoff.
  Highpass,
  /// Everything, with a bell boosting or cutting around the cutoff.
  Peak,
}

/// Zero-delay-feedback state-variable filter (Andrew Simper, Cytomic):
/// g = tan(π·fc/fs), k = 1/Q, a1 = 1/(1 + g(g + k)), a2 = g·a1, a3 = g·a2.
pub struct Svf {
  mode: SvfMode,
  k: f64,
  a1: f64,
  a2: f64,
  a3: f64,
  peak_gain: f64,
  ic1: f64,
  ic2: f64,
}

impl Svf {
  /// A filter in `mode`, at a Butterworth Q until set.
  pub fn new(mode: SvfMode) -> Self {
    Self {
      mode,
      k: SQRT_2,
      a1: 0.,
      a2: 0.,
      a3: 0.,
      peak_gain: 0.,
      ic1: 0.,
      ic2: 0.,
    }
  }

  /// Sets the cutoff (Hz) and Q at sample rate `fs`.
  pub fn set(&mut self, cutoff: f64, q: f64, fs: f64) {
    self.k = 1. / q;
    self.coefficients(cutoff, fs);
  }

  /// Bell: output = x + k·(A² − 1)·band with k = 1/(Q·A), A = 10^(dB/40).
  pub fn set_peak(&mut self, cutoff: f64, q: f64, gain_db: f64, fs: f64) {
    let a = 10f64.powf(gain_db / 40.);
    self.k = 1. / (q * a);
    self.peak_gain = self.k * (a * a - 1.);
    self.coefficients(cutoff, fs);
  }

  /// Filters a sample.
  #[inline]
  pub fn process(&mut self, x: f64) -> f64 {
    let v3 = x - self.ic2;
    let v1 = self.a1 * self.ic1 + self.a2 * v3;
    let v2 = self.ic2 + self.a2 * self.ic1 + self.a3 * v3;
    self.ic1 = 2. * v1 - self.ic1;
    self.ic2 = 2. * v2 - self.ic2;
    match self.mode {
      SvfMode::Lowpass => v2,
      SvfMode::Bandpass => v1,
      SvfMode::Highpass => x - self.k * v1 - v2,
      SvfMode::Peak => x + self.peak_gain * v1,
    }
  }

  /// Clears its state.
  pub fn clear(&mut self) {
    self.ic1 = 0.;
    self.ic2 = 0.;
  }

  /// Sets the coefficients for `cutoff`, kept from 20 Hz to 0.45 fs.
  fn coefficients(&mut self, cutoff: f64, fs: f64) {
    let fc = cutoff.max(20.).min(0.45 * fs);
    let g = ((PI * fc) / fs).tan();
    self.a1 = 1. / (1. + g * (g + self.k));
    self.a2 = g * self.a1;
    self.a3 = g * self.a2;
  }
}
