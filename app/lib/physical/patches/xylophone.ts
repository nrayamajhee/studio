import { barParams } from "./params";
import type { BarPatch } from "./types";

// Concert xylophone: rosewood bars undercut so the first overtone sits on the
// twelfth (3×), with tuned tubes beneath that lift and lengthen the
// fundamental. Hard mallets, a bright short ring, F4 to C8.
export const xylophone: BarPatch = {
  id: "xylophone",
  name: "Xylophone",
  family: "bar",
  strike: "mallet",
  polyphony: 16,
  range: [65, 108],
  modes: [
    [1, 1, 1],
    [3, 0.5, 0.35],
    [6.2, 0.25, 0.14],
    [9.9, 0.1, 0.07],
    [13.9, 0.05, 0.04],
  ],
  decay: [
    [65, 1.5],
    [84, 1],
    [108, 0.45],
  ],
  contact: [1.2, 0.25],
  // Calibrated so a mezzo-forte C4 (or nearest note) is −18 dBFS RMS.
  outputGain: 1.349,
  pan: { center: 0, spread: 0.45 },
  body: { type: "none" },
  params: barParams({ hardness: 0.7, cutoff: 16000, send: 0.3 }),
};
