use crate::dsp::adsr::{Adsr, AdsrStages};
use crate::dsp::filters::{DcBlocker, OnePoleHighpass};
use crate::dsp::generators::Noise;
use crate::dsp::math::{KeyTable, TWO_PI, fold_note, key_table, lerp, midi_to_hz, pan_gains};
use crate::engine::bus::Bus;
use crate::engine::modules::{LfoRouting, ModuleSettings};
use crate::engine::voice::{ACTIVE, RELEASED, STOLEN, Voice, VoiceCore, allocate};
use crate::patches::{ReedPatch, pick_tuning};

const MAX_REEDS: usize = 2;
/// The reed swings through its slot freely while it is within this much of
/// rest; past it the air rushes round the tip. The Brightness param moves it.
const SLOT: f64 = 0.25;
const SLOT_RANGE: f64 = 0.15;
/// The gap around the tongue inside the slot, and how rounded the slot's
/// edges are (sharp edges alias on high notes).
const CLEARANCE: f64 = 0.02;
const EDGE: f64 = 0.05;
/// The pressure step bends the reed before it starts to swing.
const PUSH: f64 = 0.15;
const C4_HZ: f64 = 261.63;
/// Radiated sound is the flow's slope, which rises 6 dB an octave; most of
/// that is taken back so the range sits level.
const LEVEL_TILT: f64 = 0.85;
/// That slope is small next to the other models' outputs; this brings a
/// reed near them so patch gains sit around 1.
const RADIATION_GAIN: f64 = 15.;
const NOISE_HIGHPASS: f64 = 1500.;
/// Turbulence rides on the flow itself, not on its much smaller slope, so it
/// is scaled down to sit under the tone (the Air noise param scales it
/// again).
const NOISE_LEVEL: f64 = 0.4;

pub const ROUTING: LfoRouting = LfoRouting {
  pitch_output: true,
  level_output: false,
  free: true,
  fade_in: None,
};

/// A rounded max(0, z).
fn opening(z: f64) -> f64 {
  0.5 * (z + (z * z + EDGE * EDGE).sqrt())
}

struct ReedVoice {
  core: VoiceCore,
  /// Each reed: resonator coefficients, swing feedback, level and state.
  c1: [f64; MAX_REEDS],
  c2: [f64; MAX_REEDS],
  feed: [f64; MAX_REEDS],
  level: [f64; MAX_REEDS],
  y1: [f64; MAX_REEDS],
  y2: [f64; MAX_REEDS],
  breath: Adsr,
  noise: Noise,
  noise_filter: OnePoleHighpass,
  dc: DcBlocker,
  reeds: usize,
  drive: f64,
  slot: f64,
  asymmetry: f64,
  noise_gain: f64,
  output_scale: f64,
  flow: f64,
}

impl Voice for ReedVoice {
  fn core(&self) -> &VoiceCore {
    &self.core
  }
  fn core_mut(&mut self) -> &mut VoiceCore {
    &mut self.core
  }
  fn reset(&mut self) {
    self.y1 = [0.; MAX_REEDS];
    self.y2 = [0.; MAX_REEDS];
    self.breath.reset();
    self.dc.clear();
    self.core.chain.clear();
    self.flow = 0.;
  }
}

impl ReedVoice {
  fn new(fs: f64, mods: &ModuleSettings, seed: u32) -> Self {
    let mut noise_filter = OnePoleHighpass::default();
    noise_filter.set_cutoff(NOISE_HIGHPASS, fs);
    Self {
      core: VoiceCore::new(fs, mods),
      c1: [0.; MAX_REEDS],
      c2: [0.; MAX_REEDS],
      feed: [0.; MAX_REEDS],
      level: [0.; MAX_REEDS],
      y1: [0.; MAX_REEDS],
      y2: [0.; MAX_REEDS],
      breath: Adsr::new(fs),
      noise: Noise::new(seed),
      noise_filter,
      dc: DcBlocker::new(fs),
      reeds: 1,
      drive: 2.,
      slot: SLOT,
      asymmetry: 0.,
      noise_gain: 0.,
      output_scale: 1.,
      flow: 0.,
    }
  }

