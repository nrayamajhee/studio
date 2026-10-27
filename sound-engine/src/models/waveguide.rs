use crate::dsp::delay_line::DelayLine;

/// STK DelayL-style section: tick(x) writes x and returns it delayed by
/// `delay` samples (≥ 1), remembering the output as `last`. Reads use
/// third-order Lagrange so glides and pitch vibrato move cleanly.
pub struct Waveguide {
  line: DelayLine,
  pub last: f64,
}

impl Waveguide {
  pub fn new(max_delay: f64) -> Self {
    Self {
      line: DelayLine::new(max_delay + 4.),
      last: 0.,
    }
  }

  #[inline]
  pub fn tick(&mut self, x: f64, delay: f64) -> f64 {
    self.line.write(x);
    self.last = self
      .line
      .read_lagrange3(if delay < 1. { 2. } else { delay + 1. });
    self.last
  }

  pub fn clear(&mut self) {
    self.line.clear();
    self.last = 0.;
  }
}
