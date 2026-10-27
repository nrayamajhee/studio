const IDLE: u8 = 0;
const ATTACK: u8 = 1;
const DECAY: u8 = 2;
const SUSTAIN: u8 = 3;
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

  pub fn active(&self) -> bool {
    self.stage != IDLE
  }

  pub fn releasing(&self) -> bool {
    self.stage == RELEASE
  }

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

  pub fn set_stages(&mut self, stages: AdsrStages) {
    self.set(
      stages.attack,
      stages.decay,
      stages.sustain,
      stages.release,
      false,
    );
  }

  pub fn set_release(&mut self, release: f64) {
    self.release_coef = approach(release, self.fs);
  }

  /// Retriggers from the current value to avoid clicks.
  pub fn note_on(&mut self) {
    self.stage = ATTACK;
  }

  pub fn note_off(&mut self) {
    if self.stage != IDLE && !self.one_shot {
      self.stage = RELEASE;
    }
  }

  pub fn reset(&mut self) {
    self.stage = IDLE;
    self.value = 0.;
  }

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
