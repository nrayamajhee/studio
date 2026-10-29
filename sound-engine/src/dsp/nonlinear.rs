//! Tables ported from STK (The Synthesis ToolKit, Perry Cook & Gary Scavone,
//! MIT-style license): JetTable, ReedTable and BowTable.

/// STK's jet table: the cubic x·(x² − 1), clamped to [−1, 1], for a flute's air
/// jet.
pub fn jet_table(x: f64) -> f64 {
  (x * (x * x - 1.)).clamp(-1., 1.)
}

/// STK's reed table: a reed's reflection, `offset + slope·x` clamped to [−1,
/// 1].
pub fn reed_table(x: f64, offset: f64, slope: f64) -> f64 {
  (offset + slope * x).clamp(-1., 1.)
}

/// Friction curve of a bow against a string: (|slope·(x + offset)| + 0.75)^−4,
/// clamped to [0.01, 0.98].
pub fn bow_table(x: f64, offset: f64, slope: f64) -> f64 {
  (((x + offset) * slope).abs() + 0.75)
    .powf(-4.)
    .clamp(0.01, 0.98)
}

/// Cubic soft clipper: x·(27 + x²)/(27 + 9x²) for |x| < 3, else ±1.
pub fn soft_clip(x: f64) -> f64 {
  if x <= -3. {
    return -1.;
  }
  if x >= 3. {
    return 1.;
  }
  let x2 = x * x;
  (x * (27. + x2)) / (27. + 9. * x2)
}

/// Saturation for an amount in [0, 1], level-compensated.
pub fn drive(x: f64, amount: f64) -> f64 {
  soft_clip(x * (1. + 9. * amount)) / (1. + 2. * amount)
}
