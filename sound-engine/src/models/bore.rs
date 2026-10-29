//! Flute, saxophone, brass and clarinet loops ported from STK (The Synthesis
//! ToolKit, Perry Cook & Gary Scavone, MIT-style license): src/Flute.cpp,
//! src/Saxofony.cpp, src/Brass.cpp and src/Clarinet.cpp.

use super::waveguide::Waveguide;
use crate::dsp::adsr::{Adsr, AdsrStages};
use crate::dsp::filters::{DcBlocker, OnePoleLowpass};
use crate::dsp::generators::Noise;
use crate::dsp::math::{KeyTable, TWO_PI, fold_note, key_table, lerp, midi_to_hz, pan_gains};
use crate::dsp::nonlinear::{jet_table, reed_table, soft_clip};
use crate::dsp::phase_delay::one_pole_phase_delay;
use crate::engine::bus::Bus;
use crate::engine::modules::ModuleSettings;
use crate::engine::voice::{ACTIVE, IDLE, RELEASED, Voice, VoiceCore};
use crate::patches::{BorePatch, pick_tuning};

/// Notes starting within 15 ms of the one playing are a chord's: the bore keeps
/// playing the first and only holds the rest.
const BURST_WINDOW: f64 = 0.015;
/// The most keys held at once that the bore remembers, for last-note priority.
const MAX_HELD: usize = 16;
/// STK Flute: the bore is tuned to 2/3 of the note and overblown.
const FLUTE_OVERBLOW: f64 = 0.66666;
/// The flute's jet reflection: how much of the bore's return feeds the jet.
const FLUTE_JET_REFLECTION: f64 = 0.5;
/// The flute's end reflection: how much of the bore's return joins the jet's
/// output.
const FLUTE_END_REFLECTION: f64 = 0.5;
/// STK Saxofony: reed table offset/slope and bell reflection.
const SAX_REED_OFFSET: f64 = 0.7;
/// The saxophone's bell reflection, inverting.
const SAX_BELL_REFLECTION: f64 = -0.95;
/// STK fixes the bell lowpass at pole 0.9 (~740 Hz at 44.1 kHz): too bright
/// for low notes (they overblow) and too dark for high ones (they stop
/// speaking). Open tone holes make the real reflection track the sounding
/// note, so the cutoff follows f0 instead, which also makes it sample-rate
/// independent.
const SAX_REFLECTION_RATIO: f64 = 14.;
/// The lowest the saxophone's bell lowpass goes, in hertz.
const SAX_REFLECTION_MIN: f64 = 500.;
/// STK Clarinet: the reed table and the cylinder's inverting end
/// reflection, whose loss is a two-point average (half a sample of delay).
const CLARINET_REED_OFFSET: f64 = 0.7;
/// The clarinet's end reflection, before the inversion.
const CLARINET_REFLECTION: f64 = 0.95;
/// The delay, in samples, of the clarinet's two-point average.
const CLARINET_FILTER_DELAY: f64 = 0.5;
/// STK Brass: the bore holds two periods, so its modes sit at f0/2 multiples
/// and the lips, a resonance at f0, lock onto the second; +3 samples is
/// STK's.
const BRASS_BORE_PERIODS: f64 = 2.;
/// Samples added to the brass bore's length, as STK has.
const BRASS_BORE_OFFSET: f64 = 3.;
/// STK's lip resonance (radius 0.997, input gain 0.03) has a DC gain of
/// ~0.03/ω², so low notes hold the lips wide open and never oscillate.
/// Keeping its Q fixed (r = 1 − k·ω) and its input gain at G·ω² makes the
/// lips behave the same at every pitch; k and G reproduce STK's values at
/// 880 Hz, where it speaks well.
const BRASS_LIP_K: f64 = 0.026;
/// The brass lips' input gain per ω² (see [`BRASS_LIP_K`]).
const BRASS_LIP_G: f64 = 2.26;
/// The share of the breath's pressure in the brass player's mouth.
const BRASS_MOUTH: f64 = 0.3;
/// How much of the brass bore's return reaches the lips.
const BRASS_BORE_REFLECTION: f64 = 0.85;
/// Lip tension 0–1 moves the lip resonance ±0.05 octave around the note,
/// brightening and bending the pitch as tightening real lips does.
const BRASS_LIP_RANGE: f64 = 0.1;

