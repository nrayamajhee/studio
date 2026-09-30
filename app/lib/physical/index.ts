import { PhysicalSynth } from "./PhysicalSynth";

// The constructor touches no browser APIs, so this is safe to evaluate during
// prerendering; the AudioContext and worklet are created lazily in start().
export const physicalSynth = new PhysicalSynth();

export { PhysicalSynth };
export type * from "./messages";
