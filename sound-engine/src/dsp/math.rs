use std::f64::consts::PI;

pub const TWO_PI: f64 = 2. * PI;

/// ln(1000): an exponential decays by 60 dB after T60 when
/// r^n = e^(−6.9078·n/(T60·fs)).
pub const LN_1000: f64 = 6.907755278982137;

/// Piecewise-linear table over MIDI note number, clamped at both ends.
pub type KeyTable = Vec<(f64, f64)>;

pub fn midi_to_hz(note: f64) -> f64 {
  440. * 2f64.powf((note - 69.) / 12.)
}

pub fn clamp(x: f64, lo: f64, hi: f64) -> f64 {
  if x < lo {
    lo
  } else if x > hi {
    hi
  } else {
    x
  }
}

pub fn lerp(a: f64, b: f64, t: f64) -> f64 {
  a + (b - a) * t
}

/// JavaScript's `Math.round`: halves round up, toward +∞.
pub fn js_round(x: f64) -> f64 {
  (x + 0.5).floor()
}

pub fn next_pow2(n: usize) -> usize {
  let mut p = 1;
  while p < n {
    p <<= 1;
  }
  p
}

pub fn is_prime(n: u64) -> bool {
  if n < 2 {
    return false;
  }
  if n.is_multiple_of(2) {
    return n == 2;
  }
  let mut d = 3;
  while d * d <= n {
    if n.is_multiple_of(d) {
      return false;
    }
    d += 2;
  }
  true
}

pub fn next_prime(n: f64) -> u64 {
  let mut candidate = n.ceil().max(2.) as u64;
  while !is_prime(candidate) {
    candidate += 1;
  }
  candidate
}

pub fn key_table(table: &[(f64, f64)], note: f64) -> f64 {
  if note <= table[0].0 {
    return table[0].1;
  }
  let last = table[table.len() - 1];
  if note >= last.0 {
    return last.1;
  }
  for i in 1..table.len() {
    let (n1, v1) = table[i];
    if note <= n1 {
      let (n0, v0) = table[i - 1];
      return v0 + ((v1 - v0) * (note - n0)) / (n1 - n0);
    }
  }
  last.1
}

/// Folds a note into [low, high] by whole octaves.
pub fn fold_note(note: i32, low: i32, high: i32) -> i32 {
  let mut folded = note;
  while folded < low {
    folded += 12;
  }
  while folded > high {
    folded -= 12;
  }
  if folded < low { low } else { folded }
}

/// Equal-power pan law for pan ∈ [−1, 1].
pub fn pan_gains(pan: f64, out: &mut [f64; 2]) {
  let angle = ((clamp(pan, -1., 1.) + 1.) * PI) / 4.;
  out[0] = angle.cos();
  out[1] = angle.sin();
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn tables_and_notes() {
    assert_eq!(midi_to_hz(69.), 440.);
    assert_eq!(key_table(&[(20., 1.), (40., 3.)], 30.), 2.);
    assert_eq!(key_table(&[(20., 1.), (40., 3.)], 10.), 1.);
    assert_eq!(fold_note(10, 21, 108), 22);
    assert_eq!(next_prime(24.2), 29);
    assert_eq!(js_round(-2.5), -2.);
    assert_eq!(js_round(2.5), 3.);
  }
}
