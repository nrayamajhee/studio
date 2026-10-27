use std::f64::consts::FRAC_1_SQRT_2;

use super::param_set::ParamSet;
use crate::dsp::math::js_round;

/// How a model takes the vibrato: on its own exciter's level and its own
/// loop's pitch, or left to the voice's output (tremolo and a swept delay).
#[derive(Clone, Copy)]
pub struct LfoRouting {
  pub pitch_output: bool,
  pub level_output: bool,
  /// Voices join one free-running cycle instead of each starting its own.
  pub free: bool,
  /// Seconds the depth takes to ramp in after the delay.
  pub fade_in: Option<f64>,
}

pub const OUTPUT_ROUTING: LfoRouting = LfoRouting {
  pitch_output: true,
  level_output: true,
  free: false,
  fade_in: None,
};

pub const MODEL_ROUTING: LfoRouting = LfoRouting {
  pitch_output: false,
  level_output: false,
  free: false,
  fade_in: None,
};

/// The built-in modules every voice of an instrument shares settings for:
/// the filter and the vibrato, read from the patch's filter.* and vibrato.*
/// params.
pub struct ModuleSettings {
  pub routing: LfoRouting,
  pub fade_in: f64,
  pub cutoff: f64,
  pub q: f64,
  pub env_amount: f64,
  /// Per-update decay of the filter envelope (updates are 16 samples apart).
  pub env_decay: f64,
  pub keytrack: f64,
  pub lfo_rate: f64,
  pub lfo_shape: i32,
  pub lfo_delay: f64,
  /// Peak pitch swing as a ratio above 1: 2^(cents/1200) − 1.
  pub pitch: f64,
  /// Peak level swing, a fraction of the exciter or the output.
  pub level: f64,
  /// Peak cutoff swing in octaves.
  pub filter: f64,
}

impl ModuleSettings {
  pub fn new(routing: LfoRouting) -> Self {
    Self {
      routing,
      fade_in: routing.fade_in.unwrap_or(0.3),
      cutoff: 16000.,
      q: FRAC_1_SQRT_2,
      env_amount: 0.,
      env_decay: 1.,
      keytrack: 0.,
      lfo_rate: 5.,
      lfo_shape: 0,
      lfo_delay: 0.,
      pitch: 0.,
      level: 0.,
      filter: 0.,
    }
  }

  pub fn lfo_on(&self) -> bool {
    self.pitch > 0. || self.level > 0. || self.filter > 0.
  }

  pub fn read(&mut self, p: &ParamSet, fs: f64) {
    if p.has("filter.cutoff") {
      self.cutoff = p.get("filter.cutoff");
    }
    if p.has("filter.resonance") {
      self.q = p.get("filter.resonance");
    }
    self.env_amount = p.get_or("filter.envAmount", 0.);
    self.keytrack = p.get_or("filter.keytrack", 0.);
    self.env_decay = (-16. / (p.get_or("filter.envDecay", 0.3).max(0.01) * fs)).exp();
    if !p.has("vibrato.rate") {
      return;
    }
    self.lfo_rate = p.get("vibrato.rate");
    self.lfo_shape = js_round(p.get("vibrato.shape")) as i32;
    self.lfo_delay = p.get("vibrato.delay");
    self.pitch = 2f64.powf(p.get("vibrato.pitch") / 1200.) - 1.;
    self.level = p.get("vibrato.level");
    self.filter = p.get("vibrato.filter");
  }
}
