import type { AdsrStages } from "../dsp/Adsr";
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

type AdsrRanges = {
  readonly [Stage in keyof AdsrStages]: readonly [min: number, max: number];
};

// The winds' breath and the violin's bow.
const INSTRUMENT_ADSR: AdsrRanges = {
  attack: [0.005, 0.5],
  decay: [0.01, 1],
  sustain: [0.3, 1],
  release: [0.02, 1],
};

// Log ranges whose 11-step knobs land on 200 ms for decay and release.
const MASTER_ADSR: AdsrRanges = {
  attack: [0.001, 4],
  decay: [0.01, 4],
  sustain: [0, 1],
  release: [0.001, 4],
};

// Attack, decay, sustain and release under `prefix`: every ADSR in the engine
// is described this way and read back with ParamSet.envelope(prefix).
function adsrParams(
  prefix: string,
  stages: AdsrStages,
  ranges: AdsrRanges,
): ParamSpec[] {
  const time = { unit: "s", scale: "log", primary: true } as const;
  return [
    param(
      `${prefix}.attack`,
      "Attack",
      "envelope",
      ...ranges.attack,
      stages.attack,
      time,
    ),
    param(
      `${prefix}.decay`,
      "Decay",
      "envelope",
      ...ranges.decay,
      stages.decay,
      time,
    ),
    param(
      `${prefix}.sustain`,
      "Sustain",
      "envelope",
      ...ranges.sustain,
      stages.sustain,
      primary,
    ),
    param(
      `${prefix}.release`,
      "Release",
      "envelope",
      ...ranges.release,
      stages.release,
      time,
    ),
  ];
}

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

// Legato glide time; the lowest is a jump.
const portamentoParam = (value: number) =>
  param("resonator.portamento", "Portamento", "resonator", 0.001, 0.3, value, {
    unit: "s",
    scale: "log",
    primary: true,
  });

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
    param("envelope.release", "Damper", "envelope", 0.25, 4, 1, {
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
  // Legato glide time; the winds slide, brass a little less.
  portamento: number;
  jetRatio?: number;
  reed?: number;
  blowPosition?: number;
  lip?: number;
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
    ...(d.lip === undefined
      ? []
      : [
          // STK Brass lip tension: the lip resonance relative to the note.
          param("exciter.lip", "Lip tension", "exciter", 0, 1, d.lip, primary),
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
    portamentoParam(d.portamento),
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
    ...adsrParams("envelope", d, INSTRUMENT_ADSR),
    ...shared(d.send),
  ];
}

// The violin mixes in its measured body filter ("Body"); other bowed patches
// use the bus's modal body instead.
export function bowedParams(
  send: number,
  portamento: number,
  body: "violin" | "modal" = "violin",
): ParamSpec[] {
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
    portamentoParam(portamento),
    body === "violin"
      ? param("body.violin", "Body", "body", 0, 1, 1, primary)
      : param("body.mix", "Body", "body", 0, 1, 0.6, primary),
    param("body.tone", "Tone", "body", -1, 1, 0, primary),
    ...filterParams(12000, Math.SQRT1_2),
    ...adsrParams(
      "envelope",
      { attack: 0.06, decay: 0.05, sustain: 0.9, release: 0.15 },
      INSTRUMENT_ADSR,
    ),
    ...shared(send),
  ];
}

// In the order of the Oscillator's waves.
export const OSCILLATOR_WAVES = ["Sine", "Triangle", "Square", "Saw"] as const;

// The second oscillator can be switched off, leaving a single-oscillator patch.
export const OSCILLATOR_WAVES_2 = ["Off", ...OSCILLATOR_WAVES] as const;

// Shaping beyond the gate's attack and release comes from the master ADSR.
export function oscillatorParams(send: number, glide: number): ParamSpec[] {
  const time = { unit: "s", scale: "log", primary: true } as const;
  return [
    param(
      "exciter.wave",
      "Wave 1",
      "exciter",
      0,
      OSCILLATOR_WAVES.length - 1,
      0,
      {
        options: OSCILLATOR_WAVES,
        primary: true,
      },
    ),
    param(
      "exciter.wave2",
      "Wave 2",
      "exciter",
      0,
      OSCILLATOR_WAVES_2.length - 1,
      0,
      {
        options: OSCILLATOR_WAVES_2,
        primary: true,
      },
    ),
    // How much of the second oscillator is summed in; silent while Wave 2 is Off.
    param("exciter.level2", "Osc 2 level", "exciter", 0, 1, 0.5, primary),
    // Where the second oscillator sits in its cycle relative to the first:
    // 0° reinforces, 180° cancels a matching wave.
    param("exciter.phase", "Phase", "exciter", 0, 360, 0, {
      unit: "°",
      primary: true,
    }),
    // Legato glide, the synth's portamento; the lowest is a jump.
    param("exciter.glide", "Glide", "exciter", 0.001, 0.5, glide, time),
    param("filter.cutoff", "Cutoff", "filter", 200, 16000, 16000, {
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
    param("envelope.attack", "Attack", "envelope", 0.005, 0.5, 0.005, time),
    param("envelope.release", "Release", "envelope", 0.02, 2, 0.1, time),
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
  // One LFO over the whole mix; shape and target are indices (sine, triangle,
  // square, random; pitch, volume, filter, pan). Zero depth leaves the mix as
  // it is.
  param("lfo.rate", "LFO rate", "space", 0.2, 20, 5, {
    unit: "Hz",
    scale: "log",
    primary: true,
  }),
  param("lfo.depth", "LFO depth", "space", 0, 1, 0, primary),
  param("lfo.shape", "LFO shape", "space", 0, 3, 0),
  param("lfo.target", "LFO target", "space", 0, 3, 0),
  // The FX chain; zero leaves the mix as it is.
  param("fx.drive", "Drive", "space", 0, 1, 0, primary),
  param("fx.chorus", "Chorus", "space", 0, 1, 0, primary),
  param("fx.delay", "Delay", "space", 0, 1, 0, primary),
  // The master ADSR over every voice. The defaults (instant attack, full
  // sustain, a release far longer than any damper) leave notes as modelled.
  ...adsrParams(
    "adsr",
    { attack: 0.001, decay: 0.3, sustain: 1, release: 4 },
    MASTER_ADSR,
  ),
];
