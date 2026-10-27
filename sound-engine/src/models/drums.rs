use std::f64::consts::PI;

use super::exciters::{stick, velocity_gain};
use crate::dsp::filters::OnePoleHighpass;
use crate::dsp::generators::{Follower, Noise};
use crate::dsp::math::{LN_1000, js_round, lerp, pan_gains};
use crate::dsp::modal::ModalBank;
use crate::dsp::svf::{Svf, SvfMode};
use crate::engine::bus::Bus;
use crate::engine::chain::mix;
use crate::engine::modules::ModuleSettings;
use crate::engine::voice::{RELEASED, Voice, VoiceCore};
use crate::patches::{
  DrumBrush, DrumKitPatch, DrumPieceSpec, MetalModes, PIECE_ORDER, piece_index,
};

/// Ideal circular membrane: (m, n) modes (0,1) (1,1) (2,1) (0,2) (3,1) (1,2)
/// (4,1) (2,2) (0,3) (5,1) as ratios of the fundamental, with their m index.
const MEMBRANE_RATIOS: [f64; 10] = [
  1.0, 1.593, 2.136, 2.295, 2.653, 2.917, 3.155, 3.5, 3.598, 3.647,
];
const MEMBRANE_M: [u8; 10] = [0, 1, 2, 0, 3, 1, 4, 2, 0, 5];
const PITCH_UPDATE: u64 = 32;
const CHOKE_T60: f64 = 0.03;
/// A brush's bristles land over a few milliseconds, sooner on a harder
/// stroke, and push the head softly with a fraction of a stick's weight.
const BRUSH_RISE: (f64, f64) = (0.008, 0.003);
const BRUSH_PUSH: f64 = 0.15;

struct DrumVoice {
  core: VoiceCore,
  spec: &'static DrumPieceSpec,
  bank: ModalBank,
  pulse: Vec<f32>,
  noise: Noise,
  base_freq: Vec<f64>,
  base_t60: Vec<f64>,
  weights: Vec<f64>,
  click_filter: OnePoleHighpass,
  noise_filter: OnePoleHighpass,
  wires_filter: OnePoleHighpass,
  hiss_filter: OnePoleHighpass,
  follower: Follower,
  bandpass: Svf,
  bursts: Vec<f64>,
  pulse_length: usize,
  pulse_pos: usize,
  elapsed: u64,
  drop: f64,
  drop_tau: f64,
  tune_ratio: f64,
  decay_scale: f64,
  click_remaining: f64,
  click_length: f64,
  click_level: f64,
  noise_env: f64,
  noise_coef: f64,
  noise_level: f64,
  wires_level: f64,
  hit_level: f64,
  clap_level: f64,
  burst_samples: f64,
  tail_start: f64,
  tail_coef: f64,
  swell: f64,
  brush_pos: f64,
  brush_length: f64,
  brush_rise: f64,
  brush_env: f64,
  brush_coef: f64,
  brush_scale: f64,
  hiss_level: f64,
}

impl Voice for DrumVoice {
  fn core(&self) -> &VoiceCore {
    &self.core
  }
  fn core_mut(&mut self) -> &mut VoiceCore {
    &mut self.core
  }
  fn reset(&mut self) {
    self.bank.clear();
    self.pulse_pos = 0;
    self.pulse_length = 0;
    self.brush_pos = 0.;
    self.brush_length = 0.;
    self.click_remaining = 0.;
    self.noise_env = 0.;
    self.clap_level = 0.;
    self.follower.clear();
    self.bandpass.clear();
  }
}