/// Which of STK's bore instruments a voice is.
#[derive(Clone, Copy, PartialEq)]
enum Kind {
  /// A jet blown across the bore's end, overblown.
  Flute,
  /// A conical bore driven by a reed, split at the reed.
  Saxophone,
  /// Lips buzzing into a bore two periods long.
  Brass,
  /// A cylindrical bore driven by a reed, inverting at its end.
  Clarinet,
}

/// The bore's one voice: its waveguides, filters, breath and gate envelopes,
/// the delay lengths it glides between, and the brass lips' resonance.
struct BoreVoice {
  core: VoiceCore,
  kind: Kind,
  bore: Waveguide,
  jet: Waveguide,
  reflection: OnePoleLowpass,
  dc: DcBlocker,
  breath: Adsr,
  gate: Adsr,
  noise: Noise,
  bore_length: f64,
  jet_length: f64,
  bore_target: f64,
  jet_target: f64,
  glide: f64,
  max_pressure: f64,
  output_gain: f64,
  noise_gain: f64,
  reed_slope: f64,
  watchdog: bool,
  /// Lip resonance: input gain, a1, a2 and state.
  lip_gain: f64,
  lip_a1: f64,
  lip_a2: f64,
  lip_y1: f64,
  lip_y2: f64,
  zero1: f64,
}

impl Voice for BoreVoice {
  fn core(&self) -> &VoiceCore {
    &self.core
  }
  fn core_mut(&mut self) -> &mut VoiceCore {
    &mut self.core
  }
  fn reset(&mut self) {
    self.bore.clear();
    self.jet.clear();
    self.reflection.clear();
    self.dc.clear();
    self.core.chain.clear();
    self.breath.reset();
    self.gate.reset();
    self.lip_y1 = 0.;
    self.lip_y2 = 0.;
    self.zero1 = 0.;
  }
}

impl BoreVoice {
  /// An idle voice of `kind` whose waveguides fit the lowest note, `lowest_hz`.
  fn new(fs: f64, mods: &ModuleSettings, lowest_hz: f64, kind: Kind) -> Self {
    let longest = if kind == Kind::Brass {
      (BRASS_BORE_PERIODS * fs) / lowest_hz + BRASS_BORE_OFFSET + 8.
    } else {
      fs / (lowest_hz * FLUTE_OVERBLOW) + 8.
    };
    Self {
      core: VoiceCore::new(fs, mods),
      kind,
      bore: Waveguide::new(longest),
      jet: Waveguide::new(longest),
      reflection: OnePoleLowpass::default(),
      dc: DcBlocker::new(fs),
      breath: Adsr::new(fs),
      gate: Adsr::new(fs),
      noise: Noise::new(4242),
      bore_length: 100.,
      jet_length: 30.,
      bore_target: 100.,
      jet_target: 30.,
      glide: 1.,
      max_pressure: 1.,
      output_gain: 0.5,
      noise_gain: 0.15,
      reed_slope: 0.3,
      watchdog: false,
      lip_gain: 0.,
      lip_a1: 0.,
      lip_a2: 0.,
      lip_y1: 0.,
      lip_y2: 0.,
      zero1: 0.,
    }
  }

  /// Tunes the brass lips' resonance to `freq`, keeping its Q and its gain at
  /// the note the same at every pitch.
  fn set_lip(&mut self, freq: f64) {
    let w = (TWO_PI * freq) / self.core.fs;
    let r = 1. - BRASS_LIP_K * w;
    self.lip_gain = BRASS_LIP_G * w * w;
    self.lip_a2 = r * r;
    self.lip_a1 = -2. * r * w.cos();
  }

  /// Runs one sample through the lips' resonance.
  fn lip(&mut self, x: f64) -> f64 {
    let y = self.lip_gain * x - self.lip_a1 * self.lip_y1 - self.lip_a2 * self.lip_y2;
    self.lip_y2 = self.lip_y1;
    self.lip_y1 = y;
    y
  }

