// How a held chord sounds: all at once, strummed, or as a pattern of its
// notes in time with the tempo.
export type ChordStyleId =
  "block" | "pulse" | "strum" | "up" | "down" | "upDown" | "broken" | "alberti";

export const CHORD_STYLES: readonly {
  id: ChordStyleId;
  name: string;
  detail: string;
}[] = [
  { id: "block", name: "Block", detail: "Every note at once" },
  { id: "pulse", name: "Pulse", detail: "Four short strikes, a gap apart" },
  { id: "strum", name: "Strum", detail: "Low to high, a sweep apart" },
  { id: "up", name: "Arp up", detail: "One at a time, low to high" },
  { id: "down", name: "Arp down", detail: "One at a time, high to low" },
  { id: "upDown", name: "Up-down", detail: "Up, then back down" },
  { id: "broken", name: "Broken", detail: "The root, then the rest" },
  { id: "alberti", name: "Alberti", detail: "Low, high, middle, high" },
];

// A pattern's steps a beat, 1/4 to 1/32 with triplets (the red knob), and a
// strum's gap between strings in ms (the blue knob).
export const CHORD_RATES: readonly number[] = [1, 2, 3, 4, 6, 8];
export const STRUM_GAPS: readonly number[] = [5, 10, 15, 20, 30, 40, 60, 80];

// A pulse strikes the chord this many times, each held for this share of its
// step, so a gap is left before the next.
const PULSE_STRIKES = 4;
const PULSE_GATE = 0.5;

export interface ChordStyle {
  id: ChordStyleId;
  perBeat: number;
  strum: number;
}

export const DEFAULT_CHORD_STYLE: ChordStyle = {
  id: "block",
  perBeat: 4,
  strum: 20,
};

export const isChordStyle = (value: unknown): value is ChordStyle => {
  const style = value as ChordStyle;
  return (
    CHORD_STYLES.some(({ id }) => id === style?.id) &&
    CHORD_RATES.includes(style.perBeat) &&
    STRUM_GAPS.includes(style.strum)
  );
};

// A pattern's steps, each the notes it sounds as indices from the lowest.
function stepsOf(id: ChordStyleId, count: number): number[][] {
  const all = Array.from({ length: count }, (_, i) => i);
  const top = count - 1;
  switch (id) {
    case "up":
      return all.map((i) => [i]);
    case "down":
      return all.map((i) => [top - i]);
    case "upDown":
      return [...all, ...all.slice(1, -1).reverse()].map((i) => [i]);
    case "broken":
      return [[0], all.slice(1)];
    case "alberti":
      return count < 3 ? all.map((i) => [i]) : [[0], [top], [1], [top]];
    default:
      return [all];
  }
}

export interface ChordVoice {
  on: (midi: number) => void;
  off: (midi: number) => void;
}

// Plays `midis` in `style` until the returned function stops it, which
// releases whatever still sounds. A pattern keeps going round while held,
// each note lasting its step; a pulse strikes four times and stops. `stepMs`
// is read every step, so a new tempo takes hold at once.
export function playChord(
  midis: readonly number[],
  style: ChordStyle,
  stepMs: () => number,
  voice: ChordVoice,
) {
  const notes = [...midis].sort((a, b) => a - b);
  const sounding: number[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  const on = (midi: number) => {
    voice.on(midi);
    sounding.push(midi);
  };
  const off = (midi: number) => {
    const at = sounding.indexOf(midi);
    if (at < 0) return;
    sounding.splice(at, 1);
    voice.off(midi);
  };

  if (style.id === "block" || notes.length < 2) {
    notes.forEach(on);
  } else if (style.id === "pulse") {
    let strikes = 0;
    let next = performance.now();
    const strike = () => {
      const step = stepMs();
      notes.forEach(on);
      timers.push(setTimeout(() => notes.forEach(off), step * PULSE_GATE));
      if (++strikes === PULSE_STRIKES) return;
      next = Math.max(next + step, performance.now());
      timers.push(setTimeout(strike, next - performance.now()));
    };
    strike();
  } else if (style.id === "strum") {
    notes.forEach((midi, i) => {
      if (i === 0) on(midi);
      else timers.push(setTimeout(() => on(midi), i * style.strum));
    });
  } else {
    const steps = stepsOf(style.id, notes.length);
    let index = 0;
    let next = performance.now();
    let current: number[] = [];
    const step = () => {
      current.forEach(off);
      current = steps[index++ % steps.length].map((i) => notes[i]);
      current.forEach(on);
      // After a stall (a hidden tab) carry on from now rather than catch up.
      next = Math.max(next + stepMs(), performance.now());
      timers[0] = setTimeout(step, next - performance.now());
    };
    step();
  }

  return () => {
    timers.forEach(clearTimeout);
    [...sounding].forEach(off);
  };
}
