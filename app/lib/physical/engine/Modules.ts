import type { ParamSet } from "./ParamSet";

// How a model takes the LFO module: on its own exciter's level (breath, bow,
// bellows) and its own loop's pitch, or left to the voice's output, which
// applies level as tremolo and pitch through a swept delay.
export type LfoRouting = {
  pitch: "model" | "output";
  level: "model" | "output";
  // Voices join one free-running cycle, like a harmonium's shared bellows,
  // instead of each starting its own at note-on.
  free?: boolean;
  // Seconds the depth takes to ramp in after the delay.
  fadeIn?: number;
};

const OUTPUT_ROUTING: LfoRouting = { pitch: "output", level: "output" };

// The built-in modules every voice of an instrument shares settings for: the
// filter (cutoff, resonance, envelope, keytrack) and the LFO. They are read
// from the patch's filter.* and lfo.* params, so a model only declares them.
export class ModuleSettings {
  readonly routing: LfoRouting;
  readonly fadeIn: number;
  cutoff = 16000;
  q = Math.SQRT1_2;
  envAmount = 0;
  // Per-update decay of the filter envelope (updates are 16 samples apart).
  envDecay = 1;
  keytrack = 0;
  lfoRate = 5;
  lfoShape = 0;
  lfoDelay = 0;
  // Peak pitch swing as a ratio above 1: 2^(cents/1200) − 1.
  pitch = 0;
  // Peak level swing, a fraction of the exciter or the output.
  level = 0;
  // Peak cutoff swing in octaves.
  filter = 0;

  constructor(routing: LfoRouting = OUTPUT_ROUTING) {
    this.routing = routing;
    this.fadeIn = routing.fadeIn ?? 0.3;
  }

  get lfoOn() {
    return this.pitch > 0 || this.level > 0 || this.filter > 0;
  }

  read(p: ParamSet, fs: number) {
    if (p.has("filter.cutoff")) this.cutoff = p.get("filter.cutoff");
    if (p.has("filter.resonance")) this.q = p.get("filter.resonance");
    this.envAmount = p.has("filter.envAmount") ? p.get("filter.envAmount") : 0;
    this.keytrack = p.has("filter.keytrack") ? p.get("filter.keytrack") : 0;
    this.envDecay = Math.exp(
      -16 /
        (Math.max(
          0.01,
          p.has("filter.envDecay") ? p.get("filter.envDecay") : 0.3,
        ) *
          fs),
    );
    if (!p.has("lfo.rate")) return;
    this.lfoRate = p.get("lfo.rate");
    this.lfoShape = Math.round(p.get("lfo.shape"));
    this.lfoDelay = p.get("lfo.delay");
    this.pitch = 2 ** (p.get("lfo.pitch") / 1200) - 1;
    this.level = p.get("lfo.level");
    this.filter = p.get("lfo.filter");
  }
}
