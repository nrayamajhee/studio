use super::math::js_round;

const LOOKAHEAD: f64 = 0.0015;
const RELEASE: f64 = 0.1;

/// A stereo look-ahead peak limiter. The signal is delayed by the look-ahead
/// while the gain ramps down to what keeps the coming peak at `ceiling`.
/// Read `left` and `right` after each process().
pub struct PeakLimiter {
  pub left: f64,
  pub right: f64,
  ceiling: f64,
  recover: f64,
  delay_l: Vec<f32>,
  delay_r: Vec<f32>,
  min_gain: Vec<f64>,
  min_at: Vec<f64>,
  ramp: Vec<f64>,
  min_head: usize,
  min_count: usize,
  ramp_sum: f64,
  envelope: f64,
  frame: f64,
}

impl PeakLimiter {
  pub fn new(fs: f64, ceiling: f64) -> Self {
    let size = (js_round(LOOKAHEAD * fs) as usize).max(1) + 1;
    Self {
      left: 0.,
      right: 0.,
      ceiling,
      recover: 1. - (-1. / (RELEASE * fs)).exp(),
      delay_l: vec![0.; size],
      delay_r: vec![0.; size],
      min_gain: vec![0.; size],
      min_at: vec![0.; size],
      ramp: vec![1.; size],
      min_head: 0,
      min_count: 0,
      ramp_sum: size as f64,
      envelope: 1.,
      frame: 0.,
    }
  }

  pub fn process(&mut self, in_l: f64, in_r: f64) {
    let size = self.delay_l.len();
    let slot = (self.frame % size as f64) as usize;
    let peak = in_l.abs().max(in_r.abs());
    let needed = if peak > self.ceiling {
      self.ceiling / peak
    } else {
      1.
    };
    self.envelope = needed.min(self.envelope + (1. - self.envelope) * self.recover);

    while self.min_count > 0
      && self.min_gain[(self.min_head + self.min_count - 1) % size] >= self.envelope
    {
      self.min_count -= 1;
    }
    let back = (self.min_head + self.min_count) % size;
    self.min_gain[back] = self.envelope;
    self.min_at[back] = self.frame;
    self.min_count += 1;
    while self.min_at[self.min_head] <= self.frame - size as f64 {
      self.min_head = (self.min_head + 1) % size;
      self.min_count -= 1;
    }
    let held = self.min_gain[self.min_head];

    self.ramp_sum += held - self.ramp[slot];
    self.ramp[slot] = held;
    let gain = (self.ramp_sum / size as f64).min(1.);

    // The oldest sample in the delay is the one leaving now.
    let out = (slot + 1) % size;
    self.left = self.delay_l[out] as f64 * gain;
    self.right = self.delay_r[out] as f64 * gain;
    self.delay_l[slot] = in_l as f32;
    self.delay_r[slot] = in_r as f32;
    self.frame += 1.;
  }
}
