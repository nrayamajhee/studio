import { useSyncExternalStore } from "react";
import { INITIAL_MODULES, isModules, type ModuleSettings } from "./modules";
import {
  DEFAULT_TIMING,
  type Meter,
  type PlayedNote,
  type Take,
} from "./noteRecorder";
import { INITIAL_PATTERN, isPattern, type DrumPattern } from "./drumPattern";
import { starterTape } from "./starterSong";
import { STRAIGHT, isSwing, type Swing } from "./swing";
import type { Track } from "./tracks";

// A tape: a set of tracks, with the tempo, time signature and swing
// they play at (straight without one).
export type Tape = {
  id: string;
  name: string;
  bpm: number;
  meter: Meter;
  swing?: Swing;
  tracks: readonly Track[];
};

// What has been recorded: the working take with its ADSR, LFO and FX, the
// drum grid's pattern, and the tapes whose tracks were kept
// from them, persisted in localStorage under their own keys so a reload keeps
// them. `tracks` are the open tape's.
export type Session = {
  take: Take | null;
  modules: ModuleSettings;
  pattern: DrumPattern;
  tapes: readonly Tape[];
  tape: string;
  tracks: readonly Track[];
};

export const TAKE_KEY = "studio.take";
export const MODULES_KEY = "studio.takeModules";
export const PATTERN_KEY = "studio.pattern";
// Where the take kept the tracks it was loaded from, when saving it updated
// them; dropped on first read.
const SOURCE_KEYS = ["studio.takeSource", "studio.stepsSource"];
export const TAPES_KEY = "studio.tapes";
export const TAPE_KEY = "studio.tape";
// Where the tracks were kept before there were tapes; they become the first.
const TRACKS_KEY = "studio.tracks";
// Where the take and tracks used to be kept together; split into their keys
// on first read.
const LEGACY_KEY = "studio.session";
const EMPTY: Session = {
  take: null,
  modules: INITIAL_MODULES,
  pattern: INITIAL_PATTERN,
  tapes: [],
  tape: "",
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
    (track.source === undefined ||
      track.source === "roll" ||
      track.source === "drumGrid") &&
    isTake(track.take) &&
    isNumber(track.timing?.bpm) &&
    isNumber(track.timing.meter?.beats) &&
    isNumber(track.timing.perBeat) &&
    (track.timing.swing === undefined || isSwing(track.timing.swing)) &&
    isNumber(track.start) &&
    isNumber(track.volume) &&
    typeof track.muted === "boolean" &&
    typeof track.soloed === "boolean" &&
    (track.repeats === undefined ||
      (isNumber(track.repeats) && track.repeats >= 1)) &&
    (track.takeTarget === undefined || typeof track.takeTarget === "string") &&
    (track.followTape === undefined || typeof track.followTape === "boolean") &&
    (track.copies === undefined ||
      (Array.isArray(track.copies) &&
        track.copies.every(
          (copy) =>
            isNumber(copy?.start) &&
            isNumber(copy.repeats) &&
            copy.repeats >= 1,
        ))) &&
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

const isTape = (value: unknown): value is Tape => {
  const tape = value as Tape;
  return (
    typeof tape?.id === "string" &&
    typeof tape.name === "string" &&
    isNumber(tape.bpm) &&
    isNumber(tape.meter?.beats) &&
    isNumber(tape.meter?.unit) &&
    (tape.swing === undefined || isSwing(tape.swing)) &&
    Array.isArray(tape.tracks)
  );
};

const tapeId = () => `tape-${Date.now().toString(36)}`;

// The next "Tape n" after the highest number taken.
const nextName = (tapes: readonly Tape[]) =>
  `Tape ${
    Math.max(
      0,
      ...tapes.map(({ name }) => Number(/^Tape (\d+)$/.exec(name)?.[1] ?? 0)),
    ) + 1
  }`;

const emptyTape = (
  tapes: readonly Tape[],
  bpm = DEFAULT_TIMING.bpm,
  meter = DEFAULT_TIMING.meter,
  swing = STRAIGHT,
): Tape => ({
  id: tapeId(),
  name: nextName(tapes),
  bpm,
  meter,
  swing,
  tracks: [],
});

// The tapes as stored, or on a first visit the starter song, or a first tape
// holding the tracks kept before there were tapes.
function readTapes(legacyTracks: unknown) {
  const stored = load(TAPES_KEY);
  const tapes = Array.isArray(stored)
    ? stored
        .filter(isTape)
        .map((tape) => ({ ...tape, tracks: tracksOf(tape.tracks) }))
    : [];
  if (tapes.length > 0) {
    const open = load(TAPE_KEY);
    const tape = tapes.some(({ id }) => id === open) ? (open as string) : "";
    return { tapes, tape: tape || tapes[0].id };
  }
  const kept = tracksOf(legacyTracks);
  const first =
    kept.length > 0
      ? { ...emptyTape([]), tracks: kept }
      : starterTape(tapeId());
  save(TAPES_KEY, [first]);
  save(TAPE_KEY, first.id);
  save(TRACKS_KEY);
  return { tapes: [first], tape: first.id };
}

// The session with `tapes`, `tape` open, and its tracks.
const withTapes = (
  current: Omit<Session, "tapes" | "tape" | "tracks">,
  tapes: readonly Tape[],
  tape: string,
): Session => ({
  ...current,
  tapes,
  tape,
  tracks: tapes.find(({ id }) => id === tape)?.tracks ?? [],
});

function read(): Session {
  const modules = modulesOf(load(MODULES_KEY));
  const stored = load(PATTERN_KEY);
  const pattern = isPattern(stored) ? stored : INITIAL_PATTERN;
  SOURCE_KEYS.forEach((key) => save(key));
  const legacy = load(LEGACY_KEY) as Record<string, unknown> | null;
  if (!legacy) {
    const { tapes, tape } = readTapes(load(TRACKS_KEY));
    const take = takeOf(load(TAKE_KEY));
    return withTapes({ take, modules, pattern }, tapes, tape);
  }
  const take = takeOf(legacy.take);
  save(TAKE_KEY, take);
  save(LEGACY_KEY);
  const { tapes, tape } = readTapes(legacy.tracks);
  return withTapes({ take, modules, pattern }, tapes, tape);
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

export function setPattern(
  change: DrumPattern | ((pattern: DrumPattern) => DrumPattern),
) {
  const current = getSnapshot();
  const pattern =
    typeof change === "function" ? change(current.pattern) : change;
  save(PATTERN_KEY, pattern);
  update({ ...current, pattern });
}

const setTapes = (tapes: readonly Tape[], tape: string) => {
  save(TAPES_KEY, tapes);
  save(TAPE_KEY, tape);
  update(withTapes(getSnapshot(), tapes, tape));
};

// Changes the open tape's tracks.
export function setTracks(
  change: (tracks: readonly Track[]) => readonly Track[],
) {
  const { tapes, tape } = getSnapshot();
  setTapes(
    tapes.map((candidate) =>
      candidate.id === tape
        ? { ...candidate, tracks: change(candidate.tracks) }
        : candidate,
    ),
    tape,
  );
}

export const openTape = (id: string) => setTapes(getSnapshot().tapes, id);

// Adds an empty tape at `bpm`, `meter` and `swing` after the others, and
// opens it.
export function newTape(bpm: number, meter: Meter, swing: Swing) {
  const { tapes } = getSnapshot();
  const tape = emptyTape(tapes, bpm, meter, swing);
  setTapes([...tapes, tape], tape.id);
  return tape;
}

// Deletes a tape, opening the one after it (or before); deleting the last
// leaves a new empty one. Returns the tape now open.
export function deleteTape(id: string) {
  const { tapes, tape } = getSnapshot();
  const at = tapes.findIndex((candidate) => candidate.id === id);
  if (at < 0) return tapes.find((candidate) => candidate.id === tape);
  const rest = tapes.filter((candidate) => candidate.id !== id);
  if (rest.length === 0) {
    const fresh = emptyTape(tapes);
    setTapes([fresh], fresh.id);
    return fresh;
  }
  const open =
    (tape !== id && rest.find((candidate) => candidate.id === tape)) ||
    rest[Math.min(at, rest.length - 1)];
  setTapes(rest, open.id);
  return open;
}

// Keeps the tempo, time signature and swing with the open tape.
export function setTapeTiming(bpm: number, meter: Meter, swing: Swing) {
  const { tapes, tape } = getSnapshot();
  const open = tapes.find(({ id }) => id === tape);
  const kept = open?.swing ?? STRAIGHT;
  if (
    !open ||
    (open.bpm === bpm &&
      open.meter.beats === meter.beats &&
      open.meter.unit === meter.unit &&
      kept.amount === swing.amount &&
      kept.perBeat === swing.perBeat)
  )
    return;
  setTapes(
    tapes.map((candidate) =>
      candidate.id === tape ? { ...candidate, bpm, meter, swing } : candidate,
    ),
    tape,
  );
}

export const openedTape = () => {
  const { tapes, tape } = getSnapshot();
  return tapes.find(({ id }) => id === tape);
};
