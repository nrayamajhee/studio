//! The string model: piano, guitar and basses, each note one to three
//! single-delay-loop strings, struck by a hammer or plucked.

use super::exciters::{HammerOptions, PluckOptions, hammer, pluck};
use super::string_loop::StringLoop;
use crate::dsp::adsr::Adsr;
use crate::dsp::filters::DcBlocker;
use crate::dsp::generators::Noise;
use crate::dsp::math::{clamp, fold_note, js_round, key_table, midi_to_hz, pan_gains};
use crate::engine::bus::Bus;
use crate::engine::modules::ModuleSettings;
use crate::engine::voice::{ACTIVE, IDLE, RELEASED, STOLEN, Voice, VoiceCore, pick_victim};
use crate::patches::StringPatch;

/// How long (s) a guitar string is damped before it's re-fretted and plucked
/// again.
const REFRET_SECONDS: f64 = 0.008;
/// Notes starting within 15 ms of each other are a chord's, spread out by the
/// Strum param.
const STRUM_WINDOW: f64 = 0.015;
/// The most unison strings a piano key has.
const MAX_UNISON: usize = 3;

/// One string (a guitar's) or one key's strings (a piano's): its loops, the
/// pulse that excites them, the pickup's comb, the damper's deferral under the
/// pedal, and a note waiting for a re-fret or strum delay to run out.
pub struct StringVoice {
  core: VoiceCore,
  loops: Vec<StringLoop>,
  split: [f64; MAX_UNISON],
  excitation: Vec<f32>,
  noise: Noise,
  dc: DcBlocker,
  amp: Adsr,
  loop_count: usize,
  excitation_length: usize,
  excitation_pos: usize,
  pickup_tap: usize,
  deferred: bool,
  countdown: i64,
  pending_note: i32,
  pending_velocity: f64,
}

impl Voice for StringVoice {
  fn core(&self) -> &VoiceCore {
    &self.core
  }
  fn core_mut(&mut self) -> &mut VoiceCore {
    &mut self.core
  }
  fn reset(&mut self) {
    for string in &mut self.loops {
      string.clear();
    }
    self.dc.clear();
    self.core.chain.clear();
    self.amp.reset();
    self.excitation_length = 0;
    self.excitation_pos = 0;
    self.deferred = false;
    self.countdown = 0;
    self.pending_note = -1;
  }
}

impl StringVoice {
  /// An idle voice of `loops` strings that fit the lowest note, `lowest_hz`,
  /// with room for an excitation of `excitation_size` samples, its pick noise
  /// seeded by `seed`.
  fn new(
    fs: f64,
    mods: &ModuleSettings,
    lowest_hz: f64,
    loops: usize,
    excitation_size: usize,
    seed: u32,
  ) -> Self {
    Self {
      core: VoiceCore::new(fs, mods),
      loops: (0..loops).map(|_| StringLoop::new(fs, lowest_hz)).collect(),
      split: [0.; MAX_UNISON],
      excitation: vec![0.; excitation_size],
      noise: Noise::new(seed),
      dc: DcBlocker::new(fs),
      amp: Adsr::new(fs),
      loop_count: 1,
      excitation_length: 0,
      excitation_pos: 0,
      pickup_tap: 0,
      deferred: false,
      countdown: 0,
      pending_note: -1,
      pending_velocity: 0.,
    }
  }

  /// Renders from `from` to `end`, stopping at the sample where a re-fret or
  /// strum delay runs out (returned), so the instrument can launch the note
  /// and carry on from there.
  fn render(
    &mut self,
    from: usize,
    end: usize,
    left: &mut [f32],
    right: &mut [f32],
    mods: &ModuleSettings,
  ) -> Option<usize> {
    for i in from..end {
      if self.countdown > 0 {
        self.countdown -= 1;
        if self.countdown == 0 {
          return Some(i);
        }
      }
      let mut e = 0.;
      if self.excitation_pos < self.excitation_length {
        e = self.excitation[self.excitation_pos] as f64;
        self.excitation_pos += 1;
      }
      let mut y = 0.;
      for s in 0..self.loop_count {
        y += self.loops[s].tick(e * self.split[s]);
      }
      if self.pickup_tap > 0 {
        y -= self.loops[0].delay.read_int(self.pickup_tap);
      }
      let x = self.dc.process(y);
      let gain = self.amp.process();
      self.core.chain.emit(x, gain, i, left, right, mods);
    }
    None
  }
}