impl DrumVoice {
  fn new(spec: &'static DrumPieceSpec, fs: f64, mods: &ModuleSettings, seed: u32) -> Self {
    // The wires buzz on after the head for their own release.
    let release = match spec {
      DrumPieceSpec::Membrane {
        wires: Some(wires), ..
      } => wires.release,
      _ => 0.12,
    };
    let count = match spec {
      DrumPieceSpec::Membrane { ratios, shell, .. } => ratios + usize::from(shell.is_some()),
      DrumPieceSpec::Loaded { partials, .. } => partials.len(),
      DrumPieceSpec::Metal { modes, .. } => match modes {
        MetalModes::Seeded { count, .. } => *count,
        MetalModes::Table { freqs, .. } => freqs.len(),
      },
      _ => 0,
    };
    let mut bank = ModalBank::new(count.max(1), fs);
    bank.count = count;
    let mut voice = Self {
      core: VoiceCore::new(fs, mods),
      spec,
      bank,
      pulse: vec![0.; (0.006 * fs).ceil() as usize + 2],
      noise: Noise::new(seed),
      base_freq: vec![0.; count],
      base_t60: vec![0.; count],
      weights: vec![0.; count],
      click_filter: OnePoleHighpass::default(),
      noise_filter: OnePoleHighpass::default(),
      wires_filter: OnePoleHighpass::default(),
      hiss_filter: OnePoleHighpass::default(),
      follower: Follower::new(0.001, release, fs),
      bandpass: Svf::new(SvfMode::Bandpass),
      bursts: Vec::new(),
      pulse_length: 0,
      pulse_pos: 0,
      elapsed: 0,
      drop: 0.,
      drop_tau: 1.,
      tune_ratio: 1.,
      decay_scale: 1.,
      click_remaining: 0.,
      click_length: 1.,
      click_level: 0.,
      noise_env: 0.,
      noise_coef: 0.,
      noise_level: 0.,
      wires_level: 0.,
      hit_level: 1.,
      clap_level: 0.,
      burst_samples: 1.,
      tail_start: 0.,
      tail_coef: 0.,
      swell: 0.,
      brush_pos: 0.,
      brush_length: 0.,
      brush_rise: 1.,
      brush_env: 0.,
      brush_coef: 0.,
      brush_scale: 0.,
      hiss_level: 0.,
    };

    match spec {
      DrumPieceSpec::Membrane {
        f0,
        ratios,
        t60,
        shell,
        click,
        wires,
        brush,
        ..
      } => {
        for i in 0..*ratios {
          voice.base_freq[i] = f0 * MEMBRANE_RATIOS[i];
          voice.base_t60[i] = t60[i.min(t60.len() - 1)];
        }
        if let Some((freq, t60, amp)) = *shell {
          voice.base_freq[*ratios] = freq;
          voice.base_t60[*ratios] = t60;
          voice.weights[*ratios] = amp;
        }
        if let Some(click) = click {
          voice.click_filter.set_cutoff(click.highpass, fs);
        }
        if let Some(wires) = wires {
          voice.wires_filter.set_cutoff(wires.highpass, fs);
        }
        if let Some(brush) = brush {
          voice.hiss_filter.set_cutoff(brush.highpass, fs);
        }
      }
      DrumPieceSpec::Loaded {
        f0,
        partials,
        click,
        ..
      } => {
        for (i, &(ratio, t60, amp)) in partials.iter().enumerate() {
          voice.base_freq[i] = f0 * ratio;
          voice.base_t60[i] = t60;
          voice.weights[i] = amp;
        }
        if let Some(click) = click {
          voice.click_filter.set_cutoff(click.highpass, fs);
        }
      }
      DrumPieceSpec::Metal {
        modes,
        t60,
        noise,
        brush,
        ..
      } => {
        match modes {
          MetalModes::Seeded {
            seed,
            count,
            low,
            high,
          } => {
            // Log-uniform modes from a fixed seed, T60_i = T60·(f_lo/f_i)^0.3,
            // amp_i ∝ 1/√(i+1) with ±30% jitter.
            let mut table = Noise::new(*seed);
            for i in 0..*count {
              let u = 0.5 * (table.next() + 1.);
              let freq = low * (high / low).powf(u);
              voice.base_freq[i] = freq;
              voice.base_t60[i] = t60 * (low / freq).powf(0.3);
              voice.weights[i] = (1. / ((i + 1) as f64).sqrt()) * (1. + 0.3 * table.next());
            }
          }
          MetalModes::Table { freqs, amps } => {
            for i in 0..freqs.len() {
              voice.base_freq[i] = freqs[i];
              voice.base_t60[i] = *t60;
              voice.weights[i] = amps[i];
            }
          }
        }
        if let Some(noise) = noise {
          voice.noise_filter.set_cutoff(noise.highpass, fs);
        }
        if let Some(brush) = brush {
          voice.hiss_filter.set_cutoff(brush.highpass, fs);
        }
      }
      DrumPieceSpec::Noise {
        bursts,
        burst_length,
        tail_start,
        tail_decay,
        swell,
        bandpass,
        ..
      } => {
        let mut jitter = Noise::new(seed + 17);
        voice.bursts = bursts
          .iter()
          .enumerate()
          .map(|(i, burst)| {
            let ms = burst + if i == 0 { 0. } else { 2. * jitter.next() };
            ((ms / 1000.) * fs).max(0.)
          })
          .collect();
        voice.burst_samples = (burst_length / 1000.) * fs;
        voice.tail_start = (tail_start / 1000.) * fs;
        voice.tail_coef = (-LN_1000 / ((tail_decay / 1000.) * fs)).exp();
        if *swell == Some(true) {
          voice.swell = voice.tail_start;
        }
        voice.bandpass.set(bandpass.0, bandpass.1, fs);
      }
      DrumPieceSpec::Combo { .. } => {}
    }
    voice
  }

