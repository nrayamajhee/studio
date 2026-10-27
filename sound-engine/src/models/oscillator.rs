use crate::dsp::adsr::Adsr;
use crate::dsp::generators::Oscillator;
use crate::dsp::math::{fold_note, js_round, midi_to_hz, pan_gains};
use crate::engine::bus::Bus;
use crate::engine::modules::{LfoRouting, ModuleSettings};
use crate::engine::voice::{ACTIVE, RELEASED, STOLEN, Voice, VoiceCore, allocate, legato_note};
use crate::patches::OscillatorPatch;

pub const ROUTING: LfoRouting = LfoRouting {
  pitch_output: false,
  level_output: true,
  free: false,
  fade_in: None,
};

struct OscillatorVoice {
  core: VoiceCore,
  oscillator: Oscillator,
  osc2: Oscillator,
  /// Opens at full while the key is down; decay and sustain come from the
  /// track ADSR.
  gate: Adsr,
  level: f64,
  level2: f64,
}

impl Voice for OscillatorVoice {
  fn core(&self) -> &VoiceCore {
    &self.core
  }
  fn core_mut(&mut self) -> &mut VoiceCore {
    &mut self.core
  }
  fn reset(&mut self) {
    self.oscillator.reset();
    self.osc2.reset();
    self.gate.reset();
    self.core.chain.clear();
  }
}

impl OscillatorVoice {
  fn render(
    &mut self,
    start: usize,
    end: usize,
    left: &mut [f32],
    right: &mut [f32],
    mods: &ModuleSettings,
  ) {
    self.core.chain.begin(mods);
    let pitch = mods.pitch;
    let vibrato = mods.lfo_on();
    for i in start..end {
      // The vibrato bends both oscillators; level and filter are the output's.
      let bend = if vibrato {
        1. + pitch * self.core.chain.modulate()
      } else {
        1.
      };
      let x = self.level * (self.oscillator.process(bend) + self.level2 * self.osc2.process(bend));
      let gain = self.gate.process();
      self.core.chain.emit(x, gain, i, left, right, mods);
    }
    self.core.end_block(end - start);
  }
}

/// One or two polyphonic oscillators (sine, triangle, square or saw) summed
/// through the filter and a gate: a plain source for the modules and the
/// track ADSR to shape.
pub struct OscillatorModel {
  patch: &'static OscillatorPatch,
  voices: Vec<OscillatorVoice>,
  by_note: [i32; 128],
}

impl OscillatorModel {
  pub fn new(patch: &'static OscillatorPatch, fs: f64, mods: &ModuleSettings) -> Self {
    Self {
      patch,
      voices: (0..patch.polyphony + 2)
        .map(|_| OscillatorVoice {
          core: VoiceCore::new(fs, mods),
          oscillator: Oscillator::new(fs),
          osc2: Oscillator::new(fs),
          gate: Adsr::new(fs),
          level: 0.,
          level2: 0.,
        })
        .collect(),
      by_note: [-1; 128],
    }
  }

  pub fn voices_mut(&mut self) -> impl Iterator<Item = &mut VoiceCore> {
    self.voices.iter_mut().map(|voice| &mut voice.core)
  }

  pub fn read_params(&mut self, bus: &Bus) {
    let p = &bus.params;
    let wave = js_round(p.get("exciter.wave")) as i32;
    let wave2 = js_round(p.get("exciter.wave2")) as i32;
    let level2 = if wave2 > 0 {
      p.get("exciter.level2")
    } else {
      0.
    };
    let phase = p.get("exciter.phase") / 360.;
    let attack = p.get("envelope.attack");
    let release = p.get("envelope.release");
    let glide = 1. - (-3. / (p.get("exciter.glide") * bus.fs)).exp();
    for voice in &mut self.voices {
      voice.oscillator.wave = wave;
      voice.oscillator.glide = glide;
      voice.osc2.wave = (wave2 - 1).max(0);
      voice.osc2.glide = glide;
      voice.osc2.phase_offset = phase;
      voice.level2 = level2;
      voice.gate.set(attack, 0., 1., release, true);
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
        Self::gate_on(voice, velocity);
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
    self.by_note[n as usize] = idle as i32;
    let voice = &mut self.voices[idle];
    voice.reset();
    voice.core.begin(n, bus.clock);
    voice.core.chain.onset(n, bus.clock, &bus.mods);
    let hz = midi_to_hz(n as f64);
    let start = if from >= 0 {
      midi_to_hz(from as f64)
    } else {
      hz
    };
    voice.oscillator.set_frequency(hz, start);
    voice.osc2.set_frequency(hz, start);
    pan_gains(self.patch.base.pan.center, &mut voice.core.chain.gains);
    Self::gate_on(voice, velocity);
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
    Self::gate_off(voice);
  }

  pub fn all_notes_off(&mut self) {
    for voice in &mut self.voices {
      if voice.core.busy() && voice.core.state != STOLEN {
        voice.core.holds = 0;
        Self::gate_off(voice);
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

  fn gate_on(voice: &mut OscillatorVoice, velocity: f64) {
    voice.level = velocity;
    voice.gate.note_on();
    voice.core.chain.shape.note_on();
  }

  fn gate_off(voice: &mut OscillatorVoice) {
    voice.core.state = RELEASED;
    voice.gate.note_off();
    voice.core.chain.shape.note_off();
  }
}