/// Piano, guitar and basses: struck or plucked single-delay-loop strings
/// with per-key or per-string allocation, dampers, a sustain pedal and
/// re-strikes.
pub struct StringModel {
  patch: &'static StringPatch,
  voices: Vec<StringVoice>,
  by_note: [i32; 128],
  sustain_down: bool,
  last_note_on: f64,
  strum_index: f64,
  decay: f64,
  brightness: f64,
  inharmonicity: f64,
  detune: f64,
  hardness: f64,
  position: f64,
  strength: f64,
  attack: f64,
  release: f64,
  strum: f64,
  jawari: f64,
  finger: bool,
}

impl StringModel {
  /// The model for `patch` at `fs`: a voice per open string for a guitar or
  /// bass that allocates by string, else four voices to spare over the
  /// polyphony, one per key.
  pub fn new(patch: &'static StringPatch, fs: f64, mods: &ModuleSettings) -> Self {
    let loops = if patch.allocation == "key" {
      MAX_UNISON
    } else if patch.polarization.is_some() {
      2
    } else {
      1
    };
    let hammer_size = (0.014 * fs).ceil() as usize;
    let mut voices = Vec::new();
    match (&patch.open_strings, patch.allocation.as_str()) {
      (Some(open), "string") => {
        for (s, &open) in open.iter().enumerate() {
          let lowest_hz = midi_to_hz(open as f64);
          let size = (fs / lowest_hz).ceil() as usize + 8;
          voices.push(StringVoice::new(
            fs,
            mods,
            lowest_hz,
            loops,
            size,
            1000 + s as u32 * 77,
          ));
        }
      }
      _ => {
        let lowest_hz = midi_to_hz(patch.base.range.0 as f64);
        let size = (fs / lowest_hz).ceil() as usize + hammer_size + 8;
        for v in 0..patch.polyphony + 4 {
          voices.push(StringVoice::new(
            fs,
            mods,
            lowest_hz,
            loops,
            size,
            2000 + v as u32 * 131,
          ));
        }
      }
    }
    Self {
      patch,
      voices,
      by_note: [-1; 128],
      sustain_down: false,
      last_note_on: f64::NEG_INFINITY,
      strum_index: 0.,
      decay: 1.,
      brightness: 0.,
      inharmonicity: 1.,
      detune: 1.,
      hardness: 0.5,
      position: 0.15,
      strength: 1.,
      attack: 0.001,
      release: 1.,
      strum: 0.,
      jawari: 0.,
      finger: false,
    }
  }

  /// Every voice's shared core, for the instrument to retarget.
  pub fn voices_mut(&mut self) -> impl Iterator<Item = &mut VoiceCore> {
    self.voices.iter_mut().map(|voice| &mut voice.core)
  }

  /// Reads the strings' decay, brightness, inharmonicity and detune, the
  /// exciter's hardness, position, strength and kind, the attack and damper
  /// release, the strum and the jawari from the params.
  pub fn read_params(&mut self, bus: &Bus) {
    let p = &bus.params;
    self.decay = p.get("resonator.decay");
    self.brightness = p.get("resonator.brightness");
    self.inharmonicity = p.get("resonator.inharmonicity");
    self.detune = p.get("resonator.detune");
    self.hardness = p.get("exciter.hardness");
    self.position = p.get("exciter.position");
    self.strength = p.get("exciter.strength");
    self.attack = p.get("envelope.attack");
    self.release = p.get("envelope.release");
    self.strum = p.get_or("exciter.strum", 0.);
    self.finger = if p.has("exciter.pluck") {
      p.get("exciter.pluck") >= 0.5
    } else {
      self.patch.exciter == "finger"
    };
    self.jawari = p.get_or("resonator.jawari", 0.);
  }

