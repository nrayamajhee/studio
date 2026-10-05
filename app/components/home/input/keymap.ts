import type { ModuleId } from "../deviceEngine";

export type Tool =
  | "record"
  | "play"
  | "stop"
  | "tracks"
  | "album"
  | "take"
  | "steps"
  | "metronome"
  | "synth"
  | "params"
  | "chords"
  | "style"
  | "save"
  | "delete"
  | "mute"
  | "clip"
  | ModuleId;

// Everything the keyboard can press on the Device.
export type Control =
  | { kind: "note"; semitone: number }
  | { kind: "chord"; index: number }
  | { kind: "preset"; index: number }
  | { kind: "tool"; tool: Tool }
  | { kind: "step"; direction: -1 | 1 }
  // ↑ and ↓: the previous or next row, as the blue knob picks a track.
  | { kind: "pick"; direction: -1 | 1 }
  | { kind: "shift" };

// Indexed by keybed semitone (F3 = 0). The piano takes the home row, as in a
// DAW's musical typing: white keys F3–B4 along A S D F G H J K L ; ', and
// each black key on the row above, between its neighbours (W E R, Y U,
// O P [). The home row runs out at B4; held with Shift, its last five keys
// (L P ; [ ') carry on past it instead, C5 to E5, white keys still on white.
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
];

// The notes Shift adds past the home row's last key.
export const SHIFT_NOTES = 5;
const SHIFTED_FROM = NOTE_KEYS.length - SHIFT_NOTES;

// The note a piano key plays with Shift held: the last five move up past B4.
export const shiftedNote = (semitone: number) =>
  semitone >= SHIFTED_FROM && semitone < NOTE_KEYS.length
    ? semitone + SHIFT_NOTES
    : semitone;

// The pads sit around the piano, and a key always presses the same pad,
// whatever the view. The number row picks sounds: the six preset pads on
// 1 2 3 4 5 6 (with Shift, their alternates) and the six chord pads on
// 7 8 9 0 - =, the most played last (- minor, = major). ` opens the synth
// parameters and Q the instruments, ] the chord palette and \ Chord style.
// Esc opens the tracks, and the bottom letter row runs along the rest of the
// views, then Mute, Record and Stop:
//   Z Album · X Tape · C Drum sequencer · V ADSR · B LFO · N FX
//   M Tempo (⇧ the click) · , Mute (⇧ Solo) · . Record · / Stop
// With Shift, V B N turn their effect on or off. T is Clip (⇧ Trim). Play is
// Space; Shift and the arrows are their own keys (↑ and ↓ pick a track, as the
// blue knob does). ⌫ is Delete (⇧⌫ Revert), and ⌘S (Ctrl S) is Save.
const PRESET_KEYS = ["1", "2", "3", "4", "5", "6"];
const CHORD_KEYS = ["7", "8", "9", "0", "-", "="];
const TOOL_KEYS: Readonly<Record<Tool, string>> = {
  play: "Space",
  stop: "/",
  record: ".",
  synth: "Q",
  params: "`",
  chords: "]",
  style: "\\",
  tracks: "Esc",
  album: "Z",
  take: "X",
  steps: "C",
  adsr: "V",
  lfo: "B",
  fx: "N",
  metronome: "M",
  mute: ",",
  clip: "T",
  save: "",
  delete: "⌫",
};

// KeyboardEvent.code for each label that isn't Key<letter> or Digit<n>.
const CODES: Readonly<Record<string, readonly string[]>> = {
  ",": ["Comma"],
  "-": ["Minus"],
  "`": ["Backquote"],
  Esc: ["Escape"],
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
  "↑": ["ArrowUp"],
  "↓": ["ArrowDown"],
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
      return control.semitone < NOTE_KEYS.length
        ? NOTE_KEYS[control.semitone]
        : `⇧${NOTE_KEYS[control.semitone - SHIFT_NOTES]}`;
    case "chord":
      return CHORD_KEYS[control.index];
    case "preset":
      return PRESET_KEYS[control.index];
    case "tool":
      return TOOL_KEYS[control.tool];
    case "step":
      return control.direction < 0 ? "←" : "→";
    case "pick":
      return control.direction < 0 ? "↑" : "↓";
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
    case "pick":
      return `pick:${control.direction}`;
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
  { kind: "pick", direction: -1 },
  { kind: "pick", direction: 1 },
  { kind: "shift" },
];

// KeyboardEvent.code → the control that key presses.
export const KEYMAP: ReadonlyMap<string, Control> = new Map(
  CONTROLS.flatMap((control) => {
    const label = hotkeyLabel(control);
    return label ? codesOf(label).map((code) => [code, control] as const) : [];
  }),
);
