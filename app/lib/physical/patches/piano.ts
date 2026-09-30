import { Noise } from "../dsp/generators";
import { stringParams } from "./params";
import type { StringPatch } from "./types";

// Soundboard: 20 modes log-spaced 60–3000 Hz, T60 0.25 → 0.04 s,
// amp ∝ 1/√(i+1) with ±30% seeded jitter.
const jitter = new Noise(1717);
const soundboard = Array.from({ length: 20 }, (_, i) => {
  const t = i / 19;
  return [
    60 * (3000 / 60) ** t,
    0.25 * (0.04 / 0.25) ** t,
    (1 / Math.sqrt(i + 1)) * (1 + 0.3 * jitter.next()),
  ] as const;
});

export const piano: StringPatch = {
  id: "piano",
  name: "Grand Piano",
  family: "string",
  exciter: "hammer",
  allocation: "key",
  polyphony: 24,
  range: [21, 108],
  // Calibrated so a mezzo-forte C4 (or nearest note) is −18 dBFS RMS.
  outputGain: 1.2,
  pan: { center: 0, spread: 0.35 },
  body: { type: "modal", modes: soundboard },
  unison: [
    [21, 1],
    [31, 1],
    [32, 2],
    [46, 2],
    [47, 3],
  ],
  unisonDetune: [
    [21, 0.4],
    [108, 0.9],
  ],
  unisonDecay: [1, 0.55, 0.4],
  t60: [
    [21, 18],
    [36, 14],
    [48, 10],
    [60, 7],
    [72, 4.5],
    [84, 2.5],
    [96, 1.2],
    [108, 0.5],
  ],
  brightness: [
    [21, 0.35],
    [48, 0.25],
    [72, 0.15],
    [96, 0.08],
    [108, 0.05],
  ],
  dispersionStages: [
    [21, 8],
    [40, 6],
    [55, 4],
    [70, 2],
    [84, 0],
  ],
  dispersionCoef: [
    [21, -0.7],
    [55, -0.5],
    [84, -0.3],
  ],
  damperT60: [
    [21, 0.6],
    [60, 0.35],
    [89, 0.25],
  ],
  noDamperAbove: 89,
  // Contact time ∝ m^(1/3.5): 1.4× longer at A0, 0.4× at C8.
  hammerMass: [
    [21, 3.25],
    [60, 1],
    [108, 0.0405],
  ],
  params: stringParams({
    hardness: 0.5,
    position: 0.12,
    bodyMix: 0.35,
    cutoff: 16000,
    send: 0.25,
  }),
};
