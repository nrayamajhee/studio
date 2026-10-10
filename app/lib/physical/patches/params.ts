import type { AdsrStages } from "../dsp/Adsr";
import type { ParamSpec, Patch, SectionId } from "./types";

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

// Every instrument's params come in these modules, always in this order: the
// signal chain (exciter, resonator, filter, body, output), then what
// modulates it (envelope, LFO). The Synth screen gives each its own page and
// the Lab a heading. The exciter and resonator are the model's own; the rest
// are built from the same params on every instrument that has them.
export const MODULES: readonly { id: SectionId; label: string }[] = [
  { id: "exciter", label: "Exciter" },
  { id: "resonator", label: "Resonator" },
  { id: "filter", label: "Filter" },
  { id: "body", label: "Body" },
  { id: "output", label: "Output" },
  { id: "envelope", label: "Envelope" },
  { id: "lfo", label: "LFO" },
];

// An instrument's params grouped by module, in module order; modules it
// doesn't have are left out.
export function paramModules(specs: readonly ParamSpec[]) {
  return MODULES.map((module) => ({
    ...module,
    specs: specs.filter((spec) => spec.section === module.id),
  })).filter((module) => module.specs.length > 0);
}

type AdsrRanges = {
  readonly [Stage in keyof AdsrStages]: readonly [min: number, max: number];
};

// The winds' breath, the violin's bow and the free reeds' bellows.
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

// The filter module: a lowpass whose cutoff follows the key and opens with
// an envelope that starts at each note and decays.
function filterParams(cutoff: number, q = Math.SQRT1_2): ParamSpec[] {
  return [
    param("filter.cutoff", "Cutoff", "filter", 200, 16000, cutoff, {
      unit: "Hz",
      scale: "log",
      primary: true,
    }),
    param("filter.resonance", "Resonance", "filter", 0.5, 8, q, primary),
    param("filter.envAmount", "Env amount", "filter", 0, 4, 0, primary),
    param("filter.envDecay", "Env decay", "filter", 0.02, 2, 0.3, {
      unit: "s",
      scale: "log",
      primary: true,
    }),
    param("filter.keytrack", "Keytrack", "filter", 0, 1, 0, primary),
  ];
}

// In the order of the LFO's shapes.
export const LFO_SHAPES = ["Sine", "Triangle", "Square", "Random"] as const;

export type LfoDefaults = {
  rate?: number;
  delay?: number;
  // Cents either side of the note.
  pitch?: number;
  // A fraction of the exciter's drive (breath, bow, bellows) or, on models
  // without one, of the output.
  level?: number;
};

// A wind or bow's vibrato depth as it used to be set, a fraction of the loop's
// length, in cents.
export const ratioToCents = (ratio: number) => 1200 * Math.log2(1 + ratio);

// Ids older saved presets may hold for what is now the LFO module, with how
// each value carries over. The winds' and bow's pitch depths were fractions
// of the loop's length.
const MOVED_TO_LFO: Partial<
  Record<
    Patch["family"],
    Record<string, [id: string, convert?: (v: number) => number]>
  >
> = {
  bore: {
    "exciter.vibrato": ["lfo.level"],
    "resonator.vibratoRate": ["lfo.rate"],
    "resonator.pitchVibrato": ["lfo.pitch", ratioToCents],
  },
  bowed: {
    "exciter.vibrato": ["lfo.pitch", ratioToCents],
    "resonator.vibratoRate": ["lfo.rate"],
  },
  reed: {
    "exciter.vibrato": ["lfo.level"],
    "resonator.vibratoRate": ["lfo.rate"],
  },
};

// Saved values with their ids brought up to date; values whose id is current
// pass through, and a moved one never replaces one already under its new id.
export function migrateParams(
  family: Patch["family"],
  values: Readonly<Record<string, number>>,
) {
  const moved = MOVED_TO_LFO[family];
  if (!moved) return values;
  const next: Record<string, number> = {};
  for (const [id, value] of Object.entries(values)) {
    const target = moved[id];
    if (!target) next[id] = value;
    else if (!(target[0] in values))
      next[target[0]] = target[1] ? target[1](value) : value;
  }
  return next;
}

// The LFO module: one per voice, starting with the note after `delay` (the
// free reeds' swell runs freely instead), swinging pitch, level and cutoff.
function lfoParams(d: LfoDefaults = {}): ParamSpec[] {
  return [
    param("lfo.rate", "Rate", "lfo", 0.2, 12, d.rate ?? 5, {
      unit: "Hz",
      scale: "log",
      primary: true,
    }),
    param("lfo.shape", "Shape", "lfo", 0, LFO_SHAPES.length - 1, 0, {
      options: LFO_SHAPES,
      primary: true,
    }),
    param("lfo.delay", "Delay", "lfo", 0, 2, d.delay ?? 0, {
      unit: "s",
      primary: true,
    }),
    param("lfo.pitch", "Pitch", "lfo", 0, 50, d.pitch ?? 0, {
      unit: "cents",
      primary: true,
    }),
    param("lfo.level", "Level", "lfo", 0, 0.3, d.level ?? 0, primary),
    param("lfo.filter", "Filter", "lfo", 0, 3, 0, {
      unit: "oct",
      primary: true,
    }),
  ];
}

