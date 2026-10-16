import { useSyncExternalStore } from "react";
import { CHORD_PALETTE, DEFAULT_PAD_CHORDS } from "./chords";
import {
  PLAY_STYLES,
  DEFAULT_PLAY_STYLE,
  isPlayStyle,
  isSavedPlayStyle,
  type PlayStyle,
  type SavedPlayStyle,
} from "./playStyles";

// Which chord each chord pad plays, by chord id, persisted in localStorage.
export const PAD_CHORDS_KEY = "studio.padChords";
export const CHORD_PADS = DEFAULT_PAD_CHORDS.length;

const known = new Set(CHORD_PALETTE.map((chord) => chord.id));

let padChords: readonly string[] | null = null;
const listeners = new Set<() => void>();

function read(): readonly string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(PAD_CHORDS_KEY) ?? "null");
    if (!Array.isArray(stored)) return DEFAULT_PAD_CHORDS;
    // Four chords, from before there were six, go on the rightmost four
    // pads, the most played.
    const chords: unknown[] =
      stored.length === 4 ? [undefined, undefined, ...stored] : stored;
    return DEFAULT_PAD_CHORDS.map((fallback, i) =>
      typeof chords[i] === "string" && known.has(chords[i] as string)
        ? (chords[i] as string)
        : fallback,
    );
  } catch {
    return DEFAULT_PAD_CHORDS;
  }
}

function update(change: (current: readonly string[]) => readonly string[]) {
  padChords = change(padChords ?? read());
  try {
    localStorage.setItem(PAD_CHORDS_KEY, JSON.stringify(padChords));
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

const getSnapshot = () => (padChords ??= read());
const getServerSnapshot = () => DEFAULT_PAD_CHORDS;

export function usePadChords() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// Puts every chord pad back on its built-in chord, played as a block.
export function resetPadChords() {
  update(() => DEFAULT_PAD_CHORDS);
  setPlayStyle({ ...DEFAULT_PLAY_STYLE, saved: undefined });
}

export function setPadChord(index: number, id: string) {
  update((current) => current.map((value, i) => (i === index ? id : value)));
}

// How the chord pads play their chords (see playStyles), kept like them.
export const PLAY_STYLE_KEY = "studio.playStyle";
let style: PlayStyle | null = null;

function readStyle(): PlayStyle {
  try {
    const stored = JSON.parse(localStorage.getItem(PLAY_STYLE_KEY) ?? "null");
    return isPlayStyle(stored) ? stored : DEFAULT_PLAY_STYLE;
  } catch {
    return DEFAULT_PLAY_STYLE;
  }
}

const getStyle = () => (style ??= readStyle());
const getServerStyle = () => DEFAULT_PLAY_STYLE;

export function usePlayStyle() {
  return useSyncExternalStore(subscribe, getStyle, getServerStyle);
}

export function setPlayStyle(change: Partial<PlayStyle>) {
  style = { ...getStyle(), ...change };
  try {
    localStorage.setItem(PLAY_STYLE_KEY, JSON.stringify(style));
  } catch {
    // Storage can be unavailable (private mode); the change still applies.
  }
  listeners.forEach((listener) => listener());
}

// Play styles saved from the Device, kept like the rest.
export const PLAY_STYLES_KEY = "studio.playStyles";
const NO_SAVED: readonly SavedPlayStyle[] = [];
let saved: readonly SavedPlayStyle[] | null = null;

function readSaved(): readonly SavedPlayStyle[] {
  try {
    const stored = JSON.parse(localStorage.getItem(PLAY_STYLES_KEY) ?? "null");
    return Array.isArray(stored) ? stored.filter(isSavedPlayStyle) : NO_SAVED;
  } catch {
    return NO_SAVED;
  }
}

const getSaved = () => (saved ??= readSaved());

export function useSavedPlayStyles() {
  return useSyncExternalStore(subscribe, getSaved, () => NO_SAVED);
}

function writeSaved(next: readonly SavedPlayStyle[]) {
  saved = next;
  try {
    localStorage.setItem(PLAY_STYLES_KEY, JSON.stringify(saved));
  } catch {
    // Storage can be unavailable (private mode); the change still applies.
  }
  listeners.forEach((listener) => listener());
}

// Saves `style` as a new play style, named for its pattern with the next free
// number ("Strum 2"), and plays it as that.
export function savePlayStyle(style: PlayStyle): SavedPlayStyle {
  const base =
    PLAY_STYLES.find(({ id }) => id === style.id)?.name ?? "Play style";
  const taken = new Set(getSaved().map(({ name }) => name));
  let n = 2;
  while (taken.has(`${base} ${n}`)) n++;
  const made: SavedPlayStyle = {
    id: `style-${Date.now().toString(36)}`,
    name: `${base} ${n}`,
    pattern: style.id,
    perBeat: style.perBeat,
    strum: style.strum,
  };
  writeSaved([...getSaved(), made]);
  setPlayStyle({ saved: made.id });
  return made;
}

// Stores `style`'s rate and strum in the saved play style it is.
export function updatePlayStyle(style: PlayStyle) {
  writeSaved(
    getSaved().map((candidate) =>
      candidate.id === style.saved
        ? { ...candidate, perBeat: style.perBeat, strum: style.strum }
        : candidate,
    ),
  );
}

// Removes a saved play style; playing it falls back to its pattern.
export function deletePlayStyle(id: string) {
  writeSaved(getSaved().filter((candidate) => candidate.id !== id));
  if (getStyle().saved === id) setPlayStyle({ saved: undefined });
}
