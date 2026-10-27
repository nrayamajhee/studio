import { isKit, type DeviceSound } from "./deviceEngine";
import { carryNote } from "./drumPattern";
import { modulesOf, withModules, type ModuleSettings } from "./modules";
import {
  MAX_TAKE_MS,
  timeline,
  type PlayedNote,
  type Take,
  type Timing,
} from "./noteRecorder";

// A section of a track's take that plays in place of the whole take, from
// where it sits on the timeline, as many times as the track repeats; in the
// take's own beats from its start. It is kept while off, so it comes back as
// it was.
export type TrackLoop = {
  start: number;
  end: number;
  on: boolean;
};

// The whole track again, from `start` (beats), its take (or clip) played
// `repeats` times back to back.
export type TrackCopy = { start: number; repeats: number };

// Where a track was made, and so the one place it opens again: the piano
// roll, or the drum grid.
export type TrackSource = "roll" | "drumGrid";

// A take kept on the tracks view, with the sound and preset that played it
// and its timing: its own tempo, which it plays at unless it follows the
// tape's, and the meter and grid it was recorded on. `start` slides it along
// the timeline, in the tape's beats. Its notes are never changed in place,
// but its ADSR, LFO and FX can be, and its sound renders through them.
export type Track = {
  id: string;
  name: string;
  color: string;
  presetId: string;
  sound: DeviceSound;
  // Missing on tracks saved before they kept their own; see `trackModules`.
  modules?: ModuleSettings;
  // Missing on tracks saved before they kept it; see `trackSource`.
  source?: TrackSource;
  take: Take;
  // The instrument the take was played on; it plays on the track's own now
  // (see trackTake). Missing on tracks saved before their instrument could
  // change: the one they play.
  takeTarget?: DeviceSound["target"];
  timing: Timing;
  // Plays at the tape's tempo instead of its own (`timing.bpm`). Missing on
  // tracks saved before they kept a tempo; see `followsTape`.
  followTape?: boolean;
  start: number;
  // 0–1, set in tenths by the red knob.
  volume: number;
  muted: boolean;
  soloed: boolean;
  loop?: TrackLoop;
  // How many times the take (or its loop) plays back to back; once if unset.
  repeats?: number;
  // The track again later on, after its first copy (its own start and
  // repeats), in order along the timeline: with gaps between, never
  // overlapping.
  copies?: readonly TrackCopy[];
};

// Note colours, one per track in turn, bright enough for the black screen.
export const TRACK_COLORS = [
  "#f2884b",
  "#2f7de1",
  "#4ba078",
  "#a78bfa",
  "#ec4899",
  "#eab308",
];

// A track's ADSR, LFO and FX, or for an older track the ones baked into it.
export const trackModules = (track: Track) =>
  track.modules ?? modulesOf(track.sound);

// Where a track was made, or for an older track where it must have been: the
// drum grid keeps a pattern as a kit's take with every note on the grid, one
// step long.
export function trackSource(track: Track): TrackSource {
  if (track.source) return track.source;
  const { perBeat } = track.timing;
  if (!isKit(track.sound.target) || perBeat === 0) return "roll";
  const step = 60_000 / track.take.bpm / perBeat;
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-6 * step;
  const onGrid = track.take.notes.every(
    ({ start, duration }) =>
      near(start, Math.round(start / step) * step) && near(duration, step),
  );
  return onGrid ? "drumGrid" : "roll";
}

// The change that gives a track `modules`, and renders it through them.
export const modulesChange = (track: Track, modules: ModuleSettings) => ({
  modules,
  sound: withModules(track.sound, modules),
});

// The next track from a take, played in the piano roll or drawn in the drum grid:
// named for its instrument, coloured in turn, unmuted, at the top of the
// timeline. It keeps its own copy of the take and its effects, so later takes
// on the take leave it alone.
export function makeTrack(
  count: number,
  name: string,
  take: Take,
  presetId: string,
  sound: DeviceSound,
  modules: ModuleSettings,
  timing: Timing,
  source: TrackSource,
): Track {
  return {
    id: `track-${Date.now().toString(36)}`,
    name,
    color: TRACK_COLORS[count % TRACK_COLORS.length],
    presetId,
    sound: withModules(structuredClone(sound), modules),
    modules: structuredClone(modules),
    source,
    take: structuredClone(take),
    takeTarget: sound.target,
    timing,
    followTape: false,
    start: 0,
    volume: 1,
    muted: false,
    soloed: false,
    repeats: 1,
  };
}

export type TrackClip = {
  // One pass of the take, in beats.
  length: number;
  // Where the first pass starts after the track's start, in beats: a loop
  // plays from its left edge.
  offset: number;
  // Each copy of the track, where it starts (beats) and how many passes it
  // plays back to back, placed so none overlap.
  copies: readonly TrackCopy[];
  // The pass is the track's loop.
  looped: boolean;
  notes: readonly { note: number; start: number; length: number }[];
};

// Whether a track plays at the tape's tempo rather than its own. One saved
// before tracks kept a tempo does as it always did: on a grid it follows the
// tape, and off one it plays as recorded.
export const followsTape = (track: Track) =>
  track.followTape ?? track.timing.perBeat > 0;

// The tempo a track plays at on a tape at `bpm`: the tape's, or its own.
export const trackBpm = (track: Track, bpm: number) =>
  followsTape(track) ? bpm : track.timing.bpm;

// One of the take's own beats as the track plays it on a tape at `bpm`, in
// ms.
const takeBeatMs = (track: Track, bpm: number) => 60_000 / trackBpm(track, bpm);

