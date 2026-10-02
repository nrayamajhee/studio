import type { DeviceSound } from "./deviceEngine";
import {
  timeline,
  type PlayedNote,
  type Take,
  type Timing,
} from "./noteRecorder";

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
}

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
  };
}

export interface TrackClip {
  // One pass of the take, in beats.
  length: number;
  // On a grid the take loops along the timeline; with none it plays once.
  loops: boolean;
  notes: readonly { note: number; start: number; length: number }[];
}

// One pass of a track's take at `bpm`, in ms: on a grid it stretches to the
// tempo, keeping its beats; with none it plays as recorded.
export const passOf = (track: Track, bpm: number) =>
  timeline(track.take, { ...track.timing, bpm });

// Where each pass starts (ms) on a timeline `span` beats long at `bpm`: from
// the track's start, and on a grid again after every pass to the end.
export function startsOf(
  track: Track,
  pass: { length: number; notes: readonly PlayedNote[] },
  bpm: number,
  span: number,
) {
  const beat = 60_000 / bpm;
  const starts: number[] = [];
  const loops = track.timing.perBeat > 0;
  for (
    let at = track.start * beat;
    pass.length > 0 && at < span * beat && (starts.length === 0 || loops);
    at += pass.length
  )
    starts.push(at);
  return starts;
}

// A track's take as the tracks view draws it at `bpm`, in beats.
export function clipOf(track: Track, bpm: number): TrackClip {
  const { length, notes } = passOf(track, bpm);
  const beat = 60_000 / bpm;
  return {
    length: length / beat,
    loops: track.timing.perBeat > 0,
    notes: notes.map(({ note, start, duration }) => ({
      note,
      start: start / beat,
      length: duration / beat,
    })),
  };
}

// Whether a track is heard: not muted, and soloed whenever any track is.
export const audible = (track: Track, tracks: readonly Track[]) =>
  !track.muted && (track.soloed || !tracks.some(({ soloed }) => soloed));
