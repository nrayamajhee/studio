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

// Sine or triangle LFO whose depth ramps in after `delay`, the way a player
// starts vibrato late and widens it.
export class Lfo {
  private readonly fs: number;
  private phase = 0;
  private increment = 0;
  private elapsed = 0;
  private delaySamples = 0;
  private fadeSamples = 1;
  triangle = false;

  constructor(fs: number) {
    this.fs = fs;
  }

  set(rate: number, delay: number, fadeIn: number) {
    this.increment = rate / this.fs;
    this.delaySamples = delay * this.fs;
    this.fadeSamples = Math.max(1, fadeIn * this.fs);
  }

  setRate(rate: number) {
    this.increment = rate / this.fs;
  }

  restart() {
    this.phase = 0;
    this.elapsed = 0;
  }

  process() {
    const t = this.elapsed++ - this.delaySamples;
    if (t < 0) return 0;
    this.phase += this.increment;
    if (this.phase >= 1) this.phase -= 1;
    const fade = t < this.fadeSamples ? t / this.fadeSamples : 1;
    const wave = this.triangle
      ? 1 - 4 * Math.abs(this.phase - 0.5)
      : Math.sin(TWO_PI * this.phase);
    return wave * fade;
  }
}

// A free-running modulator in [−1, 1]: sine, triangle, square, or random (a new
// value each cycle). Square and random edges are eased over ~5 ms so they
// don't click.
export class ModLfo {
  shape = 0;
  private readonly fs: number;
  private readonly ease: number;
  private readonly noise = new Noise(9173);
  private phase = 0;
  private increment = 0;
  private stepped = 0;
  private random = 0;

  constructor(fs: number) {
    this.fs = fs;
    this.ease = 1 - Math.exp(-1 / (0.005 * fs));
  }

  setRate(hz: number) {
    this.increment = hz / this.fs;
  }

  process() {
    this.phase += this.increment;
    if (this.phase >= 1) {
      this.phase -= 1;
      this.random = this.noise.next();
    }
    switch (this.shape) {
      case 0:
        return Math.sin(TWO_PI * this.phase);
      case 1:
        return 1 - 4 * Math.abs(this.phase - 0.5);
      case 2:
        this.stepped +=
          ((this.phase < 0.5 ? 1 : -1) - this.stepped) * this.ease;
        return this.stepped;
      default:
        this.stepped += (this.random - this.stepped) * this.ease;
        return this.stepped;
    }
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
