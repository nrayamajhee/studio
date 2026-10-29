//! The instrument body every voice of an instrument shares, on its bus: a
//! soundboard, a radiating bell, or none, with a tone tilt after.

use crate::dsp::filters::{OnePoleHighpass, OnePoleLowpass};
use crate::dsp::math::LN_1000;
use crate::dsp::modal::ModalBank;
use crate::dsp::svf::{Svf, SvfMode};
use crate::patches::BodySpec;

/// Where the tone tilt splits lows from highs, in hertz.
const TILT_SPLIT_HZ: f64 = 800.;

/// Per-channel ±6 dB tilt around 800 Hz.
struct Tilt {
  lp: OnePoleLowpass,
  low: f64,
  high: f64,
}

impl Tilt {
  /// A flat tilt at `fs`.
  fn new(fs: f64) -> Self {
    let mut lp = OnePoleLowpass::default();
    lp.set_cutoff(TILT_SPLIT_HZ, fs);
    Self {
      lp,
      low: 1.,
      high: 1.,
    }
  }

  /// Tilts one sample: the lows and highs each scaled by their gain.
  fn process(&mut self, x: f64) -> f64 {
    let low = self.lp.process(x);
    low * self.low + (x - low) * self.high
  }
}

/// The resonating body shared by every voice of an instrument: a modal
/// soundboard or top plate, a radiation filter at the open end or bell, or
/// none.
pub struct Body {
  spec: &'static BodySpec,
  fs: f64,
  bank: Option<ModalBank>,
  highpass_l: OnePoleHighpass,
  highpass_r: OnePoleHighpass,
  presence_l: Svf,
  presence_r: Svf,
  tilt_l: Tilt,
  tilt_r: Tilt,
  mix: f64,
  tilted: bool,
}

impl Body {
  /// The body `spec` describes at `fs`, at its default size, resonance and mix,
  /// and no tilt.
  pub fn new(spec: &'static BodySpec, fs: f64) -> Self {
    let bank = match spec {
      BodySpec::Modal { modes } => {
        let mut bank = ModalBank::new(modes.len(), fs);
        bank.count = modes.len();
        Some(bank)
      }
      _ => None,
    };
    let mut body = Self {
      spec,
      fs,
      bank,
      highpass_l: OnePoleHighpass::default(),
      highpass_r: OnePoleHighpass::default(),
      presence_l: Svf::new(SvfMode::Peak),
      presence_r: Svf::new(SvfMode::Peak),
      tilt_l: Tilt::new(fs),
      tilt_r: Tilt::new(fs),
      mix: 0.5,
      tilted: false,
    };
    body.configure(1., 1., 0., 0.5);
    body
  }

  /// size scales mode frequencies, resonance their T60, tone tilts ±6 dB,
  /// mix blends the body in.
  pub fn configure(&mut self, size: f64, resonance: f64, tone: f64, mix: f64) {
    self.mix = mix;
    match self.spec {
      BodySpec::Modal { modes } => {
        if let Some(bank) = &mut self.bank {
          for (i, &(freq, t60, amp)) in modes.iter().enumerate() {
            // Normalize each mode's resonant peak gain to `amp`.
            let decay = t60 * resonance;
            let r = (-LN_1000 / (decay * self.fs)).exp();
            bank.set_mode(i, freq * size, decay, amp * 2. * (1. - r));
          }
        }
      }
      BodySpec::Radiation { highpass, presence } => {
        let cutoff = highpass * size;
        self.highpass_l.set_cutoff(cutoff, self.fs);
        self.highpass_r.set_cutoff(cutoff, self.fs);
        if let Some(p) = presence {
          self
            .presence_l
            .set_peak(p.freq * size, p.q, p.gain_db * resonance, self.fs);
          self
            .presence_r
            .set_peak(p.freq * size, p.q, p.gain_db * resonance, self.fs);
        }
      }
      BodySpec::None => {}
    }
    let high = 10f64.powf((tone * 6.) / 20.);
    self.tilt_l.low = 1. / high;
    self.tilt_r.low = 1. / high;
    self.tilt_l.high = high;
    self.tilt_r.high = high;
    self.tilted = tone != 0.;
  }

  /// Runs `n` frames of the bus through the body, blended in by its mix, then
  /// the tilt, in place.
  pub fn process(&mut self, left: &mut [f32], right: &mut [f32], n: usize) {
    let mix = self.mix;
    match self.spec {
      BodySpec::Modal { .. } => {
        if let Some(bank) = &mut self.bank {
          for i in 0..n {
            let wet = mix * bank.process(0.5 * (left[i] as f64 + right[i] as f64));
            left[i] = (left[i] as f64 + wet) as f32;
            right[i] = (right[i] as f64 + wet) as f32;
          }
        }
      }
      BodySpec::Radiation { presence, .. } => {
        let presence = presence.is_some();
        for i in 0..n {
          let mut l = self.highpass_l.process(left[i] as f64);
          let mut r = self.highpass_r.process(right[i] as f64);
          if presence {
            l = self.presence_l.process(l);
            r = self.presence_r.process(r);
          }
          left[i] = (left[i] as f64 + mix * (l - left[i] as f64)) as f32;
          right[i] = (right[i] as f64 + mix * (r - right[i] as f64)) as f32;
        }
      }
      BodySpec::None => {}
    }
    if self.tilted {
      for i in 0..n {
        left[i] = self.tilt_l.process(left[i] as f64) as f32;
        right[i] = self.tilt_r.process(right[i] as f64) as f32;
      }
    }
  }
}
