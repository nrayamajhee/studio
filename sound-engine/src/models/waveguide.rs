//! The waveguide section the bore and bowed models' loops are built from.

use crate::dsp::delay_line::DelayLine;

/// STK DelayL-style section: tick(x) writes x and returns it delayed by
/// `delay` samples (≥ 1), remembering the output as `last`. Reads use
/// third-order Lagrange so glides and pitch vibrato move cleanly.
pub struct Waveguide {
  line: DelayLine,
  pub last: f64,
}

impl Waveguide {
  /// A silent section that delays by up to `max_delay` samples.
  pub fn new(max_delay: f64) -> Self {
    Self {
      line: DelayLine::new(max_delay + 4.),
      last: 0.,
    }
  }

  /// Writes `x` and returns what went in `delay` samples ago (at least one),
  /// remembering it as `last`.
  #[inline]
  pub fn tick(&mut self, x: f64, delay: f64) -> f64 {
    self.line.write(x);
    self.last = self
      .line
      .read_lagrange3(if delay < 1. { 2. } else { delay + 1. });
    self.last
  }

  /// Silences the section.
  pub fn clear(&mut self) {
    self.line.clear();
    self.last = 0.;
  }
}
