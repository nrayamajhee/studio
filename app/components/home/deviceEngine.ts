import {
  physicalSynth,
  type DrumPieceId,
  type EngineEvent,
  type InstrumentId,
  type KitId,
} from "../../lib/physical";
import { MASTER_PARAMS, PATCH_BY_ID } from "../../lib/physical/patches";
import type { DrumKitPatch, ParamSpec } from "../../lib/physical/patches/types";
import type { PlayedNote } from "./noteRecorder";

// Rendered past a take's end, so its last notes and the reverb ring out (s).
const RENDER_TAIL = 2.5;

// An instrument as it was set up to play: which, at what octave, with which
// params (its own and the master's).
export type DeviceSound = {
  target: InstrumentId | KitId;
  octave: number;
  overrides: Record<string, Record<string, number>>;
};

export type DevicePreset = {
  id: string;
  name: string;
  // Key into PRESET_ICONS; anything else is shown on the pad as text.
  icon: string;
  // Saved from the Device rather than built in.
  user?: boolean;
  target: InstrumentId | KitId;
  // Semitones added to keybed notes so each instrument plays in its register.
  octave: number;
  overrides?: Record<string, number>;
  // The preset pad (0–5) a built-in starts on, and the one it starts on as a
  // Shift alternate. A pad goes back to it when its saved preset is deleted.
  pad?: number;
  shiftPad?: number;
};

// The built-in presets, in library order: keys, guitars and bass, bowed and
// plucked strings, brass, winds, tuned percussion, hand drums and kits, then
// the oscillator.
export const DEVICE_PRESETS: readonly DevicePreset[] = [
  {
    id: "piano",
    icon: "piano",
    name: "Grand Piano",
    target: "piano",
    octave: 0,
    pad: 0,
  },
  {
    id: "harmonium",
    icon: "harmonium",
    name: "Harmonium",
    target: "harmonium",
    octave: 0,
  },
  {
    id: "electricGuitar",
    icon: "electric",
    name: "Electric Guitar",
    target: "electricGuitar",
    octave: 0,
    shiftPad: 1,
  },
  {
    id: "guitar",
    icon: "guitar",
    name: "Acoustic Guitar",
    target: "guitar",
    octave: 0,
    pad: 1,
  },
  {
    id: "bass",
    icon: "bass",
    name: "Bass Guitar",
    target: "bass",
    octave: -24,
    pad: 2,
  },
  {
    id: "nylonGuitar",
    icon: "nylon",
    name: "Nylon Guitar",
    target: "nylonGuitar",
    octave: 0,
  },
  {
    id: "ukulele",
    icon: "ukulele",
    name: "Ukulele",
    target: "ukulele",
    octave: 0,
  },
  {
    id: "banjo",
    icon: "banjo",
    name: "Banjo",
    target: "banjo",
    octave: 0,
  },
  {
    id: "violin",
    icon: "violin",
    name: "Violin",
    target: "violin",
    octave: 0,
    shiftPad: 3,
  },
  {
    id: "cello",
    icon: "cello",
    name: "Cello",
    target: "cello",
    octave: -12,
    pad: 3,
  },
  {
    id: "uprightBass",
    icon: "upright",
    name: "Upright Bass",
    target: "uprightBass",
    octave: -24,
    shiftPad: 2,
  },
  {
    id: "harp",
    icon: "harp",
    name: "Harp",
    target: "harp",
    octave: 0,
  },
  {
    id: "sitar",
    icon: "sitar",
    name: "Sitar",
    target: "sitar",
    octave: 0,
  },
  {
    id: "trumpet",
    icon: "trumpet",
    name: "Trumpet",
    target: "trumpet",
    octave: 0,
  },
  {
    id: "bassTrumpet",
    icon: "bassTrumpet",
    name: "Bass Trumpet",
    target: "bassTrumpet",
    octave: -12,
  },
  {
    id: "trombone",
    icon: "trombone",
    name: "Trombone",
    target: "trombone",
    octave: -12,
  },
  {
    id: "flute",
    icon: "wind",
    name: "Flute",
    target: "flute",
    octave: 12,
    shiftPad: 4,
  },
  {
    id: "clarinet",
    icon: "clarinet",
    name: "Clarinet",
    target: "clarinet",
    octave: 0,
  },
  {
    id: "harmonica",
    icon: "harmonica",
    name: "Harmonica",
    target: "harmonica",
    octave: 12,
  },
  {
    id: "xylophone",
    icon: "xylophone",
    name: "Xylophone",
    target: "xylophone",
    octave: 12,
  },
  {
    id: "steelPan",
    icon: "steelPan",
    name: "Steel Pan",
    target: "steelPan",
    octave: 0,
  },
  {
    id: "kalimba",
    icon: "kalimba",
    name: "Kalimba",
    target: "kalimba",
    octave: 0,
  },
  {
    id: "saxophone",
    icon: "sax",
    name: "Alto Sax",
    target: "saxophone",
    octave: 0,
    pad: 4,
  },
  {
    id: "madal",
    icon: "madal",
    name: "Madal",
    target: "madal",
    octave: 0,
  },
  {
    id: "tabla",
    icon: "tabla",
    name: "Tabla",
    target: "tabla",
    octave: 0,
  },
  {
    id: "drums",
    icon: "drum",
    name: "Drum Kit",
    target: "drums",
    octave: 0,
    pad: 5,
  },
  {
    id: "drums808",
    icon: "keys",
    name: "808 Kit",
    target: "drums808",
    octave: 0,
    shiftPad: 5,
  },
  {
    id: "oscillator",
    icon: "waveform",
    name: "Oscillator",
    target: "oscillator",
    octave: 0,
    shiftPad: 0,
  },
];