// Legato glide time; the lowest is a jump.
const glideParam = (id: string, section: SectionId, value: number, max = 0.3) =>
  param(id, "Glide", section, 0.001, max, value, {
    unit: "s",
    scale: "log",
    primary: true,
  });

// The output module: drive (where the model has it), level and reverb send.
const outputParams = (send: number, drive?: number): ParamSpec[] => [
  ...(drive === undefined
    ? []
    : [param("output.drive", "Drive", "output", 0, 1, drive, primary)]),
  param("output.level", "Level", "output", 0, 2, 1),
  param("space.send", "Reverb send", "output", 0, 1, send, primary),
];

const bodyParams = (
  mix: number,
  labels?: { size: string; resonance: string },
) => [
  param("body.size", labels?.size ?? "Size", "body", 0.7, 1.4, 1, {
    unit: "×",
    primary: true,
  }),
  param(
    "body.resonance",
    labels?.resonance ?? "Resonance",
    "body",
    labels ? 0 : 0.5,
    2,
    1,
    { unit: "×", primary: true },
  ),
  param("body.tone", "Tone", "body", -1, 1, 0, primary),
  param("body.mix", "Mix", "body", 0, 1, mix, primary),
];

export type StringDefaults = {
  hardness: number;
  position: number;
  bodyMix: number;
  cutoff: number;
  q?: number;
  send: number;
  drive?: number;
  strum?: number;
  // A sitar's jawari: how hard the string buzzes against the bridge.
  jawari?: number;
  // A plucked string's default pluck, which the Pluck param can switch.
  pluck?: "pick" | "finger";
};

export const PLUCKS = ["Pick", "Finger"] as const;

export function stringParams(d: StringDefaults): ParamSpec[] {
  return [
    param("exciter.hardness", "Hardness", "exciter", 0, 1, d.hardness, primary),
    // How far along the string from the bridge, shown as that fraction.
    param("exciter.position", "Position", "exciter", 0.05, 0.5, d.position, {
      unit: "%",
      primary: true,
    }),
    param("exciter.strength", "Strength", "exciter", 0, 1, 0.8, primary),
    ...(d.pluck === undefined
      ? []
      : [
          param(
            "exciter.pluck",
            "Pluck",
            "exciter",
            0,
            1,
            d.pluck === "finger" ? 1 : 0,
            { options: PLUCKS, primary: true },
          ),
        ]),
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
    ...(d.jawari === undefined
      ? []
      : [
          param(
            "resonator.jawari",
            "Jawari",
            "resonator",
            0,
            1,
            d.jawari,
            primary,
          ),
        ]),
    ...bodyParams(d.bodyMix),
    ...filterParams(d.cutoff, d.q),
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
    ...lfoParams(),
    ...outputParams(d.send, d.drive),
  ];
}

