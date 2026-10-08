import { stringParams } from "./params";
import type { StringPatch } from "./types";

// Four-string fingered electric bass: pickup comb, no acoustic body.
export const bass: StringPatch = {
  id: "bass",
  name: "Electric bass",
  family: "string",
  exciter: "finger",
  allocation: "string",
  polyphony: 4,
  openStrings: [28, 33, 38, 43],
  maxFret: 24,
  range: [28, 67],
  // Calibrated so a mezzo-forte C4 (or nearest note) is −14 LUFS momentary.
  outputGain: 0.4625,
  pan: { center: 0, spread: 0 },
  body: { type: "none" },
  unison: [[0, 1]],
  unisonDetune: [[0, 0]],
  unisonDecay: [1],
  t60: [
    [28, 8],
    [43, 6],
    [55, 4.5],
    [67, 3],
  ],
  brightness: [
    [28, 0.45],
    [67, 0.3],
  ],
  dispersionStages: [
    [28, 3],
    [39, 3],
    [40, 2],
    [55, 2],
    [56, 0],
  ],
  dispersionCoef: [
    [28, -0.35],
    [39, -0.35],
    [40, -0.25],
  ],
  damperT60: [[28, 0.08]],
  pickup: 0.15,
  params: stringParams({
    pluck: "finger",
    hardness: 0.35,
    position: 0.2,
    bodyMix: 0,
    cutoff: 3000,
    q: 0.8,
    send: 0.05,
    drive: 0.1,
  }),
};
