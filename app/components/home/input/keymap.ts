import type { ModuleId } from "../deviceEngine";

export type Tool =
  "record" | "play" | "tracks" | "metronome" | "synth" | "save" | ModuleId;

// Everything the keyboard can press on the Device.
export type Control =
  | { kind: "note"; semitone: number }
  | { kind: "chord"; index: number }
  | { kind: "preset"; index: number }
  | { kind: "tool"; tool: Tool }
  | { kind: "step"; direction: -1 | 1 }
  | { kind: "shift" };

// Indexed by keybed semitone (F3 = 0). The piano takes the top two rows like
// a real keyboard: white keys F3–E5 along Tab Q W E R T Y U I O P [ ] \, and
// each black key on the number key between its neighbours (1 2 3 5 6 8 9 0 =
// and Backspace).
const NOTE_KEYS = [
  "Tab",
  "1",
  "Q",
  "2",
  "W",
  "3",
  "E",
  "R",
  "5",
  "T",
  "6",
  "Y",
  "U",
  "8",
  "I",
  "9",
  "O",
  "0",
  "P",
  "[",
  "=",
  "]",
  "⌫",
  "\\",
];

// The pads' two rows sit on the home and bottom rows, lined up from the right
// edge. Top: Tracks, Synth, ADSR, LFO and FX on A S D F G, presets on
// H J K L ; ', Metronome on Z (no home-row key left of A). Bottom: chords on
// B N M , . /, Record and Save on C V. Space plays, and the arrows and Shift
// press their own pads.
const PRESET_KEYS = ["H", "J", "K", "L", ";", "'"];
const CHORD_KEYS = ["B", "N", "M", ",", ".", "/"];
const TOOL_KEYS: Readonly<Record<Tool, string>> = {
  metronome: "Z",
  tracks: "A",
  synth: "S",
  adsr: "D",
  lfo: "F",
  fx: "G",
  play: "Space",
  record: "C",
  save: "V",
};

// KeyboardEvent.code for each label that isn't Key<letter> or Digit<n>.
const CODES: Readonly<Record<string, readonly string[]>> = {
  ",": ["Comma"],
  ".": ["Period"],
  "/": ["Slash"],
  ";": ["Semicolon"],
  "'": ["Quote"],
  "=": ["Equal"],
  "[": ["BracketLeft"],
  "]": ["BracketRight"],
  "\\": ["Backslash"],
  "←": ["ArrowLeft"],
  "→": ["ArrowRight"],
  "⇧": ["ShiftLeft", "ShiftRight"],
  "⌫": ["Backspace"],
  Tab: ["Tab"],
  Space: ["Space"],
};

const codesOf = (label: string) =>
  CODES[label] ?? [/^\d$/.test(label) ? `Digit${label}` : `Key${label}`];

// The badge each control shows: its key's legend.
export function hotkeyLabel(control: Control): string {
  switch (control.kind) {
    case "note":
      return NOTE_KEYS[control.semitone];
    case "chord":
      return CHORD_KEYS[control.index];
    case "preset":
      return PRESET_KEYS[control.index];
    case "tool":
      return TOOL_KEYS[control.tool];
    case "step":
      return control.direction < 0 ? "←" : "→";
    case "shift":
      return "⇧";
  }
}

// A stable name for a control, for sets of held controls.
export function controlId(control: Control): string {
  switch (control.kind) {
    case "note":
      return `note:${control.semitone}`;
    case "chord":
      return `chord:${control.index}`;
    case "preset":
      return `preset:${control.index}`;
    case "tool":
      return `tool:${control.tool}`;
    case "step":
      return `step:${control.direction}`;
    case "shift":
      return "shift";
  }
}

const CONTROLS: readonly Control[] = [
  ...NOTE_KEYS.map((_, semitone): Control => ({ kind: "note", semitone })),
  ...CHORD_KEYS.map((_, index): Control => ({ kind: "chord", index })),
  ...PRESET_KEYS.map((_, index): Control => ({ kind: "preset", index })),
  ...(Object.keys(TOOL_KEYS) as Tool[]).map((tool): Control => ({
    kind: "tool",
    tool,
  })),
  { kind: "step", direction: -1 },
  { kind: "step", direction: 1 },
  { kind: "shift" },
];

// KeyboardEvent.code → the control that key presses.
export const KEYMAP: ReadonlyMap<string, Control> = new Map(
  CONTROLS.flatMap((control) =>
    codesOf(hotkeyLabel(control)).map((code) => [code, control] as const),
  ),
);