  /// Renders the frames `start..end`: the breath, with its noise and the
  /// vibrato, drives the kind's loop, its delays bent by the vibrato. A loop
  /// that blows up is cleared and flagged. The note counts as released once its
  /// breath ends.
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
      self.bore_length += (self.bore_target - self.bore_length) * self.glide;
      self.jet_length += (self.jet_target - self.jet_length) * self.glide;
      // The LFO sways the breath and bends the bore's length.
      let vib = self.core.chain.modulate();
      let mut pressure = self.max_pressure * self.breath.process();
      pressure += pressure * (self.noise_gain * self.noise.next() + level * vib);
      let bend = 1. - pitch * vib;

      let mut out = match self.kind {
        Kind::Brass => {
          // The lips open with the pressure across them (squared,
          // saturating), mixing mouth and bore pressure into the bore.
          let mouth = BRASS_MOUTH * pressure;
          let back = BRASS_BORE_REFLECTION * self.bore.last;
          let mut area = self.lip(mouth - back);
          area *= area;
          if area > 1. {
            area = 1.;
          }
          let x = self.dc.process(area * mouth + (1. - area) * back);
          self.bore.tick(x, self.bore_length * bend)
        }
        Kind::Clarinet => {
          let reflected = -CLARINET_REFLECTION * 0.5 * (self.bore.last + self.zero1);
          self.zero1 = self.bore.last;
          let diff = reflected - pressure;
          self.bore.tick(
            pressure + diff * reed_table(diff, CLARINET_REED_OFFSET, -self.reed_slope),
            self.bore_length * bend,
          )
        }
        Kind::Saxophone => {
          // delayA ≡ bore (bell side), delayB ≡ jet (reed side).
          let t = SAX_BELL_REFLECTION * self.reflection.process(self.bore.last);
          let out = t - self.jet.last;
          let diff = pressure - out;
          self.jet.tick(t, self.jet_length * bend);
          let reed = diff * reed_table(diff, SAX_REED_OFFSET, self.reed_slope);
          self.bore.tick(
            4. * soft_clip(0.25 * (pressure - reed - t)),
            self.bore_length * bend,
          );
          out
        }
        Kind::Flute => {
          let mut temp = -self.reflection.process(self.bore.last);
          temp = self.dc.process(temp);
          let mut diff = pressure - FLUTE_JET_REFLECTION * temp;
          diff = self.jet.tick(diff, self.jet_length * bend);
          diff = jet_table(diff) + FLUTE_END_REFLECTION * temp;
          0.3
            * self
              .bore
              .tick(4. * soft_clip(0.25 * diff), self.bore_length * bend)
        }
      };

      if !(out > -4. && out < 4.) {
        // Blown up (or NaN): silence the loops and restart the note quietly.
        self.bore.clear();
        self.jet.clear();
        self.reflection.clear();
        self.dc.clear();
        self.lip_y1 = 0.;
        self.lip_y2 = 0.;
        self.zero1 = 0.;
        self.watchdog = true;
        out = 0.;
      }

      let gain = self.output_gain * self.gate.process();
      self.core.chain.emit(out, gain, i, left, right, mods);
    }
    self.core.end_block(end - start);
    if !self.breath.active() && self.core.state == ACTIVE {
      self.core.state = RELEASED;
    }
  }
}

/// Monophonic flute, saxophone, brass or clarinet with last-note priority
/// and legato.
pub struct BoreModel {
  patch: &'static BorePatch,
  tuning: KeyTable,
  voice: BoreVoice,
  held: [i32; MAX_HELD],
  held_count: usize,
  current: i32,
  current_hz: f64,
  burst_start: f64,
  pressure: f64,
  noise_level: f64,
  portamento: f64,
  envelope: AdsrStages,
  lip_ratio: f64,
  watchdog_reported: bool,
}

impl BoreModel {
  /// The model for `patch` at `fs`, its kind from the patch's model, the
  /// reflection filter set for it, and its tuning table picked for `fs`.
  pub fn new(patch: &'static BorePatch, fs: f64, mods: &ModuleSettings) -> Self {
    let kind = match patch.model.as_str() {
      "saxophone" => Kind::Saxophone,
      "brass" => Kind::Brass,
      "clarinet" => Kind::Clarinet,
      _ => Kind::Flute,
    };
    let mut voice = BoreVoice::new(fs, mods, midi_to_hz(patch.base.range.0 as f64), kind);
    voice.reflection.set_pole(if kind == Kind::Saxophone {
      0.9
    } else {
      0.7 - (0.1 * 22050.) / fs
    });
    pan_gains(patch.base.pan.center, &mut voice.core.chain.gains);
    Self {
      patch,
      tuning: pick_tuning(&patch.tuning_cents, fs),
      voice,
      held: [0; MAX_HELD],
      held_count: 0,
      current: -1,
      current_hz: 0.,
      burst_start: f64::NEG_INFINITY,
      pressure: 1.,
      noise_level: 1.,
      portamento: 0.03,
      envelope: AdsrStages {
        attack: 0.05,
        decay: 0.1,
        sustain: 0.9,
        release: 0.1,
      },
      lip_ratio: 1.,
      watchdog_reported: false,
    }
  }

