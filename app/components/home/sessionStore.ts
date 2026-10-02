import { useSyncExternalStore } from "react";
import type { PlayedNote, Take } from "./noteRecorder";
import type { Track } from "./tracks";

// What has been recorded: the working take and the tracks kept from it,
// persisted in localStorage under their own keys so a reload keeps them.
export interface Session {
  take: Take | null;
  tracks: readonly Track[];
}

const TAKE_KEY = "studio.take";
const TRACKS_KEY = "studio.tracks";
// Where both used to be kept together; split into the two keys on first read.
const LEGACY_KEY = "studio.session";
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
    typeof track.soloed === "boolean" &&
    (track.repeats === undefined ||
      (isNumber(track.repeats) && track.repeats >= 1)) &&
    (track.loop === undefined ||
      (isNumber(track.loop?.start) &&
        isNumber(track.loop.end) &&
        typeof track.loop.on === "boolean"))
  );
};

const load = (key: string): unknown => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
};

// Stores `value` under `key`, or with no value removes the key.
const save = (key: string, value?: unknown) => {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode) or full; the change still applies.
  }
};

// Anything that doesn't look like a take or track is dropped.
const takeOf = (value: unknown) => (isTake(value) ? value : null);
const tracksOf = (value: unknown) =>
  Array.isArray(value) ? (value as unknown[]).filter(isTrack) : [];

function read(): Session {
  const legacy = load(LEGACY_KEY) as Record<string, unknown> | null;
  if (!legacy)
    return { take: takeOf(load(TAKE_KEY)), tracks: tracksOf(load(TRACKS_KEY)) };
  const migrated = {
    take: takeOf(legacy.take),
    tracks: tracksOf(legacy.tracks),
  };
  save(TAKE_KEY, migrated.take);
  save(TRACKS_KEY, migrated.tracks);
  save(LEGACY_KEY);
  return migrated;
}

function update(next: Session) {
  session = next;
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
  save(TAKE_KEY, take);
  update({ ...getSnapshot(), take });
}

export function setTracks(
  change: (tracks: readonly Track[]) => readonly Track[],
) {
  const current = getSnapshot();
  const tracks = change(current.tracks);
  save(TRACKS_KEY, tracks);
  update({ ...current, tracks });
}
