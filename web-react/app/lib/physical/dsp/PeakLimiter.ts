const LOOKAHEAD = 0.0015;
const RELEASE = 0.1;

// The limiter's delay in samples at `fs`: its look-ahead.
export const limiterLatency = (fs: number) => Math.round(LOOKAHEAD * fs);

// A stereo look-ahead peak limiter. The signal is delayed by the look-ahead
// while the gain ramps down to what keeps the coming peak at `ceiling`, so a
// transient (a chord's hammers landing together) is turned down rather than
// clipped. The gain holds over the look-ahead, then recovers over `RELEASE`.
// Below the ceiling it only delays. Allocation-free; read `left` and `right`
// after each process().
export class PeakLimiter {
  readonly latency: number;
  left = 0;
  right = 0;
  private readonly ceiling: number;
  private readonly recover: number;
  private readonly delayL: Float32Array;
  private readonly delayR: Float32Array;
  // A sliding minimum of the gain over the look-ahead (a monotonic queue of
  // gains and the sample each arrived at), then a moving average over the
  // same length, which ramps the gain down in a straight line that reaches
  // the minimum exactly as the peak leaves the delay.
  private readonly minGain: Float64Array;
  private readonly minAt: Float64Array;
  private readonly ramp: Float64Array;
  private minHead = 0;
  private minCount = 0;
  private rampSum: number;
  private envelope = 1;
  private frame = 0;

  constructor(fs: number, ceiling: number) {
    const size = Math.max(1, limiterLatency(fs)) + 1;
    this.latency = size - 1;
    this.ceiling = ceiling;
    this.recover = 1 - Math.exp(-1 / (RELEASE * fs));
    this.delayL = new Float32Array(size);
    this.delayR = new Float32Array(size);
    this.minGain = new Float64Array(size);
    this.minAt = new Float64Array(size);
    this.ramp = new Float64Array(size).fill(1);
    this.rampSum = size;
  }

  process(inL: number, inR: number) {
    const size = this.delayL.length;
    const slot = this.frame % size;
    const peak = Math.max(Math.abs(inL), Math.abs(inR));
    const needed = peak > this.ceiling ? this.ceiling / peak : 1;
    this.envelope = Math.min(
      needed,
      this.envelope + (1 - this.envelope) * this.recover,
    );

    const gains = this.minGain;
    const at = this.minAt;
    while (
      this.minCount > 0 &&
      gains[(this.minHead + this.minCount - 1) % size] >= this.envelope
    )
      this.minCount--;
    const back = (this.minHead + this.minCount) % size;
    gains[back] = this.envelope;
    at[back] = this.frame;
    this.minCount++;
    while (at[this.minHead] <= this.frame - size) {
      this.minHead = (this.minHead + 1) % size;
      this.minCount--;
    }
    const held = gains[this.minHead];

    this.rampSum += held - this.ramp[slot];
    this.ramp[slot] = held;
    const gain = Math.min(1, this.rampSum / size);

    // The oldest sample in the delay is the one leaving now.
    const out = (slot + 1) % size;
    this.left = this.delayL[out] * gain;
    this.right = this.delayR[out] * gain;
    this.delayL[slot] = inL;
    this.delayR[slot] = inR;
    this.frame++;
  }
}
