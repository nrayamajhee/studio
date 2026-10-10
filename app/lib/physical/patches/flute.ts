import { boreParams } from "./params";
import type { BorePatch } from "./types";

// Concert flute (STK Flute loop, jet ratio 0.32).
export const flute: BorePatch = {
  id: "flute",
  name: "Flute",
  family: "bore",
  model: "flute",
  range: [60, 96],
  pressure: [1.1, 1.3],
  // Measured corrections (tuning sweep at velocity 0.7), per sample rate.
  tuningCents: {
    44100: [
      [60, -20.7],
      [67, -21.9],
      [70, -22.6],
      [71, -23.3],
      [72, -23.3],
      [83, -29.9],
      [91, -38.8],
      [93, -42.7],
      [95, -45.8],
      [96, -48.5],
    ],
    48000: [
      [60, -20.4],
      [61, -21.3],
      [62, -20.4],
      [66, -20.9],
      [75, -24.1],
      [83, -28.8],
      [84, -30.4],
      [87, -32.3],
      [92, -38.5],
      [93, -40.5],
      [95, -43],
      [96, -45.4],
    ],
  },
  // Calibrated so a mezzo-forte C4 (or nearest note) is −14 LUFS momentary.
  outputGain: 1.158,
  pan: { center: 0, spread: 0 },
  body: { type: "radiation", highpass: 250 },
  params: boreParams({
    noise: 1.2,
    vibrato: 0.04,
    vibratoRate: 5,
    vibratoDelay: 0.3,
    portamento: 0.03,
    jetRatio: 0.32,
    attack: 0.06,
    decay: 0.1,
    sustain: 0.9,
    release: 0.1,
    cutoff: 12000,
    send: 0.25,
  }),
};
