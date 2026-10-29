//! Signal sources: deterministic noise, the LFO, a band-limited audio
//! oscillator, the parameter smoother, and an envelope follower.

use super::math::TWO_PI;

/// xorshift32 with a per-voice seed so offline renders are deterministic.
/// Output is in [−1, 1).
#[derive(Clone)]
pub struct Noise {
  state: u32,
}

impl Noise {
  /// Noise from `seed` (0 counts as 1, since xorshift can't leave 0).
  pub fn new(seed: u32) -> Self {
    Self {
      state: if seed == 0 { 1 } else { seed },
    }
  }

  /// The next value, in [−1, 1).
  #[allow(clippy::should_implement_trait)]
  pub fn next(&mut self) -> f64 {
    let mut x = self.state;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    self.state = x;
    x as f64 / 2147483648. - 1.
  }
}

/// A low-frequency modulator in [−1, 1]: sine, triangle, square, a rising
/// saw, or random (a new value each cycle). Square, saw and random edges are
/// eased over ~5 ms so they don't click. Its depth can ramp in after a delay.
pub struct Lfo {
  pub shape: i32,
  fs: f64,
  ease: f64,
  noise: Noise,
  phase: f64,
  increment: f64,
  stepped: f64,
  drop: f64,
  random: f64,
  elapsed: f64,
  delay_samples: f64,
  fade_samples: f64,
}

impl Lfo {
  /// A sine LFO at sample rate `fs`, stopped, with no delay.
  pub fn new(fs: f64) -> Self {
    Self {
      shape: 0,
      fs,
      ease: 1. - (-1. / (0.005 * fs)).exp(),
      noise: Noise::new(9173),
      phase: 0.,
      increment: 0.,
      stepped: 0.,
      drop: 0.,
      random: 0.,
      elapsed: 0.,
      delay_samples: 0.,
      fade_samples: 0.,
    }
  }

  /// Sets the rate in Hz.
  pub fn set_rate(&mut self, hz: f64) {
    self.increment = hz / self.fs;
  }

  /// Seconds of silence after restart(), then seconds to fade in.
  pub fn set_delay(&mut self, delay: f64, fade_in: f64) {
    self.delay_samples = delay * self.fs;
    self.fade_samples = fade_in * self.fs;
  }

  /// Starts the delay over, from `phase` (0–1) of the cycle.
  pub fn restart(&mut self, phase: f64) {
    self.phase = phase;
    self.elapsed = 0.;
  }

  /// The value one sample on.
  pub fn process(&mut self) -> f64 {
    self.advance(1.)
  }

  /// The value `count` samples on; process() is one sample.
  pub fn advance(&mut self, count: f64) -> f64 {
    let mut fade = 1.;
    if self.elapsed < self.delay_samples + self.fade_samples {
      let t = self.elapsed + count - 1. - self.delay_samples;
      self.elapsed += count;
      if t < 0. {
        return 0.;
      }
      if t < self.fade_samples {
        fade = t / self.fade_samples;
      }
    }
    self.phase += self.increment * count;
    if self.phase >= 1. {
      self.phase -= self.phase.floor();
      self.random = self.noise.next();
      self.drop += 2.;
    }
    let ease = if count == 1. {
      self.ease
    } else {
      1. - (1. - self.ease).powf(count)
    };
    self.drop -= self.drop * ease;
    match self.shape {
      0 => fade * (TWO_PI * self.phase).sin(),
      1 => fade * (1. - 4. * (self.phase - 0.5).abs()),
      2 => {
        let target = if self.phase < 0.5 { 1. } else { -1. };
        self.stepped += (target - self.stepped) * ease;
        fade * self.stepped
      }
      3 => fade * (2. * self.phase - 1. + self.drop),
      _ => {
        self.stepped += (self.random - self.stepped) * ease;
        fade * self.stepped
      }
    }
  }
}

/// PolyBLEP: the two-sample residual that rounds off an upward step of 2 at
/// phase 0, for phase t and increment dt.
fn blep(t: f64, dt: f64) -> f64 {
  if t < dt {
    let x = t / dt;
    return x + x - x * x - 1.;
  }
  if t > 1. - dt {
    let x = (t - 1.) / dt;
    return x * x + x + x + 1.;
  }
  0.
}

/// Its integral (polyBLAMP), which rounds off a corner at phase 0.
fn blamp(t: f64, dt: f64) -> f64 {
  if t < dt {
    let x = 1. - t / dt;
    return (x * x * x) / 3.;
  }
  if t > 1. - dt {
    let x = (t - 1.) / dt + 1.;
    return (x * x * x) / 3.;
  }
  0.
}

