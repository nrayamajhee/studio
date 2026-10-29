//! Phase delay (samples) and magnitude helpers used to tune delay loops.

/// One-pole lowpass y = (1 − p)·x + p·y₁.
pub fn one_pole_phase_delay(p: f64, w: f64) -> f64 {
  (p * w.sin()).atan2(1. - p * w.cos()) / w
}

/// A one-pole lowpass's gain at `w` radians a sample.
pub fn one_pole_magnitude(p: f64, w: f64) -> f64 {
  (1. - p) / (1. - 2. * p * w.cos() + p * p).sqrt()
}

/// First-order allpass A(z) = (a + z⁻¹)/(1 + a·z⁻¹); a = 0 gives exactly 1.
pub fn allpass1_phase_delay(a: f64, w: f64) -> f64 {
  -((-w.sin()).atan2(a + w.cos()) - (-a * w.sin()).atan2(1. + a * w.cos())) / w
}

/// Coefficient of a first-order allpass whose phase delay at w equals
/// `delay` (∈ [0.5, 1.5)), by bisection.
pub fn allpass1_for_delay(delay: f64, w: f64) -> f64 {
  let mut lo = -0.999;
  let mut hi = 0.999;
  for _ in 0..40 {
    let mid = 0.5 * (lo + hi);
    if allpass1_phase_delay(mid, w) > delay {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  0.5 * (lo + hi)
}
