//! Bowed string ported from STK (The Synthesis ToolKit, Perry Cook & Gary
//! Scavone, MIT-style license): src/Bowed.cpp, include/BowTable.h, with the
//! violin body filter by Esteban Maestre.

use super::waveguide::Waveguide;
use crate::dsp::adsr::{Adsr, AdsrStages};
use crate::dsp::filters::{Biquad, OnePoleLowpass, rescale_quadratic};
use crate::dsp::math::{KeyTable, TWO_PI, fold_note, key_table, midi_to_hz, pan_gains};
use crate::dsp::nonlinear::bow_table;
use crate::dsp::phase_delay::one_pole_phase_delay;
use crate::engine::bus::Bus;
use crate::engine::modules::{LfoRouting, ModuleSettings};
use crate::engine::voice::{ACTIVE, RELEASED, STOLEN, Voice, VoiceCore, allocate, legato_note};
use crate::patches::{BowedPatch, pick_tuning};

/// The sample rate STK's body filter was designed at; the sections are rescaled
/// from it to the engine's.
pub const STK_RATE: f64 = 44100.;
/// Body sections as (b0, b1, b2, a1, a2), designed at 44.1 kHz.
pub const BODY_SECTIONS: [[f64; 5]; 6] = [
  [1.0, 1.5667, 0.3133, -0.5509, -0.3925],
  [1.0, -1.9537, 0.9542, -1.6357, 0.8697],
  [1.0, -1.6683, 0.8852, -1.7674, 0.8735],
  [1.0, -1.8585, 0.9653, -1.8498, 0.9516],
  [1.0, -1.9299, 0.9621, -1.9354, 0.959],
  [1.0, -1.98, 0.9888, -1.9867, 0.9923],
];
/// The body filter's output gain, as STK has.
const BODY_GAIN: f64 = 0.1248;
/// The bow table's offset, as STK has.
const BOW_OFFSET: f64 = 0.001;
/// The loss of the string's reflection at the bridge.
const STRING_FILTER_GAIN: f64 = 0.95;

/// The violin takes the vibrato itself, on the string's length and the bow's
/// speed, ramping it in over 0.4 s.
pub const ROUTING: LfoRouting = LfoRouting {
  pitch_output: false,
  level_output: false,
  free: false,
  fade_in: Some(0.4),
};

/// One bowed string: the neck and bridge waveguides either side of the bow, the
/// string's loss filter, the violin body, and the bow's envelope.
struct BowedVoice {
  core: VoiceCore,
  neck: Waveguide,
  bridge: Waveguide,
  string_filter: OnePoleLowpass,
  body: Vec<Biquad>,
  bow: Adsr,
  base_delay: f64,
  /// The loop length a legato note glides to, at `glide` per sample.
  delay_target: f64,
  glide: f64,
  beta: f64,
  max_velocity: f64,
  slope: f64,
  body_mix: f64,
}

impl Voice for BowedVoice {
  fn core(&self) -> &VoiceCore {
    &self.core
  }
  fn core_mut(&mut self) -> &mut VoiceCore {
    &mut self.core
  }
  fn reset(&mut self) {
    self.neck.clear();
    self.bridge.clear();
    self.string_filter.clear();
    for section in &mut self.body {
      section.clear();
    }
    self.core.chain.clear();
    self.bow.reset();
  }
}

impl BowedVoice {
  /// An idle voice whose waveguides fit the lowest note, `lowest_hz`, with the
  /// body's sections rescaled to `fs`.
  fn new(fs: f64, mods: &ModuleSettings, lowest_hz: f64) -> Self {
    let longest = fs / lowest_hz + 8.;
    let mut string_filter = OnePoleLowpass::default();
    string_filter.set_pole(0.75 - (0.2 * 22050.) / fs);
    let body = BODY_SECTIONS
      .iter()
      .map(|&[b0, b1, b2, a1, a2]| {
        let mut section = Biquad::default();
        let (zb1, zb2) = rescale_quadratic(b1 / b0, b2 / b0, STK_RATE, fs);
        let (pa1, pa2) = rescale_quadratic(a1, a2, STK_RATE, fs);
        section.set(b0, zb1 * b0, zb2 * b0, pa1, pa2);
        section
      })
      .collect();
    Self {
      core: VoiceCore::new(fs, mods),
      neck: Waveguide::new(longest),
      bridge: Waveguide::new(longest),
      string_filter,
      body,
      bow: Adsr::new(fs),
      base_delay: 100.,
      delay_target: 100.,
      glide: 1.,
      beta: 0.127236,
      max_velocity: 0.2,
      slope: 3.,
      body_mix: 1.,
    }
  }

