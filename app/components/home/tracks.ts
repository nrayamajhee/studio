import type { DeviceSound } from "./deviceEngine";
import {
  timeline,
  type PlayedNote,
  type Take,
  type Timing,
} from "./noteRecorder";

// A section of a track's take that plays in place of the whole take, from
// where it sits on the timeline, as many times as the track repeats; in the
// take's own beats from its start. It is kept while off, so it comes back as
// it was.
export interface TrackLoop {
  start: number;
  end: number;
  on: boolean;
}

// A take kept on the tracks view, with the sound and preset that played it
// and the timing it was recorded on (its own tempo, meter and grid). `start`
// slides it along the timeline, in beats.
export interface Track {
  id: string;
  name: string;
  color: string;
  presetId: string;
  sound: DeviceSound;
  take: Take;
  timing: Timing;
  start: number;
  // 0–1, set in tenths by the red knob.
  volume: number;
  muted: boolean;
  soloed: boolean;
  loop?: TrackLoop;
  // How many times the take (or its loop) plays back to back; once if unset.
  repeats?: number;
}

// Shift and the arrows add and remove repeats, up to this many; the scrubbed
// mix renders the whole timeline, so it can't grow without bound.
export const MAX_REPEATS = 16;

// Note colours, one per track in turn, bright enough for the black screen.
export const TRACK_COLORS = [
  "#f2884b",
  "#2f7de1",
  "#4ba078",
  "#a78bfa",
  "#ec4899",
  "#eab308",
];

// The next track from a take: named for its instrument, coloured in turn,
// unmuted, at the top of the timeline. It keeps its own copy, so later takes
// on the take leave it alone.
export function makeTrack(
  count: number,
  name: string,
  take: Take,
  presetId: string,
  sound: DeviceSound,
  timing: Timing,
): Track {
  return {
    id: `track-${Date.now().toString(36)}`,
    name,
    color: TRACK_COLORS[count % TRACK_COLORS.length],
    presetId,
    sound: structuredClone(sound),
    take: structuredClone(take),
    timing,
    start: 0,
    volume: 1,
    muted: false,
    soloed: false,
    repeats: 1,
  };
}

export interface TrackClip {
  // One pass of the take, in beats.
  length: number;
  // Where the first pass starts after the track's start, in beats: a loop
  // plays from its left edge.
  offset: number;
  // How many passes play back to back.
  repeats: number;
  // The pass is the track's loop.
  looped: boolean;
  notes: readonly { note: number; start: number; length: number }[];
}

// One of the take's own beats at `bpm`, in ms: a grid take stretches to the
// tempo, keeping its beats; a free one plays as recorded.
const takeBeatMs = (track: Track, bpm: number) =>
  60_000 / (track.timing.perBeat > 0 ? bpm : track.take.bpm);

// The whole take at its own tempo, in ms: quantized on a grid, as played
// without one.
const ownTimeline = (track: Track) =>
  timeline(track.take, { ...track.timing, bpm: track.take.bpm });

// The whole take's length in its own beats: how far a loop can reach.
export const takeBeats = (track: Track) =>
  ownTimeline(track).length / (60_000 / track.take.bpm);

// What a loop's edges move by, in the take's beats: a grid step, or a
// sixteenth on a free take.
export const loopStep = (track: Track) => 1 / (track.timing.perBeat || 4);

// The notes sounding in [from, to) ms, moved to start at 0. A note across an
// edge is clipped to it: one held in from before starts at `from`, and one
// held past the end stops at `to`.
const section = (notes: readonly PlayedNote[], from: number, to: number) =>
  notes
    .filter(({ start, duration }) => start < to && start + duration > from)
    .map((note) => {
      const start = Math.max(note.start, from);
      return {
        ...note,
        start: start - from,
        duration: Math.min(note.start + note.duration, to) - start,
      };
    });

// One pass of a track's take at `bpm`, in ms: the whole take, or while it
// loops just the loop.
export function passOf(track: Track, bpm: number) {
  const pass = timeline(track.take, { ...track.timing, bpm });
  if (!track.loop?.on) return pass;
  const beat = takeBeatMs(track, bpm);
  const from = Math.min(track.loop.start * beat, pass.length);
  const to = Math.min(track.loop.end * beat, pass.length);
  return { length: to - from, notes: section(pass.notes, from, to) };
}

// Where each pass starts (ms) on a timeline `span` beats long at `bpm`: from
// the track's start (or its loop's left edge), then right after the last, for
// each of its repeats that starts before the end.
export function startsOf(
  track: Track,
  pass: { length: number; notes: readonly PlayedNote[] },
  bpm: number,
  span: number,
) {
  const beat = 60_000 / bpm;
  const starts: number[] = [];
  const loop = track.loop?.on ? track.loop : null;
  const offset = loop ? loop.start * takeBeatMs(track, bpm) : 0;
  for (
    let at = track.start * beat + offset;
    pass.length > 0 && at < span * beat && starts.length < repeatsOf(track);
    at += pass.length
  )
    starts.push(at);
  return starts;
}

export const repeatsOf = (track: Track) => track.repeats ?? 1;

// A track's take as the tracks view draws it at `bpm`, in beats.
export function clipOf(track: Track, bpm: number): TrackClip {
  const { length, notes } = passOf(track, bpm);
  const beat = 60_000 / bpm;
  const loop = track.loop?.on ? track.loop : null;
  return {
    length: length / beat,
    offset: loop ? (loop.start * takeBeatMs(track, bpm)) / beat : 0,
    repeats: repeatsOf(track),
    looped: loop !== null,
    notes: notes.map(({ note, start, duration }) => ({
      note,
      start: start / beat,
      length: duration / beat,
    })),
  };
}

// The track cut down to its loop: the notes outside it deleted, those across
// its edges clipped to them (never quantized), and the rest moved up to the
// take's start, which slides to where the loop was so it still sounds there.
// The loop stays on, now the whole take.
export function cutToLoop(track: Track, bpm: number): Track {
  const { loop } = track;
  if (!loop) return track;
  const beat = 60_000 / track.take.bpm;
  const from = loop.start * beat;
  const to = Math.min(loop.end * beat, ownTimeline(track).length);
  // A grid take's beats keep to the tempo; a free one's are its own.
  const shift =
    track.timing.perBeat > 0 ? loop.start : loop.start * (bpm / track.take.bpm);
  return {
    ...track,
    take: {
      notes: section(track.take.notes, from, to),
      length: to - from,
      bpm: track.take.bpm,
    },
    start: track.start + shift,
    loop: { start: 0, end: (to - from) / beat, on: true },
  };
}

// Whether a track is heard: not muted, and soloed whenever any track is.
export const audible = (track: Track, tracks: readonly Track[]) =>
  !track.muted && (track.soloed || !tracks.some(({ soloed }) => soloed));
