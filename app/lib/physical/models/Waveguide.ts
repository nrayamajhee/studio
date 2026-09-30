import { DelayLine } from "../dsp/DelayLine";

// STK DelayL-style section: tick(x) writes x and returns it delayed by `delay`
// samples (≥ 1), remembering the output as `last` (STK's lastOut()). Reads use
// third-order Lagrange so portamento and pitch vibrato glide cleanly.
export class Waveguide {
  private readonly line: DelayLine;
  last = 0;

  constructor(maxDelay: number) {
    this.line = new DelayLine(maxDelay + 4);
  }

  tick(x: number, delay: number) {
    this.line.write(x);
    this.last = this.line.readLagrange3(delay < 1 ? 2 : delay + 1);
    return this.last;
  }

  clear() {
    this.line.clear();
    this.last = 0;
  }
}