  /// Renders the frames `start..end`: the loop length glides toward its target,
  /// the bow (swayed by the vibrato) meets the two waves through the bow table,
  /// and the bridge's wave runs through the body and the chain.
  fn render(
    &mut self,
    start: usize,
    end: usize,
    left: &mut [f32],
    right: &mut [f32],
    mods: &ModuleSettings,
  ) {
    self.core.chain.begin(mods);
    let (pitch, level) = (mods.pitch, mods.level);
    for i in start..end {
      if self.base_delay != self.delay_target {
        self.base_delay += (self.delay_target - self.base_delay) * self.glide;
        if (self.delay_target - self.base_delay).abs() < 1e-6 {
          self.base_delay = self.delay_target;
        }
      }
      // The LFO bends the string's length (vibrato) and sways the bow.
      let vib = self.core.chain.modulate();
      let bow_velocity = self.max_velocity * self.bow.process() * (1. + level * vib);
      let bridge_reflection = -STRING_FILTER_GAIN * self.string_filter.process(self.bridge.last);
      let nut_reflection = -self.neck.last;
      let delta_v = bow_velocity - (bridge_reflection + nut_reflection);
      let new_velocity = delta_v * bow_table(delta_v, BOW_OFFSET, self.slope);
      self.neck.tick(
        bridge_reflection + new_velocity,
        self.base_delay * (1. - self.beta) + self.base_delay * pitch * vib,
      );
      self
        .bridge
        .tick(nut_reflection + new_velocity, self.base_delay * self.beta);

      let mut x = self.bridge.last;
      let mut wet = x;
      for section in &mut self.body {
        wet = section.process(wet);
      }
      x = BODY_GAIN * (x + self.body_mix * (wet - x));
      self.core.chain.emit(x, 1., i, left, right, mods);
    }
    self.core.end_block(end - start);
  }
}

/// Violin: up to four bowed strings at once (double stops and chords).
pub struct BowedModel {
  patch: &'static BowedPatch,
  tuning: KeyTable,
  voices: Vec<BowedVoice>,
  by_note: [i32; 128],
  pressure: f64,
  position: f64,
  speed: f64,
  glide: f64,
  envelope: AdsrStages,
  body_mix: f64,
}

impl BowedModel {
  /// The model for `patch` at `fs`, with two voices to spare over its polyphony
  /// for steals to fade, and its tuning table picked for `fs`.
  pub fn new(patch: &'static BowedPatch, fs: f64, mods: &ModuleSettings) -> Self {
    let lowest_hz = midi_to_hz(patch.base.range.0 as f64);
    Self {
      patch,
      tuning: pick_tuning(&patch.tuning_cents, fs),
      voices: (0..patch.polyphony + 2)
        .map(|_| BowedVoice::new(fs, mods, lowest_hz))
        .collect(),
      by_note: [-1; 128],
      pressure: 0.5,
      position: 0.127,
      speed: 1.,
      glide: 1.,
      envelope: AdsrStages {
        attack: 0.05,
        decay: 0.1,
        sustain: 0.9,
        release: 0.1,
      },
      body_mix: 1.,
    }
  }

  /// Every voice's shared core, for the instrument to retarget.
  pub fn voices_mut(&mut self) -> impl Iterator<Item = &mut VoiceCore> {
    self.voices.iter_mut().map(|voice| &mut voice.core)
  }

  /// Reads the bow's pressure, position and speed, the portamento, the bow
  /// envelope and the body's mix from the params, into every voice.
  pub fn read_params(&mut self, bus: &Bus) {
    let p = &bus.params;
    self.pressure = p.get("exciter.pressure");
    self.position = p.get("exciter.position");
    self.speed = p.get("exciter.speed");
    self.glide = 1. - (-3. / (p.get("resonator.portamento") * bus.fs)).exp();
    self.envelope = p.envelope("envelope");
    self.body_mix = p.get_or("body.violin", 0.);
    for voice in &mut self.voices {
      // STK controlChange: bow pressure maps to the friction slope 5 → 1.
      voice.slope = 5. - 4. * self.pressure;
      voice.beta = self.position;
      voice.glide = self.glide;
      voice.body_mix = self.body_mix;
      voice.bow.set_release(self.envelope.release);
    }
  }

