import { reedParams } from "./params";
import type { ReedPatch } from "./types";

// Hand-pumped harmonium: two reeds a key, the second a few cents sharp so they
// beat, in a wooden case, with the bellows' slow swell in the pressure.
export const harmonium: ReedPatch = {
  id: "harmonium",
  name: "Harmonium",
  family: "reed",
  range: [36, 84],
  polyphony: 12,
  reeds: [
    [0, 1],
    [7, 0.8],
  ],
  pressure: [2, 3.4],
  settle: [
    [36, 0.1],
    [60, 0.05],
    [84, 0.025],
  ],
  asymmetry: 0.85,
  // Measured corrections (tuning sweep at velocity 0.7), per sample rate.
  tuningCents: {
    44100: [
      [36, -0.3],
      [82, -2.1],
      [84, -2.3],
    ],
    48000: [
      [36, -0.4],
      [37, 0.2],
      [39, -0.4],
      [79, -1.7],
      [84, -2.1],
    ],
  },
  // Calibrated so a mezzo-forte C4 (or nearest note) is −14 LUFS momentary.
  outputGain: 0.9826,
  pan: { center: 0, spread: 0.2 },
  // (Hz, T60 s, amp): the case's air and panel modes.
  body: {
    type: "modal",
    modes: [
      [180, 0.08, 0.5],
      [320, 0.06, 0.6],
      [520, 0.05, 0.5],
      [850, 0.04, 0.35],
      [1400, 0.03, 0.2],
      [2300, 0.02, 0.1],
    ],
  },
  params: reedParams({
    noise: 0.3,
    swell: 0.03,
    swellRate: 0.35,
    brightness: 0.3,
    bodyMix: 0.4,
    attack: 0.06,
    decay: 0.1,
    sustain: 0.9,
    release: 0.08,
    cutoff: 9000,
    send: 0.25,
  }),
};
