import type { SynthParams } from "../../lib/synth";

type NumericParam = {
  [K in keyof SynthParams]-?: SynthParams[K] extends number ? K : never;
}[keyof SynthParams];

export interface SynthControl {
  label: string;
  value: (params: SynthParams) => number;
  display: (params: SynthParams) => string;
  update: (value: number) => Partial<SynthParams>;
}

export interface SynthSection {
  id: "exciter" | "tone" | "filter" | "modulation" | "envelope" | "effects";
  title: string;
  controls: [SynthControl, SynthControl, SynthControl, SynthControl];
}

const percent = (value: number) => `${Math.round(value * 100)}%`;
const seconds = (value: number) => `${Number(value.toFixed(3))} s`;
const frequency = (value: number) =>
  value >= 1000
    ? `${(value / 1000).toFixed(1)} kHz`
    : `${Math.round(value)} Hz`;

function numeric(
  key: NumericParam,
  label: string,
  min: number,
  max: number,
  step: number,
  format: (value: number) => string,
  logarithmic = false,
): SynthControl {
  return {
    label,
    value: (params) => {
      const value = Math.max(min, Math.min(max, params[key]));
      return logarithmic
        ? (Math.log(value / min) / Math.log(max / min)) * 100
        : ((value - min) / (max - min)) * 100;
    },
    display: (params) => format(params[key]),
    update: (value) => {
      const raw = logarithmic
        ? min * Math.pow(max / min, value / 100)
        : min + (value / 100) * (max - min);
      const rounded = min + Math.round((raw - min) / step) * step;
      return {
        [key]: Number(Math.max(min, Math.min(max, rounded)).toFixed(4)),
      };
    },
  };
}

function choice<K extends keyof SynthParams>(
  key: K,
  label: string,
  values: readonly SynthParams[K][],
): SynthControl {
  return {
    label,
    value: (params) =>
      (Math.max(0, values.indexOf(params[key])) / (values.length - 1)) * 100,
    display: (params) => String(params[key]),
    update: (value) => ({
      [key]: values[Math.round((value / 100) * (values.length - 1))],
    }),
  };
}

export const SYNTH_SECTIONS: SynthSection[] = [
  {
    id: "exciter",
    title: "Exciter / Click",
    controls: [
      choice("exciterMode", "Mode", ["off", "thud", "noise", "click", "drum"]),
      numeric("exciterVol", "Amount", 0, 1, 0.01, percent),
      numeric("exciterFreq", "Impulse tone", 30, 4000, 10, frequency, true),
      numeric("exciterDecay", "Impulse decay", 0.005, 0.2, 0.001, seconds),
    ],
  },
  {
    id: "tone",
    title: "Tone Core",
    controls: [
      choice("osc1Wave", "Oscillator 1", [
        "sine",
        "triangle",
        "sawtooth",
        "square",
      ]),
      choice("osc2Wave", "Oscillator 2", [
        "off",
        "sine",
        "triangle",
        "sawtooth",
        "square",
      ]),
      numeric(
        "detune",
        "Detune",
        0,
        25,
        0.1,
        (value) => `${value.toFixed(1)} ct`,
      ),
      choice("osc2Oct", "Osc 2 octave", [-12, 0, 12]),
    ],
  },
  {
    id: "filter",
    title: "Filter Matrix",
    controls: [
      choice("filterType", "Filter mode", [
        "off",
        "lowpass",
        "bandpass",
        "highpass",
        "notch",
      ]),
      numeric("cutoff", "Cutoff", 80, 12000, 20, frequency, true),
      numeric("envMod", "Env sweep", 0, 7000, 50, frequency),
      numeric("keytrack", "Keytracking", -1, 1, 0.02, percent),
    ],
  },
  {
    id: "modulation",
    title: "LFO & Modulation",
    controls: [
      choice("lfoDest", "Destination", [
        "off",
        "pitch",
        "filter",
        "amp",
        "tremolo",
        "pan",
      ]),
      numeric(
        "lfoRate",
        "LFO rate",
        0.1,
        20,
        0.1,
        (value) => `${value.toFixed(1)} Hz`,
      ),
      numeric("lfoDepth", "Depth", 0, 1, 0.01, percent),
      numeric("ksFeed", "Feedback", 0, 0.99, 0.01, percent),
    ],
  },
  {
    id: "envelope",
    title: "Amplitude ADSR",
    controls: [
      numeric("attack", "Attack", 0.001, 1, 0.001, seconds, true),
      numeric("decay", "Decay", 0.05, 5, 0.05, seconds),
      numeric("sustain", "Sustain", 0, 1, 0.01, percent),
      numeric("release", "Release", 0.02, 2.5, 0.02, seconds),
    ],
  },
  {
    id: "effects",
    title: "Body & Space",
    controls: [
      numeric(
        "lowEq",
        "Body EQ",
        -12,
        12,
        0.5,
        (value) => `${value > 0 ? "+" : ""}${value.toFixed(1)} dB`,
      ),
      numeric("drive", "Drive", 0, 1, 0.01, percent),
      numeric("reverb", "Reverb", 0, 0.8, 0.01, percent),
      numeric("masterVol", "Volume", 0, 1, 0.01, percent),
    ],
  },
];