export const KNOB_STEPS = 11;

export type ModuleId = "adsr" | "lfo" | "fx";

export type ModuleKnob = {
  // A master param, with the Device's label and the knob's starting value as
  // its default. The engine's own default (no effect) is what "off" sends.
  spec: ParamSpec;
  steps: number;
  // The lowest step's value when it isn't on the scale: a true 0 ms attack, or
  // the shortest release that doesn't click.
  floor?: number;
  // Named steps, for knobs that pick rather than set (LFO shape and target).
  options?: readonly string[];
};

export type DeviceModule = {
  id: ModuleId;
  label: string;
  title: string;
  // White, green, red and blue knob, in that order.
  knobs: readonly ModuleKnob[];
};

function knob(
  id: string,
  label: string,
  start: number,
  {
    steps = KNOB_STEPS,
    options,
    min,
    max,
    floor,
  }: {
    steps?: number;
    options?: readonly string[];
    min?: number;
    max?: number;
    floor?: number;
  } = {},
): ModuleKnob {
  const spec = MASTER_PARAMS.find((param) => param.id === id);
  if (!spec) throw new Error(`Missing master param ${id}`);
  return {
    spec: {
      ...spec,
      label,
      default: start,
      min: min ?? spec.min,
      max: max ?? spec.max,
    },
    steps,
    options,
    floor,
  };
}

// The three global modules the Device layers over every instrument. Each
// knob's start sits on a knob step (0, 200 ms, 50%, 200 ms for the ADSR; 5 Hz
// for the LFO).
export const DEVICE_MODULES: Readonly<Record<ModuleId, DeviceModule>> = {
  adsr: {
    id: "adsr",
    label: "ADSR",
    title: "ADSR envelope",
    knobs: [
      knob("adsr.attack", "Attack", 0.001, { floor: 0 }),
      knob("adsr.decay", "Decay", 0.2),
      knob("adsr.sustain", "Sustain", 0.5),
      // A release under ~3 ms cuts dark notes off with a click; 5 ms is the
      // lowest step, with margin. The rest keep the 10 ms–4 s scale, with
      // 200 ms on a step.
      knob("adsr.release", "Release", 0.2, { min: 0.01, floor: 0.005 }),
    ],
  },
  lfo: {
    id: "lfo",
    label: "LFO",
    title: "LFO",
    knobs: [
      knob("lfo.rate", "Rate", 5),
      knob("lfo.depth", "Depth", 0.5),
      knob("lfo.shape", "Shape", 0, {
        steps: 4,
        options: ["Sine", "Triangle", "Square", "Random"],
      }),
      knob("lfo.target", "Target", 0, {
        steps: 4,
        options: ["Pitch", "Volume", "Filter", "Pan"],
      }),
    ],
  },
  fx: {
    id: "fx",
    label: "FX",
    title: "Effects",
    knobs: [
      knob("fx.drive", "Drive", 0),
      knob("fx.chorus", "Chorus", 0),
      knob("fx.delay", "Delay", 0),
      // Up to twice the engine's reverb, so the default sits mid-knob.
      knob("reverb.return", "Reverb", 0.35, { max: 0.7 }),
    ],
  },
};

// With a kit selected, keys play pieces by pitch class, as the kit maps them.
export const keyPiece = (kit: KitId, midi: number) =>
  (PATCH_BY_ID[kit] as DrumKitPatch).keys[midi % 12];

// How the instrument's physical model is excited, shown on the screen.
export function engineName(target: InstrumentId | KitId) {
  const patch = PATCH_BY_ID[target];
  switch (patch.family) {
    case "string":
      return patch.exciter === "hammer" ? "Hammer" : "Pluck";
    case "bore":
      return patch.model === "flute"
        ? "Breath"
        : patch.model === "brass"
          ? "Lips"
          : "Reed";
    case "bowed":
      return "Bow";
    case "drums":
      return "Strike";
    case "oscillator":
      return "Oscillator";
    case "reed":
      return "Free reed";
    case "bar":
      return patch.strike === "thumb" ? "Thumb" : "Mallet";
  }
}

export const findPreset = (id: string) =>
  DEVICE_PRESETS.find((preset) => preset.id === id) ?? DEVICE_PRESETS[0];

// Every param of the preset's instrument: its override, else the default.
export function presetValues(preset: DevicePreset) {
  const values: Record<string, number> = {};
  for (const spec of PATCH_BY_ID[preset.target].params) {
    values[spec.id] = preset.overrides?.[spec.id] ?? spec.default;
  }
  return values;
}

