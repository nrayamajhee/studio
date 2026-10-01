import { boreParams } from "./params";
import type { BorePatch } from "./types";

// Trumpet in B♭ (STK Brass lip loop), sounding E3 to C6: a bright bell with a
// presence peak near 1.2 kHz.
export const trumpet: BorePatch = {
  id: "trumpet",
  name: "Trumpet",
  family: "bore",
  model: "brass",
  range: [52, 84],
  pressure: [0.55, 0.95],
  // Measured corrections (tuning sweep at velocity 0.7), per sample rate.
  tuningCents: {
    44100: [
      [52, -59.2],
      [74, -42.8],
      [84, -33.2],
    ],
    48000: [
      [52, -59.3],
      [74, -44],
      [84, -34.6],
    ],
  },
  // Calibrated so a mezzo-forte C4 (or nearest note) is −18 dBFS RMS.
  outputGain: 2.163,
  pan: { center: 0, spread: 0 },
  body: {
    type: "radiation",
    highpass: 200,
    presence: { freq: 1200, q: 0.8, gainDb: 4 },
  },
  params: boreParams({
    lip: 0.5,
    noise: 0.3,
    vibrato: 0.02,
    vibratoRate: 5.5,
    attack: 0.03,
    decay: 0.08,
    sustain: 0.9,
    release: 0.08,
    cutoff: 9000,
    send: 0.25,
  }),
};
