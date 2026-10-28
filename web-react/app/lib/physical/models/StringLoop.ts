import { DelayLine } from "../dsp/DelayLine";
import { TWO_PI } from "../dsp/math";
import {
  allpass1ForDelay,
  allpass1PhaseDelay,
  onePoleMagnitude,
  onePolePhaseDelay,
} from "../dsp/phaseDelay";

const MAX_STAGES = 8;
const MAX_LOOP_GAIN = 0.99999;

// High notes with long T60s: the loss filter alone may lose more per period
// than the decay allows (the loop gain would have to exceed 1). Lighten it to
// the largest pole that still lets g stay below MAX_LOOP_GAIN.
function lightestLoss(p: number, w0: number, perPeriod: number) {
  if (perPeriod / onePoleMagnitude(p, w0) <= MAX_LOOP_GAIN) return p;
  let lo = 0;
  let hi = p;
  for (let i = 0; i < 40; i++) {
    const mid = 0.5 * (lo + hi);
    if (perPeriod / onePoleMagnitude(mid, w0) <= MAX_LOOP_GAIN) lo = mid;
    else hi = mid;
  }
  return lo;
}

// Single-delay-loop string (extended Karplus-Strong):
// delay → M dispersion allpasses → one-pole loss·g → fractional tuning allpass
// → [jawari] → + excitation → back into the delay.
//
// The jawari is a sitar's broad curved bridge, which the string grazes as it
// swings. Following Pierce & Van Duyne's passive nonlinear filter, it is a
// first-order allpass whose coefficient switches while the string is past the
// bridge's gap, shortening the loop for that part of each swing: loud notes
// buzz and the buzz fades with them. It is a rotation of (input, state), so
// switching never adds energy and the loop stays stable.
export class StringLoop {
  readonly delay: DelayLine;
  private readonly fs: number;
  private readonly apX1 = new Float64Array(MAX_STAGES);
  private readonly apY1 = new Float64Array(MAX_STAGES);
  private stages = 0;
  private apA = 0;
  private p = 0;
  private lp = 0;
  private g = 0;
  private gTarget = 0;
  private gCoef = 1;
  private tA = 0;
  private tX1 = 0;
  private tY1 = 0;
  private nInt = 2;
  private f0 = 440;
  private w0 = 0;
  private jawari = false;
  private contact = 0;
  private contactNorm = 1;
  private gap = 0;
  private bridge = 0;
  // Nominal loop length in samples, for pickup and pluck-position combs.
  period = 100;

  constructor(fs: number, lowestHz: number) {
    this.fs = fs;
    this.delay = new DelayLine(fs / lowestHz + 8);
  }

  // A jawari bridge: `contact` (0–0.9) is the allpass coefficient while the
  // string touches it, `gap` how far it swings before it does. Set before
  // tune(), which takes the bridge's one sample of rest delay out of the loop.
  setJawari(contact: number, gap: number) {
    this.jawari = true;
    this.contact = contact;
    this.contactNorm = Math.sqrt(1 - contact * contact);
    this.gap = gap;
  }

  // Tunes the loop so its fundamental lands exactly on f0:
  // D = fs/f0 − τ_loss(ω0) − τ_disp(ω0), Nint = floor(D − 0.5), and the
  // leftover d ∈ [0.5, 1.5) goes to an allpass solved for exact delay at ω0.
  tune(
    f0: number,
    t60: number,
    brightness: number,
    stages: number,
    coef: number,
  ) {
    const fs = this.fs;
    this.f0 = f0;
    this.apA = coef;
    const w0 = (TWO_PI * f0) / fs;
    this.w0 = w0;
    const p = lightestLoss(brightness, w0, 10 ** (-3 / (f0 * t60)));
    this.p = p;
    const tauLoss = onePolePhaseDelay(p, w0);
    // At rest the jawari is an allpass at 0: exactly one sample.
    const bridge = this.jawari ? 1 : 0;
    let m = Math.max(0, Math.min(MAX_STAGES, Math.round(stages)));
    let d = fs / f0 - tauLoss - bridge - m * allpass1PhaseDelay(coef, w0);
    // Keep at least two samples of pure delay by dropping dispersion stages.
    while (m > 0 && Math.floor(d - 0.5) < 2) {
      m--;
      d = fs / f0 - tauLoss - bridge - m * allpass1PhaseDelay(coef, w0);
    }
    this.stages = m;
    this.nInt = Math.max(1, Math.floor(d - 0.5));
    this.tA = allpass1ForDelay(d - this.nInt, w0);
    this.period = fs / f0;
    const g = this.loopGain(t60);
    this.g = g;
    this.gTarget = g;
    this.gCoef = 1;
  }

