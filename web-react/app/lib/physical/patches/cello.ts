import { bowedParams } from "./params";
import type { BowedPatch } from "./types";

// Cello: the violin's STK Bowed loop an octave and a fifth lower, with a modal
// body in place of the violin filter (air and main wood modes near 100 and
// 200 Hz).
export const cello: BowedPatch = {
  id: "cello",
  name: "Cello",
  family: "bowed",
  polyphony: 4,
  range: [36, 81],
  // Measured corrections (tuning sweep at velocity 0.7), per sample rate.
  tuningCents: {
    44100: [
      [36, -0.9],
      [41, -0.3],
      [46, -1.5],
      [47, -0.2],
      [50, -0.3],
      [51, -1.8],
      [53, -1.9],
      [54, -0.4],
      [62, -1.5],
      [63, -3.2],
      [69, -4.9],
      [79, -10.1],
      [81, -12.8],
    ],
    48000: [
      [36, -0.8],
      [40, -0.1],
      [45, -1.4],
      [48, -0.1],
      [50, -0.2],
      [51, -1.6],
      [54, -1.9],
      [55, -0.4],
      [63, -1.6],
      [64, -3.1],
      [73, -6.4],
      [80, -10.1],
      [81, -11.4],
    ],
  },
  // Calibrated so a mezzo-forte C4 (or nearest note) is −14 LUFS momentary.
  outputGain: 7.775,
  pan: { center: -0.1, spread: 0.1 },
  body: {
    type: "modal",
    modes: [
      [98, 0.15, 1.0],
      [145, 0.12, 0.6],
      [185, 0.12, 0.9],
      [220, 0.1, 0.8],
      [330, 0.08, 0.5],
      [450, 0.06, 0.4],
      [620, 0.05, 0.3],
      [900, 0.04, 0.2],
      [1400, 0.03, 0.12],
      [2200, 0.02, 0.08],
    ],
  },
  params: bowedParams(0.3, 0.1, "modal"),
};
