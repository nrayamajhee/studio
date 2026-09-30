import type { ParamSpec, SectionId } from "./types";

const param = (
  id: string,
  label: string,
  section: SectionId,
  min: number,
  max: number,
  value: number,
  extra: Partial<ParamSpec> = {},
): ParamSpec => ({ id, label, section, min, max, default: value, ...extra });

const primary = { primary: true } as const;

function filterParams(cutoff: number, q: number): ParamSpec[] {
  return [
    param("filter.cutoff", "Cutoff", "filter", 200, 16000, cutoff, {
      unit: "Hz",
      scale: "log",
      primary: true,
    }),
    param("filter.resonance", "Resonance", "filter", 0.5, 8, q, primary),
    param("filter.envAmount", "Env amount", "filter", 0, 4, 0, primary),
    param("filter.keytrack", "Keytrack", "filter", 0, 1, 0, primary),
    param("filter.envDecay", "Env decay", "filter", 0.02, 2, 0.3, {
      unit: "s",
      scale: "log",
    }),
  ];
}

const shared = (send: number): ParamSpec[] => [
  param("space.send", "Reverb send", "space", 0, 1, send, primary),
  param("output.level", "Level", "space", 0, 2, 1),
];

export interface StringDefaults {
  hardness: number;
  position: number;
  bodyMix: number;
  cutoff: number;
  q?: number;
  send: number;
  drive?: number;
  strum?: number;
}

export function stringParams(d: StringDefaults): ParamSpec[] {
  return [
    param("exciter.hardness", "Hardness", "exciter", 0, 1, d.hardness, primary),
    param(
      "exciter.position",
      "Position",
      "exciter",
      0.05,
      0.5,
      d.position,
      primary,
    ),
    param("exciter.strength", "Strength", "exciter", 0, 1, 0.8, primary),
    ...(d.strum === undefined
      ? []
      : [
          param("exciter.strum", "Strum", "exciter", 0, 60, d.strum, {
            unit: "ms",
          }),
        ]),
    param("resonator.decay", "Decay", "resonator", 0.25, 4, 1, {
      unit: "×",
      scale: "log",
      primary: true,
    }),
    param(
      "resonator.brightness",
      "Brightness",
      "resonator",
      -0.3,
      0.3,
      0,
      primary,
    ),
    param("resonator.inharmonicity", "Inharmonicity", "resonator", 0, 3, 1, {
      unit: "×",
      primary: true,
    }),
    param("resonator.detune", "Detune", "resonator", 0, 4, 1, {
      unit: "×",
      primary: true,
    }),
    param("body.size", "Size", "body", 0.7, 1.4, 1, {
      unit: "×",
      primary: true,
    }),
    param("body.resonance", "Resonance", "body", 0.5, 2, 1, {
      unit: "×",
      primary: true,
    }),
    param("body.tone", "Tone", "body", -1, 1, 0, primary),
    param("body.mix", "Mix", "body", 0, 1, d.bodyMix, primary),
    ...(d.drive === undefined
      ? []
      : [param("output.drive", "Drive", "body", 0, 1, d.drive)]),
    ...filterParams(d.cutoff, d.q ?? Math.SQRT1_2),
    param("envelope.attack", "Attack", "envelope", 0.001, 0.2, 0.001, {
      unit: "s",
      scale: "log",
      primary: true,
    }),
    param("envelope.release", "Release (damper)", "envelope", 0.25, 4, 1, {
      unit: "×",
      scale: "log",
      primary: true,
    }),
    ...shared(d.send),
  ];
}

export interface BoreDefaults {
  noise: number;
  vibrato: number;
  vibratoRate: number;
  jetRatio?: number;
  reed?: number;
  blowPosition?: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  cutoff: number;
  send: number;
}

export function boreParams(d: BoreDefaults): ParamSpec[] {
  return [
    param("exciter.pressure", "Breath", "exciter", 0.85, 1.25, 1, {
      unit: "×",
      primary: true,
    }),
    ...(d.jetRatio === undefined
      ? []
      : [
          param(
            "exciter.jetRatio",
            "Jet ratio",
            "exciter",
            0.2,
            0.5,
            d.jetRatio,
            primary,
          ),
        ]),
    ...(d.reed === undefined
      ? []
      : [
          // STK Saxofony reed stiffness: table slope = 0.1 + 0.4·stiffness.
          param(
            "exciter.reed",
            "Reed stiffness",
            "exciter",
            0,
            1,
            d.reed,
            primary,
          ),
          param(
            "exciter.blowPosition",
            "Blow position",
            "exciter",
            0.1,
            0.5,
            d.blowPosition ?? 0.2,
          ),
        ]),
    param("exciter.noise", "Breath noise", "exciter", 0, 2, d.noise, {
      unit: "×",
      primary: true,
    }),
    param("exciter.vibrato", "Vibrato", "exciter", 0, 0.12, d.vibrato, primary),
    param(
      "resonator.vibratoRate",
      "Vibrato rate",
      "resonator",
      3,
      8,
      d.vibratoRate,
      {
        unit: "Hz",
        primary: true,
      },
    ),
    param("resonator.portamento", "Portamento", "resonator", 0.001, 0.3, 0.03, {
      unit: "s",
      scale: "log",
      primary: true,
    }),
    param(
      "resonator.pitchVibrato",
      "Pitch vibrato",
      "resonator",
      0,
      0.01,
      0.002,
    ),
    param("body.size", "Bell size", "body", 0.7, 1.4, 1, {
      unit: "×",
      primary: true,
    }),
    param("body.resonance", "Presence", "body", 0, 2, 1, {
      unit: "×",
      primary: true,
    }),
    param("body.tone", "Tone", "body", -1, 1, 0, primary),
    param("body.mix", "Mix", "body", 0, 1, 1, primary),
    ...filterParams(d.cutoff, Math.SQRT1_2),
    param("envelope.attack", "Attack", "envelope", 0.005, 0.5, d.attack, {
      unit: "s",
      scale: "log",
      primary: true,
    }),
    param("envelope.decay", "Decay", "envelope", 0.01, 1, d.decay, {
      unit: "s",
      scale: "log",
      primary: true,
    }),
    param(
      "envelope.sustain",
      "Sustain",
      "envelope",
      0.3,
      1,
      d.sustain,
      primary,
    ),
    param("envelope.release", "Release", "envelope", 0.02, 1, d.release, {
      unit: "s",
      scale: "log",
      primary: true,
    }),
    ...shared(d.send),
  ];
}

