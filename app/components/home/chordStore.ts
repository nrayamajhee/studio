import { useSyncExternalStore } from "react";
import { CHORD_PALETTE, DEFAULT_CHORD_MACROS } from "./chords";
import {
  CHORD_STYLES,
  DEFAULT_CHORD_STYLE,
  isChordStyle,
  isSavedChordStyle,
  type ChordStyle,
  type SavedChordStyle,
} from "./chordStyles";

// Which chord each macro pad plays, by chord id, persisted in localStorage.
const STORAGE_KEY = "studio.chords";
export const CHORD_MACROS = DEFAULT_CHORD_MACROS.length;

const known = new Set(CHORD_PALETTE.map((chord) => chord.id));

let macros: readonly string[] | null = null;
const listeners = new Set<() => void>();

function read(): readonly string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!Array.isArray(stored)) return DEFAULT_CHORD_MACROS;
    // Four macros, from before there were six, go on the rightmost four
    // pads, the most played.
    const macros: unknown[] =
      stored.length === 4 ? [undefined, undefined, ...stored] : stored;
    return DEFAULT_CHORD_MACROS.map((fallback, i) =>
      typeof macros[i] === "string" && known.has(macros[i] as string)
        ? (macros[i] as string)
        : fallback,
    );
  } catch {
    return DEFAULT_CHORD_MACROS;
  }
}

function update(change: (current: readonly string[]) => readonly string[]) {
  macros = change(macros ?? read());
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(macros));
  } catch {
    // Storage can be unavailable (private mode); the change still applies.
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => (macros ??= read());
const getServerSnapshot = () => DEFAULT_CHORD_MACROS;

export function useChordMacros() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// Puts every chord pad back on its built-in chord, played as a block.
export function resetChordMacros() {
  update(() => DEFAULT_CHORD_MACROS);
  setChordStyle({ ...DEFAULT_CHORD_STYLE, saved: undefined });
}

export function setChordMacro(index: number, id: string) {
  update((current) => current.map((value, i) => (i === index ? id : value)));
}

// How the chord pads play their chords (see chordStyles), kept like them.
const STYLE_KEY = "studio.chordStyle";
let style: ChordStyle | null = null;

function readStyle(): ChordStyle {
  try {
    const stored = JSON.parse(localStorage.getItem(STYLE_KEY) ?? "null");
    return isChordStyle(stored) ? stored : DEFAULT_CHORD_STYLE;
  } catch {
    return DEFAULT_CHORD_STYLE;
  }
}

const getStyle = () => (style ??= readStyle());
const getServerStyle = () => DEFAULT_CHORD_STYLE;

export function useChordStyle() {
  return useSyncExternalStore(subscribe, getStyle, getServerStyle);
}

export function setChordStyle(change: Partial<ChordStyle>) {
  style = { ...getStyle(), ...change };
  try {
    localStorage.setItem(STYLE_KEY, JSON.stringify(style));
  } catch {
    // Storage can be unavailable (private mode); the change still applies.
  }
  listeners.forEach((listener) => listener());
}

// Play styles saved from the Device, kept like the rest.
const SAVED_KEY = "studio.playStyles";
const NO_SAVED: readonly SavedChordStyle[] = [];
let saved: readonly SavedChordStyle[] | null = null;

function readSaved(): readonly SavedChordStyle[] {
  try {
    const stored = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "null");
    return Array.isArray(stored) ? stored.filter(isSavedChordStyle) : NO_SAVED;
  } catch {
    return NO_SAVED;
  }
}

const getSaved = () => (saved ??= readSaved());

export function useSavedChordStyles() {
  return useSyncExternalStore(subscribe, getSaved, () => NO_SAVED);
}

function writeSaved(next: readonly SavedChordStyle[]) {
  saved = next;
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
  } catch {
    // Storage can be unavailable (private mode); the change still applies.
  }
  listeners.forEach((listener) => listener());
}

// Saves `style` as a new play style, named for its pattern with the next free
// number ("Strum 2"), and plays it as that.
export function saveChordStyle(style: ChordStyle): SavedChordStyle {
  const base =
    CHORD_STYLES.find(({ id }) => id === style.id)?.name ?? "Play style";
  const taken = new Set(getSaved().map(({ name }) => name));
  let n = 2;
  while (taken.has(`${base} ${n}`)) n++;
  const made: SavedChordStyle = {
    id: `style-${Date.now().toString(36)}`,
    name: `${base} ${n}`,
    pattern: style.id,
    perBeat: style.perBeat,
    strum: style.strum,
  };
  writeSaved([...getSaved(), made]);
  setChordStyle({ saved: made.id });
  return made;
}

// Stores `style`'s rate and strum in the saved play style it is.
export function updateChordStyle(style: ChordStyle) {
  writeSaved(
    getSaved().map((candidate) =>
      candidate.id === style.saved
        ? { ...candidate, perBeat: style.perBeat, strum: style.strum }
        : candidate,
    ),
  );
}

// Removes a saved play style; playing it falls back to its pattern.
export function deleteChordStyle(id: string) {
  writeSaved(getSaved().filter((candidate) => candidate.id !== id));
  if (getStyle().saved === id) setChordStyle({ saved: undefined });
}
