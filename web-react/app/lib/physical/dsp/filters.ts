import { TWO_PI } from "./math";

export class OnePoleLowpass {
  p = 0;
  private y1 = 0;

  setPole(p: number) {
    this.p = p;
  }

  setCutoff(hz: number, fs: number) {
    this.p = Math.exp((-TWO_PI * hz) / fs);
  }

  process(x: number) {
    this.y1 = (1 - this.p) * x + this.p * this.y1;
    return this.y1;
  }

  clear() {
    this.y1 = 0;
  }
}

// x minus its one-pole lowpass: a gentle first-order highpass.
export class OnePoleHighpass {
  private p = 0;
  private lp = 0;

  setCutoff(hz: number, fs: number) {
    this.p = Math.exp((-TWO_PI * hz) / fs);
  }

  process(x: number) {
    this.lp = (1 - this.p) * x + this.p * this.lp;
    return x - this.lp;
  }

  clear() {
    this.lp = 0;
  }
}

// y = x − x₁ + R·y₁ with R = 1 − 2π·20/fs (about a 20 Hz corner).
export class DcBlocker {
  private readonly r: number;
  private x1 = 0;
  private y1 = 0;

  constructor(fs: number) {
    this.r = 1 - (TWO_PI * 20) / fs;
  }

  process(x: number) {
    const y = x - this.x1 + this.r * this.y1;
    this.x1 = x;
    this.y1 = y;
    return y;
  }

  clear() {
    this.x1 = 0;
    this.y1 = 0;
  }
}

// First-order allpass y = a·x + x₁ − a·y₁. Used both as a Thiran tuning stage
// and as a dispersion stage (a < 0 delays lows more than highs).
export class Allpass1 {
  a = 0;
  private x1 = 0;
  private y1 = 0;

  process(x: number) {
    const y = this.a * x + this.x1 - this.a * this.y1;
    this.x1 = x;
    this.y1 = y;
    return y;
  }

  clear() {
    this.x1 = 0;
    this.y1 = 0;
  }
}

// Direct-form-I biquad y = b0·x + b1·x₁ + b2·x₂ − a1·y₁ − a2·y₂.
export class Biquad {
  b0 = 1;
  b1 = 0;
  b2 = 0;
  a1 = 0;
  a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  set(b0: number, b1: number, b2: number, a1: number, a2: number) {
    this.b0 = b0;
    this.b1 = b1;
    this.b2 = b2;
    this.a1 = a1;
    this.a2 = a2;
  }

  process(x: number) {
    const y =
      this.b0 * x +
      this.b1 * this.x1 +
      this.b2 * this.x2 -
      this.a1 * this.y1 -
      this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }

  clear() {
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
  }
}

// Moves the complex pole or zero pair of a z-plane quadratic 1 + c1·z⁻¹ + c2·z⁻²
// designed at `fromRate` to the same analog frequency at `toRate`.
export function rescaleQuadratic(
  c1: number,
  c2: number,
  fromRate: number,
  toRate: number,
): [number, number] {
  if (c2 <= 0 || c1 * c1 >= 4 * c2) return [c1, c2];
  const r = Math.sqrt(c2);
  const theta = (Math.acos(-c1 / (2 * r)) * fromRate) / toRate;
  const rScaled = r ** (fromRate / toRate);
  return [-2 * rScaled * Math.cos(theta), rScaled * rScaled];
}
