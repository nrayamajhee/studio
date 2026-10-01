import { stringParams } from "./params";
import type { StringPatch } from "./types";

// Solid-body electric guitar: steel strings that sustain longer than on the
// acoustic, a bridge pickup comb in place of a body, and a little amp drive.
export const electricGuitar: StringPatch = {
  id: "electricGuitar",
  name: "Electric Guitar",
  family: "string",
  exciter: "pick",
  allocation: "string",
  polyphony: 6,
  openStrings: [40, 45, 50, 55, 59, 64],
  maxFret: 22,
  range: [40, 86],
  // Calibrated so a mezzo-forte C4 (or nearest note) is −18 dBFS RMS.
  outputGain: 0.525,
  pan: { center: 0, spread: 0.15 },
  body: { type: "none" },
  unison: [[0, 1]],
  unisonDetune: [[0, 0]],
  unisonDecay: [1],
  polarization: { detuneCents: 0.2, decay: 0.8, split: 0.7 },
  t60: [
    [40, 10],
    [52, 8],
    [64, 6],
    [76, 4],
    [88, 2.5],
  ],
  brightness: [
    [40, 0.25],
    [64, 0.18],
    [88, 0.1],
  ],
  dispersionStages: [
    [40, 1],
    [51, 1],
    [52, 0],
  ],
  dispersionCoef: [[40, -0.15]],
  damperT60: [[40, 0.1]],
  pickup: 0.12,
  params: stringParams({
    hardness: 0.65,
    position: 0.15,
    bodyMix: 0,
    cutoff: 5500,
    q: 1,
    send: 0.15,
    drive: 0.35,
  }),
};