  /// Tunes reed `r` to `hz`. Its swing dies away over `settle` seconds
  /// unless the drive feeds it: a van der Pol oscillator,
  /// x'' − (2/τ)(D − 1 − 4Dx²)x' + ω²x = 0, which grows once D > 1 and
  /// settles at an amplitude of √((D − 1)/D).
  fn tune_reed(&mut self, r: usize, hz: f64, settle: f64) {
    let fs = self.core.fs;
    let radius = (-1. / (settle * fs)).exp();
    self.c1[r] = 2. * radius * ((TWO_PI * hz) / fs).cos();
    self.c2[r] = radius * radius;
    self.feed[r] = 2. / (settle * fs);
  }

  fn push(&mut self) {
    for r in 0..self.reeds {
      self.y1[r] = PUSH;
      self.y2[r] = PUSH;
    }
  }

  fn render(
    &mut self,
    start: usize,
    end: usize,
    left: &mut [f32],
    right: &mut [f32],
    mods: &ModuleSettings,
  ) {
    self.core.chain.begin(mods);
    let swell = mods.level;
    for i in start..end {
      // The LFO is the swell: bellows or a hand moving the pressure.
      let pressure = self.breath.process() * (1. + swell * self.core.chain.modulate());
      let drive = self.drive * pressure;
      // Air through the slot follows the opening and √pressure (Bernoulli).
      let mut open = 0.;
      for r in 0..self.reeds {
        let x1 = self.y1[r];
        let x = self.c1[r] * x1 - self.c2[r] * self.y2[r]
          + self.feed[r] * drive * (1. - 4. * x1 * x1) * (x1 - self.y2[r]);
        self.y2[r] = x1;
        self.y1[r] = x;
        open += self.level[r]
          * (CLEARANCE + opening(x - self.slot) + (1. - self.asymmetry) * opening(-x - self.slot));
      }
      let flow = open * (if pressure > 0. { pressure } else { 0. }).sqrt();
      let mut out = RADIATION_GAIN * (flow - self.flow);
      self.flow = flow;
      out += NOISE_LEVEL * self.noise_gain * flow * self.noise_filter.process(self.noise.next());

      let x = self.dc.process(out);
      self
        .core
        .chain
        .emit(x, self.output_scale, i, left, right, mods);
    }
    self.core.end_block(end - start);
  }
}

/// Harmonium and harmonica: free reeds, each a tongue swinging through a
/// slot. A reed is a self-oscillating resonator (van der Pol) tuned to the
/// note and fed by the pressure; the air it lets past is a pulse each swing,
/// and the sound is that flow's slope, so harder blowing swings the reed
/// further out of the slot and brightens it. A key can sound two reeds, the
/// second a few cents sharp. The LFO is a shared swell (bellows or hand
/// tremolo): one free-running cycle moves the pressure of every voice.
pub struct ReedModel {
  patch: &'static ReedPatch,
  tuning: KeyTable,
  voices: Vec<ReedVoice>,
  by_note: [i32; 128],
  pressure: f64,
  celeste: f64,
  noise_level: f64,
  slot: f64,
  envelope: AdsrStages,
}

impl ReedModel {
  pub fn new(patch: &'static ReedPatch, fs: f64, mods: &ModuleSettings) -> Self {
    Self {
      patch,
      tuning: pick_tuning(&patch.tuning_cents, fs),
      voices: (0..patch.polyphony + 2)
        .map(|v| ReedVoice::new(fs, mods, 3000 + v as u32 * 97))
        .collect(),
      by_note: [-1; 128],
      pressure: 1.,
      celeste: 1.,
      noise_level: 1.,
      slot: SLOT,
      envelope: AdsrStages {
        attack: 0.05,
        decay: 0.1,
        sustain: 0.9,
        release: 0.08,
      },
    }
  }

  pub fn voices_mut(&mut self) -> impl Iterator<Item = &mut VoiceCore> {
    self.voices.iter_mut().map(|voice| &mut voice.core)
  }

  pub fn read_params(&mut self, bus: &Bus) {
    let p = &bus.params;
    self.pressure = p.get("exciter.pressure");
    self.noise_level = p.get("exciter.noise");
    self.celeste = p.get("resonator.detune");
    self.slot = SLOT + SLOT_RANGE * p.get("resonator.brightness");
    self.envelope = p.envelope("envelope");
    for i in 0..self.voices.len() {
      let voice = &mut self.voices[i];
      voice.slot = self.slot;
      voice.noise_gain = self.noise_level;
      voice.breath.set_release(self.envelope.release);
      if voice.core.busy() {
        let note = voice.core.note;
        self.tune(i, note);
      }
    }
  }