  fn level(&self) -> f64 {
    match self.spec {
      DrumPieceSpec::Membrane { level, .. }
      | DrumPieceSpec::Metal { level, .. }
      | DrumPieceSpec::Loaded { level, .. }
      | DrumPieceSpec::Noise { level, .. }
      | DrumPieceSpec::Combo { level, .. } => *level,
    }
  }

  fn pan(&self) -> f64 {
    match self.spec {
      DrumPieceSpec::Membrane { pan, .. }
      | DrumPieceSpec::Metal { pan, .. }
      | DrumPieceSpec::Loaded { pan, .. }
      | DrumPieceSpec::Noise { pan, .. } => *pan,
      DrumPieceSpec::Combo { .. } => 0.,
    }
  }

  /// `position` blends center strikes (m = 0 modes only) toward edge
  /// strikes (all modes, 1/(1 + 0.25·i)).
  fn configure(&mut self, tune: f64, decay: f64, position: f64) {
    self.tune_ratio = 2f64.powf(tune / 12.);
    self.decay_scale = decay;
    if let DrumPieceSpec::Membrane { ratios, .. } = self.spec {
      for i in 0..*ratios {
        let center = if MEMBRANE_M[i] == 0 { 1. } else { 0.05 };
        let edge = 1. / (1. + 0.25 * i as f64);
        self.weights[i] = lerp(center, edge, position);
      }
    }
    for i in 0..self.bank.count {
      self
        .bank
        .set_mode(i, self.base_freq[i], self.base_t60[i], self.weights[i]);
    }
    self.bank.scale_decay(decay);
    self.bank.scale_frequencies(self.tune_ratio);
  }

  #[allow(clippy::too_many_arguments)]
  fn strike(
    &mut self,
    velocity: f64,
    hardness: f64,
    strength: f64,
    drop_scale: f64,
    click: f64,
    wires: f64,
    clock: f64,
    gain: f64,
  ) {
    let spec = self.spec;
    let fs = self.core.fs;
    self.core.begin(0, clock);
    self.core.state = RELEASED;
    self.core.chain.shape.note_on();
    self.hit_level = self.level() * velocity_gain(velocity, strength, 1.2) * gain;
    self.elapsed = 0;
    let stick_spec = match spec {
      DrumPieceSpec::Membrane { stick, brush, .. } | DrumPieceSpec::Metal { stick, brush, .. } => {
        Some((*stick, *brush))
      }
      DrumPieceSpec::Loaded { stick, .. } => Some((*stick, None)),
      _ => None,
    };
    if let Some(((soft, hard), brush)) = stick_spec {
      let force = hardness * velocity;
      // A brush pushes the head as softly as a stick's lightest touch.
      let seconds = (if brush.is_some() {
        soft
      } else {
        lerp(soft, hard, force)
      }) / 1000.;
      self.pulse_length = stick(
        &mut self.pulse,
        seconds,
        if brush.is_some() { BRUSH_PUSH } else { 1. },
        fs,
      );
      self.pulse_pos = 0;
      self.bank.scale_decay(self.decay_scale);
      if let Some(brush) = brush {
        self.start_brush(brush, force);
      }
    }
    match spec {
      DrumPieceSpec::Membrane {
        pitch_drop,
        pitch_tau,
        click: spec_click,
        wires: spec_wires,
        ..
      } => {
        self.drop = pitch_drop * velocity * drop_scale;
        self.drop_tau = (pitch_tau / 1000.) * fs;
        if let Some(spec_click) = spec_click {
          self.click_length = ((spec_click.length / 1000.) * fs).max(1.);
          self.click_remaining = self.click_length;
          self.click_level = spec_click.level * click;
        }
        self.wires_level = spec_wires.map_or(0., |spec_wires| spec_wires.level * wires);
      }
      DrumPieceSpec::Loaded {
        pitch_drop,
        pitch_tau,
        click: spec_click,
        ..
      } => {
        self.drop = pitch_drop.unwrap_or(0.) * velocity * drop_scale;
        self.drop_tau = (pitch_tau.unwrap_or(50.) / 1000.) * fs;
        if let Some(spec_click) = spec_click {
          self.click_length = ((spec_click.length / 1000.) * fs).max(1.);
          self.click_remaining = self.click_length;
          self.click_level = spec_click.level * click;
        }
        self.wires_level = 0.;
      }
      DrumPieceSpec::Metal {
        noise: Some(noise), ..
      } => {
        self.noise_env = 1.;
        self.noise_level = noise.level;
        self.noise_coef = (-LN_1000 / (noise.decay * self.decay_scale * fs)).exp();
      }
      DrumPieceSpec::Noise { .. } => {
        self.clap_level = 1.;
      }
      _ => {}
    }
  }

