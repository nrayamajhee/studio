import { PATCH_BY_ID } from "../../../lib/physical/patches";
import type { DevicePreset } from "../deviceEngine";

export const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

export const F3_MIDI = 53;
// The keybed has no velocity; every press plays mezzo-forte.
export const KEY_VELOCITY = 0.8;
export const WHITE_KEYS = [0, 2, 4, 6, 7, 9, 11, 12, 14, 16, 18, 19, 21, 23];
export const BLACK_KEYS = [1, 3, 5, 8, 10, 13, 15, 17, 20, 22];
export const KEYBED_LOW = F3_MIDI + WHITE_KEYS[0];
export const KEYBED_HIGH = F3_MIDI + WHITE_KEYS[WHITE_KEYS.length - 1];

export const octaveOf = (midi: number) => Math.floor(midi / 12) - 1;

export const spokenNote = (midi: number) =>
  `${NOTE_NAMES[midi % 12].replace("#", " sharp")} ${octaveOf(midi)}`;

export const engravedNote = (midi: number) => {
  const name = NOTE_NAMES[midi % 12].replace("#", "♯");
  return name === "C" ? `C${octaveOf(midi)}` : name;
};

// How far the octave buttons reach for a preset: the shifted keybed may hang
// at most 11 notes past either end of its instrument's range, where they fold
// back in by octaves. The piano gets ±3, the flute ±1. Kits play pieces by
// pitch class, so shifting their octave would change nothing.
export const octaveLimits = ({ target, octave }: DevicePreset) => {
  const patch = PATCH_BY_ID[target];
  if (patch.family === "drums") return [0, 0] as const;
  const [low, high] = patch.range;
  return [
    Math.ceil((low - 11 - (KEYBED_LOW + octave)) / 12),
    Math.floor((high + 11 - (KEYBED_HIGH + octave)) / 12),
  ] as const;
};

export const clampOctave = (shift: number, preset: DevicePreset) => {
  const [lowest, highest] = octaveLimits(preset);
  return Math.min(highest, Math.max(lowest, shift));
};