  /// How many voices are sounding.
  pub fn active_voices(&self) -> usize {
    self.voices.iter().filter(|voice| voice.core.busy()).count()
  }

  /// Plays `note` (folded into the patch's range) on a key or a string, as the
  /// patch allocates, delayed by the strum when it's a chord's later note.
  pub fn note_on(&mut self, bus: &Bus, note: i32, velocity: f64) {
    let n = fold_note(note, self.patch.base.range.0, self.patch.base.range.1);
    // Chord macros arrive as a burst; spread a burst like a strum if asked.
    if bus.clock - self.last_note_on < STRUM_WINDOW * bus.fs {
      self.strum_index += 1.;
    } else {
      self.strum_index = 0.;
    }
    self.last_note_on = bus.clock;
    let delay = js_round((self.strum_index * self.strum * bus.fs) / 1000.) as i64;
    if self.patch.allocation == "key" {
      self.note_on_key(bus, n, velocity, delay);
    } else {
      self.note_on_string(bus, n, velocity, delay);
    }
  }

  /// Lets go of `note`: the damper falls once every press is let go, unless the
  /// pedal holds it up; a note still waiting to start is dropped.
  pub fn note_off(&mut self, bus: &Bus, note: i32) {
    let n = fold_note(note, self.patch.base.range.0, self.patch.base.range.1);
    let Some(index) = self.find_held(n) else {
      return;
    };
    let voice = &mut self.voices[index];
    voice.core.holds -= 1;
    if voice.core.holds > 0 {
      return;
    }
    if voice.countdown > 0 && voice.pending_note == n {
      voice.countdown = 0;
      voice.core.state = RELEASED;
      return;
    }
    if self.sustain_down {
      voice.deferred = true;
      voice.core.state = RELEASED;
      return;
    }
    self.damp(bus, index);
  }

  /// Presses (`down`) the pedal, or lets it up, damping every note let go while
  /// it was down.
  pub fn sustain(&mut self, bus: &Bus, down: bool) {
    self.sustain_down = down;
    if down {
      return;
    }
    for i in 0..self.voices.len() {
      if self.voices[i].deferred && self.voices[i].core.holds == 0 {
        self.voices[i].deferred = false;
        self.damp(bus, i);
      }
    }
  }

  /// Lets the pedal up and damps every note.
  pub fn all_notes_off(&mut self, bus: &Bus) {
    self.sustain_down = false;
    for i in 0..self.voices.len() {
      let voice = &mut self.voices[i];
      if voice.core.busy() && voice.core.state != STOLEN {
        voice.core.holds = 0;
        voice.countdown = 0;
        self.damp(bus, i);
      }
    }
  }

  /// Lets the pedal up and frees every voice at once.
  pub fn panic(&mut self) {
    self.sustain_down = false;
    for voice in &mut self.voices {
      voice.free();
    }
    self.by_note = [-1; 128];
  }

  /// Renders the sounding voices into the bus for the frames `start..end`,
  /// starting each waiting note at the very sample its delay runs out.
  pub fn render(&mut self, bus: &mut Bus, start: usize, end: usize) {
    for v in 0..self.voices.len() {
      if !self.voices[v].core.busy() {
        continue;
      }
      self.voices[v].core.chain.begin(&bus.mods);
      let mut from = start;
      while let Some(at) =
        self.voices[v].render(from, end, &mut bus.left, &mut bus.right, &bus.mods)
      {
        self.launch(bus, v);
        from = at;
      }
      self.voices[v].core.end_block(end - start);
    }
  }