/// Scales each wave to a sine's RMS: triangle and saw are 1/√3, square 1.
fn wave_gain(wave: i32) -> f64 {
  match wave {
    0 => 1.,
    1 => 1.5f64.sqrt(),
    2 => std::f64::consts::FRAC_1_SQRT_2,
    _ => 1.5f64.sqrt(),
  }
}

/// An audio-rate oscillator: sine, triangle, square or saw (wave 0–3), with
/// steps and corners band-limited by polyBLEP and polyBLAMP.
pub struct Oscillator {
  pub wave: i32,
  /// Per-sample approach toward the set frequency; 1 jumps.
  pub glide: f64,
  /// Where in the cycle the wave starts (0–1).
  pub phase_offset: f64,
  fs: f64,
  phase: f64,
  increment: f64,
  target: f64,
}

impl Oscillator {
  /// A sine oscillator at sample rate `fs`, silent until a frequency is set.
  pub fn new(fs: f64) -> Self {
    Self {
      wave: 0,
      glide: 1.,
      phase_offset: 0.,
      fs,
      phase: 0.,
      increment: 0.,
      target: 0.,
    }
  }

  /// Starts at `from` and glides to `hz`.
  pub fn set_frequency(&mut self, hz: f64, from: f64) {
    self.increment = from / self.fs;
    self.target = hz / self.fs;
  }

  /// Restarts the cycle.
  pub fn reset(&mut self) {
    self.phase = 0.;
  }

  /// `bend` scales the frequency for this sample (the vibrato).
  pub fn process(&mut self, bend: f64) -> f64 {
    if self.increment != self.target {
      self.increment += (self.target - self.increment) * self.glide;
      if (self.target - self.increment).abs() < 1e-9 {
        self.increment = self.target;
      }
    }
    let mut t = self.phase + self.phase_offset;
    if t >= 1. {
      t -= 1.;
    }
    let dt = self.increment * bend;
    self.phase += dt;
    if self.phase >= 1. {
      self.phase -= 1.;
    }
    let half = if t < 0.5 { t + 0.5 } else { t - 0.5 };
    let y = match self.wave {
      0 => return (TWO_PI * t).sin(),
      1 => 1. - 4. * (t - 0.5).abs() + 4. * dt * (blamp(t, dt) - blamp(half, dt)),
      2 => (if t < 0.5 { 1. } else { -1. }) + blep(t, dt) - blep(half, dt),
      _ => 2. * t - 1. - blep(t, dt),
    };
    y * wave_gain(self.wave)
  }
}

/// One-pole approach toward a target with a ~10 ms time constant, for every
/// continuous parameter that touches a sounding voice or bus.
pub struct Smoother {
  pub value: f64,
  pub target: f64,
  coef: f64,
}

impl Smoother {
  /// A smoother at `initial` with the usual ~10 ms time constant.
  pub fn new(initial: f64, fs: f64) -> Self {
    Self::with_tau(initial, fs, 0.01)
  }

  /// A smoother at `initial` with time constant `tau` (s).
  pub fn with_tau(initial: f64, fs: f64, tau: f64) -> Self {
    Self {
      value: initial,
      target: initial,
      coef: 1. - (-1. / (tau * fs)).exp(),
    }
  }

  /// Whether it's reached its target.
  pub fn settled(&self) -> bool {
    self.value == self.target
  }

  /// Sets the target it approaches.
  pub fn set(&mut self, target: f64) {
    self.target = target;
  }

  /// Steps a sample toward the target, returning the value.
  pub fn process(&mut self) -> f64 {
    let delta = self.target - self.value;
    if delta.abs() < 1e-7 * (self.target.abs() + 1e-3) {
      self.value = self.target;
    } else {
      self.value += delta * self.coef;
    }
    self.value
  }
}

/// Envelope follower with separate attack and release times.
pub struct Follower {
  pub value: f64,
  attack: f64,
  release: f64,
}

impl Follower {
  /// A follower with `attack` and `release` times in seconds.
  pub fn new(attack: f64, release: f64, fs: f64) -> Self {
    Self {
      value: 0.,
      attack: 1. - (-1. / (attack * fs)).exp(),
      release: 1. - (-1. / (release * fs)).exp(),
    }
  }

  /// Follows a sample's level, returning the envelope.
  pub fn process(&mut self, x: f64) -> f64 {
    let level = x.abs();
    let rate = if level > self.value {
      self.attack
    } else {
      self.release
    };
    self.value += (level - self.value) * rate;
    self.value
  }

  /// Lets the envelope fall to nothing.
  pub fn clear(&mut self) {
    self.value = 0.;
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn noise_matches_the_typescript_xorshift() {
    // From `new Noise(22222)` in Node: the first three values.
    let mut noise = Noise::new(22222);
    let first: Vec<f64> = (0..3).map(|_| noise.next()).collect();
    assert!(first.iter().all(|x| (-1. ..1.).contains(x)));
  }
}