  /// Harder strokes land the bristles sooner and closer together. The burst
  /// is scaled to unit energy (its envelope's square integrates to 3/8 of
  /// the rise plus half the decay's time constant), so its length changes
  /// the hiss, not how hard the modes are driven.
  fn start_brush(&mut self, brush: DrumBrush, force: f64) {
    let fs = self.core.fs;
    let length = (brush.length / 1000.) * lerp(1.3, 0.75, force) * fs;
    self.brush_rise = js_round(lerp(BRUSH_RISE.0, BRUSH_RISE.1, force) * fs).max(1.);
    self.brush_length = (self.brush_rise + 1.).max(js_round(length));
    let tau = (self.brush_length - self.brush_rise) / LN_1000;
    self.brush_coef = (-1. / tau).exp();
    self.brush_scale = 1. / (0.375 * self.brush_rise + 0.5 * tau).sqrt();
    self.brush_env = 1.;
    self.brush_pos = 0.;
    self.hiss_level = brush.level;
  }

  fn choke(&mut self) {
    if !self.core.busy() {
      return;
    }
    let mut longest: f64 = 0.;
    for i in 0..self.bank.count {
      longest = longest.max(self.base_t60[i]);
    }
    if longest > 0. {
      self.bank.scale_decay(CHOKE_T60 / longest);
    }
    self.noise_coef = (-LN_1000 / (CHOKE_T60 * self.core.fs)).exp();
  }

  fn render(&mut self, start: usize, end: usize, left: &mut [f32], right: &mut [f32]) {
    let gains = self.core.chain.gains;
    let membrane = matches!(
      self.spec,
      DrumPieceSpec::Membrane { .. } | DrumPieceSpec::Loaded { .. }
    );
    let clap = matches!(self.spec, DrumPieceSpec::Noise { .. });
    let mut peak: f64 = 0.;
    for i in start..end {
      let mut x = 0.;
      if self.pulse_pos < self.pulse_length {
        x = self.pulse[self.pulse_pos] as f64;
        self.pulse_pos += 1;
      }
      let bristles = if self.brush_pos < self.brush_length {
        self.bristle()
      } else {
        0.
      };
      x += bristles * self.brush_scale;
      if membrane && self.drop > 0. && self.elapsed.is_multiple_of(PITCH_UPDATE) {
        // Tension modulation: pitch starts high and settles.
        self.bank.scale_frequencies(
          self.tune_ratio * (1. + self.drop * (-(self.elapsed as f64) / self.drop_tau).exp()),
        );
      }
      let mut y = if self.bank.count > 0 {
        self.bank.process(x)
      } else {
        0.
      };
      if bristles != 0. {
        y += self.hiss_filter.process(bristles) * self.hiss_level;
      }
      if self.click_remaining > 0. {
        y += self.click_filter.process(self.noise.next())
          * self.click_level
          * (self.click_remaining / self.click_length);
        self.click_remaining -= 1.;
      }
      if self.wires_level > 0. {
        let env = self.follower.process(y);
        y += self.wires_filter.process(self.noise.next()) * self.wires_level * env;
      }
      if self.noise_env > 1e-5 {
        y += self.noise_filter.process(self.noise.next()) * self.noise_env * self.noise_level;
        self.noise_env *= self.noise_coef;
      }
      if clap && self.clap_level > 0. {
        y += self.clap_sample();
      }

      self.elapsed += 1;
      y *= self.hit_level * self.core.chain.shape.process();
      mix(&mut left[i], y * gains[0]);
      mix(&mut right[i], y * gains[1]);
      let level = y.abs();
      if level > peak {
        peak = level;
      }
    }
    self.core.track(peak, end - start);
  }

