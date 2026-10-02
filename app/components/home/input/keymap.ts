import type { ModuleId } from "../deviceEngine";

export type Tool =
  | "record"
  | "play"
  | "stop"
  | "tracks"
  | "take"
  | "metronome"
  | "synth"
  | "save"
  | "delete"
  | "mute"
  | ModuleId;

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

// The two pad rows sit on the home and bottom keyboard rows, in order, with
// Space, Shift and the arrows as their own transport keys. The bottom row
// starts at X so it sits under the home row the way the physical keys do:
// ; lines up with ., ' with /, and so on. Top, left to right: Play (Space),
// Stop (A), Record (S), Save (D), Tracks (F), Metronome (G), ADSR (H),
// Synth (J), then four presets (K L ; '). Bottom: Shift, ← , →, Delete (X),
// Take (C), LFO (V), FX (B), Mute (N), then four chords (M , . /).
const PRESET_KEYS = ["K", "L", ";", "'"];
const CHORD_KEYS = ["M", ",", ".", "/"];
const TOOL_KEYS: Readonly<Record<Tool, string>> = {
  play: "Space",
  stop: "A",
  record: "S",
  save: "D",
  tracks: "F",
  metronome: "G",
  adsr: "H",
  synth: "J",
  delete: "X",
  take: "C",
  lfo: "V",
  fx: "B",
  mute: "N",
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
