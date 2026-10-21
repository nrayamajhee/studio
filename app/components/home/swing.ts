// Swing: every second eighth or sixteenth pushed late. Within each pair the
// first takes `amount` percent of the pair's time and the second the rest, so
// 50 is straight and 75 a hard shuffle. It bends time rather than moving
// notes: anything played, recorded or written plays through it, and a
// triplet grid, already swung by where its steps fall, is left alone.
export type Swing = {
  amount: number;
  // The steps a beat it swings: 2 for eighths, 4 for sixteenths (in 4/4).
  perBeat: 2 | 4;
};

export const STRAIGHT: Swing = { amount: 50, perBeat: 4 };
export const MIN_SWING = 50;
export const MAX_SWING = 75;
export const SWING_UNITS: readonly Swing["perBeat"][] = [2, 4];

export const isSwing = (value: unknown): value is Swing => {
  const swing = value as Swing;
  return (
    typeof swing?.amount === "number" &&
    swing.amount >= MIN_SWING &&
    swing.amount <= MAX_SWING &&
    SWING_UNITS.includes(swing.perBeat)
  );
};

// The swing that applies on a grid of `perBeat` steps (0 for the piano
// roll's none), or null when it plays straight: no swing, or a triplet grid.
export const swingOn = (swing: Swing | undefined, perBeat = 0) =>
  swing && swing.amount > MIN_SWING && (perBeat === 0 || perBeat % 3 !== 0)
    ? swing
    : null;

// `t` (ms from a beat) as `swing` plays it at `beatMs` a beat.
export function swingTime(t: number, beatMs: number, swing: Swing) {
  const pair = (2 * beatMs) / swing.perBeat;
  const share = swing.amount / 100;
  const from = Math.floor(t / pair) * pair;
  const x = t - from;
  return (
    from +
    (x < pair / 2
      ? x * 2 * share
      : share * pair + (x - pair / 2) * 2 * (1 - share))
  );
}

// Where a time `swingTime` gives back came from: what was played swung, as
// it would be straight.
export function straightTime(t: number, beatMs: number, swing: Swing) {
  const pair = (2 * beatMs) / swing.perBeat;
  const share = swing.amount / 100;
  const from = Math.floor(t / pair) * pair;
  const x = t - from;
  return (
    from +
    (x < share * pair
      ? x / (2 * share)
      : pair / 2 + (x - share * pair) / (2 * (1 - share)))
  );
}

type Timed = { start: number; duration: number };

// Notes moved through `move`, each end with its start.
const moved = <T extends Timed>(
  notes: readonly T[],
  move: (t: number) => number,
): T[] =>
  notes.map((note) => {
    const start = move(note.start);
    return {
      ...note,
      start,
      duration: move(note.start + note.duration) - start,
    };
  });

// Notes on a straight timeline (ms from a beat) as `swing` plays them.
export const swingNotes = <T extends Timed>(
  notes: readonly T[],
  beatMs: number,
  swing: Swing,
) => moved(notes, (t) => swingTime(t, beatMs, swing));

// A take written straight, at its own tempo, as `swing` plays it (none
// leaves it straight): for a preview, which plays the notes as they are.
export const swungTake = <T extends { notes: readonly Timed[]; bpm: number }>(
  take: T,
  swing: Swing | null,
): T =>
  swing
    ? { ...take, notes: swingNotes(take.notes, 60_000 / take.bpm, swing) }
    : take;

// Notes as played through `swing`, put back straight.
export const straightenNotes = <T extends Timed>(
  notes: readonly T[],
  beatMs: number,
  swing: Swing,
) => moved(notes, (t) => straightTime(t, beatMs, swing));
