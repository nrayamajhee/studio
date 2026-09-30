import { DelayLine } from "../dsp/DelayLine";
import { ModLfo, Smoother } from "../dsp/generators";
import { Svf } from "../dsp/Svf";

// Targets, in the order of the lfo.target param.
export const LFO_TARGETS = ["pitch", "volume", "filter", "pan"] as const;

// Pitch swings by up to ±3% (about ±50 cents) at full depth. The swept delay
// that makes it is capped at 8 ms, which only limits the slowest rates.
const PITCH_SWING = 0.03;
const MAX_SWEEP = 0.008;
const FILTER_UPDATE = 16;

// One LFO over the whole mix, after the instruments, so every model responds
// the same way: pitch (a swept delay), volume (tremolo), filter (a lowpass
// swept from 250 Hz to 16 kHz, blended in by depth) or pan. At zero depth the
// mix passes through untouched.
export class MasterLfo {
  private readonly fs: number;
  private readonly lfo: ModLfo;
  private readonly depth: Smoother;
  // Crossfade into the delayed signal, so switching pitch on or off is smooth.
  private readonly pitchMix: Smoother;
  private readonly delayL: DelayLine;
  private readonly delayR: DelayLine;
  private readonly filterL = new Svf("lowpass");
  private readonly filterR = new Svf("lowpass");
  private target = 0;
  private rate = 5;
  private ticks = 0;

  constructor(fs: number) {
    this.fs = fs;
    this.lfo = new ModLfo(fs);
    this.depth = new Smoother(0, fs);
    this.pitchMix = new Smoother(0, fs, 0.02);
    this.delayL = new DelayLine(2 * MAX_SWEEP * fs + 8);
    this.delayR = new DelayLine(2 * MAX_SWEEP * fs + 8);
  }

  set(rate: number, depth: number, shape: number, target: number) {
    this.rate = rate;
    this.lfo.setRate(rate);
    this.lfo.shape = shape;
    this.target = target;
    this.depth.set(depth);
    this.pitchMix.set(depth > 0 && target === 0 ? 1 : 0);
  }

  process(left: Float32Array, right: Float32Array, n: number) {
    const pitch = this.target === 0;
    if (!pitch && this.depth.settled && this.depth.value === 0) return;
    if (pitch && this.pitchMix.settled && this.pitchMix.value === 0) {
      // Keep the delay filled so switching on picks up the current sound.
      for (let i = 0; i < n; i++) {
        this.delayL.write(left[i]);
        this.delayR.write(right[i]);
      }
      return;
    }
    const sweep = Math.min(MAX_SWEEP, PITCH_SWING / (2 * Math.PI * this.rate));
    const centre = (sweep + 0.001) * this.fs;
    for (let i = 0; i < n; i++) {
      const d = this.depth.process();
      const m = this.lfo.process();
      const l = left[i];
      const r = right[i];
      switch (this.target) {
        case 0: {
          this.delayL.write(l);
          this.delayR.write(r);
          const at = centre + d * m * sweep * this.fs;
          const mix = this.pitchMix.process();
          left[i] = l + mix * (this.delayL.readLagrange3(at) - l);
          right[i] = r + mix * (this.delayR.readLagrange3(at) - r);
          break;
        }
        case 1: {
          const g = 1 - (d * (1 - m)) / 2;
          left[i] = l * g;
          right[i] = r * g;
          break;
        }
        case 2: {
          if (this.ticks++ % FILTER_UPDATE === 0) {
            const cutoff = 250 * 2 ** (3 * (m + 1));
            this.filterL.set(cutoff, 1.2, this.fs);
            this.filterR.set(cutoff, 1.2, this.fs);
          }
          left[i] = l + d * (this.filterL.process(l) - l);
          right[i] = r + d * (this.filterR.process(r) - r);
          break;
        }
        default: {
          // Equal-power pan around the centre, unity at rest.
          const angle = ((d * m + 1) * Math.PI) / 4;
          left[i] = l * Math.cos(angle) * Math.SQRT2;
          right[i] = r * Math.sin(angle) * Math.SQRT2;
        }
      }
    }
  }
}
