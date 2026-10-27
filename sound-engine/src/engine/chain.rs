use std::f64::consts::PI;

use super::modules::ModuleSettings;
use crate::dsp::adsr::Adsr;
use crate::dsp::delay_line::DelayLine;
use crate::dsp::generators::{Lfo, Smoother};
use crate::dsp::svf::{Svf, SvfMode};

const FILTER_UPDATE: u64 = 16;
/// The vibrato is computed every 16 samples and drawn straight between.
const LFO_UPDATE: f64 = 16.;
/// The filter's cutoff moves this far toward its target each update.
const CUTOFF_GLIDE: f64 = 0.3;
/// The output's pitch vibrato is a delay swept by up to 8 ms around 1 ms.
const MAX_SWEEP: f64 = 0.008;
const SWEEP_CENTRE: f64 = 0.001;

/// Adds `y` into a bus sample as the TypeScript engine's `Float32Array` does.
#[inline]
pub fn mix(sample: &mut f32, y: f64) {
  *sample = (*sample as f64 + y) as f32;
}

/// The modules a voice runs its raw signal through: the filter, the
/// vibrato's output destinations, the master ADSR, the steal fade and the
/// pan. A model starts each segment with begin(), reads the vibrato through
/// modulate() where it takes it itself, and hands each sample to emit().
pub struct VoiceChain {
  /// The vibrato's value this sample, from modulate().
  pub modulation: f64,
  /// The steal fade: 1 until a stolen voice ramps it to 0.
  pub fade: f64,
  pub fade_step: f64,
  /// The master ADSR, applied on top of the model's own envelopes.
  pub shape: Adsr,
  pub gains: [f64; 2],
  fs: f64,
  lfo: Lfo,
  mod_step: f64,
  lfo_left: f64,
  svf: Svf,
  cutoff: f64,
  cutoff_target: f64,
  filter_env: f64,
  set_cutoff: f64,
  set_q: f64,
  ticks: u64,
  peak: f64,
  lfo_on: bool,
  own_lfo: bool,
  tremolo: f64,
  bending: bool,
  sweep: Option<DelayLine>,
  sweep_mix: Option<Smoother>,
  sweep_centre: f64,
  sweep_depth: f64,
}

impl VoiceChain {
  pub fn new(fs: f64, mods: &ModuleSettings) -> Self {
    let output = mods.routing.pitch_output;
    Self {
      modulation: 0.,
      fade: 1.,
      fade_step: 0.,
      shape: Adsr::new(fs),
      gains: [0.; 2],
      fs,
      lfo: Lfo::new(fs),
      mod_step: 0.,
      lfo_left: 0.,
      svf: Svf::new(SvfMode::Lowpass),
      cutoff: 16000.,
      cutoff_target: 16000.,
      filter_env: 0.,
      set_cutoff: -1.,
      set_q: -1.,
      ticks: 0,
      peak: 0.,
      lfo_on: false,
      own_lfo: false,
      tremolo: 0.,
      bending: false,
      sweep: output.then(|| DelayLine::new(2. * MAX_SWEEP * fs + 8.)),
      sweep_mix: output.then(|| Smoother::with_tau(0., fs, 0.02)),
      sweep_centre: 0.,
      sweep_depth: 0.,
    }
  }

  /// A new note: the filter jumps to the note's cutoff and its envelope and
  /// the vibrato start over (a free-running one picks up the shared cycle).
  pub fn onset(&mut self, note: i32, clock: f64, mods: &ModuleSettings) {
    self.retarget(note, mods);
    self.cutoff = self.cutoff_target;
    self.filter_env = 1.;
    self.modulation = 0.;
    self.mod_step = 0.;
    self.lfo_left = 0.;
    if mods.routing.free {
      self.lfo.set_delay(0., 0.);
      let cycle = (clock * mods.lfo_rate) / self.fs;
      self.lfo.restart(cycle - cycle.floor());
    } else {
      self.lfo.set_delay(mods.lfo_delay, mods.fade_in);
      self.lfo.restart(0.);
    }
  }

  /// Struck again while it sounds: the filter envelope starts over.
  pub fn retrigger(&mut self) {
    self.filter_env = 1.;
  }

  /// The settings changed: the cutoff glides to the new target.
  pub fn retarget(&mut self, note: i32, mods: &ModuleSettings) {
    self.cutoff_target = mods.cutoff * 2f64.powf((mods.keytrack * (note - 60) as f64) / 12.);
    self.lfo.shape = mods.lfo_shape;
    self.lfo.set_rate(mods.lfo_rate);
  }