export type BoreDefaults = {
  noise: number;
  vibrato: number;
  vibratoRate: number;
  // How long a held note waits before its vibrato fades in.
  vibratoDelay?: number;
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
};

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
        ]),
    ...(d.blowPosition === undefined
      ? []
      : [
          param(
            "exciter.blowPosition",
            "Blow position",
            "exciter",
            0.1,
            0.5,
            d.blowPosition,
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
    glideParam("resonator.portamento", "resonator", d.portamento),
    ...bodyParams(1, { size: "Bell size", resonance: "Presence" }),
    ...filterParams(d.cutoff),
    ...adsrParams("envelope", d, INSTRUMENT_ADSR),
    // The vibrato sways the breath; a touch of pitch rides on it.
    ...lfoParams({
      rate: d.vibratoRate,
      delay: d.vibratoDelay ?? 0.25,
      pitch: ratioToCents(0.002),
      level: d.vibrato,
    }),
    ...outputParams(d.send),
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
    param("exciter.position", "Bow position", "exciter", 0.05, 0.4, 0.18, {
      unit: "%",
      primary: true,
    }),
    param("exciter.speed", "Bow speed", "exciter", 0.5, 1.5, 1, {
      unit: "×",
      primary: true,
    }),
    glideParam("resonator.portamento", "resonator", portamento),
    body === "violin"
      ? param("body.violin", "Body", "body", 0, 1, 1, primary)
      : param("body.mix", "Body", "body", 0, 1, 0.6, primary),
    param("body.tone", "Tone", "body", -1, 1, 0, primary),
    ...filterParams(12000),
    ...adsrParams(
      "envelope",
      { attack: 0.06, decay: 0.05, sustain: 0.9, release: 0.15 },
      INSTRUMENT_ADSR,
    ),
    // The left hand's vibrato: it rolls the string's length.
    ...lfoParams({ rate: 5.6, delay: 0.3, pitch: ratioToCents(0.006) }),
    ...outputParams(send),
  ];
}

export type ReedDefaults = {
  noise: number;
  // The shared swell: a harmonium's bellows, a harmonica player's hand.
  swell: number;
  swellRate: number;
  brightness: number;
  bodyMix: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  cutoff: number;
  send: number;
};

export function reedParams(d: ReedDefaults): ParamSpec[] {
  return [
    param("exciter.pressure", "Pressure", "exciter", 0.7, 1.4, 1, {
      unit: "×",
      primary: true,
    }),
    param("exciter.noise", "Air noise", "exciter", 0, 2, d.noise, {
      unit: "×",
      primary: true,
    }),
    // How far the reed swings before air rushes past it: narrower, brighter
    // pulses.
    param(
      "resonator.brightness",
      "Brightness",
      "resonator",
      -1,
      1,
      d.brightness,
      primary,
    ),
    // Scales how sharp a second reed sits, and so how fast it beats.
    param("resonator.detune", "Celeste", "resonator", 0, 3, 1, {
      unit: "×",
      primary: true,
    }),
    ...bodyParams(d.bodyMix),
    ...filterParams(d.cutoff),
    ...adsrParams("envelope", d, INSTRUMENT_ADSR),
    // The swell: the bellows or a cupped hand moving the pressure.
    ...lfoParams({ rate: d.swellRate, level: d.swell }),
    ...outputParams(d.send),
  ];
}

export type BarDefaults = {
  hardness: number;
  // Only for a patch with a modal body (the kalimba's box).
  bodyMix?: number;
  cutoff: number;
  send: number;
};

export function barParams(d: BarDefaults): ParamSpec[] {
  return [
    param("exciter.hardness", "Hardness", "exciter", 0, 1, d.hardness, primary),
    param("exciter.strength", "Strength", "exciter", 0, 1, 0.8, primary),
    param("resonator.decay", "Decay", "resonator", 0.25, 4, 1, {
      unit: "×",
      scale: "log",
      primary: true,
    }),
    // Tilts the upper modes' levels, ±6 dB an octave of their ratio.
    param("resonator.brightness", "Brightness", "resonator", -1, 1, 0, primary),
    ...(d.bodyMix === undefined ? [] : bodyParams(d.bodyMix)),
    ...filterParams(d.cutoff),
    ...lfoParams(),
    ...outputParams(d.send),
  ];
}

// In the order of the Oscillator's waves.
export const OSCILLATOR_WAVES = ["Sine", "Triangle", "Square", "Saw"] as const;

// The second oscillator can be switched off, leaving a single-oscillator patch.
export const OSCILLATOR_WAVES_2 = ["Off", ...OSCILLATOR_WAVES] as const;

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
    glideParam("exciter.glide", "exciter", glide, 0.5),
    ...filterParams(16000),
    // Only a gate's attack and release: the track ADSR shapes the rest, so
    // two volume envelopes never stack.
    param("envelope.attack", "Attack", "envelope", 0.005, 0.5, 0.005, time),
    param("envelope.release", "Release", "envelope", 0.02, 2, 0.1, time),
    ...lfoParams(),
    ...outputParams(send),
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
    ...outputParams(send),
  ];
}

export const MASTER_PARAMS: ParamSpec[] = [
  param("master.volume", "Volume", "output", 0, 1, 0.8, primary),
  param("reverb.size", "Reverb size", "output", 0.5, 1.5, 1, {
    unit: "×",
    primary: true,
  }),
  param("reverb.decay", "Reverb decay", "output", 0.3, 8, 1.8, {
    unit: "s",
    scale: "log",
    primary: true,
  }),
  param("reverb.damping", "Reverb damping", "output", 0, 0.7, 0.35, primary),
  param("reverb.predelay", "Predelay", "output", 0, 0.06, 0.015, { unit: "s" }),
  param("reverb.return", "Reverb return", "output", 0, 1, 0.35, primary),
  // One LFO over the whole mix; shape and target are indices (sine, triangle,
  // square, random; pitch, volume, filter, pan). Zero depth leaves the mix as
  // it is.
  param("lfo.rate", "LFO rate", "output", 0.2, 20, 5, {
    unit: "Hz",
    scale: "log",
    primary: true,
  }),
  param("lfo.depth", "LFO depth", "output", 0, 1, 0, primary),
  param("lfo.shape", "LFO shape", "output", 0, 3, 0),
  param("lfo.target", "LFO target", "output", 0, 3, 0),
  // The FX chain; zero leaves the mix as it is.
  param("fx.drive", "Drive", "output", 0, 1, 0, primary),
  param("fx.chorus", "Chorus", "output", 0, 1, 0, primary),
  param("fx.delay", "Delay", "output", 0, 1, 0, primary),
  // The master ADSR over every voice. The defaults (instant attack, full
  // sustain, a release far longer than any damper) leave notes as modelled.
  ...adsrParams(
    "adsr",
    { attack: 0.001, decay: 0.3, sustain: 1, release: 4 },
    MASTER_ADSR,
  ),
];
