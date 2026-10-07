import { stringParams } from "./params";
import type { StringPatch } from "./types";

// Five-string banjo in open G (D3 G3 B3 D4, and the short high g drone),
// picked near the bridge. The bridge stands on a tight drumhead, which rings
// bright and short: the body's membrane modes give the twang, and the head
// soaks up the strings, so notes fade sooner than a guitar's.
export const banjo: StringPatch = {
  id: "banjo",
  name: "Banjo",
  family: "string",
  exciter: "pick",
  allocation: "string",
  polyphony: 5,
  openStrings: [50, 55, 59, 62, 67],
  maxFret: 22,
  range: [50, 86],
  // Calibrated so a mezzo-forte C4 (or nearest note) is −18 dBFS RMS.
  outputGain: 1.122,
  pan: { center: 0, spread: 0.15 },
  // (Hz, T60 s, amp): the head's membrane modes.
  body: {
    type: "modal",
    modes: [
      [340, 0.06, 1.2],
      [540, 0.05, 0.9],
      [730, 0.045, 0.7],
      [930, 0.04, 0.55],
      [1130, 0.035, 0.45],
      [1560, 0.03, 0.3],
      [2250, 0.02, 0.2],
    ],
  },
  unison: [[0, 1]],
  unisonDetune: [[0, 0]],
  unisonDecay: [1],
  polarization: { detuneCents: 0.3, decay: 0.5, split: 0.75 },
  t60: [
    [50, 3],
    [62, 2.4],
    [74, 1.8],
    [86, 1.2],
  ],
  brightness: [
    [50, 0.12],
    [86, 0.06],
  ],
  dispersionStages: [
    [50, 1],
    [61, 1],
    [62, 0],
  ],
  dispersionCoef: [[50, -0.12]],
  damperT60: [[50, 0.15]],
  params: stringParams({
    pluck: "pick",
    hardness: 0.85,
    position: 0.1,
    bodyMix: 0.7,
    cutoff: 12000,
    send: 0.15,
    strum: 8,
  }),
};
