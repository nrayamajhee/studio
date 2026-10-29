//! The engine's simple filters: one-pole lowpass and highpass, a DC blocker, a
//! direct-form biquad, and rescaling a pole pair to another sample rate.

use super::math::TWO_PI;

/// y = (1 − p)·x + p·y₁: a one-pole lowpass, its pole `p` set directly or from
/// a cutoff.
pub struct OnePoleLowpass {
  pub p: f64,
  y1: f64,
}

impl Default for OnePoleLowpass {
  fn default() -> Self {
    Self { p: 0., y1: 0. }
  }
}

impl OnePoleLowpass {
  /// Sets the pole directly (0 passes everything, near 1 smooths heavily).
  pub fn set_pole(&mut self, p: f64) {
    self.p = p;
  }

  /// Sets the pole for a cutoff of `hz` at sample rate `fs`.
  pub fn set_cutoff(&mut self, hz: f64, fs: f64) {
    self.p = ((-TWO_PI * hz) / fs).exp();
  }

  /// Filters a sample.
  pub fn process(&mut self, x: f64) -> f64 {
    self.y1 = (1. - self.p) * x + self.p * self.y1;
    self.y1
  }

  /// Clears its state.
  pub fn clear(&mut self) {
    self.y1 = 0.;
  }
}

/// x minus its one-pole lowpass: a gentle first-order highpass.
#[derive(Default)]
pub struct OnePoleHighpass {
  p: f64,
  lp: f64,
}

impl OnePoleHighpass {
  /// Sets the cutoff to `hz` at sample rate `fs`.
  pub fn set_cutoff(&mut self, hz: f64, fs: f64) {
    self.p = ((-TWO_PI * hz) / fs).exp();
  }

  /// Filters a sample.
  pub fn process(&mut self, x: f64) -> f64 {
    self.lp = (1. - self.p) * x + self.p * self.lp;
    x - self.lp
  }

  /// Clears its state.
  pub fn clear(&mut self) {
    self.lp = 0.;
  }
}

/// y = x − x₁ + R·y₁ with R = 1 − 2π·20/fs (about a 20 Hz corner).
pub struct DcBlocker {
  r: f64,
  x1: f64,
  y1: f64,
}

impl DcBlocker {
  /// A blocker at sample rate `fs`.
  pub fn new(fs: f64) -> Self {
    Self {
      r: 1. - (TWO_PI * 20.) / fs,
      x1: 0.,
      y1: 0.,
    }
  }

  /// Filters a sample.
  pub fn process(&mut self, x: f64) -> f64 {
    let y = x - self.x1 + self.r * self.y1;
    self.x1 = x;
    self.y1 = y;
    y
  }

  /// Clears its state.
  pub fn clear(&mut self) {
    self.x1 = 0.;
    self.y1 = 0.;
  }
}

/// Direct-form-I biquad y = b0·x + b1·x₁ + b2·x₂ − a1·y₁ − a2·y₂.
#[derive(Default)]
pub struct Biquad {
  b0: f64,
  b1: f64,
  b2: f64,
  a1: f64,
  a2: f64,
  x1: f64,
  x2: f64,
  y1: f64,
  y2: f64,
}

impl Biquad {
  /// Sets the coefficients (a0 normalized to 1).
  pub fn set(&mut self, b0: f64, b1: f64, b2: f64, a1: f64, a2: f64) {
    self.b0 = b0;
    self.b1 = b1;
    self.b2 = b2;
    self.a1 = a1;
    self.a2 = a2;
  }

  /// Filters a sample.
  pub fn process(&mut self, x: f64) -> f64 {
    let y =
      self.b0 * x + self.b1 * self.x1 + self.b2 * self.x2 - self.a1 * self.y1 - self.a2 * self.y2;
    self.x2 = self.x1;
    self.x1 = x;
    self.y2 = self.y1;
    self.y1 = y;
    y
  }

  /// Clears its state.
  pub fn clear(&mut self) {
    self.x1 = 0.;
    self.x2 = 0.;
    self.y1 = 0.;
    self.y2 = 0.;
  }
}

/// Moves the complex pole or zero pair of a z-plane quadratic
/// 1 + c1·z⁻¹ + c2·z⁻² designed at `from_rate` to the same analog frequency
/// at `to_rate`.
pub fn rescale_quadratic(c1: f64, c2: f64, from_rate: f64, to_rate: f64) -> (f64, f64) {
  if c2 <= 0. || c1 * c1 >= 4. * c2 {
    return (c1, c2);
  }
  let r = c2.sqrt();
  let theta = ((-c1 / (2. * r)).acos() * from_rate) / to_rate;
  let r_scaled = r.powf(from_rate / to_rate);
  (-2. * r_scaled * theta.cos(), r_scaled * r_scaled)
}