  // Ramps the loop gain toward the value for a new T60 over `ramp` seconds
  // (dampers, re-fretting) without clicking.
  setDecay(t60: number, ramp: number) {
    this.gTarget = this.loopGain(t60);
    this.gCoef = ramp > 0 ? 1 - Math.exp(-1 / (ramp * this.fs)) : 1;
  }

  tick(excitation: number) {
    let y = this.delay.readInt(this.nInt);
    const a = this.apA;
    for (let s = 0; s < this.stages; s++) {
      const out = a * y + this.apX1[s] - a * this.apY1[s];
      this.apX1[s] = y;
      this.apY1[s] = out;
      y = out;
    }
    this.lp = (1 - this.p) * y + this.p * this.lp;
    this.g += (this.gTarget - this.g) * this.gCoef;
    const lossy = this.lp * this.g;
    let tuned = this.tA * lossy + this.tX1 - this.tA * this.tY1;
    this.tX1 = lossy;
    this.tY1 = tuned;
    if (this.jawari) {
      // Normalized-ladder allpass: (a·x + c·s, c·x − a·s) is a rotation.
      const a = this.bridge > this.gap ? this.contact : 0;
      const c = a === 0 ? 1 : this.contactNorm;
      const through = a * tuned + c * this.bridge;
      this.bridge = c * tuned - a * this.bridge;
      tuned = through;
    }
    const out = tuned + excitation;
    this.delay.write(out);
    return out;
  }

  clear() {
    this.delay.clear();
    this.apX1.fill(0);
    this.apY1.fill(0);
    this.lp = 0;
    this.tX1 = 0;
    this.tY1 = 0;
    this.bridge = 0;
  }

  // The first `count` partials of the tuned loop: each where the round trip
  // holds a whole number of cycles (so stiffness stretches them sharp), and
  // how long it rings (T60, s) through the loss filter at its frequency.
  partials(count: number) {
    const fs = this.fs;
    const roundTrip = (w: number) =>
      this.nInt +
      this.stages * allpass1PhaseDelay(this.apA, w) +
      onePolePhaseDelay(this.p, w) +
      allpass1PhaseDelay(this.tA, w) +
      (this.jawari ? 1 : 0);
    const result: { hz: number; t60: number }[] = [];
    for (let n = 1; n <= count; n++) {
      let w = n * this.w0;
      for (let i = 0; i < 30 && w < Math.PI; i++)
        w = (TWO_PI * n) / roundTrip(w);
      if (w >= Math.PI) break;
      const perTrip = this.gTarget * onePoleMagnitude(this.p, w);
      const t60 = (-3 / Math.log10(perTrip)) * (roundTrip(w) / fs);
      result.push({ hz: (w * fs) / TWO_PI, t60 });
    }
    return result;
  }

  // g = 10^(−3/(f0·T60)) / |H_loss(ω0)|: loses 60 dB after f0·T60 periods.
  private loopGain(t60: number) {
    const perPeriod = 10 ** (-3 / (this.f0 * t60));
    return Math.min(
      MAX_LOOP_GAIN,
      perPeriod / onePoleMagnitude(this.p, this.w0),
    );
  }
}
