import { stringParams } from "./params";
import type { StringPatch } from "./types";

// Classical guitar played fingerstyle: nylon strings, darker and quicker to
// fade than steel and less stiff, on a light top with lower, rounder modes.
export const nylonGuitar: StringPatch = {
  id: "nylonGuitar",
  name: "Nylon Guitar",
  family: "string",
  exciter: "finger",
  allocation: "string",
  polyphony: 6,
  openStrings: [40, 45, 50, 55, 59, 64],
  maxFret: 19,
  range: [40, 83],
  // Calibrated so a mezzo-forte C4 (or nearest note) is −18 dBFS RMS.
  outputGain: 1.1,
  pan: { center: 0, spread: 0.2 },
  // (Hz, T60 s, amp): air, top plate and upper plate modes.
  body: {
    type: "modal",
    modes: [
      [95, 0.22, 1.0],
      [190, 0.16, 0.8],
      [260, 0.1, 0.45],
      [380, 0.08, 0.45],
      [520, 0.06, 0.3],
      [750, 0.05, 0.2],
      [1100, 0.04, 0.12],
      [1800, 0.03, 0.08],
    ],
  },
  unison: [[0, 1]],
  unisonDetune: [[0, 0]],
  unisonDecay: [1],
  polarization: { detuneCents: 0.4, decay: 0.6, split: 0.7 },
  t60: [
    [40, 5],
    [52, 4],
    [64, 2.8],
    [76, 1.8],
    [88, 1.1],
  ],
  brightness: [
    [40, 0.4],
    [64, 0.32],
    [88, 0.2],
  ],
  dispersionStages: [
    [40, 1],
    [51, 1],
    [52, 0],
  ],
  dispersionCoef: [[40, -0.08]],
  damperT60: [[40, 0.12]],
  params: stringParams({
    hardness: 0.3,
    position: 0.2,
    bodyMix: 0.55,
    cutoff: 8000,
    send: 0.22,
    strum: 0,
  }),
};
