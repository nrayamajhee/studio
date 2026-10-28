import { barParams } from "./params";
import type { BarPatch } from "./types";

// Kalimba: steel tines clamped at one end, plucked by the thumbs. A clamped
// tine's overtones sit far above it (6.27× and 17.55×) and die fast, so the
// pluck starts with a bright ping that settles into a long, pure note over a
// small wooden box. C4 to E6.
export const kalimba: BarPatch = {
  id: "kalimba",
  name: "Kalimba",
  family: "bar",
  strike: "thumb",
  polyphony: 12,
  range: [60, 88],
  modes: [
    [1, 1, 3.2],
    [6.27, 0.28, 0.45],
    [17.55, 0.1, 0.07],
  ],
  decay: [
    [60, 1.2],
    [76, 1],
    [88, 0.8],
  ],
  contact: [4, 1.5],
  // Calibrated so a mezzo-forte C4 (or nearest note) is −14 LUFS momentary.
  outputGain: 1.136,
  pan: { center: 0, spread: 0.25 },
  // (Hz, T60 s, amp): the box's air and its thin top.
  body: {
    type: "modal",
    modes: [
      [190, 0.08, 0.6],
      [450, 0.05, 0.4],
      [920, 0.03, 0.2],
    ],
  },
  params: barParams({
    hardness: 0.4,
    bodyMix: 0.35,
    cutoff: 14000,
    send: 0.25,
  }),
};
