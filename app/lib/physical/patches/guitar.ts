import { stringParams } from "./params";
import type { StringPatch } from "./types";

// Acoustic steel-string guitar.
export const guitar: StringPatch = {
  id: "guitar",
  name: "Acoustic Guitar",
  family: "string",
  exciter: "pick",
  allocation: "string",
  polyphony: 6,
  openStrings: [40, 45, 50, 55, 59, 64],
  maxFret: 20,
  range: [40, 84],
  // Calibrated so a mezzo-forte C4 (or nearest note) is −18 dBFS RMS.
  outputGain: 0.9,
  pan: { center: 0, spread: 0.2 },
  // (Hz, T60 s, amp): air, top plate and upper plate modes.
  body: {
    type: "modal",
    modes: [
      [100, 0.2, 1.0],
      [200, 0.15, 0.8],
      [280, 0.1, 0.4],
      [400, 0.08, 0.5],
      [550, 0.06, 0.3],
      [800, 0.05, 0.2],
      [1200, 0.04, 0.15],
      [2000, 0.03, 0.1],
    ],
  },
  unison: [[0, 1]],
  unisonDetune: [[0, 0]],
  unisonDecay: [1],
  // Two polarizations: +0.3 cents, 0.6× T60, excitation split 0.7/0.3.
  polarization: { detuneCents: 0.3, decay: 0.6, split: 0.7 },
  t60: [
    [40, 7],
    [52, 5.5],
    [64, 4],
    [76, 2.5],
    [88, 1.5],
  ],
  brightness: [
    [40, 0.3],
    [64, 0.2],
    [88, 0.1],
  ],
  dispersionStages: [
    [40, 1],
    [51, 1],
    [52, 0],
  ],
  dispersionCoef: [[40, -0.15]],
  damperT60: [[40, 0.12]],
  params: stringParams({
    hardness: 0.6,
    position: 0.18,
    bodyMix: 0.5,
    cutoff: 14000,
    send: 0.2,
    strum: 0,
  }),
};
