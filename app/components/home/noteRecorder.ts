// A take is kept as played, with the tempo it was played at, so it plays
// back with the same timing at any tempo or time signature later, stretched
// to it. Presses are timed to the millisecond whatever the meter.

// A note as played: MIDI note, when it started and how long it was held (ms
// from the start of the take), and how hard (0–1, a MIDI velocity / 127). On
// a kit the note names the piece struck (PIECE_NOTES), not the key it was on.
export type PlayedNote = {
  note: number;
  start: number;
  duration: number;
  velocity: number;
};

// A time signature: beats to the bar, and the note that gets the beat (4 a
// quarter, 8 an eighth). The tempo counts these beats.
export type Meter = {
  beats: number;
  unit: 4 | 8;
};

export const METERS: readonly Meter[] = [
  { beats: 2, unit: 4 },
  { beats: 3, unit: 4 },
  { beats: 4, unit: 4 },
  { beats: 5, unit: 4 },
  { beats: 6, unit: 8 },
  { beats: 7, unit: 8 },
  { beats: 12, unit: 8 },
];

// Where beats and bars fall, and on a drum-grid track the steps a beat it
// was drawn on: 0 for the piano roll, whose takes keep their own timing.
export type Timing = {
  bpm: number;
  meter: Meter;
  perBeat: number;
};

export const DEFAULT_TIMING: Timing = {
  bpm: 96,
  meter: METERS[2],
  perBeat: 0,
};

export const meterLabel = ({ beats, unit }: Meter) => `${beats}/${unit}`;

// Steps a beat as a note value: in 4/4, 4 steps a beat are sixteenths and 3
// are eighth-note triplets.
export function gridLabel({ meter, perBeat }: Timing) {
  if (perBeat === 0) return "Off";
  const value = meter.unit * perBeat;
  return value % 3 === 0 ? `1/${(value / 3) * 2}T` : `1/${value}`;
}

export const beatMs = ({ bpm }: Timing) => 60_000 / bpm;
export const barMs = (timing: Timing) => timing.meter.beats * beatMs(timing);

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

// The longest a take records for, and the longest a track's repeats run.
export const MAX_TAKE_MS = 60 * 60 * 1000;

// A take as played, with the tempo it was played at. It plays back with the
// timing it was played with, stretched to the tempo, and loops in whole bars
// of the meter, at the tempo and meter set when each loop starts.
export type Take = {
  notes: PlayedNote[];
  length: number;
  bpm: number;
};

// A take on its own timeline in ms at `timing`: its notes as played,
// stretched from the tempo they were played at, keeping their beats, over
// whole bars of the meter. A take stopped within a sixteenth after a bar line
// ends on it, and a note held past the end stops there.
export function timeline(take: Take | null, timing: Timing) {
  if (!take) return { length: 0, notes: [] as readonly PlayedNote[] };
  const stretch = take.bpm / timing.bpm;
  const bar = barMs(timing);
  const length =
    Math.max(1, Math.ceil((take.length * stretch - beatMs(timing) / 4) / bar)) *
    bar;
  return {
    length,
    notes: take.notes
      .map((note) => ({
        ...note,
        start: note.start * stretch,
        duration: note.duration * stretch,
      }))
      .filter(({ start }) => start < length)
      .map((note) => ({
        ...note,
        duration: Math.min(note.duration, length - note.start),
      })),
  };
}
