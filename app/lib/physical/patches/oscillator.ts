import { oscillatorParams } from "./params";
import type { OscillatorPatch } from "./types";

// A plain oscillator, the one source that isn't a physical model.
export const oscillator: OscillatorPatch = {
  id: "oscillator",
  name: "Oscillator",
  family: "oscillator",
  range: [21, 108],
  polyphony: 8,
  // A sine at velocity 0.7 is 0.7/√2 RMS, then −3 dB from the centre pan:
  // 0.1259 / (0.7 · 0.7071 · 0.7071) puts C4 at −18 dBFS RMS.
  outputGain: 0.36,
  pan: { center: 0, spread: 0 },
  body: { type: "none" },
  params: oscillatorParams(0.2, 0.05),
};
