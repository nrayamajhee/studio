import { cents } from "../dsp/math";
import { Svf } from "../dsp/Svf";

// In-place iterative radix-2 FFT; re.length must be a power of two.
export function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tRe = re[b] * curRe - im[b] * curIm;
        const tIm = re[b] * curIm + im[b] * curRe;
        re[b] = re[a] - tRe;
        im[b] = im[a] - tIm;
        re[a] += tRe;
        im[a] += tIm;
        const next = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = next;
      }
    }
  }
}

export type Spectrum = {
  magnitudeDb: Float64Array;
  binHz: number;
};

// Hann-windowed, zero-padded magnitude spectrum of signal[start..end).
export function spectrum(
  signal: ArrayLike<number>,
  fs: number,
  start: number,
  end: number,
  size = 65536,
): Spectrum {
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  const length = Math.min(end - start, size);
  for (let i = 0; i < length; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (length - 1));
    re[i] = signal[start + i] * w;
  }
  fft(re, im);
  const magnitudeDb = new Float64Array(size / 2);
  for (let i = 0; i < size / 2; i++) {
    magnitudeDb[i] = 10 * Math.log10(re[i] * re[i] + im[i] * im[i] + 1e-30);
  }
  return { magnitudeDb, binHz: fs / size };
}

// Strongest peak within ±`windowCents` of target, refined by parabolic
// interpolation on the dB magnitude.
export function peakNear(
  spec: Spectrum,
  target: number,
  windowCents = 100,
): number {
  const lo = Math.max(
    1,
    Math.floor((target * 2 ** (-windowCents / 1200)) / spec.binHz),
  );
  const hi = Math.min(
    spec.magnitudeDb.length - 2,
    Math.ceil((target * 2 ** (windowCents / 1200)) / spec.binHz),
  );
  let best = lo;
  for (let i = lo; i <= hi; i++) {
    if (spec.magnitudeDb[i] > spec.magnitudeDb[best]) best = i;
  }
  const a = spec.magnitudeDb[best - 1];
  const b = spec.magnitudeDb[best];
  const c = spec.magnitudeDb[best + 1];
  const denom = a - 2 * b + c;
  const offset = denom === 0 ? 0 : (0.5 * (a - c)) / denom;
  return (best + offset) * spec.binHz;
}

export type PitchResult = {
  hz: number;
  cents: number;
};

// Measures f0 near `target` from 0.3 s to 1.7 s after `onset` (in samples).
export function measurePitch(
  signal: ArrayLike<number>,
  fs: number,
  target: number,
  onset = 0,
  from = 0.3,
  to = 1.7,
): PitchResult {
  const start = onset + Math.round(from * fs);
  const end = Math.min(signal.length, onset + Math.round(to * fs));
  const hz = peakNear(spectrum(signal, fs, start, end), target);
  return { hz, cents: cents(hz, target) };
}

// Schroeder backward-integrated energy decay; fits −5..−25 dB and extrapolates
// to −60 dB (T20 × 3). Returns NaN if the curve never reaches −25 dB.
export function measureT60(
  signal: ArrayLike<number>,
  fs: number,
  onset = 0,
): number {
  const energy = new Float64Array(signal.length - onset);
  for (let i = 0; i < energy.length; i++) {
    energy[i] = signal[onset + i] * signal[onset + i];
  }
  return energyT60(energy, fs);
}

// T60 from an energy envelope sampled at `rate` per second.
export function energyT60(energy: ArrayLike<number>, fs: number): number {
  const n = energy.length;
  const edc = new Float64Array(n);
  let acc = 0;
  for (let i = n - 1; i >= 0; i--) {
    acc += energy[i];
    edc[i] = acc;
  }
  const total = edc[0];
  if (total <= 0) return NaN;
  let t5 = -1;
  let t25 = -1;
  for (let i = 0; i < n; i++) {
    const db = 10 * Math.log10(edc[i] / total + 1e-30);
    if (t5 < 0 && db <= -5) t5 = i;
    if (db <= -25) {
      t25 = i;
      break;
    }
  }
  if (t5 < 0 || t25 < 0) return NaN;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  let count = 0;
  for (let i = t5; i <= t25; i += Math.max(1, Math.floor((t25 - t5) / 400))) {
    const x = i / fs;
    const y = 10 * Math.log10(edc[i] / total + 1e-30);
    sx += x;
    sy += y;
    sxx += x * x;
    sxy += x * y;
    count++;
  }
  const slope = (count * sxy - sx * sy) / (count * sxx - sx * sx);
  return slope < 0 ? -60 / slope : NaN;
}

export type SignalStats = {
  peak: number;
  rms: number;
  dc: number;
  finite: boolean;
};