// The take as the track's instrument plays it: the notes it was played with,
// carried onto the instrument now on the track (a tabla's ge onto a madal's
// dhin or a drum kit's kick, and back), so changing it loses nothing.
export function trackTake(track: Track): Take {
  const from = track.takeTarget ?? track.sound.target;
  const to = track.sound.target;
  if (from === to) return track.take;
  return {
    ...track.take,
    notes: track.take.notes.flatMap((played) => {
      const note = carryNote(played.note, from, to);
      return note === null ? [] : [{ ...played, note }];
    }),
  };
}

// The whole take as the track plays it on a tape at `bpm`, in ms: as played,
// stretched from the tempo it was played at to the track's, in whole bars.
const playedTimeline = (track: Track, bpm: number) =>
  timeline(trackTake(track), { ...track.timing, bpm: trackBpm(track, bpm) });

// The whole take at its own tempo, in ms, in whole bars.
const ownTimeline = (track: Track) =>
  timeline(track.take, { ...track.timing, bpm: track.take.bpm });

// A place on the timeline (beats at `bpm`) as beats into a track's take.
export const takeBeatsAt = (track: Track, bpm: number, beats: number) =>
  ((beats - track.start) * (60_000 / bpm)) / takeBeatMs(track, bpm);

// The whole take's length in its own beats: how far a loop can reach.
export const takeBeats = (track: Track) =>
  ownTimeline(track).length / (60_000 / track.take.bpm);

// The steps a beat a track's clip edges keep to: a drum-grid track's own, or
// sixteenths on one from the piano roll.
export const gridSteps = (track: Track) => track.timing.perBeat || 4;

// What a loop's edges move by, in the take's beats: two steps (an eighth from
// the piano roll), so the knob crosses a take quickly but stays on its steps.
export const loopStep = (track: Track) => 2 / gridSteps(track);

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

// One pass of a track's take on a tape at `bpm`, in ms: the whole take, or
// while it loops just the loop.
export function passOf(track: Track, bpm: number) {
  const pass = playedTimeline(track, bpm);
  if (!track.loop?.on) return pass;
  const beat = takeBeatMs(track, bpm);
  const from = Math.min(track.loop.start * beat, pass.length);
  const to = Math.min(track.loop.end * beat, pass.length);
  return { length: to - from, notes: section(pass.notes, from, to) };
}

export const repeatsOf = (track: Track) => track.repeats ?? 1;

// Every copy of a track, the first its own start and repeats.
export const copiesOf = (track: Track): TrackCopy[] => [
  { start: track.start, repeats: repeatsOf(track) },
  ...(track.copies ?? []),
];

// The change that gives a track `copies`, the first as its own start and
// repeats.
export const copiesChange = (copies: readonly TrackCopy[]) => ({
  start: copies[0].start,
  repeats: copies[0].repeats,
  copies: copies.slice(1),
});

// `copies` in order with none overlapping, a pass `length` beats long: each
// starts where it is or, if the one before reaches past that, where it ends.
export function settleCopies(
  copies: readonly TrackCopy[],
  length: number,
): TrackCopy[] {
  let end = 0;
  return copies.map(({ start, repeats }) => {
    const at = Math.max(start, end);
    end = at + length * repeats;
    return { start: at, repeats };
  });
}

// A track's copies as they play at `bpm`, settled so none overlap.
export const placedCopies = (track: Track, bpm: number) =>
  settleCopies(copiesOf(track), passOf(track, bpm).length / (60_000 / bpm));

// Where each pass starts (ms) on a timeline `span` beats long at `bpm`: for
// each copy, from its start (or its loop's left edge), then right after the
// last, for each of its repeats that starts before the end.
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
  const copies = settleCopies(copiesOf(track), pass.length / beat);
  for (const { start, repeats } of copies)
    for (
      let at = start * beat + offset, played = 0;
      pass.length > 0 && at < span * beat && played < repeats;
      at += pass.length, played++
    )
      starts.push(at);
  return starts;
}

// As many repeats as fit in an hour at `bpm`, the longest a take records.
export function maxRepeats(track: Track, bpm: number) {
  const { length } = passOf(track, bpm);
  return length > 0 ? Math.max(1, Math.floor(MAX_TAKE_MS / length)) : 1;
}

// A track's take as the tracks view draws it at `bpm`, in beats.
export function clipOf(track: Track, bpm: number): TrackClip {
  const { length, notes } = passOf(track, bpm);
  const beat = 60_000 / bpm;
  const loop = track.loop?.on ? track.loop : null;
  return {
    length: length / beat,
    offset: loop ? (loop.start * takeBeatMs(track, bpm)) / beat : 0,
    copies: settleCopies(copiesOf(track), length / beat),
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
// take's start, which slides (with every copy) to where the loop was so it
// still sounds there. The clip is done with: the track plays whole.
export function cutToLoop(track: Track, bpm: number): Track {
  const { loop } = track;
  if (!loop) return track;
  const beat = 60_000 / track.take.bpm;
  const from = loop.start * beat;
  const to = Math.min(loop.end * beat, ownTimeline(track).length);
  // The loop's start in the tape's beats, as the track plays.
  const shift = (loop.start * takeBeatMs(track, bpm)) / (60_000 / bpm);
  return {
    ...track,
    take: {
      notes: section(track.take.notes, from, to),
      length: to - from,
      bpm: track.take.bpm,
    },
    start: track.start + shift,
    copies: track.copies?.map((copy) => ({
      ...copy,
      start: copy.start + shift,
    })),
    loop: undefined,
  };
}

// Whether a track is heard: not muted, and soloed whenever any track is.
export const audible = (track: Track, tracks: readonly Track[]) =>
  !track.muted && (track.soloed || !tracks.some(({ soloed }) => soloed));
