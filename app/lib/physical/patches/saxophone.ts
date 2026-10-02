import { boreParams } from "./params";
import type { BorePatch } from "./types";

// Alto saxophone (STK Saxofony loop).
export const saxophone: BorePatch = {
  id: "saxophone",
  name: "Alto Sax",
  family: "bore",
  model: "saxophone",
  range: [49, 80],
  pressure: [0.78, 0.98],
  // Measured corrections (tuning sweep at velocity 0.7), per sample rate.
  tuningCents: {
    44100: [
      [49, 2.3],
      [65, 1.9],
      [66, 2.3],
      [68, 1.7],
      [80, 1.6],
    ],
    48000: [
      [49, 2.2],
      [68, 1.8],
      [69, 2.1],
      [72, 1.6],
      [80, 1.7],
    ],
  },
  // Calibrated so a mezzo-forte C4 (or nearest note) is −18 dBFS RMS.
  outputGain: 0.52,
  pan: { center: 0, spread: 0 },
  body: {
    type: "radiation",
    highpass: 150,
    presence: { freq: 1500, q: 1, gainDb: 3 },
  },
  params: boreParams({
    reed: 0.5,
    blowPosition: 0.42,
    noise: 1,
    vibrato: 0.03,
    vibratoRate: 5.2,
    portamento: 0.06,
    attack: 0.04,
    decay: 0.1,
    sustain: 0.85,
    release: 0.08,
    cutoff: 10000,
    send: 0.2,
  }),
};
