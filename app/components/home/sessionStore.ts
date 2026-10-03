import { useSyncExternalStore } from "react";
import { INITIAL_MODULES, isModules, type ModuleSettings } from "./modules";
import {
  DEFAULT_TIMING,
  type Meter,
  type PlayedNote,
  type Take,
} from "./noteRecorder";
import { INITIAL_PATTERN, isPattern, type StepPattern } from "./stepPattern";
import type { Track } from "./tracks";

// A song on the album: a set of tracks, with the tempo and time signature
// they play at.
export interface Song {
  id: string;
  name: string;
  bpm: number;
  meter: Meter;
  tracks: readonly Track[];
}

// What has been recorded: the working take with its ADSR, LFO and FX, the
// drum sequencer's pattern, and the album of songs whose tracks were kept
// from them, persisted in localStorage under their own keys so a reload keeps
// them. `tracks` are the open song's.
export interface Session {
  take: Take | null;
  modules: ModuleSettings;
  steps: StepPattern;
  songs: readonly Song[];
  song: string;
  tracks: readonly Track[];
}

const TAKE_KEY = "studio.take";
const MODULES_KEY = "studio.takeModules";
const STEPS_KEY = "studio.steps";
// Where the tape kept the tracks it was loaded from, when saving it updated
// them; dropped on first read.
const SOURCE_KEYS = ["studio.takeSource", "studio.stepsSource"];
const SONGS_KEY = "studio.songs";
const SONG_KEY = "studio.song";
// Where the tracks were kept before there were songs; they become the first.
const TRACKS_KEY = "studio.tracks";
// Where the take and tracks used to be kept together; split into their keys
// on first read.
const LEGACY_KEY = "studio.session";
const EMPTY: Session = {
  take: null,
  modules: INITIAL_MODULES,
  steps: INITIAL_PATTERN,
  songs: [],
  song: "",
  tracks: [],
};

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
    (track.modules === undefined || isModules(track.modules)) &&
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

const modulesOf = (value: unknown) =>
  isModules(value) ? value : INITIAL_MODULES;

const isSong = (value: unknown): value is Song => {
  const song = value as Song;
  return (
    typeof song?.id === "string" &&
    typeof song.name === "string" &&
    isNumber(song.bpm) &&
    isNumber(song.meter?.beats) &&
    isNumber(song.meter?.unit) &&
    Array.isArray(song.tracks)
  );
};

const songId = () => `song-${Date.now().toString(36)}`;

// The next "Song n" after the highest number taken.
const nextName = (songs: readonly Song[]) =>
  `Song ${
    Math.max(
      0,
      ...songs.map(({ name }) => Number(/^Song (\d+)$/.exec(name)?.[1] ?? 0)),
    ) + 1
  }`;

const emptySong = (
  songs: readonly Song[],
  bpm = DEFAULT_TIMING.bpm,
  meter = DEFAULT_TIMING.meter,
): Song => ({ id: songId(), name: nextName(songs), bpm, meter, tracks: [] });

// The album as stored, or a first song holding the tracks kept before there
// were songs.
function readSongs(legacyTracks: unknown) {
  const stored = load(SONGS_KEY);
  const songs = Array.isArray(stored)
    ? stored
        .filter(isSong)
        .map((song) => ({ ...song, tracks: tracksOf(song.tracks) }))
    : [];
  if (songs.length > 0) {
    const open = load(SONG_KEY);
    const song = songs.some(({ id }) => id === open) ? (open as string) : "";
    return { songs, song: song || songs[0].id };
  }
  const first = { ...emptySong([]), tracks: tracksOf(legacyTracks) };
  save(SONGS_KEY, [first]);
  save(SONG_KEY, first.id);
  save(TRACKS_KEY);
  return { songs: [first], song: first.id };
}

// The session with `songs`, `song` open, and its tracks.
const withSongs = (
  current: Omit<Session, "songs" | "song" | "tracks">,
  songs: readonly Song[],
  song: string,
): Session => ({
  ...current,
  songs,
  song,
  tracks: songs.find(({ id }) => id === song)?.tracks ?? [],
});

function read(): Session {
  const modules = modulesOf(load(MODULES_KEY));
  const pattern = load(STEPS_KEY);
  const steps = isPattern(pattern) ? pattern : INITIAL_PATTERN;
  SOURCE_KEYS.forEach((key) => save(key));
  const legacy = load(LEGACY_KEY) as Record<string, unknown> | null;
  if (!legacy) {
    const { songs, song } = readSongs(load(TRACKS_KEY));
    const take = takeOf(load(TAKE_KEY));
    return withSongs({ take, modules, steps }, songs, song);
  }
  const take = takeOf(legacy.take);
  save(TAKE_KEY, take);
  save(LEGACY_KEY);
  const { songs, song } = readSongs(legacy.tracks);
  return withSongs({ take, modules, steps }, songs, song);
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

export function setTakeModules(modules: ModuleSettings) {
  save(MODULES_KEY, modules);
  update({ ...getSnapshot(), modules });
}

export function setSteps(
  change: StepPattern | ((steps: StepPattern) => StepPattern),
) {
  const current = getSnapshot();
  const steps = typeof change === "function" ? change(current.steps) : change;
  save(STEPS_KEY, steps);
  update({ ...current, steps });
}

const setSongs = (songs: readonly Song[], song: string) => {
  save(SONGS_KEY, songs);
  save(SONG_KEY, song);
  update(withSongs(getSnapshot(), songs, song));
};

// Changes the open song's tracks.
export function setTracks(
  change: (tracks: readonly Track[]) => readonly Track[],
) {
  const { songs, song } = getSnapshot();
  setSongs(
    songs.map((candidate) =>
      candidate.id === song
        ? { ...candidate, tracks: change(candidate.tracks) }
        : candidate,
    ),
    song,
  );
}

export const openSong = (id: string) => setSongs(getSnapshot().songs, id);

// Adds an empty song at `bpm` and `meter` after the others, and opens it.
export function newSong(bpm: number, meter: Meter) {
  const { songs } = getSnapshot();
  const song = emptySong(songs, bpm, meter);
  setSongs([...songs, song], song.id);
  return song;
}

// Deletes a song, opening the one after it (or before); deleting the last
// leaves a new empty one. Returns the song now open.
export function deleteSong(id: string) {
  const { songs, song } = getSnapshot();
  const at = songs.findIndex((candidate) => candidate.id === id);
  if (at < 0) return songs.find((candidate) => candidate.id === song);
  const rest = songs.filter((candidate) => candidate.id !== id);
  if (rest.length === 0) {
    const fresh = emptySong(songs);
    setSongs([fresh], fresh.id);
    return fresh;
  }
  const open =
    (song !== id && rest.find((candidate) => candidate.id === song)) ||
    rest[Math.min(at, rest.length - 1)];
  setSongs(rest, open.id);
  return open;
}

// Keeps the tempo and time signature with the open song.
export function setSongTiming(bpm: number, meter: Meter) {
  const { songs, song } = getSnapshot();
  const open = songs.find(({ id }) => id === song);
  if (
    !open ||
    (open.bpm === bpm &&
      open.meter.beats === meter.beats &&
      open.meter.unit === meter.unit)
  )
    return;
  setSongs(
    songs.map((candidate) =>
      candidate.id === song ? { ...candidate, bpm, meter } : candidate,
    ),
    song,
  );
}

export const openedSong = () => {
  const { songs, song } = getSnapshot();
  return songs.find(({ id }) => id === song);
};
