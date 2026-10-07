import { stringParams } from "./params";
import type { StringPatch } from "./types";

// Soprano ukulele: four nylon strings in re-entrant G4 C4 E4 A4 (the G an
// octave up), played with the fingers over a small, bright body.
export const ukulele: StringPatch = {
  id: "ukulele",
  name: "Ukulele",
  family: "string",
  exciter: "finger",
  allocation: "string",
  polyphony: 4,
  openStrings: [67, 60, 64, 69],
  maxFret: 15,
  range: [60, 84],
  // Calibrated so a mezzo-forte C4 (or nearest note) is −18 dBFS RMS.
  outputGain: 1,
  pan: { center: 0, spread: 0.15 },
  // (Hz, T60 s, amp): a small box's air and top modes, higher than a guitar's.
  body: {
    type: "modal",
    modes: [
      [270, 0.12, 0.9],
      [410, 0.09, 0.7],
      [600, 0.07, 0.5],
      [880, 0.05, 0.35],
      [1350, 0.04, 0.2],
      [2100, 0.03, 0.12],
    ],
  },
  unison: [[0, 1]],
  unisonDetune: [[0, 0]],
  unisonDecay: [1],
  polarization: { detuneCents: 0.4, decay: 0.6, split: 0.7 },
  t60: [
    [60, 3],
    [72, 2.2],
    [84, 1.5],
  ],
  brightness: [
    [60, 0.38],
    [84, 0.28],
  ],
  dispersionStages: [[60, 0]],
  dispersionCoef: [[60, 0]],
  damperT60: [[60, 0.12]],
  params: stringParams({
    pluck: "finger",
    hardness: 0.3,
    position: 0.22,
    bodyMix: 0.55,
    cutoff: 9000,
    send: 0.2,
    strum: 12,
  }),
};
