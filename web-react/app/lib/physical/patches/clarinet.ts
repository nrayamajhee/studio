import { boreParams } from "./params";
import type { BorePatch } from "./types";

// B♭ clarinet at concert pitch (STK Clarinet loop): a reed on a cylinder,
// closed at the reed and open at the bell, so it sounds mostly odd harmonics.
export const clarinet: BorePatch = {
  id: "clarinet",
  name: "Clarinet",
  family: "bore",
  model: "clarinet",
  range: [50, 91],
  pressure: [0.55, 0.85],
  // Measured corrections (tuning sweep at velocity 0.7), per sample rate.
  tuningCents: {
    44100: [[50, 0]],
    48000: [[50, 0]],
  },
  // Calibrated so a mezzo-forte C4 (or nearest note) is −14 LUFS momentary.
  outputGain: 0.4876,
  pan: { center: 0, spread: 0 },
  body: {
    type: "radiation",
    highpass: 140,
    presence: { freq: 1500, q: 1, gainDb: 2 },
  },
  params: boreParams({
    reed: 0.5,
    noise: 0.8,
    vibrato: 0,
    vibratoRate: 5,
    portamento: 0.05,
    attack: 0.03,
    decay: 0.1,
    sustain: 0.9,
    release: 0.06,
    cutoff: 9000,
    send: 0.2,
  }),
};