export const isKit = (target: InstrumentId | KitId): target is KitId =>
  PATCH_BY_ID[target].family === "drums";

type Held = {
  target: InstrumentId | KitId;
  note: number;
};

let current: DevicePreset = DEVICE_PRESETS[0];
const held = new Map<number, Held[]>();
const applied = new Map<string, number>();

// Sends a param only when its value actually changes.
function setParam(
  target: InstrumentId | KitId | "master",
  id: string,
  value: number,
) {
  const key = `${target}:${id}`;
  if (applied.get(key) === value) return;
  applied.set(key, value);
  physicalSynth.setParam(target, id, value);
}

export const deviceEngine = {
  unlock() {
    if (physicalSynth.ready) physicalSynth.resume();
    else void physicalSynth.start();
  },

  // Every param of the instrument goes back to its default unless the preset
  // overrides it or it has been edited since, so switching presets never leaks
  // settings between them.
  loadPreset(preset: DevicePreset, edits?: Readonly<Record<string, number>>) {
    current = preset;
    const values = { ...presetValues(preset), ...edits };
    for (const [id, value] of Object.entries(values)) {
      setParam(preset.target, id, value);
    }
    return values;
  },

  // `midi` is the keybed note; the preset's octave offset is applied here and
  // remembered so the note-off reaches the same instrument and note.
  noteOn(midi: number, velocity: number) {
    const { target, octave } = current;
    const note = midi + octave;
    const stack = held.get(midi) ?? [];
    stack.push({ target, note });
    held.set(midi, stack);
    if (isKit(target))
      physicalSynth.hit(target, keyPiece(target, midi), velocity);
    else physicalSynth.noteOn(target, note, velocity);
  },

  // A kit's piece, now or at `time` on the audio clock (see `now`).
  hit(kit: KitId, piece: DrumPieceId, velocity: number, time?: number) {
    physicalSynth.hit(kit, piece, velocity, time);
  },

  // The audio clock (s), which timed hits are scheduled on.
  now() {
    return physicalSynth.now();
  },

  noteOff(midi: number) {
    const entry = held.get(midi)?.pop();
    if (!entry) return;
    if (!isKit(entry.target)) physicalSynth.noteOff(entry.target, entry.note);
  },

  // The system volume, after the clipper: louder never clips.
  setVolume(value: number) {
    physicalSynth.setVolume(value);
  },

  // The synth's level into the clipper, before the system volume: turning it
  // down gives chords headroom.
  setLevel(value: number) {
    setParam("master", "master.volume", value);
  },

  // Sends a module's values, or with null switches it off by restoring the
  // engine's defaults for those params.
  setMasterParams(
    ids: readonly string[],
    values: Record<string, number> | null,
  ) {
    for (const id of ids) {
      const spec = MASTER_PARAMS.find((param) => param.id === id);
      if (spec) setParam("master", id, values?.[id] ?? spec.default);
    }
  },

  // Sets one param of the current instrument.
  setValue(id: string, value: number) {
    setParam(current.target, id, value);
  },

  metronomeTick(accent: boolean) {
    physicalSynth.metronomeTick(accent);
  },

  allNotesOff() {
    held.clear();
    physicalSynth.allNotesOff();
  },

  getAnalyser() {
    return physicalSynth.getAnalyser();
  },

  // The current instrument, its octave and every param sent to it and the
  // master: what an offline render needs to sound like the Device does now.
  sound(): DeviceSound {
    const { target, octave } = current;
    const overrides: Record<string, Record<string, number>> = {};
    for (const [key, value] of applied) {
      const split = key.indexOf(":");
      const owner = key.slice(0, split);
      if (owner !== target && owner !== "master") continue;
      (overrides[owner] ??= {})[key.slice(split + 1)] = value;
    }
    return { target, octave, overrides };
  },

  // Keybed notes (ms) rendered offline with `sound`, for scrubbing a take or
  // mixing tracks. Null until the engine starts.
  render(
    notes: readonly PlayedNote[],
    length: number,
    sound: DeviceSound = deviceEngine.sound(),
  ) {
    const { target, octave, overrides } = sound;
    const events: EngineEvent[] = notes.flatMap(
      ({ note, start, duration, velocity }): EngineEvent[] =>
        isKit(target)
          ? [
              {
                type: "hit",
                kit: target,
                piece: keyPiece(target, note),
                velocity,
                time: start / 1000,
              },
            ]
          : [
              {
                type: "noteOn",
                instrument: target,
                note: note + octave,
                velocity,
                time: start / 1000,
              },
              {
                type: "noteOff",
                instrument: target,
                note: note + octave,
                time: (start + duration) / 1000,
              },
            ],
    );
    return physicalSynth.render(events, length / 1000 + RENDER_TAIL, overrides);
  },

  scrubber(buffer: AudioBuffer) {
    return physicalSynth.scrubber(buffer);
  },

  mixer() {
    return physicalSynth.mixer();
  },
};
