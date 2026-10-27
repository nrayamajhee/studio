use super::exciters::stick;
use crate::dsp::math::{fold_note, key_table, lerp, midi_to_hz, pan_gains};
use crate::dsp::modal::ModalBank;
use crate::engine::bus::Bus;
use crate::engine::modules::ModuleSettings;
use crate::engine::voice::{ACTIVE, RELEASED, STOLEN, Voice, VoiceCore, allocate};
use crate::patches::BarPatch;

const MAX_MODES: usize = 8;
/// A hard hit stays on for less time than a soft one at the same hardness.
const VELOCITY_CONTACT: f64 = 0.3;

struct BarVoice {
  core: VoiceCore,
  modes: ModalBank,
  excitation: Vec<f32>,
  excitation_length: usize,
  excitation_pos: usize,
}

impl Voice for BarVoice {
  fn core(&self) -> &VoiceCore {
    &self.core
  }
  fn core_mut(&mut self) -> &mut VoiceCore {
    &mut self.core
  }
  fn reset(&mut self) {
    self.modes.clear();
    self.core.chain.clear();
    self.excitation_length = 0;
    self.excitation_pos = 0;
  }
}

impl BarVoice {
  fn new(fs: f64, mods: &ModuleSettings, longest_contact: f64) -> Self {
    Self {
      core: VoiceCore::new(fs, mods),
      modes: ModalBank::new(MAX_MODES, fs),
      excitation: vec![0.; (longest_contact * fs).ceil() as usize + 1],
      excitation_length: 0,
      excitation_pos: 0,
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
    for i in start..end {
      let mut e = 0.;
      if self.excitation_pos < self.excitation_length {
        e = self.excitation[self.excitation_pos] as f64;
        self.excitation_pos += 1;
      }
      let x = self.modes.process(e);
      self.core.chain.emit(x, 1., i, left, right, mods);
    }
    self.core.end_block(end - start);
  }
}

/// Xylophone, steel pan and kalimba: each key a bank of modes at the
/// patch's ratios to the note (a bar's, a pan dome's, a tine's), struck by a
/// mallet or plucked by a thumb. The strike is a half-sine pulse; the
/// shorter it is (a harder mallet, a harder hit), the higher the modes it
/// reaches. Tuning is exact, since each mode is a resonator at its own
/// frequency. There are no dampers: a note rings until it fades, and
/// striking it again while it rings adds to what is already sounding.
pub struct BarModel {
  patch: &'static BarPatch,
  voices: Vec<BarVoice>,
  by_note: [i32; 128],
  hardness: f64,
  strength: f64,
  decay: f64,
  brightness: f64,
}

impl BarModel {
  pub fn new(patch: &'static BarPatch, fs: f64, mods: &ModuleSettings) -> Self {
    let longest = (patch.contact.0 / 1000.) * (1. + VELOCITY_CONTACT);
    Self {
      patch,
      voices: (0..patch.polyphony + 2)
        .map(|_| BarVoice::new(fs, mods, longest))
        .collect(),
      by_note: [-1; 128],
      hardness: 0.5,
      strength: 0.8,
      decay: 1.,
      brightness: 0.,
    }
  }

  pub fn voices_mut(&mut self) -> impl Iterator<Item = &mut VoiceCore> {
    self.voices.iter_mut().map(|voice| &mut voice.core)
  }

  pub fn read_params(&mut self, bus: &Bus) {
    let p = &bus.params;
    self.hardness = p.get("exciter.hardness");
    self.strength = p.get("exciter.strength");
    self.decay = p.get("resonator.decay");
    self.brightness = p.get("resonator.brightness");
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
        voice.core.quiet_samples = 0.;
        self.strike(bus, existing as usize, velocity);
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
    pan_gains(pan, &mut voice.core.chain.gains);
    self.strike(bus, idle, velocity);
  }

  /// Nothing damps the note; it rings on, under the master ADSR's release.
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
    voice.core.chain.shape.note_off();
  }

  pub fn all_notes_off(&mut self) {
    for voice in &mut self.voices {
      if voice.core.busy() && voice.core.state != STOLEN {
        voice.core.holds = 0;
        voice.core.state = RELEASED;
        voice.core.chain.shape.note_off();
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

  /// Sets the note's modes: each at its ratio, its level tilted by the
  /// Brightness param (±6 dB an octave of ratio), and its T60 scaled for the
  /// key. Modes above 0.45·fs are left silent by the bank.
  fn tune(&mut self, index: usize, n: i32) {
    let patch = self.patch;
    let f0 = midi_to_hz(n as f64);
    let scale = key_table(&patch.decay, n as f64) * self.decay;
    let count = MAX_MODES.min(patch.modes.len());
    let brightness = self.brightness;
    let voice = &mut self.voices[index];
    voice.modes.count = count;
    for (m, &(ratio, level, t60)) in patch.modes.iter().take(count).enumerate() {
      voice
        .modes
        .set_mode(m, f0 * ratio, t60 * scale, level * ratio.powf(brightness));
    }
  }

  fn strike(&mut self, bus: &Bus, index: usize, velocity: f64) {
    let (soft, hard) = self.patch.contact;
    let contact =
      (lerp(soft, hard, self.hardness) / 1000.) * (1. + VELOCITY_CONTACT * (0.5 - velocity));
    let gain = velocity.powf(1.5 * self.strength);
    let voice = &mut self.voices[index];
    voice.excitation_length = stick(&mut voice.excitation, contact, gain, bus.fs);
    voice.excitation_pos = 0;
    voice.core.chain.retrigger();
    voice.core.chain.shape.note_on();
  }
}
