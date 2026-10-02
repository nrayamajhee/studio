import { boreParams } from "./params";
import type { BorePatch } from "./types";

// Bass trumpet (STK Brass lip loop), an octave below the trumpet: a wider
// bore and a darker bell with its presence near 800 Hz.
export const bassTrumpet: BorePatch = {
  id: "bassTrumpet",
  name: "Bass Trumpet",
  family: "bore",
  model: "brass",
  range: [40, 72],
  pressure: [0.55, 0.95],
  // Measured corrections (tuning sweep at velocity 0.7), per sample rate.
  tuningCents: {
    44100: [
      [40, -71.9],
      [48, -62.6],
      [62, -51.7],
      [72, -44.5],
    ],
    48000: [
      [40, -72.5],
      [47, -63.9],
      [57, -55.7],
      [72, -45.6],
    ],
  },
  // Calibrated so a mezzo-forte C4 (or nearest note) is −18 dBFS RMS.
  outputGain: 2.018,
  pan: { center: 0, spread: 0 },
  body: {
    type: "radiation",
    highpass: 100,
    presence: { freq: 800, q: 0.8, gainDb: 3 },
  },
  params: boreParams({
    lip: 0.5,
    noise: 0.3,
    vibrato: 0.015,
    vibratoRate: 5,
    portamento: 0.05,
    attack: 0.04,
    decay: 0.1,
    sustain: 0.9,
    release: 0.1,
    cutoff: 6000,
    send: 0.25,
  }),
};