  /// Frees the voices that fell silent and have no note waiting, forgetting
  /// their keys.
  pub fn free_finished(&mut self) {
    for i in 0..self.voices.len() {
      let voice = &mut self.voices[i];
      if voice.core.busy() && voice.core.finished() && voice.countdown == 0 {
        let note = voice.core.note;
        if note >= 0 && self.by_note[note as usize] == i as i32 {
          self.by_note[note as usize] = -1;
        }
        voice.free();
      }
    }
  }

  /// A voice whose re-fret or strum delay has elapsed.
  fn launch(&mut self, bus: &Bus, index: usize) {
    let voice = &self.voices[index];
    if voice.pending_note < 0 {
      return;
    }
    let (note, velocity) = (voice.pending_note, voice.pending_velocity);
    self.start(bus, index, note, velocity);
    self.voices[index].pending_note = -1;
  }

  /// Plays `n` on its key's voice: again if it's still sounding, else on a free
  /// voice, stealing one past the polyphony.
  fn note_on_key(&mut self, bus: &Bus, n: i32, velocity: f64, delay: i64) {
    let existing = self.by_note[n as usize];
    if existing >= 0 && self.voices[existing as usize].core.busy() {
      self.restrike(bus, existing as usize, velocity);
      return;
    }
    let mut sounding = 0;
    let mut idle: Option<usize> = None;
    for (i, voice) in self.voices.iter().enumerate() {
      if voice.core.state == IDLE {
        if idle.is_none() {
          idle = Some(i);
        }
      } else if voice.core.state != STOLEN {
        sounding += 1;
      }
    }
    if (sounding >= self.patch.polyphony || idle.is_none())
      && let Some(victim) = pick_victim(&self.voices)
    {
      let note = self.voices[victim].core.note;
      if note >= 0 && self.by_note[note as usize] >= 0 {
        self.by_note[note as usize] = -1;
      }
      if idle.is_none() {
        self.voices[victim].free();
        idle = Some(victim);
      } else {
        self.voices[victim].core.steal();
      }
    }
    let Some(idle) = idle else {
      return;
    };
    self.by_note[n as usize] = idle as i32;
    self.schedule(bus, idle, n, velocity, delay);
  }

  /// Plays `n` on a string: again if one is sounding it, else on the free
  /// string that frets it lowest (or the held one, re-fretted after a short
  /// damp).
  fn note_on_string(&mut self, bus: &Bus, n: i32, velocity: f64, delay: i64) {
    let open = self.patch.open_strings.clone().unwrap_or_default();
    let max_fret = self.patch.max_fret.unwrap_or(20);
    for s in 0..self.voices.len() {
      let voice = &self.voices[s];
      let target = if voice.countdown > 0 {
        voice.pending_note
      } else {
        voice.core.note
      };
      if voice.core.busy() && target == n && voice.core.state != STOLEN {
        if voice.countdown > 0 {
          self.voices[s].core.holds += 1;
        } else {
          self.restrike(bus, s, velocity);
        }
        return;
      }
    }
    let mut free: Option<usize> = None;
    let mut held: Option<usize> = None;
    for s in 0..open.len() {
      let fret = n - open[s];
      if fret < 0 || fret > max_fret {
        continue;
      }
      let voice = &self.voices[s];
      let available = voice.core.holds == 0 && voice.countdown == 0;
      if available && free.is_none_or(|f| fret < n - open[f]) {
        free = Some(s);
      }
      if held.is_none_or(|h| fret < n - open[h]) {
        held = Some(s);
      }
    }
    let Some(s) = free.or(held) else {
      return;
    };
    if self.voices[s].core.busy() {
      // Re-fret: damp the string for 8 ms, then retune and pluck it.
      let voice = &mut self.voices[s];
      for i in 0..voice.loop_count {
        voice.loops[i].set_decay(0.02, 0.002);
      }
      voice.pending_note = n;
      voice.pending_velocity = velocity;
      voice.countdown = (js_round(REFRET_SECONDS * bus.fs) as i64).max(delay);
      voice.core.holds = 1;
      return;
    }
    self.schedule(bus, s, n, velocity, delay);
  }

