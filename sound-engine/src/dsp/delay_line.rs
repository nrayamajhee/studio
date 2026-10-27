use super::math::next_pow2;

/// Circular buffer. After write(x), read_int(1) returns x, so a loop that
/// reads read_int(N) and then writes delays its signal by exactly N samples.
pub struct DelayLine {
  pub buffer: Vec<f32>,
  mask: usize,
  index: usize,
}

impl DelayLine {
  pub fn new(max_delay: f64) -> Self {
    let size = next_pow2(max_delay.ceil() as usize + 4);
    Self {
      buffer: vec![0.; size],
      mask: size - 1,
      index: 0,
    }
  }

  pub fn clear(&mut self) {
    self.buffer.fill(0.);
  }

  #[inline]
  pub fn write(&mut self, x: f64) {
    self.buffer[self.index] = x as f32;
    self.index = (self.index + 1) & self.mask;
  }

  #[inline]
  fn at(&self, back: i64) -> f64 {
    self.buffer[(self.index as i64 - back) as usize & self.mask] as f64
  }

  #[inline]
  pub fn read_int(&self, n: usize) -> f64 {
    self.at(n as i64)
  }

  /// Third-order Lagrange FIR, centred so the fractional part D lies in
  /// [1, 2) over taps n0..n0+3. Needs delay ≥ 2.
  #[inline]
  pub fn read_lagrange3(&self, delay: f64) -> f64 {
    let n0 = delay.floor() - 1.;
    let d = delay - n0;
    let dm1 = d - 1.;
    let dm2 = d - 2.;
    let dm3 = d - 3.;
    let h0 = (-dm1 * dm2 * dm3) / 6.;
    let h1 = (d * dm2 * dm3) / 2.;
    let h2 = (-d * dm1 * dm3) / 2.;
    let h3 = (d * dm1 * dm2) / 6.;
    let base = n0 as i64;
    h0 * self.at(base) + h1 * self.at(base + 1) + h2 * self.at(base + 2) + h3 * self.at(base + 3)
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn integer_and_fractional_reads() {
    let mut line = DelayLine::new(16.);
    for x in 1..=8 {
      line.write(x as f64);
    }
    assert_eq!(line.read_int(1), 8.);
    assert_eq!(line.read_int(3), 6.);
    assert!((line.read_lagrange3(3.) - 6.).abs() < 1e-12);
    assert!((line.read_lagrange3(3.5) - 5.5).abs() < 1e-12);
  }
}
