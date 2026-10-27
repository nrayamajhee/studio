import { nextPow2 } from "./math";

// Circular buffer. After write(x), readInt(1) returns x, so a loop that reads
// readInt(N) and then writes delays its signal by exactly N samples.
export class DelayLine {
  readonly buffer: Float32Array;
  private readonly mask: number;
  private index = 0;

  constructor(maxDelay: number) {
    const size = nextPow2(Math.ceil(maxDelay) + 4);
    this.buffer = new Float32Array(size);
    this.mask = size - 1;
  }

  get capacity() {
    return this.mask - 3;
  }

  clear() {
    this.buffer.fill(0);
  }

  write(x: number) {
    this.buffer[this.index] = x;
    this.index = (this.index + 1) & this.mask;
  }

  readInt(n: number) {
    return this.buffer[(this.index - n) & this.mask];
  }

  readLinear(delay: number) {
    const whole = Math.floor(delay);
    const frac = delay - whole;
    const a = this.buffer[(this.index - whole) & this.mask];
    const b = this.buffer[(this.index - whole - 1) & this.mask];
    return a + frac * (b - a);
  }

  // Third-order Lagrange FIR, centred so the fractional part D lies in [1, 2)
  // over taps n0..n0+3: h_k = Π_{j≠k} (D − j)/(k − j). Needs delay ≥ 2.
  readLagrange3(delay: number) {
    const n0 = Math.floor(delay) - 1;
    const d = delay - n0;
    const dm1 = d - 1;
    const dm2 = d - 2;
    const dm3 = d - 3;
    const h0 = (-dm1 * dm2 * dm3) / 6;
    const h1 = (d * dm2 * dm3) / 2;
    const h2 = (-d * dm1 * dm3) / 2;
    const h3 = (d * dm1 * dm2) / 6;
    const base = this.index - n0;
    const m = this.mask;
    const b = this.buffer;
    return (
      h0 * b[base & m] +
      h1 * b[(base - 1) & m] +
      h2 * b[(base - 2) & m] +
      h3 * b[(base - 3) & m]
    );
  }
}