  /// The one voice's shared core, for the instrument to retarget.
  pub fn voices_mut(&mut self) -> impl Iterator<Item = &mut VoiceCore> {
    std::iter::once(&mut self.voice.core)
  }

  /// Reads the pressure, breath noise, portamento, breath envelope, reed
  /// stiffness and lip tension from the params, retuning sounding brass lips.
  pub fn read_params(&mut self, bus: &Bus) {
    let p = &bus.params;
    self.pressure = p.get("exciter.pressure");
    self.noise_level = p.get("exciter.noise");
    self.portamento = p.get("resonator.portamento");
    self.envelope = p.envelope("envelope");
    let voice = &mut self.voice;
    voice.noise_gain = match voice.kind {
      Kind::Saxophone | Kind::Clarinet => 0.2,
      Kind::Brass => 0.05,
      Kind::Flute => 0.15,
    } * self.noise_level;
    voice.reed_slope = 0.1 + 0.4 * p.get("exciter.reed");
    self.lip_ratio = if p.has("exciter.lip") {
      2f64.powf((p.get("exciter.lip") - 0.5) * BRASS_LIP_RANGE)
    } else {
      1.
    };
    if voice.kind == Kind::Brass && self.current >= 0 {
      voice.set_lip(self.current_hz * self.lip_ratio);
    }
    voice.breath.set_release(self.envelope.release);
    voice.glide = 1. - (-3. / (self.portamento.max(0.001) * bus.fs)).exp();
  }

  /// 1 while the voice sounds, else 0.
  pub fn active_voices(&self) -> usize {
    usize::from(self.voice.core.busy())
  }

  /// Holds `note` (folded into the patch's range) and plays it, unless it's a
  /// chord's later note: then it waits its turn among the held keys.
  pub fn note_on(&mut self, bus: &Bus, note: i32, velocity: f64) {
    let n = fold_note(note, self.patch.base.range.0, self.patch.base.range.1);
    if self.held_count < MAX_HELD {
      self.held[self.held_count] = n;
      self.held_count += 1;
    }
    let in_burst = bus.clock - self.burst_start < BURST_WINDOW * bus.fs;
    if in_burst && self.current >= 0 {
      return;
    }
    self.burst_start = bus.clock;
    self.play(bus, n, velocity);
  }

  /// Lets go of `note`: if it was playing, the bore glides back to the latest
  /// key still held, or breathes out when none is.
  pub fn note_off(&mut self, bus: &Bus, note: i32) {
    let n = fold_note(note, self.patch.base.range.0, self.patch.base.range.1);
    if let Some(i) = self.held[..self.held_count]
      .iter()
      .rposition(|&held| held == n)
    {
      self.held.copy_within(i + 1..self.held_count, i);
      self.held_count -= 1;
    }
    if n != self.current {
      return;
    }
    if self.held_count > 0 {
      self.retune(bus, self.held[self.held_count - 1], false);
    } else {
      self.current = -1;
      self.release();
    }
  }

  /// Lets go of every key and breathes out.
  pub fn all_notes_off(&mut self) {
    self.held_count = 0;
    self.current = -1;
    self.release();
  }

  /// Lets go of every key and silences the voice at once.
  pub fn panic(&mut self) {
    self.held_count = 0;
    self.current = -1;
    self.voice.free();
  }

  /// Renders the voice into the bus for the frames `start..end`, warning once
  /// if its loop blew up.
  pub fn render(&mut self, bus: &mut Bus, start: usize, end: usize) {
    self
      .voice
      .render(start, end, &mut bus.left, &mut bus.right, &bus.mods);
    if self.voice.watchdog {
      self.voice.watchdog = false;
      if !self.watchdog_reported {
        self.watchdog_reported = true;
        bus.warning = Some(format!("{}: loop blew up and was reset", bus.name));
      }
    }
  }

