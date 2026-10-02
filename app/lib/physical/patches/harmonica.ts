import { reedParams } from "./params";
import type { ReedPatch } from "./types";

// Chromatic harmonica: one reed a hole, breathier and quicker to speak than
// the harmonium, voiced by the player's cupped hands (the body's presence).
// The Swell is the hand tremolo, off until it's turned up.
export const harmonica: ReedPatch = {
  id: "harmonica",
  name: "Harmonica",
  family: "reed",
  range: [60, 96],
  polyphony: 6,
  reeds: [[0, 1]],
  pressure: [1.8, 3.2],
  settle: [
    [60, 0.04],
    [96, 0.015],
  ],
  asymmetry: 0.9,
  // Measured corrections (tuning sweep at velocity 0.7), per sample rate.
  tuningCents: {
    44100: [
      [60, -1.2],
      [93, -2.9],
      [96, -3.4],
    ],
    48000: [
      [60, -1.1],
      [95, -2.9],
      [96, -3.1],
    ],
  },
  // Calibrated so a mezzo-forte C4 (or nearest note) is −18 dBFS RMS.
  outputGain: 1.241,
  pan: { center: 0, spread: 0 },
  body: {
    type: "radiation",
    highpass: 250,
    presence: { freq: 1300, q: 1.2, gainDb: 5 },
  },
  params: reedParams({
    noise: 1.5,
    swell: 0,
    swellRate: 5.5,
    brightness: -0.2,
    bodyMix: 1,
    attack: 0.03,
    decay: 0.1,
    sustain: 0.85,
    release: 0.05,
    cutoff: 6000,
    send: 0.2,
  }),
};
