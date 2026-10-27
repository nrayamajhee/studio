use super::chain::VoiceChain;
use super::modules::ModuleSettings;

pub const IDLE: u8 = 0;
pub const ACTIVE: u8 = 1;
pub const RELEASED: u8 = 2;
pub const STOLEN: u8 = 3;

/// −90 dBFS.
const SILENCE: f64 = 3.1623e-5;
/// Notes starting this close together are a chord, and don't glide.
const CHORD_SECONDS: f64 = 0.03;

/// The lifecycle every voice shares: idle → active → released → idle, plus
/// stolen (a 5 ms fade-out). Voices report each rendered segment's peak and
/// the owner frees them once they have stayed silent long enough.
pub struct VoiceCore {
  pub state: u8,
  pub note: i32,
  pub holds: i32,
  pub age: f64,
  pub quiet_samples: f64,
  pub fs: f64,
  pub chain: VoiceChain,
}

impl VoiceCore {
  pub fn new(fs: f64, mods: &ModuleSettings) -> Self {
    Self {
      state: IDLE,
      note: -1,
      holds: 0,
      age: 0.,
      quiet_samples: 0.,
      fs,
      chain: VoiceChain::new(fs, mods),
    }
  }

  pub fn busy(&self) -> bool {
    self.state != IDLE
  }

  pub fn finished(&self) -> bool {
    let released = self.state == RELEASED || self.state == STOLEN;
    (released && self.quiet_samples > 0.05 * self.fs) || self.quiet_samples > 1.0 * self.fs
  }

  /// Keeps a decaying voice alive while it is still audible.
  pub fn track(&mut self, peak: f64, count: usize) {
    if peak < SILENCE {
      self.quiet_samples += count as f64;
    } else {
      self.quiet_samples = 0.;
    }
  }

  /// Reports the peak of a segment rendered through the chain.
  pub fn end_block(&mut self, count: usize) {
    let peak = self.chain.take_peak();
    self.track(peak, count);
  }

  pub fn begin(&mut self, note: i32, clock: f64) {
    self.state = ACTIVE;
    self.note = note;
    self.holds = 1;
    self.age = clock;
    self.quiet_samples = 0.;
    self.chain.fade = 1.;
    self.chain.fade_step = 0.;
  }

  pub fn steal(&mut self) {
    self.state = STOLEN;
    self.holds = 0;
    self.chain.fade_step = 1. / (0.005 * self.fs);
  }

  /// The shared part of freeing a voice; the model then resets its own.
  pub fn free(&mut self) {
    self.state = IDLE;
    self.note = -1;
    self.holds = 0;
    self.quiet_samples = 0.;
    self.chain.fade = 1.;
    self.chain.fade_step = 0.;
    self.chain.shape.reset();
  }
}

/// A model's voice: its shared core and its own reset.
pub trait Voice {
  fn core(&self) -> &VoiceCore;
  fn core_mut(&mut self) -> &mut VoiceCore;
  fn reset(&mut self);

  fn free(&mut self) {
    self.core_mut().free();
    self.reset();
  }
}

/// The quietest released voice, else the oldest active one.
pub fn pick_victim<V: Voice>(voices: &[V]) -> Option<usize> {
  let mut victim: Option<usize> = None;
  for (i, voice) in voices.iter().enumerate() {
    let voice = voice.core();
    let current = victim.map(|v| voices[v].core());
    if voice.state == RELEASED {
      if current.is_none_or(|c| c.state != RELEASED || voice.quiet_samples > c.quiet_samples) {
        victim = Some(i);
      }
    } else if voice.state == ACTIVE
      && current.is_none_or(|c| c.state == ACTIVE)
      && current.is_none_or(|c| voice.age < c.age)
    {
      victim = Some(i);
    }
  }
  victim
}

/// The note a new one glides from when played legato: the latest one still
/// held, unless it started with this one as part of a chord. −1 for none.
pub fn legato_note<V: Voice>(voices: &[V], clock: f64, fs: f64) -> i32 {
  let mut latest: Option<&VoiceCore> = None;
  for voice in voices {
    let voice = voice.core();
    if voice.state == ACTIVE && latest.is_none_or(|l| voice.age > l.age) {
      latest = Some(voice);
    }
  }
  match latest {
    Some(l) if clock - l.age >= CHORD_SECONDS * fs => l.note,
    _ => -1,
  }
}

/// Finds a voice for a new note in a keyed, polyphonic instrument: the first
/// idle one, stealing (or freeing, when none is idle) a victim once
/// `polyphony` are sounding. Returns the index, and the note whose key the
/// victim held, so the caller can forget it.
pub fn allocate<V: Voice>(voices: &mut [V], polyphony: usize) -> (Option<usize>, Option<i32>) {
  let mut sounding = 0;
  let mut idle: Option<usize> = None;
  for (i, voice) in voices.iter().enumerate() {
    let state = voice.core().state;
    if state == IDLE {
      if idle.is_none() {
        idle = Some(i);
      }
    } else if state != STOLEN {
      sounding += 1;
    }
  }
  let mut forgotten = None;
  if (sounding >= polyphony || idle.is_none())
    && let Some(victim) = pick_victim(voices)
  {
    forgotten = Some(voices[victim].core().note);
    if idle.is_none() {
      voices[victim].free();
      idle = Some(victim);
    } else {
      voices[victim].core_mut().steal();
    }
  }
  (idle, forgotten)
}
