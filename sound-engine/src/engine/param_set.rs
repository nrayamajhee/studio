use crate::dsp::adsr::AdsrStages;
use crate::patches::ParamSpec;

/// An instrument's (or the master's) params: each spec's value, clamped to
/// its range.
pub struct ParamSet {
  pub specs: &'static [ParamSpec],
  values: Vec<f64>,
}

impl ParamSet {
  pub fn new(specs: &'static [ParamSpec]) -> Self {
    Self {
      specs,
      values: specs.iter().map(|spec| spec.default).collect(),
    }
  }

  pub fn index(&self, id: &str) -> Option<usize> {
    self.specs.iter().position(|spec| spec.id == id)
  }

  pub fn has(&self, id: &str) -> bool {
    self.index(id).is_some()
  }

  pub fn get(&self, id: &str) -> f64 {
    self.index(id).map_or(0., |i| self.values[i])
  }

  /// The value if the patch has the param, else `fallback`.
  pub fn get_or(&self, id: &str, fallback: f64) -> f64 {
    self.index(id).map_or(fallback, |i| self.values[i])
  }

  pub fn set(&mut self, id: &str, value: f64) -> bool {
    match self.index(id) {
      Some(i) => self.set_index(i, value),
      None => false,
    }
  }

  pub fn set_index(&mut self, i: usize, value: f64) -> bool {
    let Some(spec) = self.specs.get(i) else {
      return false;
    };
    if !value.is_finite() {
      return false;
    }
    self.values[i] = value.max(spec.min).min(spec.max);
    true
  }

  /// The four stages of an ADSR described under `prefix`.
  pub fn envelope(&self, prefix: &str) -> AdsrStages {
    AdsrStages {
      attack: self.get(&format!("{prefix}.attack")),
      decay: self.get(&format!("{prefix}.decay")),
      sustain: self.get(&format!("{prefix}.sustain")),
      release: self.get(&format!("{prefix}.release")),
    }
  }
}