  /// Starts `n` on the voice now, or holds it for `delay` samples.
  fn schedule(&mut self, bus: &Bus, index: usize, n: i32, velocity: f64, delay: i64) {
    if delay > 0 {
      let voice = &mut self.voices[index];
      voice.core.state = ACTIVE;
      voice.core.note = n;
      voice.core.holds = 1;
      voice.core.quiet_samples = 0.;
      voice.pending_note = n;
      voice.pending_velocity = velocity;
      voice.countdown = delay;
      return;
    }
    self.start(bus, index, n, velocity);
  }

  /// Starts `n` on the voice: tunes its loops (unison detune or polarizations,
  /// the patch's decay, brightness and dispersion for the key, and the jawari),
  /// excites them, sets the pickup and the pan, and opens the gate.
  fn start(&mut self, bus: &Bus, index: usize, note: i32, velocity: f64) {
    let patch = self.patch;
    let fnote = note as f64;
    let voice = &mut self.voices[index];
    let holds = voice.core.holds.max(1);
    voice.reset();
    voice.core.holds = holds;
    let f0 = midi_to_hz(fnote);
    let t60 = key_table(&patch.t60, fnote) * self.decay;
    let p = clamp(
      key_table(&patch.brightness, fnote) - self.brightness,
      0.,
      0.95,
    );
    let stages = key_table(&patch.dispersion_stages, fnote);
    let coef = clamp(
      key_table(&patch.dispersion_coef, fnote) * self.inharmonicity,
      -0.95,
      0.,
    );

    let mut count = 1;
    if patch.allocation == "key" {
      count = (js_round(key_table(&patch.unison, fnote)) as usize)
        .min(MAX_UNISON)
        .max(1);
    } else if patch.polarization.is_some() {
      count = 2;
    }
    voice.loop_count = count;
    let spread = key_table(&patch.unison_detune, fnote) * self.detune;
    for s in 0..count {
      let cents;
      let decay_scale;
      if let Some(polarization) = patch.polarization {
        cents = if s == 0 {
          0.
        } else {
          polarization.detune_cents
        };
        decay_scale = if s == 0 { 1. } else { polarization.decay };
        voice.split[s] = if s == 0 {
          polarization.split
        } else {
          1. - polarization.split
        };
      } else {
        // Unison strings sit at 0, +spread, −spread (or ±spread/2 for two).
        cents = if count == 2 {
          (if s == 0 { 0.5 } else { -0.5 }) * spread
        } else if s == 0 {
          0.
        } else if s == 1 {
          spread
        } else {
          -spread
        };
        decay_scale = patch.unison_decay.get(s).copied().unwrap_or(1.);
        voice.split[s] = 1. / count as f64;
      }
      if let Some(jawari) = patch.jawari {
        voice.loops[s].set_jawari(jawari.contact * self.jawari, jawari.gap);
      }
      voice.loops[s].tune(
        f0 * 2f64.powf(cents / 1200.),
        t60 * decay_scale,
        p,
        stages,
        coef,
      );
    }

    self.excite(bus, index, note, velocity);
    let voice = &mut self.voices[index];
    voice.pickup_tap = match patch.pickup {
      Some(pickup) => js_round(pickup * voice.loops[0].period).max(1.) as usize,
      None => 0,
    };

    let (low, high) = patch.base.range;
    let pan = match (&patch.open_strings, patch.allocation.as_str()) {
      (Some(open), "string") => {
        let strings = open.len() as f64;
        patch.base.pan.center
          + patch.base.pan.spread * ((2. * index as f64) / (strings - 1.).max(1.) - 1.)
      }
      _ => {
        patch.base.pan.center
          + patch.base.pan.spread * ((2. * (note - low) as f64) / (high - low) as f64 - 1.)
      }
    };
    pan_gains(pan, &mut voice.core.chain.gains);

    voice.core.chain.onset(note, bus.clock, &bus.mods);
    voice.amp.set(self.attack, 0., 1., 0.05, true);
    voice.amp.note_on();
    voice.core.chain.shape.note_on();
    voice.core.age = bus.clock;
    voice.core.state = ACTIVE;
    voice.core.note = note;
    voice.core.quiet_samples = 0.;
  }