  /// How many voices are sounding.
  pub fn active_voices(&self) -> usize {
    self.voices.iter().filter(|voice| voice.core.busy()).count()
  }

  /// Bows `note` (folded into the patch's range): again if it's still sounding,
  /// else on a free voice, gliding from the note it follows when played legato.
  pub fn note_on(&mut self, bus: &Bus, note: i32, velocity: f64) {
    let n = fold_note(note, self.patch.base.range.0, self.patch.base.range.1);
    let existing = self.by_note[n as usize];
    if existing >= 0 {
      let voice = &mut self.voices[existing as usize];
      if voice.core.busy() && voice.core.state != STOLEN {
        voice.core.holds += 1;
        voice.core.state = ACTIVE;
        self.bow_on(existing as usize, velocity);
        return;
      }
    }
    let from = legato_note(&self.voices, bus.clock, bus.fs);
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
    self.tune(bus, idle, n, from);
    self.bow_on(idle, velocity);
    self.voices[idle].core.chain.onset(n, bus.clock, &bus.mods);
  }

  /// Lifts the bow from `note` once every press of it is let go.
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
    voice.core.state = RELEASED;
    voice.bow.note_off();
    voice.core.chain.shape.note_off();
  }

  /// Lifts the bow from every string.
  pub fn all_notes_off(&mut self) {
    for voice in &mut self.voices {
      if voice.core.busy() && voice.core.state != STOLEN {
        voice.core.holds = 0;
        voice.core.state = RELEASED;
        voice.bow.note_off();
        voice.core.chain.shape.note_off();
      }
    }
  }

  /// Frees every voice at once.
  pub fn panic(&mut self) {
    for voice in &mut self.voices {
      voice.free();
    }
    self.by_note = [-1; 128];
  }

  /// Renders the sounding voices into the bus for the frames `start..end`.
  pub fn render(&mut self, bus: &mut Bus, start: usize, end: usize) {
    for voice in &mut self.voices {
      if voice.core.busy() {
        voice.render(start, end, &mut bus.left, &mut bus.right, &bus.mods);
      }
    }
  }

  /// Frees the voices that fell silent, forgetting their notes.
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

  /// Starts the bow on the voice at a speed set by the velocity and the speed
  /// param.
  fn bow_on(&mut self, index: usize, velocity: f64) {
    let voice = &mut self.voices[index];
    // STK: maxVelocity = 0.03 + 0.2·amplitude.
    voice.max_velocity = (0.03 + 0.2 * velocity) * self.speed;
    voice.bow.set_stages(self.envelope);
    voice.bow.note_on();
    voice.core.chain.shape.note_on();
  }

  /// Round trip = neck + bridge + 2 ("lastOut" samples) + τ_string filter.
  fn loop_delay(&self, bus: &Bus, index: usize, n: i32) -> f64 {
    let f0 = midi_to_hz(n as f64) * 2f64.powf(key_table(&self.tuning, n as f64) / 1200.);
    let w = (TWO_PI * f0) / bus.fs;
    (bus.fs / f0 - 2. - one_pole_phase_delay(self.voices[index].string_filter.p, w)).max(2.)
  }

  /// A legato note starts at the length of the one it follows and glides.
  fn tune(&mut self, bus: &Bus, index: usize, n: i32, from: i32) {
    let target = self.loop_delay(bus, index, n);
    let base = if from >= 0 {
      self.loop_delay(bus, index, from)
    } else {
      target
    };
    let (low, high) = self.patch.base.range;
    let pan = self.patch.base.pan.center
      + self.patch.base.pan.spread * ((2. * (n - low) as f64) / (high - low) as f64 - 1.);
    let voice = &mut self.voices[index];
    voice.delay_target = target;
    voice.base_delay = base;
    pan_gains(pan, &mut voice.core.chain.gains);
  }
}
