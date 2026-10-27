import { barParams } from "./params";
import type { BarPatch } from "./types";

// Tenor steel pan: each note a dome hammered into the pan's face and tuned so
// its modes fall on the octave and twelfth (1 : 2 : 3). Each tuned mode has a
// near twin a few cents off, which gives the pan its shimmer. Rubber-tipped
// sticks, C4 to E6.
export const steelPan: BarPatch = {
  id: "steelPan",
  name: "Steel pan",
  family: "bar",
  strike: "mallet",
  polyphony: 12,
  range: [60, 88],
  modes: [
    [1, 1, 2.4],
    [1.004, 0.45, 2.2],
    [2, 0.8, 1.6],
    [2.006, 0.3, 1.4],
    [3, 0.4, 0.9],
    [4.02, 0.15, 0.5],
    [5.05, 0.06, 0.3],
  ],
  decay: [
    [60, 1.2],
    [72, 1],
    [88, 0.7],
  ],
  contact: [3, 0.8],
  // Calibrated so a mezzo-forte C4 (or nearest note) is −14 LUFS momentary.
  outputGain: 0.6632,
  pan: { center: 0, spread: 0.3 },
  body: { type: "none" },
  params: barParams({ hardness: 0.5, cutoff: 12000, send: 0.3 }),
};
