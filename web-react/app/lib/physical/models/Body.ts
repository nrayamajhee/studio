import { OnePoleHighpass, OnePoleLowpass } from "../dsp/filters";
import { LN_1000 } from "../dsp/math";
import { ModalBank } from "../dsp/modal";
import { Svf } from "../dsp/Svf";
import type { BodySpec } from "../patches/types";

const TILT_SPLIT_HZ = 800;

// Per-channel ±6 dB tilt around 800 Hz: a one-pole split into low and high
// bands with opposite gains.
class Tilt {
  private readonly lp = new OnePoleLowpass();
  low = 1;
  high = 1;

  constructor(fs: number) {
    this.lp.setCutoff(TILT_SPLIT_HZ, fs);
  }

  process(x: number) {
    const low = this.lp.process(x);
    return low * this.low + (x - low) * this.high;
  }
}

// The resonating body shared by every voice of an instrument: a modal
// soundboard or top plate (piano, guitar, upright bass), a radiation filter at
// the open end or bell (winds), or none.
export class Body {
  private readonly spec: BodySpec;
  private readonly fs: number;
  private readonly bank: ModalBank | null = null;
  private readonly highpassL = new OnePoleHighpass();
  private readonly highpassR = new OnePoleHighpass();
  private readonly presenceL = new Svf("peak");
  private readonly presenceR = new Svf("peak");
  private readonly tiltL: Tilt;
  private readonly tiltR: Tilt;
  private mix = 0.5;
  private tilted = false;

  constructor(spec: BodySpec, fs: number) {
    this.spec = spec;
    this.fs = fs;
    this.tiltL = new Tilt(fs);
    this.tiltR = new Tilt(fs);
    if (spec.type === "modal") {
      this.bank = new ModalBank(spec.modes.length, fs);
      this.bank.count = spec.modes.length;
    }
    this.configure(1, 1, 0, 0.5);
  }

  // size scales mode frequencies (0.7–1.4×), resonance scales their T60
  // (0.5–2×), tone tilts ±6 dB, mix blends the body in.
  configure(size: number, resonance: number, tone: number, mix: number) {
    this.mix = mix;
    const spec = this.spec;
    if (spec.type === "modal" && this.bank) {
      for (let i = 0; i < spec.modes.length; i++) {
        const [freq, t60, amp] = spec.modes[i];
        // A body is driven continuously, so normalize each mode's resonant
        // peak gain (≈ A/(2(1 − r)) for impulse amplitude A) to `amp`.
        const decay = t60 * resonance;
        const r = Math.exp(-LN_1000 / (decay * this.fs));
        this.bank.setMode(i, freq * size, decay, amp * 2 * (1 - r));
      }
    } else if (spec.type === "radiation") {
      const cutoff = spec.highpass * size;
      this.highpassL.setCutoff(cutoff, this.fs);
      this.highpassR.setCutoff(cutoff, this.fs);
      if (spec.presence) {
        const { freq, q, gainDb } = spec.presence;
        this.presenceL.setPeak(freq * size, q, gainDb * resonance, this.fs);
        this.presenceR.setPeak(freq * size, q, gainDb * resonance, this.fs);
      }
    }
    const high = 10 ** ((tone * 6) / 20);
    this.tiltL.low = this.tiltR.low = 1 / high;
    this.tiltL.high = this.tiltR.high = high;
    this.tilted = tone !== 0;
  }

  process(left: Float32Array, right: Float32Array, n: number) {
    const spec = this.spec;
    const mix = this.mix;
    if (spec.type === "modal" && this.bank) {
      const bank = this.bank;
      for (let i = 0; i < n; i++) {
        const wet = mix * bank.process(0.5 * (left[i] + right[i]));
        left[i] += wet;
        right[i] += wet;
      }
    } else if (spec.type === "radiation") {
      const presence = spec.presence !== undefined;
      for (let i = 0; i < n; i++) {
        let l = this.highpassL.process(left[i]);
        let r = this.highpassR.process(right[i]);
        if (presence) {
          l = this.presenceL.process(l);
          r = this.presenceR.process(r);
        }
        left[i] += mix * (l - left[i]);
        right[i] += mix * (r - right[i]);
      }
    }
    if (this.tilted) {
      for (let i = 0; i < n; i++) {
        left[i] = this.tiltL.process(left[i]);
        right[i] = this.tiltR.process(right[i]);
      }
    }
  }
}
