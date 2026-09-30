import type { Noise } from "../dsp/generators";
import { clamp, lerp } from "../dsp/math";

// Velocity response blended by the "strength" macro: 0 ignores velocity,
// 1 follows velocity^curve.
export const velocityGain = (velocity: number, strength: number, curve = 1.2) =>
  lerp(1, velocity ** curve, strength);

function normalizePeak(buffer: Float32Array, length: number, gain: number) {
  let peak = 0;
  for (let n = 0; n < length; n++) peak = Math.max(peak, Math.abs(buffer[n]));
  const scale = peak > 0 ? gain / peak : 0;
  for (let n = 0; n < length; n++) buffer[n] *= scale;
}

// e[n] − e[n − b]: removes the harmonics that have a node at the pluck or
// strike point (every 1/β-th harmonic).
function positionComb(buffer: Float32Array, length: number, b: number) {
  if (b < 1) return;
  for (let n = length - 1; n >= b; n--) buffer[n] -= buffer[n - b];
}

export interface PluckOptions {
  period: number;
  velocity: number;
  hardness: number;
  position: number;
  strength: number;
  finger: boolean;
}

// Writes one period of pluck excitation; returns its length.
export function pluck(
  buffer: Float32Array,
  noise: Noise,
  { period, velocity, hardness, position, strength, finger }: PluckOptions,
) {
  const length = Math.min(buffer.length, Math.max(2, Math.round(period)));
  if (finger) {
    // Raised-cosine pulse: the soft pad of a finger.
    const width = Math.max(2, Math.round(length * (0.5 - 0.35 * hardness)));
    let lp = 0;
    for (let n = 0; n < length; n++) {
      lp = 0.9 * lp + 0.1 * noise.next();
      const pulse =
        n < width ? 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / width) : 0;
      buffer[n] = pulse + 0.1 * lp;
    }
    positionComb(
      buffer,
      length,
      Math.round(clamp(position, 0.02, 0.5) * length),
    );
  } else {
    // A pick displaces the string into a triangle peaking at the pluck point
    // (which already carries the pluck-position nulls), plus the scrape of the
    // pick as noise; harder, faster plucks pass more of it through.
    const p = clamp(0.9 - 0.85 * hardness * (0.5 + 0.5 * velocity), 0, 0.97);
    const apex = Math.max(1, Math.round(clamp(position, 0.02, 0.5) * length));
    let lp = 0;
    let mean = 0;
    for (let n = 0; n < length; n++) {
      const shape = n < apex ? n / apex : (length - n) / (length - apex);
      lp = (1 - p) * (shape + 0.25 * noise.next()) + p * lp;
      buffer[n] = lp;
      mean += lp;
    }
    mean /= length;
    for (let n = 0; n < length; n++) buffer[n] -= mean;
  }
  const gain = velocityGain(velocity, strength);
  normalizePeak(buffer, length, gain);
  if (!finger) {
    // The pick's click: a sharp edge at the start of the burst.
    buffer[0] += 0.3 * hardness * gain;
    if (length > 1) buffer[1] -= 0.15 * hardness * gain;
  }
  return length;
}

export interface HammerOptions {
  period: number;
  velocity: number;
  hardness: number;
  position: number;
  strength: number;
  mass: number;
  fs: number;
  // Output: how long the felt stayed in contact with the string.
  contactMs: number;
}

// Felt stiffness K and string admittance for a C4 contact of ~1 ms at full
// velocity with a p = 2.5 felt law (T ∝ (m/K)^(1/(p+1))·v0^((1−p)/(p+1))).
const FELT_EXPONENT = 2.5;
const FELT_STIFFNESS = 1.775e12;
const STRING_IMPEDANCE_2Z = 20000;
const V_MIN = 0.008;
const V_MAX = 1;
const OVERSAMPLE = 4;
const MAX_CONTACT = 0.012;

// Explicit-Euler felt hammer against a string modelled as two semi-infinite
// halves (a dashpot 2Z). Writes the averaged force pulse, applies the
// strike-position comb and returns the excitation length.
export function hammer(buffer: Float32Array, options: HammerOptions) {
  const { period, velocity, hardness, position, strength, mass, fs } = options;
  const k = FELT_STIFFNESS * 10 ** ((hardness - 0.5) * 1.5);
  const dt = 1 / (OVERSAMPLE * fs);
  const maxSteps = Math.round(MAX_CONTACT * OVERSAMPLE * fs);
  let vh = V_MIN + (V_MAX - V_MIN) * velocity ** 1.5;
  let yh = 0;
  let ys = 0;
  let contact = false;
  let acc = 0;
  let sub = 0;
  let n = 0;
  const combLength = Math.round(clamp(position, 0.02, 0.5) * period);
  const limit = buffer.length - combLength - 1;
  for (let step = 0; step < maxSteps && n < limit; step++) {
    const c = yh - ys;
    let force = 0;
    if (c > 0) {
      contact = true;
      force = k * c ** FELT_EXPONENT;
    } else if (contact) {
      break;
    }
    vh -= (force / mass) * dt;
    yh += vh * dt;
    ys += (force / STRING_IMPEDANCE_2Z) * dt;
    acc += force;
    if (++sub === OVERSAMPLE) {
      buffer[n++] = acc / OVERSAMPLE;
      acc = 0;
      sub = 0;
    }
  }
  options.contactMs = (n / fs) * 1000;
  const length = n + combLength;
  buffer.fill(0, n, length);
  positionComb(buffer, length, combLength);
  normalizePeak(buffer, length, velocityGain(velocity, strength, 1.3));
  return length;
}

// Half-sine stick pulse of duration τc, area-normalized so low modes keep
// their level and only the highs change with hardness.
export function stick(
  buffer: Float32Array,
  seconds: number,
  gain: number,
  fs: number,
) {
  const length = Math.min(buffer.length, Math.max(1, Math.round(seconds * fs)));
  const scale = (gain * Math.PI) / (2 * length);
  for (let n = 0; n < length; n++) {
    buffer[n] = scale * Math.sin((Math.PI * (n + 0.5)) / length);
  }
  return length;
}