export function bowedParams(send: number): ParamSpec[] {
  return [
    param("exciter.pressure", "Bow pressure", "exciter", 0, 1, 0.75, primary),
    param(
      "exciter.position",
      "Bow position",
      "exciter",
      0.05,
      0.4,
      0.18,
      primary,
    ),
    param("exciter.speed", "Bow speed", "exciter", 0.5, 1.5, 1, {
      unit: "×",
      primary: true,
    }),
    param("exciter.vibrato", "Vibrato", "exciter", 0, 0.02, 0.006, primary),
    param("resonator.vibratoRate", "Vibrato rate", "resonator", 3, 8, 5.6, {
      unit: "Hz",
      primary: true,
    }),
    param("body.violin", "Body", "body", 0, 1, 1, primary),
    param("body.tone", "Tone", "body", -1, 1, 0, primary),
    ...filterParams(12000, Math.SQRT1_2),
    param("envelope.attack", "Attack", "envelope", 0.005, 0.5, 0.06, {
      unit: "s",
      scale: "log",
      primary: true,
    }),
    param("envelope.decay", "Decay", "envelope", 0.01, 1, 0.05, {
      unit: "s",
      scale: "log",
      primary: true,
    }),
    param("envelope.sustain", "Sustain", "envelope", 0.3, 1, 0.9, primary),
    param("envelope.release", "Release", "envelope", 0.02, 1, 0.15, {
      unit: "s",
      scale: "log",
      primary: true,
    }),
    ...shared(send),
  ];
}

export function drumParams(send: number): ParamSpec[] {
  return [
    param("exciter.hardness", "Hardness", "exciter", 0, 1, 0.6, primary),
    param("exciter.position", "Position", "exciter", 0, 1, 0.3, primary),
    param("exciter.strength", "Strength", "exciter", 0, 1, 0.8, primary),
    param("exciter.click", "Click", "exciter", 0, 2, 1, {
      unit: "×",
      primary: true,
    }),
    param("resonator.tune", "Tune", "resonator", -12, 12, 0, {
      unit: "st",
      primary: true,
    }),
    param("resonator.decay", "Decay", "resonator", 0.25, 4, 1, {
      unit: "×",
      scale: "log",
      primary: true,
    }),
    param("resonator.pitchDrop", "Pitch drop", "resonator", 0, 2, 1, {
      unit: "×",
      primary: true,
    }),
    param("resonator.wires", "Snare wires", "resonator", 0, 1.5, 1, {
      unit: "×",
      primary: true,
    }),
    param("body.width", "Width", "body", 0, 1.5, 1, {
      unit: "×",
      primary: true,
    }),
    param("body.tone", "Tone", "body", -1, 1, 0, primary),
    param("filter.cutoff", "Cutoff", "filter", 200, 20000, 20000, {
      unit: "Hz",
      scale: "log",
      primary: true,
    }),
    param(
      "filter.resonance",
      "Resonance",
      "filter",
      0.5,
      8,
      Math.SQRT1_2,
      primary,
    ),
    ...shared(send),
  ];
}

export const MASTER_PARAMS: ParamSpec[] = [
  param("master.volume", "Volume", "space", 0, 1, 0.8, primary),
  param("reverb.size", "Reverb size", "space", 0.5, 1.5, 1, {
    unit: "×",
    primary: true,
  }),
  param("reverb.decay", "Reverb decay", "space", 0.3, 8, 1.8, {
    unit: "s",
    scale: "log",
    primary: true,
  }),
  param("reverb.damping", "Reverb damping", "space", 0, 0.7, 0.35, primary),
  param("reverb.predelay", "Predelay", "space", 0, 0.06, 0.015, { unit: "s" }),
  param("reverb.return", "Reverb return", "space", 0, 1, 0.35, primary),
];