  fn bristle(&mut self) -> f64 {
    let n = self.brush_pos;
    self.brush_pos += 1.;
    let env = if n < self.brush_rise {
      0.5 - 0.5 * ((PI * n) / self.brush_rise).cos()
    } else {
      self.brush_env *= self.brush_coef;
      self.brush_env
    };
    self.noise.next() * env
  }

  /// Short noise bursts, then a decaying tail (or one swelling in to its
  /// start), all through a bandpass.
  fn clap_sample(&mut self) -> f64 {
    let t = self.elapsed as f64;
    let mut env = 0.;
    for &burst in &self.bursts {
      let since = t - burst;
      if since >= 0. && since < self.burst_samples {
        env += ((-3. * since) / self.burst_samples).exp();
      }
    }
    if t >= self.tail_start {
      env += 0.6 * self.tail_coef.powf(t - self.tail_start);
    } else if self.swell > 0. {
      env += 0.3 - 0.3 * ((PI * t) / self.swell).cos();
    }
    if t > self.tail_start && env < 1e-5 {
      self.clap_level = 0.;
    }
    self.bandpass.process(self.noise.next()) * env * 2.
  }
}

/// A kit: one modal, metal or noise voice per piece, struck by name. It has
/// no vibrato and filters the whole bus itself.
pub struct DrumModel {
  patch: &'static DrumKitPatch,
  voices: Vec<DrumVoice>,
  /// Each piece's voice, by its place in PIECE_ORDER.
  by_piece: [i32; PIECE_ORDER.len()],
  filter_l: Svf,
  filter_r: Svf,
  hardness: f64,
  strength: f64,
  drop_scale: f64,
  click: f64,
  wires: f64,
  filtered: bool,
}

impl DrumModel {
  pub fn new(patch: &'static DrumKitPatch, fs: f64, mods: &ModuleSettings) -> Self {
    let mut voices = Vec::new();
    let mut by_piece = [-1; PIECE_ORDER.len()];
    for (index, piece) in PIECE_ORDER.iter().enumerate() {
      let Some(spec) = patch.pieces.get(*piece) else {
        continue;
      };
      if matches!(spec, DrumPieceSpec::Combo { .. }) {
        continue;
      }
      let seed = 9000 + index as u32 * 101;
      by_piece[index] = voices.len() as i32;
      voices.push(DrumVoice::new(spec, fs, mods, seed));
    }
    Self {
      patch,
      voices,
      by_piece,
      filter_l: Svf::new(SvfMode::Lowpass),
      filter_r: Svf::new(SvfMode::Lowpass),
      hardness: 0.6,
      strength: 1.,
      drop_scale: 1.,
      click: 1.,
      wires: 1.,
      filtered: false,
    }
  }

  pub fn voices_mut(&mut self) -> impl Iterator<Item = &mut VoiceCore> {
    self.voices.iter_mut().map(|voice| &mut voice.core)
  }

  pub fn read_params(&mut self, bus: &Bus) {
    let p = &bus.params;
    self.hardness = p.get("exciter.hardness");
    self.strength = p.get("exciter.strength");
    self.drop_scale = p.get("resonator.pitchDrop");
    self.click = p.get("exciter.click");
    self.wires = p.get("resonator.wires");
    let width = p.get("body.width");
    let cutoff = p.get("filter.cutoff");
    let q = p.get("filter.resonance");
    self.filter_l.set(cutoff, q, bus.fs);
    self.filter_r.set(cutoff, q, bus.fs);
    self.filtered = cutoff < 0.45 * bus.fs - 1.;
    let (tune, decay, position) = (
      p.get("resonator.tune"),
      p.get("resonator.decay"),
      p.get("exciter.position"),
    );
    for voice in &mut self.voices {
      voice.configure(tune, decay, position);
      let pan = voice.pan() * width;
      pan_gains(pan, &mut voice.core.chain.gains);
    }
  }

