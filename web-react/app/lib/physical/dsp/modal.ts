import { LN_1000, TWO_PI } from "./math";

// One mode, all-pole: y = g·x + c·y₁ − r²·y₂ with θ = 2πf/fs,
// r = exp(−ln1000/(T60·fs)), c = 2r·cos θ. Its impulse response is
// rⁿ·sin((n+1)θ)/sin θ, so g = amp·sin θ gives a decaying sine of peak ≈ amp.
export class Resonator2 {
  private c = 0;
  private r2 = 0;
  private g = 0;
  private y1 = 0;
  private y2 = 0;

  set(freq: number, t60: number, amp: number, fs: number) {
    const f = Math.min(freq, 0.45 * fs);
    const theta = (TWO_PI * f) / fs;
    const r = Math.exp(-LN_1000 / (t60 * fs));
    this.c = 2 * r * Math.cos(theta);
    this.r2 = r * r;
    this.g = amp * Math.sin(theta);
  }

  process(x: number) {
    const y = this.g * x + this.c * this.y1 - this.r2 * this.y2;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }

  clear() {
    this.y1 = 0;
    this.y2 = 0;
  }
}

// A bank of Resonator2 modes in structure-of-arrays form.
export class ModalBank {
  readonly size: number;
  private readonly fs: number;
  private readonly freq: Float64Array;
  private readonly t60: Float64Array;
  private readonly amp: Float64Array;
  private readonly r: Float64Array;
  private readonly c: Float64Array;
  private readonly r2: Float64Array;
  private readonly g: Float64Array;
  private readonly y1: Float64Array;
  private readonly y2: Float64Array;
  count = 0;
  private freqScale = 1;
  private decayScale = 1;

  constructor(size: number, fs: number) {
    this.size = size;
    this.fs = fs;
    this.freq = new Float64Array(size);
    this.t60 = new Float64Array(size);
    this.amp = new Float64Array(size);
    this.r = new Float64Array(size);
    this.c = new Float64Array(size);
    this.r2 = new Float64Array(size);
    this.g = new Float64Array(size);
    this.y1 = new Float64Array(size);
    this.y2 = new Float64Array(size);
  }

  setMode(i: number, freq: number, t60: number, amp: number) {
    this.freq[i] = freq;
    this.t60[i] = t60;
    this.amp[i] = amp;
    this.updateDecay(i);
    this.updateFrequency(i);
  }

  // Recomputes c and g for all modes; call at most every 32 samples.
  scaleFrequencies(k: number) {
    this.freqScale = k;
    for (let i = 0; i < this.count; i++) this.updateFrequency(i);
  }

  scaleDecay(k: number) {
    this.decayScale = k;
    for (let i = 0; i < this.count; i++) {
      this.updateDecay(i);
      this.updateFrequency(i);
    }
  }

  process(x: number) {
    let sum = 0;
    const { c, r2, g, y1, y2 } = this;
    for (let i = 0; i < this.count; i++) {
      const y = g[i] * x + c[i] * y1[i] - r2[i] * y2[i];
      y2[i] = y1[i];
      y1[i] = y;
      sum += y;
    }
    return sum;
  }

  clear() {
    this.y1.fill(0);
    this.y2.fill(0);
  }

  private updateDecay(i: number) {
    const r = Math.exp(-LN_1000 / (this.t60[i] * this.decayScale * this.fs));
    this.r[i] = r;
    this.r2[i] = r * r;
  }

  private updateFrequency(i: number) {
    const f = this.freq[i] * this.freqScale;
    if (f >= 0.45 * this.fs) {
      this.c[i] = 0;
      this.g[i] = 0;
      return;
    }
    const theta = (TWO_PI * f) / this.fs;
    this.c[i] = 2 * this.r[i] * Math.cos(theta);
    this.g[i] = this.amp[i] * Math.sin(theta);
  }
}