// DC is the mean over 0.5–1.0 s after onset, trimmed to whole periods when
// `period` (samples) is known so low notes don't read as offset.
export function signalStats(
  signal: ArrayLike<number>,
  fs: number,
  onset = 0,
  period = 0,
): SignalStats {
  let peak = 0;
  let sumSquares = 0;
  let finite = true;
  for (let i = 0; i < signal.length; i++) {
    const x = signal[i];
    if (!Number.isFinite(x)) finite = false;
    const ax = Math.abs(x);
    if (ax > peak) peak = ax;
    sumSquares += x * x;
  }
  const dcStart = onset + Math.round(0.5 * fs);
  let dcEnd = Math.min(signal.length, onset + Math.round(1.0 * fs));
  if (period > 1) {
    const periods = Math.floor((dcEnd - dcStart) / period);
    if (periods > 0) dcEnd = dcStart + Math.round(periods * period);
  }
  let dc = 0;
  for (let i = dcStart; i < dcEnd; i++) dc += signal[i];
  dc = dcEnd > dcStart ? dc / (dcEnd - dcStart) : 0;
  return {
    peak,
    rms: Math.sqrt(sumSquares / Math.max(1, signal.length)),
    dc,
    finite,
  };
}

// RMS over [from, to) seconds after onset.
export function windowRms(
  signal: ArrayLike<number>,
  fs: number,
  onset: number,
  from: number,
  to: number,
) {
  const start = onset + Math.round(from * fs);
  const end = Math.min(signal.length, onset + Math.round(to * fs));
  let sum = 0;
  for (let i = start; i < end; i++) sum += signal[i] * signal[i];
  return Math.sqrt(sum / Math.max(1, end - start));
}

// One biquad, run over a whole signal (direct form I).
function biquad(
  signal: ArrayLike<number>,
  [b0, b1, b2, a1, a2]: readonly number[],
) {
  const out = new Float64Array(signal.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < signal.length; i++) {
    const x = signal[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    out[i] = y;
  }
  return out;
}

// The K-weighting of ITU-R BS.1770 at any sample rate: a high shelf for the
// head's presence boost, then a highpass for the ear's bass roll-off.
function kWeight(signal: ArrayLike<number>, fs: number) {
  const shelf = (() => {
    const K = Math.tan((Math.PI * 1681.974450955533) / fs);
    const Q = 0.7071752369554196;
    const Vh = 10 ** (3.999843853973347 / 20);
    const Vb = Vh ** 0.4996667741545416;
    const a0 = 1 + K / Q + K * K;
    return [
      (Vh + (Vb * K) / Q + K * K) / a0,
      (2 * (K * K - Vh)) / a0,
      (Vh - (Vb * K) / Q + K * K) / a0,
      (2 * (K * K - 1)) / a0,
      (1 - K / Q + K * K) / a0,
    ];
  })();
  const highpass = (() => {
    const K = Math.tan((Math.PI * 38.13547087602444) / fs);
    const Q = 0.5003270373238773;
    const a0 = 1 + K / Q + K * K;
    return [1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0];
  })();
  return biquad(biquad(signal, shelf), highpass);
}

// Momentary loudness (LUFS), as EBU R128 meters it: the loudest 400 ms
// window, stepped every 100 ms, of the K-weighted channels summed. Equal
// momentary loudness is what sounds equally loud, whether a note strikes
// and fades or swells and holds.
export function momentaryLoudness(
  left: ArrayLike<number>,
  right: ArrayLike<number>,
  fs: number,
) {
  const l = kWeight(left, fs);
  const r = kWeight(right, fs);
  const size = Math.round(0.4 * fs);
  const step = Math.round(0.1 * fs);
  let loudest = 0;
  for (let start = 0; start + size <= l.length; start += step) {
    let sum = 0;
    for (let i = start; i < start + size; i++) sum += l[i] * l[i] + r[i] * r[i];
    loudest = Math.max(loudest, sum / size);
  }
  return -0.691 + 10 * Math.log10(loudest || 1e-12);
}

// Band around f0 (Simper SVF bandpass), to follow one partial's decay.
export function bandpass(
  signal: ArrayLike<number>,
  fs: number,
  f0: number,
  q = 30,
) {
  const filter = new Svf("bandpass");
  filter.set(f0, q, fs);
  const out = new Float32Array(signal.length);
  for (let i = 0; i < signal.length; i++) out[i] = filter.process(signal[i]);
  return out;
}

// First sample above −60 dBFS.
export function findOnset(signal: ArrayLike<number>, threshold = 1e-3) {
  for (let i = 0; i < signal.length; i++) {
    if (Math.abs(signal[i]) > threshold) return i;
  }
  return -1;
}