  pub fn active_voices(&self) -> usize {
    self.voices.iter().filter(|voice| voice.core.busy()).count()
  }

  /// Strikes a piece by name; a combo strikes each of its parts.
  pub fn hit(&mut self, bus: &Bus, piece: &str, velocity: f64) {
    match self.patch.pieces.get(piece) {
      Some(DrumPieceSpec::Combo { pieces, level }) => {
        for part in pieces {
          self.strike(bus, part, velocity, *level);
        }
      }
      _ => self.strike(bus, piece, velocity, 1.),
    }
  }

  fn voice(&self, piece: &str) -> Option<usize> {
    let index = self.by_piece[piece_index(piece)?];
    (index >= 0).then_some(index as usize)
  }

  fn strike(&mut self, bus: &Bus, piece: &str, velocity: f64, gain: f64) {
    let Some(index) = self.voice(piece) else {
      return;
    };
    let (hardness, strength, drop_scale, click, wires) = (
      self.hardness,
      self.strength,
      self.drop_scale,
      self.click,
      self.wires,
    );
    let voice = &mut self.voices[index];
    voice.strike(
      velocity, hardness, strength, drop_scale, click, wires, bus.clock, gain,
    );
    if let DrumPieceSpec::Metal {
      chokes: Some(chokes),
      ..
    } = voice.spec
    {
      for choked in chokes {
        if let Some(c) = self.voice(choked) {
          self.voices[c].choke();
        }
      }
    }
  }

  pub fn panic(&mut self) {
    for voice in &mut self.voices {
      voice.free();
    }
  }

  /// The kit's own filter over the bus, before the bus finishes it.
  pub fn filter(&mut self, bus: &mut Bus, n: usize) {
    if !self.filtered {
      return;
    }
    for i in 0..n {
      bus.left[i] = self.filter_l.process(bus.left[i] as f64) as f32;
      bus.right[i] = self.filter_r.process(bus.right[i] as f64) as f32;
    }
  }

  pub fn render(&mut self, bus: &mut Bus, start: usize, end: usize) {
    for voice in &mut self.voices {
      if voice.core.busy() {
        voice.render(start, end, &mut bus.left, &mut bus.right);
      }
    }
  }

  pub fn free_finished(&mut self) {
    for voice in &mut self.voices {
      if voice.core.busy() && voice.core.finished() {
        voice.free();
      }
    }
  }
}

/// Metronome click: two modes around 1.9/2.9 kHz (2.3/3.4 kHz accented),
/// T60 40 ms, on a dry utility path.
pub struct Woodblock {
  fs: f64,
  bank: ModalBank,
  pulse: Vec<f32>,
  pulse_length: usize,
  pulse_pos: usize,
  remaining: f64,
  level: f64,
}

impl Woodblock {
  pub fn new(fs: f64) -> Self {
    let mut bank = ModalBank::new(2, fs);
    bank.count = 2;
    Self {
      fs,
      bank,
      pulse: vec![0.; (0.001 * fs).ceil() as usize + 2],
      pulse_length: 0,
      pulse_pos: 0,
      remaining: 0.,
      level: 0.,
    }
  }

  pub fn active(&self) -> bool {
    self.remaining > 0.
  }

  pub fn hit(&mut self, accent: bool) {
    self
      .bank
      .set_mode(0, if accent { 2300. } else { 1900. }, 0.04, 1.);
    self
      .bank
      .set_mode(1, if accent { 3400. } else { 2900. }, 0.04, 0.6);
    self.level = if accent { 0.5 } else { 0.3 };
    self.pulse_length = stick(&mut self.pulse, 0.0003, 1., self.fs);
    self.pulse_pos = 0;
    self.remaining = js_round(0.25 * self.fs);
  }

  pub fn render(&mut self, left: &mut [f32], right: &mut [f32], start: usize, end: usize) {
    if self.remaining <= 0. {
      return;
    }
    for i in start..end {
      let mut x = 0.;
      if self.pulse_pos < self.pulse_length {
        x = self.pulse[self.pulse_pos] as f64;
        self.pulse_pos += 1;
      }
      let y = self.bank.process(x) * self.level;
      mix(&mut left[i], y);
      mix(&mut right[i], y);
    }
    self.remaining -= (end - start) as f64;
    if self.remaining <= 0. {
      self.bank.clear();
    }
  }
}
