// A take is kept as played, so it can be quantized again at another tempo,
// time signature or grid later; the grid is derived from it, never recorded
// directly. Presses are timed to the millisecond whatever the meter.

// A note as played: MIDI note, when it started and how long it was held (ms
// from the start of the take), and how hard (0–1, a MIDI velocity / 127).
export interface PlayedNote {
  note: number;
  start: number;
  duration: number;
  velocity: number;
}

// A note on the sequencer grid, the piano roll's view of a take: the step it
// starts on and how many steps it lasts.
export interface GridNote {
  note: number;
  step: number;
  length: number;
  velocity: number;
}

// A time signature: beats to the bar, and the note that gets the beat (4 a
// quarter, 8 an eighth). The tempo counts these beats.
export interface Meter {
  beats: number;
  unit: 4 | 8;
}

export const METERS: readonly Meter[] = [
  { beats: 2, unit: 4 },
  { beats: 3, unit: 4 },
  { beats: 4, unit: 4 },
  { beats: 5, unit: 4 },
  { beats: 6, unit: 8 },
  { beats: 7, unit: 8 },
  { beats: 12, unit: 8 },
];

// Grid steps per beat; 3 and 6 are triplets, and 0 is no grid (the take as
// played). Whole steps to the beat keep every bar a whole number of steps, in
// any meter.
export const SUBDIVISIONS: readonly number[] = [0, 2, 3, 4, 6, 8];

// Where beats, bars and grid steps fall.
export interface Timing {
  bpm: number;
  meter: Meter;
  perBeat: number;
}

export const DEFAULT_TIMING: Timing = {
  bpm: 120,
  meter: METERS[2],
  perBeat: 0,
};

export const meterLabel = ({ beats, unit }: Meter) => `${beats}/${unit}`;

// The grid step as a note value: in 4/4, 4 steps a beat are sixteenths and 3
// are eighth-note triplets.
export function gridLabel({ meter, perBeat }: Timing) {
  if (perBeat === 0) return "Off";
  const value = meter.unit * perBeat;
  return value % 3 === 0 ? `1/${(value / 3) * 2}T` : `1/${value}`;
}

export const beatMs = ({ bpm }: Timing) => 60_000 / bpm;
export const barMs = (timing: Timing) => timing.meter.beats * beatMs(timing);
export const stepMs = (timing: Timing) => beatMs(timing) / timing.perBeat;

// Collects note-ons and note-offs into PlayedNotes. A pitch pressed again
// while it is still down (a chord pad over a held key) stacks, and each
// note-off ends the oldest press.
export class NoteRecorder {
  readonly origin: number;
  private readonly held = new Map<
    number,
    { start: number; velocity: number }[]
  >();
  private readonly played: PlayedNote[] = [];

  constructor(origin = performance.now()) {
    this.origin = origin;
  }

  noteOn(note: number, velocity: number, at = performance.now()) {
    const presses = this.held.get(note) ?? [];
    presses.push({ start: at - this.origin, velocity });
    this.held.set(note, presses);
  }

  noteOff(note: number, at = performance.now()) {
    const press = this.held.get(note)?.shift();
    if (!press) return;
    this.played.push({
      note,
      start: press.start,
      duration: at - this.origin - press.start,
      velocity: press.velocity,
    });
  }

  // Everything so far by start time, with notes still down held until `at`.
  take(at = performance.now()): PlayedNote[] {
    const end = at - this.origin;
    const open = [...this.held].flatMap(([note, presses]) =>
      presses.map(({ start, velocity }) => ({
        note,
        start,
        duration: end - start,
        velocity,
      })),
    );
    return [...this.played, ...open].sort((a, b) => a.start - b.start);
  }
}

// Snaps a take onto the grid: starts to the nearest step, lengths to at least
// one step. With `steps` the grid loops, wrapping starts and cutting lengths
// at its end. A pitch landing twice on one step keeps the longer, louder note.
export function quantize(
  notes: readonly PlayedNote[],
  timing: Timing,
  steps = Infinity,
): GridNote[] {
  const size = stepMs(timing);
  const cells = new Map<string, GridNote>();
  for (const { note, start, duration, velocity } of notes) {
    const step = Math.round(start / size) % steps;
    const length = Math.min(
      steps - step,
      Math.max(1, Math.round(duration / size)),
    );
    const key = `${note}:${step}`;
    const existing = cells.get(key);
    cells.set(key, {
      note,
      step,
      length: Math.max(length, existing?.length ?? 0),
      velocity: Math.max(velocity, existing?.velocity ?? 0),
    });
  }
  return [...cells.values()].sort((a, b) => a.step - b.step || a.note - b.note);
}

// Whole bars long enough to hold a take of `ms`, in steps. A take stopped
// within a step after a bar line ends on it.
export const barsFor = (ms: number, timing: Timing) =>
  Math.max(1, Math.ceil((ms - stepMs(timing)) / barMs(timing))) *
  timing.meter.beats *
  timing.perBeat;

// A take as played, with the tempo it was played at. With no grid it plays
// back once as played, like tape; on a grid it loops, snapped in whole bars
// of the meter at the tempo, grid and meter set when each loop starts.
export interface Take {
  notes: PlayedNote[];
  length: number;
  bpm: number;
}

// A take on its own timeline in ms. On a grid it stretches to the tempo,
// keeping its beats, then snaps in whole bars of the meter.
export function timeline(take: Take | null, timing: Timing) {
  if (!take) return { length: 0, notes: [] as readonly PlayedNote[] };
  if (timing.perBeat === 0) return { length: take.length, notes: take.notes };
  const stretch = take.bpm / timing.bpm;
  const steps = barsFor(take.length * stretch, timing);
  const played = take.notes.map((note) => ({
    ...note,
    start: note.start * stretch,
    duration: note.duration * stretch,
  }));
  const step = stepMs(timing);
  return {
    length: steps * step,
    notes: quantize(played, timing, steps).map(
      ({ note, velocity, step: at, length }) => ({
        note,
        velocity,
        start: at * step,
        duration: length * step,
      }),
    ),
  };
}
