import {
  physicalSynth,
  type DrumPieceId,
  type InstrumentId,
  type KitId,
} from "../../lib/physical";
import { PATCH_BY_ID } from "../../lib/physical/patches";
import type { ParamSpec } from "../../lib/physical/patches/types";

export interface DeviceControl {
  id: string;
  label: string;
}

export interface DevicePreset {
  id: string;
  name: string;
  target: InstrumentId | KitId;
  // Semitones added to keybed notes so each instrument plays in its register.
  octave: number;
  overrides?: Record<string, number>;
  controls: readonly [primary: DeviceControl, secondary: DeviceControl];
}

const TUNE: DeviceControl = { id: "resonator.tune", label: "Tune" };
const DRUM_DECAY: DeviceControl = { id: "resonator.decay", label: "Decay" };
const SUSTAIN: DeviceControl = { id: "resonator.decay", label: "Sustain" };
const VIBRATO: DeviceControl = { id: "exciter.vibrato", label: "Vibrato" };
const BREATH: DeviceControl = { id: "exciter.pressure", label: "Breath" };

// One entry per preset pad, in pad order.
export const DEVICE_PRESETS: readonly DevicePreset[] = [
  {
    id: "piano",
    name: "Grand Piano",
    target: "piano",
    octave: 0,
    controls: [{ id: "exciter.hardness", label: "Hardness" }, SUSTAIN],
  },
  {
    id: "guitar",
    name: "Acoustic Guitar",
    target: "guitar",
    octave: 0,
    controls: [{ id: "exciter.hardness", label: "Pick" }, SUSTAIN],
  },
  {
    id: "bass",
    name: "Electric Bass",
    target: "bass",
    octave: -24,
    controls: [
      { id: "filter.cutoff", label: "Tone" },
      { id: "exciter.hardness", label: "Pluck" },
    ],
  },
  {
    id: "drums",
    name: "Drum Kit",
    target: "drums",
    octave: 0,
    controls: [TUNE, DRUM_DECAY],
  },
  {
    id: "flute",
    name: "Flute",
    target: "flute",
    octave: 12,
    controls: [BREATH, VIBRATO],
  },
  {
    id: "saxophone",
    name: "Alto Sax",
    target: "saxophone",
    octave: 0,
    controls: [BREATH, VIBRATO],
  },
  {
    id: "violin",
    name: "Violin",
    target: "violin",
    octave: 0,
    controls: [{ id: "exciter.pressure", label: "Bow pressure" }, VIBRATO],
  },
  {
    id: "uprightBass",
    name: "Upright Bass",
    target: "uprightBass",
    octave: -24,
    controls: [{ id: "exciter.hardness", label: "Pluck" }, SUSTAIN],
  },
  {
    id: "drums808",
    name: "808 Kit",
    target: "drums808",
    octave: 0,
    controls: [TUNE, DRUM_DECAY],
  },
];

export const KNOB_STEPS = 11;

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

export const findPreset = (id: string) =>
  DEVICE_PRESETS.find((preset) => preset.id === id) ?? DEVICE_PRESETS[0];

export function controlSpec(preset: DevicePreset, slot: 0 | 1): ParamSpec {
  const { id } = preset.controls[slot];
  const spec = PATCH_BY_ID[preset.target].params.find(
    (param) => param.id === id,
  );
  if (!spec) throw new Error(`${preset.target} has no param ${id}`);
  return spec;
}

export const controlDefault = (preset: DevicePreset, slot: 0 | 1) =>
  preset.overrides?.[preset.controls[slot].id] ??
  controlSpec(preset, slot).default;

const isKit = (target: InstrumentId | KitId): target is KitId =>
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

  loadPreset(id: string) {
    current = findPreset(id);
    for (const [param, value] of Object.entries(current.overrides ?? {})) {
      setParam(current.target, param, value);
    }
    // The knobs reset to these defaults, so the engine must too.
    setParam(
      current.target,
      current.controls[0].id,
      controlDefault(current, 0),
    );
    setParam(
      current.target,
      current.controls[1].id,
      controlDefault(current, 1),
    );
    return current;
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

  setControl(slot: 0 | 1, value: number) {
    setParam(current.target, current.controls[slot].id, value);
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
