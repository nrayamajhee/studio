use crate::dsp::delay_line::DelayLine;
use crate::dsp::filters::{DcBlocker, OnePoleLowpass};
use crate::dsp::generators::Smoother;
use crate::dsp::math::{TWO_PI, js_round};
use crate::dsp::nonlinear::drive;

/// Chorus: two taps swept in quadrature around 15 ms.
const CHORUS_CENTRE: f64 = 0.015;
const CHORUS_SWEEP: f64 = 0.004;
const CHORUS_RATE: f64 = 0.8;
/// Delay: a ping-pong echo on an eighth note at 120 BPM, each repeat darker.
const ECHO_SECONDS: f64 = 0.25;
const ECHO_FEEDBACK: f64 = 0.45;
const ECHO_DAMPING_HZ: f64 = 3500.;
const IDLE: f64 = 1e-4;

/// The FX chain over the mix: drive, chorus, then delay. Each stage is
/// skipped while its amount is zero, and clears its lines on the way out.
pub struct MasterFx {
  fs: f64,
  drive_amount: Smoother,
  chorus_amount: Smoother,
  echo_amount: Smoother,
  dc_l: DcBlocker,
  dc_r: DcBlocker,
  chorus_l: DelayLine,
  chorus_r: DelayLine,
  echo_l: DelayLine,
  echo_r: DelayLine,
  damp_l: OnePoleLowpass,
  damp_r: OnePoleLowpass,
  chorus_phase: f64,
  chorus_idle: bool,
  echo_idle: bool,
}

impl MasterFx {
  pub fn new(fs: f64) -> Self {
    let chorus_max = (CHORUS_CENTRE + CHORUS_SWEEP) * fs + 8.;
    let mut fx = Self {
      fs,
      drive_amount: Smoother::new(0., fs),
      chorus_amount: Smoother::new(0., fs),
      echo_amount: Smoother::new(0., fs),
      dc_l: DcBlocker::new(fs),
      dc_r: DcBlocker::new(fs),
      chorus_l: DelayLine::new(chorus_max),
      chorus_r: DelayLine::new(chorus_max),
      echo_l: DelayLine::new(ECHO_SECONDS * fs + 8.),
      echo_r: DelayLine::new(ECHO_SECONDS * fs + 8.),
      damp_l: OnePoleLowpass::default(),
      damp_r: OnePoleLowpass::default(),
      chorus_phase: 0.,
      chorus_idle: true,
      echo_idle: true,
    };
    fx.damp_l.set_cutoff(ECHO_DAMPING_HZ, fs);
    fx.damp_r.set_cutoff(ECHO_DAMPING_HZ, fs);
    fx
  }

  pub fn set(&mut self, drive_amount: f64, chorus: f64, delay: f64) {
    self.drive_amount.set(drive_amount);
    self.chorus_amount.set(chorus);
    self.echo_amount.set(delay);
  }

  pub fn process(&mut self, left: &mut [f32], right: &mut [f32], n: usize) {
    self.process_drive(left, right, n);
    self.process_chorus(left, right, n);
    self.process_echo(left, right, n);
  }

  fn process_drive(&mut self, left: &mut [f32], right: &mut [f32], n: usize) {
    if self.drive_amount.settled() && self.drive_amount.value < IDLE {
      return;
    }
    for i in 0..n {
      let d = self.drive_amount.process();
      left[i] = self.dc_l.process(drive(left[i] as f64, d)) as f32;
      right[i] = self.dc_r.process(drive(right[i] as f64, d)) as f32;
    }
  }

  fn process_chorus(&mut self, left: &mut [f32], right: &mut [f32], n: usize) {
    if self.chorus_amount.settled() && self.chorus_amount.value < IDLE {
      if !self.chorus_idle {
        self.chorus_l.clear();
        self.chorus_r.clear();
        self.chorus_idle = true;
      }
      return;
    }
    self.chorus_idle = false;
    let step = CHORUS_RATE / self.fs;
    let centre = CHORUS_CENTRE * self.fs;
    let sweep = CHORUS_SWEEP * self.fs;
    for i in 0..n {
      let a = self.chorus_amount.process();
      self.chorus_phase = (self.chorus_phase + step) % 1.;
      let angle = TWO_PI * self.chorus_phase;
      let l = left[i] as f64;
      let r = right[i] as f64;
      self.chorus_l.write(l);
      self.chorus_r.write(r);
      let tap_l = self.chorus_l.read_lagrange3(centre + sweep * angle.sin());
      let tap_r = self.chorus_r.read_lagrange3(centre + sweep * angle.cos());
      left[i] = (l * (1. - 0.25 * a) + 0.6 * a * tap_l) as f32;
      right[i] = (r * (1. - 0.25 * a) + 0.6 * a * tap_r) as f32;
    }
  }

  fn process_echo(&mut self, left: &mut [f32], right: &mut [f32], n: usize) {
    if self.echo_amount.settled() && self.echo_amount.value < IDLE {
      if !self.echo_idle {
        self.echo_l.clear();
        self.echo_r.clear();
        self.damp_l.clear();
        self.damp_r.clear();
        self.echo_idle = true;
      }
      return;
    }
    self.echo_idle = false;
    let length = js_round(ECHO_SECONDS * self.fs) as usize;
    for i in 0..n {
      let wet = 0.8 * self.echo_amount.process();
      let l = left[i] as f64;
      let r = right[i] as f64;
      let echo_l = self.echo_l.read_int(length);
      let echo_r = self.echo_r.read_int(length);
      // Ping-pong: the mix enters on the left and each repeat crosses sides.
      let feedback_r = self.damp_r.process(echo_r);
      self
        .echo_l
        .write(0.5 * (l + r) + ECHO_FEEDBACK * feedback_r);
      let feedback_l = self.damp_l.process(echo_l);
      self.echo_r.write(ECHO_FEEDBACK * feedback_l);
      left[i] = (l + wet * echo_l) as f32;
      right[i] = (r + wet * echo_r) as f32;
    }
  }
}
