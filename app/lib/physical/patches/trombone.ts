import { boreParams } from "./params";
import type { BorePatch } from "./types";

// Tenor trombone (STK Brass lip loop): the bass trumpet's register with a
// larger, darker bell, and a long legato glide like the slide.
export const trombone: BorePatch = {
  id: "trombone",
  name: "Trombone",
  family: "bore",
  model: "brass",
  range: [40, 77],
  pressure: [0.6, 1],
  // Measured corrections (tuning sweep at velocity 0.7), per sample rate.
  tuningCents: {
    44100: [
      [40, -69.3],
      [46, -61.8],
      [54, -54.4],
      [74, -39.7],
      [77, -36.8],
    ],
    48000: [
      [40, -69.5],
      [46, -62],
      [52, -56.4],
      [67, -45.8],
      [74, -40.9],
      [77, -38.2],
    ],
  },
  // Calibrated so a mezzo-forte C4 (or nearest note) is −14 LUFS momentary.
  outputGain: 1.877,
  pan: { center: 0, spread: 0 },
  body: {
    type: "radiation",
    highpass: 80,
    presence: { freq: 600, q: 0.7, gainDb: 4 },
  },
  params: boreParams({
    lip: 0.45,
    noise: 0.3,
    vibrato: 0.01,
    vibratoRate: 5,
    portamento: 0.12,
    attack: 0.05,
    decay: 0.1,
    sustain: 0.9,
    release: 0.12,
    cutoff: 5000,
    send: 0.25,
  }),
};
