import { TWO_PI } from "./math";

// xorshift32 with a per-voice seed so offline renders are deterministic.
// Output is in [−1, 1).
export class Noise {
  private state: number;

  constructor(seed = 22222) {
    this.state = seed >>> 0 || 1;
  }

  seed(seed: number) {
    this.state = seed >>> 0 || 1;
  }

  next() {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 2147483648 - 1;
  }
}

// A low-frequency modulator in [−1, 1]: sine, triangle, square, or random (a
// new value each cycle). Square and random edges are eased over ~5 ms so they
// don't click. Its depth can ramp in after a delay, the way a player starts
// vibrato late and widens it; with no delay it runs at full depth at once.
export class Lfo {
  shape = 0;
  private readonly fs: number;
  private readonly ease: number;
  private readonly noise = new Noise(9173);
  private phase = 0;
  private increment = 0;
  private stepped = 0;
  private random = 0;
  private elapsed = 0;
  private delaySamples = 0;
  private fadeSamples = 0;

  constructor(fs: number) {
    this.fs = fs;
    this.ease = 1 - Math.exp(-1 / (0.005 * fs));
  }

  setRate(hz: number) {
    this.increment = hz / this.fs;
  }

  // Seconds of silence after restart(), then seconds to fade in.
  setDelay(delay: number, fadeIn: number) {
    this.delaySamples = delay * this.fs;
    this.fadeSamples = fadeIn * this.fs;
  }

  // Starts the delay over, from `phase` (0–1) of the cycle.
  restart(phase = 0) {
    this.phase = phase;
    this.elapsed = 0;
  }

  process() {
    let fade = 1;
    if (this.elapsed < this.delaySamples + this.fadeSamples) {
      const t = this.elapsed++ - this.delaySamples;
      if (t < 0) return 0;
      if (t < this.fadeSamples) fade = t / this.fadeSamples;
    }
    this.phase += this.increment;
    if (this.phase >= 1) {
      this.phase -= 1;
      this.random = this.noise.next();
    }
    switch (this.shape) {
      case 0:
        return fade * Math.sin(TWO_PI * this.phase);
      case 1:
        return fade * (1 - 4 * Math.abs(this.phase - 0.5));
      case 2:
        this.stepped +=
          ((this.phase < 0.5 ? 1 : -1) - this.stepped) * this.ease;
        return fade * this.stepped;
      default:
        this.stepped += (this.random - this.stepped) * this.ease;
        return fade * this.stepped;
    }
  }
}

// PolyBLEP (Välimäki & Huovilainen): the two-sample residual that rounds off
// an upward step of 2 at phase 0, for phase t and increment dt.
function blep(t: number, dt: number) {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

// Its integral (polyBLAMP), which rounds off a corner at phase 0.
function blamp(t: number, dt: number) {
  if (t < dt) {
    const x = 1 - t / dt;
    return (x * x * x) / 3;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt + 1;
    return (x * x * x) / 3;
  }
  return 0;
}

// Scales each wave to a sine's RMS: triangle and saw are 1/√3, square 1.
const WAVE_GAINS = [1, Math.sqrt(1.5), Math.SQRT1_2, Math.sqrt(1.5)];

// An audio-rate oscillator: sine, triangle, square or saw (wave 0–3). Steps
// and corners are band-limited with polyBLEP and polyBLAMP, so high notes
// don't alias the way the LFO's raw shapes would.
export class Oscillator {
  wave = 0;
  // Per-sample approach toward the set frequency; 1 jumps.
  glide = 1;
  // Where in the cycle the wave starts (0–1), so two oscillators can be
  // aligned or offset relative to each other.
  phaseOffset = 0;
  private readonly fs: number;
  private phase = 0;
  private increment = 0;
  private target = 0;

  constructor(fs: number) {
    this.fs = fs;
  }

  // Starts at `from` and glides to `hz`.
  setFrequency(hz: number, from = hz) {
    this.increment = from / this.fs;
    this.target = hz / this.fs;
  }

  reset() {
    this.phase = 0;
  }

  // `bend` scales the frequency for this sample (the LFO's vibrato).
  process(bend = 1) {
    if (this.increment !== this.target) {
      this.increment += (this.target - this.increment) * this.glide;
      if (Math.abs(this.target - this.increment) < 1e-9)
        this.increment = this.target;
    }
    let t = this.phase + this.phaseOffset;
    if (t >= 1) t -= 1;
    const dt = this.increment * bend;
    this.phase += dt;
    if (this.phase >= 1) this.phase -= 1;
    const half = t < 0.5 ? t + 0.5 : t - 0.5;
    let y: number;
    switch (this.wave) {
      case 0:
        return Math.sin(TWO_PI * t);
      case 1:
        // Corners at the trough (phase 0) and the peak (phase ½), where the
        // slope turns by ±8 per cycle.
        y =
          1 - 4 * Math.abs(t - 0.5) + 4 * dt * (blamp(t, dt) - blamp(half, dt));
        break;
      case 2:
        y = (t < 0.5 ? 1 : -1) + blep(t, dt) - blep(half, dt);
        break;
      default:
        y = 2 * t - 1 - blep(t, dt);
    }
    return y * WAVE_GAINS[this.wave];
  }
}

// One-pole approach toward a target with a ~10 ms time constant, for every
// continuous parameter that touches a sounding voice or bus.
export class Smoother {
  value: number;
  target: number;
  private readonly coef: number;

  constructor(initial: number, fs: number, tau = 0.01) {
    this.value = initial;
    this.target = initial;
    this.coef = 1 - Math.exp(-1 / (tau * fs));
  }

  get settled() {
    return this.value === this.target;
  }

  set(target: number) {
    this.target = target;
  }

  jump(value: number) {
    this.value = value;
    this.target = value;
  }

  process() {
    const delta = this.target - this.value;
    if (Math.abs(delta) < 1e-7 * (Math.abs(this.target) + 1e-3)) {
      this.value = this.target;
    } else {
      this.value += delta * this.coef;
    }
    return this.value;
  }
}

// Envelope follower with separate attack and release times.
export class Follower {
  value = 0;
  private readonly attack: number;
  private readonly release: number;

  constructor(attack: number, release: number, fs: number) {
    this.attack = 1 - Math.exp(-1 / (attack * fs));
    this.release = 1 - Math.exp(-1 / (release * fs));
  }

  process(x: number) {
    const level = Math.abs(x);
    this.value +=
      (level - this.value) * (level > this.value ? this.attack : this.release);
    return this.value;
  }

  clear() {
    this.value = 0;
  }
}
