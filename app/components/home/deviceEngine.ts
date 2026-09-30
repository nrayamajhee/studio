import {
  physicalSynth,
  type DrumPieceId,
  type InstrumentId,
  type KitId,
} from "../../lib/physical";
import { MASTER_PARAMS, PATCH_BY_ID } from "../../lib/physical/patches";
import type { ParamSpec } from "../../lib/physical/patches/types";

export interface DevicePreset {
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
}

// One per preset pad, grouped by engine: hammer, pluck, bow, breath, reed,
// strike.
export const DEVICE_PRESETS: readonly DevicePreset[] = [
  {
    id: "piano",
    icon: "piano",
    name: "Grand Piano",
    target: "piano",
    octave: 0,
  },
  {
    id: "guitar",
    icon: "guitar",
    name: "Acoustic Guitar",
    target: "guitar",
    octave: 0,
  },
  {
    id: "uprightBass",
    icon: "upright",
    name: "Upright Bass",
    target: "uprightBass",
    octave: -24,
  },
  { id: "violin", icon: "violin", name: "Violin", target: "violin", octave: 0 },
  { id: "flute", icon: "wind", name: "Flute", target: "flute", octave: 12 },
  {
    id: "saxophone",
    icon: "sax",
    name: "Alto Sax",
    target: "saxophone",
    octave: 0,
  },
  { id: "drums", icon: "drum", name: "Drum Kit", target: "drums", octave: 0 },
  {
    id: "drums808",
    icon: "keys",
    name: "808 Kit",
    target: "drums808",
    octave: 0,
  },
];

export const KNOB_STEPS = 11;

// The Device's ADSR knobs are the engine's master ADSR params, starting at 0,
// 200 ms, 50% and 200 ms (all on a knob step). The params' own defaults, which
// leave notes as modelled, are what switching it off sends.
const ENVELOPE_START: Record<string, number> = {
  "adsr.attack": 0.001,
  "adsr.decay": 0.2,
  "adsr.sustain": 0.5,
  "adsr.release": 0.2,
};

export const ENVELOPE_PARAMS: readonly ParamSpec[] = MASTER_PARAMS.filter(
  ({ id }) => id in ENVELOPE_START,
).map((spec) => ({ ...spec, default: ENVELOPE_START[spec.id] }));

// With a kit selected, keys play pieces by pitch class: white keys
// F G A B C D E → kick, snare, low tom, high tom, clap, crash, cowbell; black
// keys F♯ G♯ A♯ C♯ D♯ → closed hat, open hat, closed hat, closed hat, open hat.
const KEY_PIECES: readonly DrumPieceId[] = [
  "clap",
  "closedHat",
  "crash",
  "openHat",
  "cowbell",
  "kick",
  "closedHat",
  "snare",
  "openHat",
  "lowTom",
  "closedHat",
  "highTom",
];

// The drum piece a keybed note plays when a kit is selected.
export const keyPiece = (midi: number) => KEY_PIECES[midi % 12];

const NOTE_OFFSETS: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

// "C#4" → 61.
export function noteNameToMidi(name: string) {
  const match = /^([A-G])(#|b)?(-?\d+)$/.exec(name);
  if (!match) return -1;
  const accidental = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0;
  return (Number(match[3]) + 1) * 12 + NOTE_OFFSETS[match[1]] + accidental;
}

// How the instrument's physical model is excited, shown on the screen.
export function engineName(target: InstrumentId | KitId) {
  const patch = PATCH_BY_ID[target];
  switch (patch.family) {
    case "string":
      return patch.exciter === "hammer" ? "Hammer" : "Pluck";
    case "bore":
      return patch.model === "flute" ? "Breath" : "Reed";
    case "bowed":
      return "Bow";
    case "drums":
      return "Strike";
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
  target === "drums" || target === "drums808";

interface Held {
  target: InstrumentId | KitId;
  note: number;
}

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

  preview() {
    if (isKit(current.target)) {
      physicalSynth.hit(current.target, "kick", 0.8);
      return;
    }
    const target = current.target;
    const note = 60 + current.octave;
    physicalSynth.noteOn(target, note, 0.8);
    setTimeout(() => physicalSynth.noteOff(target, note), 350);
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
      physicalSynth.hit(target, KEY_PIECES[midi % 12], velocity);
    else physicalSynth.noteOn(target, note, velocity);
  },

  noteOff(midi: number) {
    const entry = held.get(midi)?.pop();
    if (!entry) return;
    if (!isKit(entry.target)) physicalSynth.noteOff(entry.target, entry.note);
  },

  setVolume(value: number) {
    setParam("master", "master.volume", value);
  },

  // Sends the ADSR's values, or with null switches it off by restoring the
  // engine's defaults.
  setEnvelope(values: Record<string, number> | null) {
    for (const spec of MASTER_PARAMS) {
      if (!spec.id.startsWith("adsr.")) continue;
      setParam("master", spec.id, values?.[spec.id] ?? spec.default);
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
};
