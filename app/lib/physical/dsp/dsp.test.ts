import { describe, expect, it } from "vitest";
import { measureT60, peakNear, spectrum } from "../offline/analysis";
import { Adsr } from "./Adsr";
import { DelayLine } from "./DelayLine";
import { Fdn } from "./Fdn";
import { Allpass1, OnePoleLowpass } from "./filters";
import { Oscillator } from "./generators";
import { ModalBank, Resonator2 } from "./modal";
import {
  allpass1ForDelay,
  allpass1PhaseDelay,
  onePolePhaseDelay,
} from "./phaseDelay";
import { Svf } from "./Svf";

const FS = 48000;

// Phase delay (samples) of a filter, from a least-squares fit of
// y ≈ a·sin(wk) + b·cos(wk) to its steady-state response to sin(wk).
function measuredPhaseDelay(process: (x: number) => number, w: number) {
  const warmup = 20000;
  const n = 40000;
  let ss = 0;
  let cc = 0;
  let sc = 0;
  let ys = 0;
  let yc = 0;
  for (let k = 0; k < warmup + n; k++) {
    const y = process(Math.sin(w * k));
    if (k >= warmup) {
      const s = Math.sin(w * k);
      const c = Math.cos(w * k);
      ss += s * s;
      cc += c * c;
      sc += s * c;
      ys += y * s;
      yc += y * c;
    }
  }
  const det = ss * cc - sc * sc;
  const a = (ys * cc - yc * sc) / det;
  const b = (yc * ss - ys * sc) / det;
  return Math.atan2(-b, a) / w;
}

function magnitude(process: (x: number) => number, w: number) {
  let peak = 0;
  for (let k = 0; k < 40000; k++) {
    const y = process(Math.sin(w * k));
    if (k > 20000) peak = Math.max(peak, Math.abs(y));
  }
  return peak;
}

describe("DelayLine", () => {
  it("returns the sample written n writes ago", () => {
    const line = new DelayLine(16);
    for (let k = 1; k <= 10; k++) line.write(k);
    expect(line.readInt(1)).toBe(10);
    expect(line.readInt(4)).toBe(7);
  });

  it("delays by fractional amounts with Lagrange and linear reads", () => {
    for (const delay of [5.25, 7.5, 9.8]) {
      const w = (2 * Math.PI * 200) / FS;
      const lagrange = new DelayLine(32);
      const linear = new DelayLine(32);
      const viaLagrange = measuredPhaseDelay((x) => {
        lagrange.write(x);
        return lagrange.readLagrange3(delay + 1);
      }, w);
      const viaLinear = measuredPhaseDelay((x) => {
        linear.write(x);
        return linear.readLinear(delay + 1);
      }, w);
      expect(viaLagrange).toBeCloseTo(delay, 2);
      expect(viaLinear).toBeCloseTo(delay, 2);
    }
  });
});

describe("phase delay formulas", () => {
  it("match a one-pole lowpass", () => {
    for (const p of [0.2, 0.5, 0.8]) {
      const w = (2 * Math.PI * 440) / FS;
      const filter = new OnePoleLowpass();
      filter.setPole(p);
      expect(measuredPhaseDelay((x) => filter.process(x), w)).toBeCloseTo(
        onePolePhaseDelay(p, w),
        3,
      );
    }
  });

  it("match a first-order allpass, including a = 0 → 1 sample", () => {
    expect(allpass1PhaseDelay(0, 0.3)).toBeCloseTo(1, 10);
    for (const a of [-0.7, -0.3, 0.4]) {
      const w = (2 * Math.PI * 1000) / FS;
      const stage = new Allpass1();
      stage.a = a;
      expect(measuredPhaseDelay((x) => stage.process(x), w)).toBeCloseTo(
        allpass1PhaseDelay(a, w),
        3,
      );
    }
  });

  it("solves allpass coefficients for an exact delay at high frequency", () => {
    const w = (2 * Math.PI * 4000) / FS;
    for (const d of [0.6, 1.0, 1.45]) {
      expect(allpass1PhaseDelay(allpass1ForDelay(d, w), w)).toBeCloseTo(d, 6);
    }
  });
});

describe("Resonator2 and ModalBank", () => {
  const impulse = (process: (x: number) => number, seconds: number) => {
    const out = new Float64Array(Math.round(seconds * FS));
    for (let i = 0; i < out.length; i++) out[i] = process(i === 0 ? 1 : 0);
    return out;
  };

  it("rings at the set frequency with the set T60 and amplitude", () => {
    const mode = new Resonator2();
    mode.set(523.25, 0.8, 0.5, FS);
    const out = impulse((x) => mode.process(x), 2);
    const f = peakNear(spectrum(out, FS, 0, out.length), 523.25);
    expect(Math.abs(f / 523.25 - 1)).toBeLessThan(0.005);
    expect(measureT60(out, FS) / 0.8).toBeGreaterThan(0.9);
    expect(measureT60(out, FS) / 0.8).toBeLessThan(1.1);
    expect(Math.max(...out.slice(0, 200))).toBeCloseTo(0.5, 1);
  });

  it("sums modes and rescales frequency", () => {
    const bank = new ModalBank(4, FS);
    bank.count = 2;
    bank.setMode(0, 200, 0.5, 1);
    bank.setMode(1, 700, 0.3, 0.5);
    bank.scaleFrequencies(1.5);
    const out = impulse((x) => bank.process(x), 1.5);
    const spec = spectrum(out, FS, 0, out.length);
    expect(Math.abs(peakNear(spec, 300) / 300 - 1)).toBeLessThan(0.005);
    expect(Math.abs(peakNear(spec, 1050) / 1050 - 1)).toBeLessThan(0.005);
  });
});