  /// Silences the filter and the pitch sweep, for a model's reset().
  pub fn clear(&mut self) {
    self.svf.clear();
    if let Some(sweep) = &mut self.sweep {
      sweep.clear();
    }
  }

  /// Settles once per rendered segment which modules have anything to do.
  pub fn begin(&mut self, mods: &ModuleSettings) {
    self.lfo_on = mods.lfo_on();
    if !self.lfo_on {
      self.modulation = 0.;
      self.mod_step = 0.;
    }
    self.own_lfo = mods.routing.pitch_output && mods.routing.level_output;
    self.tremolo = if mods.routing.level_output {
      mods.level
    } else {
      0.
    };
    let (Some(sweep), Some(mix)) = (&mut self.sweep, &mut self.sweep_mix) else {
      return;
    };
    mix.set(if mods.pitch > 0. { 1. } else { 0. });
    let bending = !(mix.settled() && mix.value == 0.);
    // Starting to bend mid-note: what the delay holds is long stale.
    if bending && !self.bending {
      sweep.clear();
    }
    self.bending = bending;
    let depth = MAX_SWEEP.min(mods.pitch / (2. * PI * mods.lfo_rate.max(0.1)));
    self.sweep_depth = depth * self.fs;
    self.sweep_centre = (depth + SWEEP_CENTRE) * self.fs;
  }

  /// Advances the vibrato and returns its value.
  #[inline]
  pub fn modulate(&mut self) -> f64 {
    if !self.lfo_on {
      return 0.;
    }
    if self.lfo_left == 0. {
      self.mod_step = (self.lfo.advance(LFO_UPDATE) - self.modulation) / LFO_UPDATE;
      self.lfo_left = LFO_UPDATE;
    }
    self.lfo_left -= 1.;
    self.modulation += self.mod_step;
    self.modulation
  }

  /// Filters one sample, scales it by `gain`, then applies the vibrato's
  /// output destinations, the master ADSR, the steal fade and the pan.
  #[inline]
  pub fn emit(
    &mut self,
    x: f64,
    gain: f64,
    i: usize,
    left: &mut [f32],
    right: &mut [f32],
    mods: &ModuleSettings,
  ) {
    if self.own_lfo {
      self.modulate();
    }
    if self.ticks.is_multiple_of(FILTER_UPDATE) {
      self.update_filter(mods);
    }
    self.ticks += 1;
    let mut y = self.svf.process(x) * gain;
    if self.tremolo > 0. {
      y *= 1. + self.tremolo * self.modulation;
    }
    if self.bending {
      y = self.bend(y);
    }
    y *= self.shape.process();
    if self.fade_step > 0. {
      self.fade = (self.fade - self.fade_step).max(0.);
      y *= self.fade;
    }
    mix(&mut left[i], y * self.gains[0]);
    mix(&mut right[i], y * self.gains[1]);
    let level = y.abs();
    if level > self.peak {
      self.peak = level;
    }
  }

  /// The segment's peak, starting the next one over.
  pub fn take_peak(&mut self) -> f64 {
    std::mem::take(&mut self.peak)
  }

  fn update_filter(&mut self, mods: &ModuleSettings) {
    self.cutoff += (self.cutoff_target - self.cutoff) * CUTOFF_GLIDE;
    self.filter_env *= mods.env_decay;
    let mut cutoff = self.cutoff * (1. + mods.env_amount * self.filter_env);
    if mods.filter > 0. {
      cutoff *= 2f64.powf(mods.filter * self.modulation);
    }
    if cutoff == self.set_cutoff && mods.q == self.set_q {
      return;
    }
    self.set_cutoff = cutoff;
    self.set_q = mods.q;
    self.svf.set(cutoff, mods.q, self.fs);
  }

  /// Pitch from the delay swept at the vibrato's rate, crossfaded in and out.
  fn bend(&mut self, y: f64) -> f64 {
    let (Some(sweep), Some(mix)) = (&mut self.sweep, &mut self.sweep_mix) else {
      return y;
    };
    sweep.write(y);
    let m = mix.process();
    y + m * (sweep.read_lagrange3(self.sweep_centre + self.sweep_depth * self.modulation) - y)
  }
}
