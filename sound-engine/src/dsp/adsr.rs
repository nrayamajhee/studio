//! The ADSR envelope every voice and module is shaped by: a linear attack,
//! exponential decay and release, and a gate mode that holds full level while
//! the note is held.

/// Not sounding.
const IDLE: u8 = 0;
/// Rising, in a straight line, to full.
const ATTACK: u8 = 1;
/// Falling exponentially to the sustain level.
const DECAY: u8 = 2;
/// Holding the sustain level while the note is held.
const SUSTAIN: u8 = 3;
/// Falling exponentially to silence after the note is let go.
const RELEASE: u8 = 4;

/// Exponential segments cover 99% of the distance in `time` seconds:
/// coef = 1 − exp(−4.6/(time·fs)), since e^(−4.6) ≈ 0.01.
fn approach(time: f64, fs: f64) -> f64 {
  if time > 0. {
    1. - (-4.6 / (time * fs)).exp()
  } else {
    1.
  }
}

/// The four stages every ADSR in the engine is set from. Times in seconds,
/// sustain 0–1.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct AdsrStages {
  pub attack: f64,
  pub decay: f64,
  pub sustain: f64,
  pub release: f64,
}

/// An ADSR envelope, one sample at a time: [`Adsr::set`] or
/// [`Adsr::set_stages`] shape it, [`Adsr::note_on`] and [`Adsr::note_off`]
/// start and release it, and [`Adsr::process`] steps it, its level in `value`.
/// With `gate` set it rises to full and holds there, ignoring the decay and
/// sustain.
pub struct Adsr {
  pub value: f64,
  stage: u8,
  fs: f64,
  attack_step: f64,
  decay_coef: f64,
  release_coef: f64,
  sustain: f64,
  gate: bool,
  one_shot: bool,
}

impl Adsr {
  /// An idle envelope at sample rate `fs`.
  pub fn new(fs: f64) -> Self {
    Self {
      value: 0.,
      stage: IDLE,
      fs,
      attack_step: 1.,
      decay_coef: 1.,
      release_coef: 1.,
      sustain: 1.,
      gate: false,
      one_shot: false,
    }
  }

  /// Whether it's sounding, in any stage.
  pub fn active(&self) -> bool {
    self.stage != IDLE
  }

  /// Whether it's in its release.
  pub fn releasing(&self) -> bool {
    self.stage == RELEASE
  }

  /// Sets the stages: attack, decay and release in seconds, sustain 0–1, and
  /// whether it's a gate (full while held).
  pub fn set(&mut self, attack: f64, decay: f64, sustain: f64, release: f64, gate: bool) {
    self.attack_step = if attack > 0. {
      1. / (attack * self.fs)
    } else {
      1.
    };
    self.decay_coef = approach(decay, self.fs);
    self.release_coef = approach(release, self.fs);
    self.sustain = sustain;
    self.gate = gate;
    self.one_shot = false;
  }

  /// Sets the stages, not as a gate.
  pub fn set_stages(&mut self, stages: AdsrStages) {
    self.set(
      stages.attack,
      stages.decay,
      stages.sustain,
      stages.release,
      false,
    );
  }

  /// Sets the release alone, in seconds.
  pub fn set_release(&mut self, release: f64) {
    self.release_coef = approach(release, self.fs);
  }

  /// Retriggers from the current value to avoid clicks.
  pub fn note_on(&mut self) {
    self.stage = ATTACK;
  }

  /// Releases the note, unless it's idle.
  pub fn note_off(&mut self) {
    if self.stage != IDLE && !self.one_shot {
      self.stage = RELEASE;
    }
  }

  /// Silences it at once.
  pub fn reset(&mut self) {
    self.stage = IDLE;
    self.value = 0.;
  }

  /// Steps the envelope a sample, returning its level.
  pub fn process(&mut self) -> f64 {
    match self.stage {
      ATTACK => {
        self.value += self.attack_step;
        if self.value >= 1. {
          self.value = 1.;
          self.stage = if self.gate { SUSTAIN } else { DECAY };
        }
      }
      DECAY => {
        let target = if self.one_shot { 0. } else { self.sustain };
        self.value += (target - self.value) * self.decay_coef;
        if (self.value - target).abs() < 1e-4 {
          self.value = target;
          self.stage = if self.one_shot { IDLE } else { SUSTAIN };
        }
      }
      SUSTAIN => {
        self.value = if self.gate { 1. } else { self.sustain };
      }
      RELEASE => {
        self.value -= self.value * self.release_coef;
        if self.value < 1e-4 {
          self.value = 0.;
          self.stage = IDLE;
        }
      }
      _ => {}
    }
    self.value
  }
}
