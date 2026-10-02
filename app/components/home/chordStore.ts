import { useSyncExternalStore } from "react";
import { CHORD_PALETTE, DEFAULT_CHORD_MACROS } from "./chords";

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
    return DEFAULT_CHORD_MACROS.map((fallback, i) =>
      typeof stored[i] === "string" && known.has(stored[i])
        ? stored[i]
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

export function setChordMacro(index: number, id: string) {
  update((current) => current.map((value, i) => (i === index ? id : value)));
}