  pub fn active_voices(&self) -> usize {
    self.voices.iter().filter(|voice| voice.core.busy()).count()
  }

  pub fn note_on(&mut self, bus: &Bus, note: i32, velocity: f64) {
    let n = fold_note(note, self.patch.base.range.0, self.patch.base.range.1);
    let existing = self.by_note[n as usize];
    if existing >= 0 {
      let voice = &mut self.voices[existing as usize];
      if voice.core.busy() && voice.core.state != STOLEN {
        voice.core.holds += 1;
        voice.core.state = ACTIVE;
        self.blow(existing as usize, velocity);
        return;
      }
    }
    let (idle, forgotten) = allocate(&mut self.voices, self.patch.polyphony);
    if let Some(note) = forgotten
      && note >= 0
      && self.by_note[note as usize] >= 0
    {
      self.by_note[note as usize] = -1;
    }
    let Some(idle) = idle else {
      return;
    };
    let voice = &mut self.voices[idle];
    voice.reset();
    voice.core.begin(n, bus.clock);
    self.by_note[n as usize] = idle as i32;
    self.tune(idle, n);
    let (low, high) = self.patch.base.range;
    let pan = self.patch.base.pan.center
      + self.patch.base.pan.spread * ((2. * (n - low) as f64) / (high - low) as f64 - 1.);
    let voice = &mut self.voices[idle];
    voice.core.chain.onset(n, bus.clock, &bus.mods);
    voice.push();
    pan_gains(pan, &mut voice.core.chain.gains);
    self.blow(idle, velocity);
  }

  pub fn note_off(&mut self, note: i32) {
    let n = fold_note(note, self.patch.base.range.0, self.patch.base.range.1);
    let index = self.by_note[n as usize];
    if index < 0 {
      return;
    }
    let voice = &mut self.voices[index as usize];
    if voice.core.holds == 0 {
      return;
    }
    voice.core.holds -= 1;
    if voice.core.holds > 0 {
      return;
    }
    Self::stop_blowing(voice);
  }

  pub fn all_notes_off(&mut self) {
    for voice in &mut self.voices {
      if voice.core.busy() && voice.core.state != STOLEN {
        voice.core.holds = 0;
        Self::stop_blowing(voice);
      }
    }
  }

  pub fn panic(&mut self) {
    for voice in &mut self.voices {
      voice.free();
    }
    self.by_note = [-1; 128];
  }

  pub fn render(&mut self, bus: &mut Bus, start: usize, end: usize) {
    for voice in &mut self.voices {
      if voice.core.busy() {
        voice.render(start, end, &mut bus.left, &mut bus.right, &bus.mods);
      }
    }
  }

  pub fn free_finished(&mut self) {
    for (i, voice) in self.voices.iter_mut().enumerate() {
      if voice.core.busy() && voice.core.finished() {
        let note = voice.core.note;
        if note >= 0 && self.by_note[note as usize] == i as i32 {
          self.by_note[note as usize] = -1;
        }
        voice.free();
      }
    }
  }

  fn tune(&mut self, index: usize, n: i32) {
    let patch = self.patch;
    let f0 = midi_to_hz(n as f64) * 2f64.powf(key_table(&self.tuning, n as f64) / 1200.);
    let settle = key_table(&patch.settle, n as f64);
    let celeste = self.celeste;
    let voice = &mut self.voices[index];
    voice.reeds = MAX_REEDS.min(patch.reeds.len());
    for r in 0..voice.reeds {
      let (cents, level) = patch.reeds[r];
      voice.tune_reed(r, f0 * 2f64.powf((cents * celeste) / 1200.), settle);
      voice.level[r] = level;
    }
    voice.asymmetry = patch.asymmetry;
    voice.output_scale = (C4_HZ / f0).powf(LEVEL_TILT);
  }

  fn blow(&mut self, index: usize, velocity: f64) {
    let (low, high) = self.patch.pressure;
    let voice = &mut self.voices[index];
    voice.drive = (lerp(low, high, velocity) * self.pressure) / self.envelope.sustain.max(0.05);
    voice.breath.set_stages(self.envelope);
    voice.breath.note_on();
    voice.core.chain.shape.note_on();
  }

  fn stop_blowing(voice: &mut ReedVoice) {
    voice.core.state = RELEASED;
    voice.breath.note_off();
    voice.core.chain.shape.note_off();
  }
}
