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

// Indexed by keybed semitone (F3 = 0). The piano takes the home row, as in a
// DAW's musical typing: white keys F3–B4 along A S D F G H J K L ; ', and
// each black key on the row above, between its neighbours (W E R, Y U,
// O P [). The home row runs out at B4, so the top keys carry on above it:
// C5 on -, C♯5 on =, D5 on ], D♯5 on Backspace and E5 on \ (Enter is left
// for pressing a focused control).
const NOTE_KEYS = [
  "A",
  "W",
  "S",
  "E",
  "D",
  "R",
  "F",
  "G",
  "Y",
  "H",
  "U",
  "J",
  "K",
  "O",
  "L",
  "P",
  ";",
  "[",
  "'",
  "-",
  "=",
  "]",
  "⌫",
  "\\",
];

// The pads sit around the piano. The number row picks sounds from its ends:
// the four preset pads on 1 2 3 4 (with Shift, their alternates) and the four
// chord pads on 7 8 9 0, with Save on 5 and Delete on 6 between them. The
// bottom letter row covers the four pad columns from Tracks to Synth, the top
// pads then the bottom ones, then Record and Stop:
//   Z Tracks · X Metronome · C ADSR · V Synth
//   B Take · N LFO · M FX · , Mute
//   . Record · / Stop
// Play is Space; Shift and the arrows are their own keys.
const PRESET_KEYS = ["1", "2", "3", "4"];
const CHORD_KEYS = ["7", "8", "9", "0"];
const TOOL_KEYS: Readonly<Record<Tool, string>> = {
  play: "Space",
  stop: "/",
  record: ".",
  tracks: "Z",
  metronome: "X",
  adsr: "C",
  synth: "V",
  take: "B",
  lfo: "N",
  fx: "M",
  mute: ",",
  save: "5",
  delete: "6",
};

// KeyboardEvent.code for each label that isn't Key<letter> or Digit<n>.
const CODES: Readonly<Record<string, readonly string[]>> = {
  ",": ["Comma"],
  "-": ["Minus"],
  ".": ["Period"],
  "/": ["Slash"],
  ";": ["Semicolon"],
  "'": ["Quote"],
  "=": ["Equal"],
  "[": ["BracketLeft"],
  "]": ["BracketRight"],
  "\\": ["Backslash"],
  "←": ["ArrowLeft"],
  "⌫": ["Backspace"],
  "→": ["ArrowRight"],
  "⇧": ["ShiftLeft", "ShiftRight"],
  Tab: ["Tab"],
  Space: ["Space"],
};

const codesOf = (label: string) =>
  CODES[label] ?? [/^\d$/.test(label) ? `Digit${label}` : `Key${label}`];

// The badge each control shows: its key's legend, or "" for none.
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
  CONTROLS.flatMap((control) => {
    const label = hotkeyLabel(control);
    return label ? codesOf(label).map((code) => [code, control] as const) : [];
  }),
);
