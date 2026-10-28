export type SvfMode = "lowpass" | "bandpass" | "highpass" | "peak";

// Zero-delay-feedback state-variable filter (Andrew Simper, Cytomic):
// g = tan(π·fc/fs), k = 1/Q, a1 = 1/(1 + g(g + k)), a2 = g·a1, a3 = g·a2.
// Stays stable under fast cutoff modulation.
export class Svf {
  private mode = 0;
  private k = Math.SQRT2;
  private a1 = 0;
  private a2 = 0;
  private a3 = 0;
  private peakGain = 0;
  private ic1 = 0;
  private ic2 = 0;

  constructor(mode: SvfMode = "lowpass") {
    this.setMode(mode);
  }

  setMode(mode: SvfMode) {
    this.mode =
      mode === "lowpass"
        ? 0
        : mode === "bandpass"
          ? 1
          : mode === "highpass"
            ? 2
            : 3;
  }

  set(cutoff: number, q: number, fs: number) {
    this.k = 1 / q;
    this.coefficients(cutoff, fs);
  }

  // Bell: output = x + k·(A² − 1)·band with k = 1/(Q·A), A = 10^(dB/40).
  setPeak(cutoff: number, q: number, gainDb: number, fs: number) {
    const a = 10 ** (gainDb / 40);
    this.k = 1 / (q * a);
    this.peakGain = this.k * (a * a - 1);
    this.coefficients(cutoff, fs);
  }

  process(x: number) {
    const v3 = x - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    switch (this.mode) {
      case 0:
        return v2;
      case 1:
        return v1;
      case 2:
        return x - this.k * v1 - v2;
      default:
        return x + this.peakGain * v1;
    }
  }

  clear() {
    this.ic1 = 0;
    this.ic2 = 0;
  }

  private coefficients(cutoff: number, fs: number) {
    const fc = Math.min(Math.max(cutoff, 20), 0.45 * fs);
    const g = Math.tan((Math.PI * fc) / fs);
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }
}
