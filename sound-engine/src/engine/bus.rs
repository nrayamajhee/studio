use super::modules::{LfoRouting, ModuleSettings};
use super::param_set::{ParamSet, Values};
use crate::dsp::filters::DcBlocker;
use crate::dsp::generators::Smoother;
use crate::dsp::nonlinear::drive as saturate;
use crate::models::body::Body;
use crate::patches::BasePatch;

pub const MAX_BLOCK: usize = 2048;

/// How long a bus keeps processing after its last voice ends, so the body
/// can ring out.
const TAIL_SECONDS: f64 = 0.5;

/// One instrument's bus: voices add their panned output into left/right;
/// finish() then runs the body, drive and output gain, sums into the master
/// and sends to the reverb.
pub struct Bus {
  pub fs: f64,
  pub name: String,
  pub params: ParamSet,
  /// The built-in filter and vibrato every voice shares.
  pub mods: ModuleSettings,
  pub left: Vec<f32>,
  pub right: Vec<f32>,
  pub clock: f64,
  pub warning: Option<String>,
  body: Body,
  output_gain: f64,
  gain: Smoother,
  send: Smoother,
  drive: Smoother,
  drive_dc_l: DcBlocker,
  drive_dc_r: DcBlocker,
  tail: f64,
}

impl Bus {
  pub fn new(
    patch: &'static BasePatch,
    fs: f64,
    routing: LfoRouting,
    overrides: Option<&Values>,
  ) -> Self {
    Self {
      fs,
      name: patch.name.clone(),
      params: ParamSet::with(&patch.params, overrides),
      mods: ModuleSettings::new(routing),
      left: vec![0.; MAX_BLOCK],
      right: vec![0.; MAX_BLOCK],
      clock: 0.,
      warning: None,
      body: Body::new(&patch.body, fs),
      output_gain: patch.output_gain,
      gain: Smoother::new(patch.output_gain, fs),
      send: Smoother::new(0., fs),
      drive: Smoother::new(0., fs),
      drive_dc_l: DcBlocker::new(fs),
      drive_dc_r: DcBlocker::new(fs),
      tail: f64::INFINITY,
    }
  }

  /// The bus's own part of applying params; the instrument then retargets
  /// its busy voices and reads its model's params.
  pub fn apply_params(&mut self) {
    let p = &self.params;
    self.send.set(p.get("space.send"));
    self.drive.set(p.get_or("output.drive", 0.));
    self
      .gain
      .set(self.output_gain * p.get_or("output.level", 1.));
    self.body.configure(
      p.get_or("body.size", 1.),
      p.get_or("body.resonance", 1.),
      p.get_or("body.tone", 0.),
      p.get_or("body.mix", 0.),
    );
    self.mods.read(&self.params, self.fs);
  }

  /// Sums the block into the master and the reverb send. False once the
  /// bus has been quiet past its tail, when it skips the work (and the
  /// instrument skips freeing voices).
  pub fn finish(
    &mut self,
    n: usize,
    active: bool,
    master_l: &mut [f32],
    master_r: &mut [f32],
    reverb_in: &mut [f32],
  ) -> bool {
    if active {
      self.tail = 0.;
    } else {
      self.tail += n as f64;
    }
    if self.tail > TAIL_SECONDS * self.fs {
      return false;
    }
    self.body.process(&mut self.left, &mut self.right, n);
    for i in 0..n {
      let mut l = self.left[i] as f64;
      let mut r = self.right[i] as f64;
      let d = self.drive.process();
      if d > 0. {
        l = self.drive_dc_l.process(saturate(l, d));
        r = self.drive_dc_r.process(saturate(r, d));
      }
      let g = self.gain.process();
      let s = self.send.process();
      l *= g;
      r *= g;
      master_l[i] = (master_l[i] as f64 + l) as f32;
      master_r[i] = (master_r[i] as f64 + r) as f32;
      reverb_in[i] = (reverb_in[i] as f64 + 0.5 * (l + r) * s) as f32;
    }
    self.left[..n].fill(0.);
    self.right[..n].fill(0.);
    true
  }
}
