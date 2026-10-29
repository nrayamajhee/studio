//! The master LFO the LFO view sets: one modulator over the whole mix.

use std::f64::consts::{PI, SQRT_2};

use crate::dsp::delay_line::DelayLine;
use crate::dsp::generators::{Lfo, Smoother};
use crate::dsp::svf::{Svf, SvfMode};

/// Pitch swings by up to ±3% at full depth; the swept delay is capped at
/// 8 ms, which only limits the slowest rates.
const PITCH_SWING: f64 = 0.03;
/// The longest the pitch's delay sweeps, in seconds.
const MAX_SWEEP: f64 = 0.008;
/// The filter's cutoff is recomputed every 16 samples.
const FILTER_UPDATE: u64 = 16;

/// One LFO over the whole mix: pitch (a swept delay), volume (tremolo),
/// filter (a lowpass swept from 250 Hz to 16 kHz) or pan. At zero depth the
/// mix passes through untouched.
pub struct MasterLfo {
  fs: f64,
  lfo: Lfo,
  depth: Smoother,
  pitch_mix: Smoother,
  delay_l: DelayLine,
  delay_r: DelayLine,
  filter_l: Svf,
  filter_r: Svf,
  target: i32,
  rate: f64,
  ticks: u64,
}

impl MasterLfo {
  /// The LFO at `fs`, at zero depth, so the mix passes untouched.
  pub fn new(fs: f64) -> Self {
    Self {
      fs,
      lfo: Lfo::new(fs),
      depth: Smoother::new(0., fs),
      pitch_mix: Smoother::with_tau(0., fs, 0.02),
      delay_l: DelayLine::new(2. * MAX_SWEEP * fs + 8.),
      delay_r: DelayLine::new(2. * MAX_SWEEP * fs + 8.),
      filter_l: Svf::new(SvfMode::Lowpass),
      filter_r: Svf::new(SvfMode::Lowpass),
      target: 0,
      rate: 5.,
      ticks: 0,
    }
  }

  /// Sets the rate in hertz, depth (0–1), shape (the LFO's index) and target: 0
  /// pitch, 1 volume, 2 filter, else pan. The depth glides; switching to or
  /// from pitch crossfades the delay in or out.
  pub fn set(&mut self, rate: f64, depth: f64, shape: i32, target: i32) {
    self.rate = rate;
    self.lfo.set_rate(rate);
    self.lfo.shape = shape;
    self.target = target;
    self.depth.set(depth);
    self
      .pitch_mix
      .set(if depth > 0. && target == 0 { 1. } else { 0. });
  }

  /// Runs `n` frames of the mix through the LFO's target, in place. At zero
  /// depth it passes through, still feeding the pitch's delay.
  pub fn process(&mut self, left: &mut [f32], right: &mut [f32], n: usize) {
    let pitch = self.target == 0;
    if !pitch && self.depth.settled() && self.depth.value == 0. {
      return;
    }
    if pitch && self.pitch_mix.settled() && self.pitch_mix.value == 0. {
      // Keep the delay filled so switching on picks up the current sound.
      for i in 0..n {
        self.delay_l.write(left[i] as f64);
        self.delay_r.write(right[i] as f64);
      }
      return;
    }
    let sweep = MAX_SWEEP.min(PITCH_SWING / (2. * PI * self.rate));
    let centre = (sweep + 0.001) * self.fs;
    for i in 0..n {
      let d = self.depth.process();
      let m = self.lfo.process();
      let l = left[i] as f64;
      let r = right[i] as f64;
      match self.target {
        0 => {
          self.delay_l.write(l);
          self.delay_r.write(r);
          let at = centre + d * m * sweep * self.fs;
          let mix = self.pitch_mix.process();
          left[i] = (l + mix * (self.delay_l.read_lagrange3(at) - l)) as f32;
          right[i] = (r + mix * (self.delay_r.read_lagrange3(at) - r)) as f32;
        }
        1 => {
          let g = 1. - (d * (1. - m)) / 2.;
          left[i] = (l * g) as f32;
          right[i] = (r * g) as f32;
        }
        2 => {
          if self.ticks.is_multiple_of(FILTER_UPDATE) {
            let cutoff = 250. * 2f64.powf(3. * (m + 1.));
            self.filter_l.set(cutoff, 1.2, self.fs);
            self.filter_r.set(cutoff, 1.2, self.fs);
          }
          self.ticks += 1;
          left[i] = (l + d * (self.filter_l.process(l) - l)) as f32;
          right[i] = (r + d * (self.filter_r.process(r) - r)) as f32;
        }
        _ => {
          // Equal-power pan around the centre, unity at rest.
          let angle = ((d * m + 1.) * PI) / 4.;
          left[i] = (l * angle.cos() * SQRT_2) as f32;
          right[i] = (r * angle.sin() * SQRT_2) as f32;
        }
      }
    }
  }
}
