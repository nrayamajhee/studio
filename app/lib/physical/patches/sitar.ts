import { stringParams } from "./params";
import type { StringPatch } from "./types";

// Sympathetic (taraf) strings tuned to C major, C4 up to G5, each ringing at
// its fundamental and octave when a played note or its harmonics match them.
const TARAF = [
  261.63, 293.66, 329.63, 349.23, 392, 440, 493.88, 523.25, 587.33, 659.26,
  783.99,
];

// Sitar: a steel playing string plucked by a wire mizrab, buzzing on its broad
// jawari bridge, over a gourd body, with the taraf ringing along.
export const sitar: StringPatch = {
  id: "sitar",
  name: "Sitar",
  family: "string",
  exciter: "pick",
  allocation: "key",
  polyphony: 6,
  range: [48, 84],
  // Calibrated so a mezzo-forte C4 (or nearest note) is −18 dBFS RMS.
  outputGain: 1.175,
  pan: { center: 0, spread: 0.15 },
  // (Hz, T60 s, amp): the gourd and the top's modes, then the taraf.
  body: {
    type: "modal",
    modes: [
      [140, 0.12, 0.6],
      [260, 0.09, 0.5],
      [420, 0.07, 0.45],
      [700, 0.05, 0.3],
      [1100, 0.04, 0.2],
      ...TARAF.flatMap((hz) => [
        [hz, 3, 0.25] as const,
        [2 * hz, 2, 0.15] as const,
      ]),
    ],
  },
  unison: [[0, 1]],
  unisonDetune: [[0, 0]],
  unisonDecay: [1],
  // Long and bright: the jawari keeps feeding the upper partials, so they
  // have to last for the buzz to.
  t60: [
    [48, 9],
    [60, 7],
    [72, 5],
    [84, 3.2],
  ],
  brightness: [
    [48, 0.06],
    [72, 0.03],
    [84, 0.02],
  ],
  dispersionStages: [
    [48, 1],
    [59, 1],
    [60, 0],
  ],
  dispersionCoef: [[48, -0.1]],
  damperT60: [[48, 0.4]],
  jawari: { contact: 0.6, gap: 0.004 },
  params: stringParams({
    pluck: "pick",
    hardness: 0.85,
    position: 0.1,
    bodyMix: 0.6,
    cutoff: 14000,
    send: 0.3,
    jawari: 0.7,
  }),
};
