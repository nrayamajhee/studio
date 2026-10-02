import { useSyncExternalStore } from "react";
import type { PlayedNote, Take } from "./noteRecorder";
import type { Track } from "./tracks";

// What has been recorded: the tape's latest take and the tracks kept from
// it, persisted in localStorage so a reload keeps them.
export interface Session {
  take: Take | null;
  tracks: readonly Track[];
}

const STORAGE_KEY = "studio.session";
const EMPTY: Session = { take: null, tracks: [] };

let session: Session | null = null;
const listeners = new Set<() => void>();

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isNote = (value: unknown): value is PlayedNote => {
  const note = value as PlayedNote;
  return (
    isNumber(note?.note) &&
    isNumber(note.start) &&
    isNumber(note.duration) &&
    isNumber(note.velocity)
  );
};

const isTake = (value: unknown): value is Take => {
  const take = value as Take;
  return (
    Array.isArray(take?.notes) &&
    take.notes.every(isNote) &&
    isNumber(take.length) &&
    isNumber(take.bpm)
  );
};

const isTrack = (value: unknown): value is Track => {
  const track = value as Track;
  return (
    typeof track?.id === "string" &&
    typeof track.name === "string" &&
    typeof track.color === "string" &&
    typeof track.presetId === "string" &&
    typeof track.sound?.target === "string" &&
    isNumber(track.sound.octave) &&
    typeof track.sound.overrides === "object" &&
    isTake(track.take) &&
    isNumber(track.timing?.bpm) &&
    isNumber(track.timing.meter?.beats) &&
    isNumber(track.timing.perBeat) &&
    isNumber(track.start) &&
    isNumber(track.volume) &&
    typeof track.muted === "boolean" &&
    typeof track.soloed === "boolean"
  );
};

// Anything that doesn't look like a take or track is dropped.
function read(): Session {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return {
      take: isTake(stored?.take) ? stored.take : null,
      tracks: Array.isArray(stored?.tracks)
        ? (stored.tracks as unknown[]).filter(isTrack)
        : [],
    };
  } catch {
    return EMPTY;
  }
}

function update(change: (current: Session) => Session) {
  session = change(session ?? read());
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage can be unavailable (private mode) or full; the change still applies.
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => (session ??= read());
const getServerSnapshot = () => EMPTY;

export function useSession() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setTake(take: Take | null) {
  update((current) => ({ ...current, take }));
}

export function setTracks(
  change: (tracks: readonly Track[]) => readonly Track[],
) {
  update((current) => ({ ...current, tracks: change(current.tracks) }));
}
