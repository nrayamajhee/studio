import { DelayLine } from "./DelayLine";
import { nextPrime } from "./math";

const LINES = 8;
const MAX_SIZE = 1.5;
const MAX_PREDELAY = 0.06;
const DIFFUSER_MS = [3.1, 5.3, 8.9, 12.7];
const DIFFUSER_GAIN = 0.6;
// Output and input sign patterns over the 8 lines.
const INPUT_GAIN = 1 / Math.sqrt(LINES);
const SLEEP_LEVEL = 1e-5; // −100 dBFS
const WAKE_LEVEL = 1e-7;

// y = −g·v + v[n−M], v = x + g·v[n−M]: Schroeder allpass in canonical form.
class SchroederAllpass {
  private readonly line: DelayLine;
  private readonly length: number;

  constructor(length: number) {
    this.length = length;
    this.line = new DelayLine(length);
  }

  process(x: number) {
    const delayed = this.line.readInt(this.length);
    const v = x + DIFFUSER_GAIN * delayed;
    this.line.write(v);
    return delayed - DIFFUSER_GAIN * v;
  }

  clear() {
    this.line.clear();
  }
}

// 8-line feedback delay network reverb with a Householder feedback matrix,
// per-line damping lowpass and a predelay + diffuser front end.
export class Fdn {
  private readonly fs: number;
  private readonly lines: DelayLine[] = [];
  private readonly lengths = new Int32Array(LINES);
  private readonly gains = new Float64Array(LINES);
  private readonly dampState = new Float64Array(LINES);
  private readonly taps = new Float64Array(LINES);
  private readonly predelay: DelayLine;
  private readonly diffusers: SchroederAllpass[] = [];
  private predelaySamples = 0;
  private size = 1;
  private t60 = 2;
  private damping = 0.3;
  private quietSamples = 0;
  sleeping = true;

  constructor(fs: number) {
    this.fs = fs;
    for (let i = 0; i < LINES; i++) {
      const longest = this.lineLength(i, MAX_SIZE);
      this.lines.push(new DelayLine(longest));
    }
    this.predelay = new DelayLine(MAX_PREDELAY * fs + 2);
    const used = new Set<number>();
    for (const ms of DIFFUSER_MS) {
      let length = nextPrime((ms * fs) / 1000);
      while (used.has(length)) length = nextPrime(length + 1);
      used.add(length);
      this.diffusers.push(new SchroederAllpass(length));
    }
    this.setSize(1);
  }

  setSize(size: number) {
    this.size = Math.min(MAX_SIZE, Math.max(0.5, size));
    for (let i = 0; i < LINES; i++) {
      this.lengths[i] = this.lineLength(i, this.size);
    }
    this.updateGains();
  }

  setDecay(t60: number) {
    this.t60 = Math.max(0.1, t60);
    this.updateGains();
  }

  setDamping(p: number) {
    this.damping = Math.min(0.95, Math.max(0, p));
  }

  setPredelay(seconds: number) {
    this.predelaySamples = Math.round(
      Math.min(MAX_PREDELAY, Math.max(0, seconds)) * this.fs,
    );
  }

  // Adds the wet signal for input[0..n) into outL/outR.
  process(
    input: Float32Array,
    outL: Float32Array,
    outR: Float32Array,
    n: number,
  ) {
    if (this.sleeping) {
      let loud = false;
      for (let i = 0; i < n; i++) {
        if (Math.abs(input[i]) > WAKE_LEVEL) {
          loud = true;
          break;
        }
      }
      if (!loud) return;
      this.sleeping = false;
      this.quietSamples = 0;
    }

    const { lines, lengths, gains, dampState, taps } = this;
    const p = this.damping;
    let blockPeak = 0;
    let inputPeak = 0;
    for (let i = 0; i < n; i++) {
      let x = input[i];
      const ax = x < 0 ? -x : x;
      if (ax > inputPeak) inputPeak = ax;
      if (this.predelaySamples > 0) {
        this.predelay.write(x);
        x = this.predelay.readInt(this.predelaySamples);
      }
      for (let d = 0; d < this.diffusers.length; d++) {
        x = this.diffusers[d].process(x);
      }

      let sum = 0;
      for (let l = 0; l < LINES; l++) {
        const s = lines[l].readInt(lengths[l]);
        dampState[l] = (1 - p) * s + p * dampState[l];
        taps[l] = dampState[l] * gains[l];
        sum += taps[l];
      }
      // Householder reflection I − (2/N)·11ᵀ in O(N).
      const shared = (2 / LINES) * sum;
      for (let l = 0; l < LINES; l++) {
        const sign = (l & 1) === 0 ? INPUT_GAIN : -INPUT_GAIN;
        lines[l].write(x * sign + taps[l] - shared);
      }
      const left = 0.5 * (taps[0] - taps[2] + taps[4] - taps[6]);
      const right = 0.5 * (taps[1] - taps[3] + taps[5] - taps[7]);
      outL[i] += left;
      outR[i] += right;
      const level = Math.max(Math.abs(left), Math.abs(right));
      if (level > blockPeak) blockPeak = level;
    }

    if (inputPeak < WAKE_LEVEL && blockPeak < SLEEP_LEVEL) {
      this.quietSamples += n;
      if (this.quietSamples > 0.5 * this.fs) this.sleep();
    } else {
      this.quietSamples = 0;
    }
  }

  clear() {
    this.sleep();
  }

  private sleep() {
    for (let i = 0; i < this.lines.length; i++) this.lines[i].clear();
    for (let i = 0; i < this.diffusers.length; i++) this.diffusers[i].clear();
    this.predelay.clear();
    this.dampState.fill(0);
    this.taps.fill(0);
    this.quietSamples = 0;
    this.sleeping = true;
  }

  // ms_i = 29·(71/29)^(i/7), mutually prime lengths in samples.
  private lineLength(i: number, size: number) {
    const ms = 29 * (71 / 29) ** (i / 7);
    return nextPrime(Math.round(((ms * this.fs) / 1000) * size));
  }

  // g_i = 10^(−3·L_i/(T60·fs)) so every line loses 60 dB in T60 seconds.
  private updateGains() {
    for (let i = 0; i < LINES; i++) {
      this.gains[i] = 10 ** ((-3 * this.lengths[i]) / (this.t60 * this.fs));
    }
  }
}