  /// Strikes the sounding voice again: its loops' decay restored, a new pulse,
  /// the filter envelope restarted.
  fn restrike(&mut self, bus: &Bus, index: usize, velocity: f64) {
    let patch = self.patch;
    let voice = &mut self.voices[index];
    voice.core.holds += 1;
    voice.deferred = false;
    voice.core.state = ACTIVE;
    voice.core.quiet_samples = 0.;
    let note = voice.core.note;
    let t60 = key_table(&patch.t60, note as f64) * self.decay;
    for s in 0..voice.loop_count {
      let scale = match patch.polarization {
        Some(polarization) => {
          if s == 0 {
            1.
          } else {
            polarization.decay
          }
        }
        None => patch.unison_decay.get(s).copied().unwrap_or(1.),
      };
      voice.loops[s].set_decay(t60 * scale, 0.005);
    }
    self.excite(bus, index, note, velocity);
    let voice = &mut self.voices[index];
    voice.core.chain.retrigger();
    voice.core.chain.shape.note_on();
  }

  /// Writes the voice's excitation: a felt hammer's pulse or a pick's or
  /// finger's pluck, at the patch's period and the exciter params.
  fn excite(&mut self, bus: &Bus, index: usize, note: i32, velocity: f64) {
    let patch = self.patch;
    let voice = &mut self.voices[index];
    let period = voice.loops[0].period;
    if patch.exciter == "hammer" {
      let options = HammerOptions {
        period,
        velocity,
        hardness: self.hardness,
        position: self.position,
        strength: self.strength,
        mass: patch
          .hammer_mass
          .as_ref()
          .map_or(1., |mass| key_table(mass, note as f64)),
        fs: bus.fs,
      };
      voice.excitation_length = hammer(&mut voice.excitation, &options).0;
    } else {
      let options = PluckOptions {
        period,
        velocity,
        hardness: self.hardness,
        position: self.position,
        strength: self.strength,
        finger: self.finger,
      };
      voice.excitation_length = pluck(&mut voice.excitation, &mut voice.noise, &options);
    }
    voice.excitation_pos = 0;
  }

  /// Drops the damper on the voice, shortening its loops' decay, except on the
  /// undamped top keys; the master ADSR releases either way.
  fn damp(&mut self, bus: &Bus, index: usize) {
    let patch = self.patch;
    let _ = bus;
    let voice = &mut self.voices[index];
    voice.core.state = RELEASED;
    voice.deferred = false;
    voice.core.chain.shape.note_off();
    if let Some(limit) = patch.no_damper_above
      && voice.core.note > limit
    {
      return;
    }
    let t60 = key_table(&patch.damper_t60, voice.core.note as f64) * self.release;
    for s in 0..voice.loop_count {
      voice.loops[s].set_decay(t60, 0.015);
    }
  }

  /// The voice holding `n`, its key's for a piano, else the string sounding (or
  /// about to sound) it.
  fn find_held(&self, n: i32) -> Option<usize> {
    if self.patch.allocation == "key" {
      let index = self.by_note[n as usize];
      return (index >= 0 && self.voices[index as usize].core.holds > 0).then_some(index as usize);
    }
    self.voices.iter().position(|voice| {
      let target = if voice.countdown > 0 {
        voice.pending_note
      } else {
        voice.core.note
      };
      voice.core.holds > 0 && target == n
    })
  }
}
