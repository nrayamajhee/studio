use super::delay_line::DelayLine;
use super::math::{js_round, next_prime};

const LINES: usize = 8;
const MAX_SIZE: f64 = 1.5;
const MAX_PREDELAY: f64 = 0.06;
const DIFFUSER_MS: [f64; 4] = [3.1, 5.3, 8.9, 12.7];
const DIFFUSER_GAIN: f64 = 0.6;
const SLEEP_LEVEL: f64 = 1e-5;
const WAKE_LEVEL: f64 = 1e-7;

fn input_gain() -> f64 {
  1. / (LINES as f64).sqrt()
}

/// y = −g·v + v[n−M], v = x + g·v[n−M]: Schroeder allpass in canonical form.
struct SchroederAllpass {
  line: DelayLine,
  length: usize,
}

impl SchroederAllpass {
  fn new(length: usize) -> Self {
    Self {
      line: DelayLine::new(length as f64),
      length,
    }
  }

  fn process(&mut self, x: f64) -> f64 {
    let delayed = self.line.read_int(self.length);
    let v = x + DIFFUSER_GAIN * delayed;
    self.line.write(v);
    delayed - DIFFUSER_GAIN * v
  }

  fn clear(&mut self) {
    self.line.clear();
  }
}

/// 8-line feedback delay network reverb with a Householder feedback matrix,
/// per-line damping lowpass and a predelay + diffuser front end.
pub struct Fdn {
  fs: f64,
  lines: Vec<DelayLine>,
  lengths: [usize; LINES],
  gains: [f64; LINES],
  damp_state: [f64; LINES],
  taps: [f64; LINES],
  predelay: DelayLine,
  diffusers: Vec<SchroederAllpass>,
  predelay_samples: usize,
  size: f64,
  t60: f64,
  damping: f64,
  quiet_samples: f64,
  pub sleeping: bool,
}

impl Fdn {
  pub fn new(fs: f64) -> Self {
    let mut fdn = Self {
      fs,
      lines: Vec::with_capacity(LINES),
      lengths: [0; LINES],
      gains: [0.; LINES],
      damp_state: [0.; LINES],
      taps: [0.; LINES],
      predelay: DelayLine::new(MAX_PREDELAY * fs + 2.),
      diffusers: Vec::new(),
      predelay_samples: 0,
      size: 1.,
      t60: 2.,
      damping: 0.3,
      quiet_samples: 0.,
      sleeping: true,
    };
    for i in 0..LINES {
      let longest = fdn.line_length(i, MAX_SIZE);
      fdn.lines.push(DelayLine::new(longest as f64));
    }
    let mut used: Vec<u64> = Vec::new();
    for ms in DIFFUSER_MS {
      let mut length = next_prime((ms * fs) / 1000.);
      while used.contains(&length) {
        length = next_prime((length + 1) as f64);
      }
      used.push(length);
      fdn.diffusers.push(SchroederAllpass::new(length as usize));
    }
    fdn.set_size(1.);
    fdn
  }

  pub fn set_size(&mut self, size: f64) {
    self.size = size.max(0.5).min(MAX_SIZE);
    for i in 0..LINES {
      self.lengths[i] = self.line_length(i, self.size);
    }
    self.update_gains();
  }

  pub fn set_decay(&mut self, t60: f64) {
    self.t60 = t60.max(0.1);
    self.update_gains();
  }

  pub fn set_damping(&mut self, p: f64) {
    self.damping = p.max(0.).min(0.95);
  }

  pub fn set_predelay(&mut self, seconds: f64) {
    self.predelay_samples = js_round(seconds.max(0.).min(MAX_PREDELAY) * self.fs) as usize;
  }

  /// Adds the wet signal for input[0..n) into out_l/out_r.
  pub fn process(&mut self, input: &[f32], out_l: &mut [f32], out_r: &mut [f32], n: usize) {
    if self.sleeping {
      if !input[..n].iter().any(|x| (*x as f64).abs() > WAKE_LEVEL) {
        return;
      }
      self.sleeping = false;
      self.quiet_samples = 0.;
    }

    let p = self.damping;
    let gain = input_gain();
    let mut block_peak = 0f64;
    let mut input_peak = 0f64;
    for i in 0..n {
      let mut x = input[i] as f64;
      let ax = x.abs();
      if ax > input_peak {
        input_peak = ax;
      }
      if self.predelay_samples > 0 {
        self.predelay.write(x);
        x = self.predelay.read_int(self.predelay_samples);
      }
      for diffuser in &mut self.diffusers {
        x = diffuser.process(x);
      }

      let mut sum = 0.;
      for l in 0..LINES {
        let s = self.lines[l].read_int(self.lengths[l]);
        self.damp_state[l] = (1. - p) * s + p * self.damp_state[l];
        self.taps[l] = self.damp_state[l] * self.gains[l];
        sum += self.taps[l];
      }
      // Householder reflection I − (2/N)·11ᵀ in O(N).
      let shared = (2. / LINES as f64) * sum;
      for l in 0..LINES {
        let sign = if l & 1 == 0 { gain } else { -gain };
        self.lines[l].write(x * sign + self.taps[l] - shared);
      }
      let t = &self.taps;
      let left = 0.5 * (t[0] - t[2] + t[4] - t[6]);
      let right = 0.5 * (t[1] - t[3] + t[5] - t[7]);
      out_l[i] = (out_l[i] as f64 + left) as f32;
      out_r[i] = (out_r[i] as f64 + right) as f32;
      let level = left.abs().max(right.abs());
      if level > block_peak {
        block_peak = level;
      }
    }

    if input_peak < WAKE_LEVEL && block_peak < SLEEP_LEVEL {
      self.quiet_samples += n as f64;
      if self.quiet_samples > 0.5 * self.fs {
        self.sleep();
      }
    } else {
      self.quiet_samples = 0.;
    }
  }

  pub fn clear(&mut self) {
    self.sleep();
  }

  fn sleep(&mut self) {
    for line in &mut self.lines {
      line.clear();
    }
    for diffuser in &mut self.diffusers {
      diffuser.clear();
    }
    self.predelay.clear();
    self.damp_state = [0.; LINES];
    self.taps = [0.; LINES];
    self.quiet_samples = 0.;
    self.sleeping = true;
  }

  /// ms_i = 29·(71/29)^(i/7), mutually prime lengths in samples.
  fn line_length(&self, i: usize, size: f64) -> usize {
    let ms = 29. * (71f64 / 29.).powf(i as f64 / 7.);
    next_prime(js_round(((ms * self.fs) / 1000.) * size)) as usize
  }

  /// g_i = 10^(−3·L_i/(T60·fs)) so every line loses 60 dB in T60 seconds.
  fn update_gains(&mut self) {
    for i in 0..LINES {
      self.gains[i] = 10f64.powf((-3. * self.lengths[i] as f64) / (self.t60 * self.fs));
    }
  }
}
