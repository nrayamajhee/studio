import { oscillatorParams } from "./params";
import type { OscillatorPatch } from "./types";

// A plain oscillator, the one source that isn't a physical model. With nothing
// physical to stay within, it spans C0 to G9, the top of MIDI.
export const oscillator: OscillatorPatch = {
  id: "oscillator",
  name: "Oscillator",
  family: "oscillator",
  range: [12, 127],
  polyphony: 8,
  // Puts a C4 sine at velocity 0.7 at −14 LUFS momentary, as loud as every
  // other instrument.
  outputGain: 0.4431,
  pan: { center: 0, spread: 0 },
  body: { type: "none" },
  params: oscillatorParams(0.2, 0.05),
};