describe("Svf", () => {
  it("is 3 dB down at cutoff (lowpass, Q 0.707)", () => {
    for (const cutoff of [200, 1000, 5000]) {
      const filter = new Svf("lowpass");
      filter.set(cutoff, Math.SQRT1_2, FS);
      const gain = magnitude(
        (x) => filter.process(x),
        (2 * Math.PI * cutoff) / FS,
      );
      expect(gain).toBeGreaterThan(Math.SQRT1_2 * 0.95);
      expect(gain).toBeLessThan(Math.SQRT1_2 * 1.05);
    }
  });

  it("boosts a bell by the set gain", () => {
    const filter = new Svf("peak");
    filter.setPeak(1500, 1, 6, FS);
    const gain = magnitude((x) => filter.process(x), (2 * Math.PI * 1500) / FS);
    expect(20 * Math.log10(gain)).toBeCloseTo(6, 0);
  });
});

describe("Adsr", () => {
  it("reaches each target at the specified time", () => {
    const env = new Adsr(FS);
    env.set(0.01, 0.1, 0.5, 0.2);
    env.noteOn();
    let t = 0;
    while (env.process() < 1) t++;
    expect(t / FS).toBeCloseTo(0.01, 3);
    for (let i = 0; i < 0.1 * FS; i++) env.process();
    expect(env.value).toBeCloseTo(0.5 + 0.5 * 0.01, 2);
    env.noteOff();
    for (let i = 0; i < 0.2 * FS; i++) env.process();
    expect(env.value).toBeLessThan(0.5 * 0.011);
  });

  it("retriggers from the current value without jumping", () => {
    const env = new Adsr(FS);
    env.set(0.05, 0.1, 0.5, 0.3);
    env.noteOn();
    for (let i = 0; i < 0.2 * FS; i++) env.process();
    env.noteOff();
    for (let i = 0; i < 0.05 * FS; i++) env.process();
    const before = env.value;
    env.noteOn();
    expect(Math.abs(env.process() - before)).toBeLessThan(1e-3);
  });
});

describe("Oscillator", () => {
  const render = (wave: number, hz: number, n: number) => {
    const osc = new Oscillator(FS);
    osc.wave = wave;
    osc.setFrequency(hz);
    return Float64Array.from({ length: n }, () => osc.process());
  };

  // Power more than 40 Hz from any harmonic of f0, relative to the total.
  const aliasDb = (signal: ArrayLike<number>, f0: number) => {
    const { magnitudeDb, binHz } = spectrum(signal, FS, 0, signal.length);
    let total = 0;
    let alias = 0;
    for (let i = 1; i < magnitudeDb.length; i++) {
      const power = 10 ** (magnitudeDb[i] / 10);
      const harmonic = (i * binHz) / f0;
      total += power;
      if (Math.abs(harmonic - Math.round(harmonic)) * f0 > 40) alias += power;
    }
    return 10 * Math.log10(alias / total);
  };

  it("plays every wave at a sine's RMS without DC", () => {
    for (let wave = 0; wave < 4; wave++) {
      // 250 Hz fits a whole number of cycles in a second.
      const out = render(wave, 250, FS);
      const mean = out.reduce((sum, y) => sum + y, 0) / FS;
      const rms = Math.sqrt(out.reduce((sum, y) => sum + y * y, 0) / FS);
      expect(Math.abs(mean)).toBeLessThan(1e-3);
      // polyBLEP rounds off a little of each step (under 0.1 dB at 250 Hz).
      expect(Math.abs(rms - Math.SQRT1_2)).toBeLessThan(0.01);
    }
  });

  it("aliases far less than the raw square and saw", () => {
    const f0 = 2793.83;
    const naive = [(t: number) => (t < 0.5 ? 1 : -1), (t: number) => 2 * t - 1];
    [2, 3].forEach((wave, i) => {
      const raw = Float64Array.from({ length: 8192 }, (_, k) =>
        naive[i](((k * f0) / FS) % 1),
      );
      expect(aliasDb(render(wave, f0, 8192), f0)).toBeLessThan(
        aliasDb(raw, f0) - 10,
      );
    });
  });
});

describe("Fdn", () => {
  it("decays with the set T60 and sleeps once silent", () => {
    const reverb = new Fdn(FS);
    reverb.setDecay(1.5);
    reverb.setDamping(0);
    const block = 128;
    const input = new Float32Array(block);
    const left = new Float32Array(block);
    const right = new Float32Array(block);
    const out = new Float64Array(FS * 4);
    for (let pos = 0; pos < out.length; pos += block) {
      input.fill(0);
      if (pos === 0) input[0] = 1;
      left.fill(0);
      right.fill(0);
      reverb.process(input, left, right, block);
      for (let i = 0; i < block && pos + i < out.length; i++)
        out[pos + i] = left[i];
    }
    const t60 = measureT60(out, FS);
    expect(t60 / 1.5).toBeGreaterThan(0.8);
    expect(t60 / 1.5).toBeLessThan(1.2);

    input.fill(0);
    for (let k = 0; k < (8 * FS) / block; k++) {
      left.fill(0);
      right.fill(0);
      reverb.process(input, left, right, block);
    }
    expect(reverb.sleeping).toBe(true);
    expect(left.every((x) => x === 0)).toBe(true);
  });
});
