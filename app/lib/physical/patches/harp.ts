import { stringParams } from "./params";
import type { StringPatch } from "./types";

// Concert harp: a string per note, plucked by the fingertips near the middle,
// over a soundbox. Harps have no dampers, so every note rings until it fades.
export const harp: StringPatch = {
  id: "harp",
  name: "Harp",
  family: "string",
  exciter: "finger",
  allocation: "key",
  polyphony: 24,
  range: [24, 103],
  // Calibrated so a mezzo-forte C4 (or nearest note) is −18 dBFS RMS.
  outputGain: 0.804,
  pan: { center: 0, spread: 0.4 },
  // (Hz, T60 s, amp): soundbox air and soundboard modes.
  body: {
    type: "modal",
    modes: [
      [110, 0.2, 0.6],
      [220, 0.15, 0.7],
      [350, 0.1, 0.5],
      [500, 0.08, 0.4],
      [800, 0.05, 0.25],
      [1300, 0.04, 0.15],
      [2000, 0.03, 0.1],
    ],
  },
  unison: [[0, 1]],
  unisonDetune: [[0, 0]],
  unisonDecay: [1],
  t60: [
    [24, 12],
    [40, 9],
    [55, 6],
    [67, 4],
    [79, 2.5],
    [91, 1.5],
    [103, 0.8],
  ],
  brightness: [
    [24, 0.45],
    [60, 0.3],
    [103, 0.15],
  ],
  dispersionStages: [
    [24, 2],
    [35, 2],
    [36, 1],
    [52, 1],
    [53, 0],
  ],
  dispersionCoef: [
    [24, -0.2],
    [36, -0.1],
  ],
  damperT60: [[24, 1]],
  noDamperAbove: 23,
  params: stringParams({
    hardness: 0.3,
    position: 0.4,
    bodyMix: 0.4,
    cutoff: 10000,
    send: 0.4,
  }),
};