  /// Frees the voice once it's released and silent.
  pub fn free_finished(&mut self) {
    let voice = &mut self.voice;
    if voice.core.busy() && voice.core.state != ACTIVE && voice.core.finished() {
      voice.free();
    }
  }

  /// Breathes out: the breath, the gate and the master ADSR release.
  fn release(&mut self) {
    self.voice.breath.note_off();
    self.voice.gate.note_off();
    self.voice.core.chain.shape.note_off();
  }

  /// Plays `n` at `velocity`: legato, the bore just glides to it; else the
  /// breath and gate start over at the velocity's pressure. Either way the loop
  /// retunes.
  fn play(&mut self, bus: &Bus, n: i32, velocity: f64) {
    let voice = &mut self.voice;
    let legato = voice.core.state == ACTIVE && voice.breath.active() && !voice.breath.releasing();
    if !legato {
      if voice.core.state == IDLE {
        voice.reset();
      }
      let (low, high) = self.patch.pressure;
      let steady = lerp(low, high, velocity) * self.pressure;
      voice.max_pressure = steady / self.envelope.sustain.max(0.05);
      voice.output_gain = velocity + 0.001;
      voice.breath.set_stages(self.envelope);
      voice.breath.note_on();
      voice.gate.set(0.005, 0., 1., 0.05, true);
      voice.gate.note_on();
      voice.core.chain.shape.note_on();
      voice.core.begin(n, bus.clock);
      voice.core.chain.onset(n, bus.clock, &bus.mods);
    }
    self.retune(bus, n, !legato);
  }

  /// Delay lengths from STK: fs/f − τ_reflection(f) − the loop's "lastOut"
  /// samples (one for the flute bore, two for the sax's split bore),
  /// corrected by the patch's measured tuning table.
  fn retune(&mut self, bus: &Bus, n: i32, immediate: bool) {
    let fs = bus.fs;
    self.current = n;
    let f0 = midi_to_hz(n as f64) * 2f64.powf(key_table(&self.tuning, n as f64) / 1200.);
    self.current_hz = f0;
    let lip_ratio = self.lip_ratio;
    let voice = &mut self.voice;
    voice.core.note = n;
    voice.core.state = ACTIVE;
    voice.core.chain.retarget(n, &bus.mods);
    match voice.kind {
      Kind::Brass => {
        // DC blocker and lip phase are left to the measured tuning table.
        voice.bore_target = (BRASS_BORE_PERIODS * fs) / f0 + BRASS_BORE_OFFSET;
        voice.set_lip(f0 * lip_ratio);
      }
      Kind::Clarinet => {
        // The inverting reflection makes the loop two passes of the bore.
        voice.bore_target = (0.5 * fs) / f0 - CLARINET_FILTER_DELAY - 1.;
      }
      Kind::Saxophone => {
        let w = (TWO_PI * f0) / fs;
        let cutoff = (0.4 * fs).min(SAX_REFLECTION_MIN.max(SAX_REFLECTION_RATIO * f0));
        voice.reflection.set_cutoff(cutoff, fs);
        let delay = fs / f0 - one_pole_phase_delay(voice.reflection.p, w) - 2.;
        let blow = bus.params.get("exciter.blowPosition");
        voice.bore_target = (1. - blow) * delay;
        voice.jet_target = blow * delay;
      }
      Kind::Flute => {
        let f_bore = f0 * FLUTE_OVERBLOW;
        let w = (TWO_PI * f_bore) / fs;
        let delay = fs / f_bore - one_pole_phase_delay(voice.reflection.p, w) - 1.;
        voice.bore_target = delay;
        voice.jet_target = delay * bus.params.get("exciter.jetRatio");
      }
    }
    if immediate {
      voice.bore_length = voice.bore_target;
      voice.jet_length = voice.jet_target;
    }
    let (low, high) = self.patch.base.range;
    let pan = self.patch.base.pan.center
      + self.patch.base.pan.spread * ((2. * (n - low) as f64) / (high - low) as f64 - 1.);
    pan_gains(pan, &mut voice.core.chain.gains);
  }
}
