use super::math::{LN_1000, TWO_PI};

/// A bank of two-pole modes y = g·x + c·y₁ − r²·y₂ in structure-of-arrays
/// form, each a decaying sine of peak ≈ amp.
pub struct ModalBank {
  pub count: usize,
  fs: f64,
  freq: Vec<f64>,
  t60: Vec<f64>,
  amp: Vec<f64>,
  r: Vec<f64>,
  c: Vec<f64>,
  r2: Vec<f64>,
  g: Vec<f64>,
  y1: Vec<f64>,
  y2: Vec<f64>,
  freq_scale: f64,
  decay_scale: f64,
}

impl ModalBank {
  pub fn new(size: usize, fs: f64) -> Self {
    Self {
      count: 0,
      fs,
      freq: vec![0.; size],
      t60: vec![0.; size],
      amp: vec![0.; size],
      r: vec![0.; size],
      c: vec![0.; size],
      r2: vec![0.; size],
      g: vec![0.; size],
      y1: vec![0.; size],
      y2: vec![0.; size],
      freq_scale: 1.,
      decay_scale: 1.,
    }
  }

  pub fn set_mode(&mut self, i: usize, freq: f64, t60: f64, amp: f64) {
    self.freq[i] = freq;
    self.t60[i] = t60;
    self.amp[i] = amp;
    self.update_decay(i);
    self.update_frequency(i);
  }

  pub fn scale_frequencies(&mut self, k: f64) {
    self.freq_scale = k;
    for i in 0..self.count {
      self.update_frequency(i);
    }
  }

  pub fn scale_decay(&mut self, k: f64) {
    self.decay_scale = k;
    for i in 0..self.count {
      self.update_decay(i);
      self.update_frequency(i);
    }
  }

  #[inline]
  pub fn process(&mut self, x: f64) -> f64 {
    let mut sum = 0.;
    for i in 0..self.count {
      let y = self.g[i] * x + self.c[i] * self.y1[i] - self.r2[i] * self.y2[i];
      self.y2[i] = self.y1[i];
      self.y1[i] = y;
      sum += y;
    }
    sum
  }

  pub fn clear(&mut self) {
    self.y1.fill(0.);
    self.y2.fill(0.);
  }

  fn update_decay(&mut self, i: usize) {
    let r = (-LN_1000 / (self.t60[i] * self.decay_scale * self.fs)).exp();
    self.r[i] = r;
    self.r2[i] = r * r;
  }

  fn update_frequency(&mut self, i: usize) {
    let f = self.freq[i] * self.freq_scale;
    if f >= 0.45 * self.fs {
      self.c[i] = 0.;
      self.g[i] = 0.;
      return;
    }
    let theta = (TWO_PI * f) / self.fs;
    self.c[i] = 2. * self.r[i] * theta.cos();
    self.g[i] = self.amp[i] * theta.sin();
  }
}
