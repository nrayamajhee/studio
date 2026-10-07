import { stringParams } from "./params";
import type { StringPatch } from "./types";

// Double bass played pizzicato: gut-like dull strings, fast decay and a large
// wooden body with low air and plate modes.
export const uprightBass: StringPatch = {
  id: "uprightBass",
  name: "Upright Bass",
  family: "string",
  exciter: "finger",
  allocation: "string",
  polyphony: 4,
  openStrings: [28, 33, 38, 43],
  maxFret: 24,
  range: [28, 67],
  // Calibrated so a mezzo-forte C4 (or nearest note) is −18 dBFS RMS.
  outputGain: 1.02,
  pan: { center: 0, spread: 0 },
  body: {
    type: "modal",
    modes: [
      [60, 0.25, 0.25],
      [98, 0.2, 0.35],
      [140, 0.15, 0.6],
      [210, 0.12, 0.5],
      [300, 0.08, 0.35],
      [420, 0.06, 0.25],
      [650, 0.05, 0.15],
      [1000, 0.04, 0.1],
    ],
  },
  unison: [[0, 1]],
  unisonDetune: [[0, 0]],
  unisonDecay: [1],
  t60: [
    [28, 4],
    [43, 3],
    [55, 2.2],
    [67, 1.5],
  ],
  brightness: [
    [28, 0.55],
    [67, 0.4],
  ],
  dispersionStages: [
    [28, 2],
    [39, 2],
    [40, 1],
    [55, 1],
    [56, 0],
  ],
  dispersionCoef: [
    [28, -0.25],
    [39, -0.25],
    [40, -0.15],
  ],
  damperT60: [[28, 0.15]],
  params: stringParams({
    pluck: "finger",
    hardness: 0.25,
    position: 0.25,
    bodyMix: 0.6,
    cutoff: 2500,
    send: 0.12,
  }),
};
