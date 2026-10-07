// How a held chord sounds: all at once, strummed, or as a pattern of its
// notes in time with the tempo.
export type ChordStyleId =
  | "block"
  | "pulse"
  | "strum"
  | "strumPulse"
  | "downUp"
  | "roll"
  | "offbeat"
  | "tresillo"
  | "gallop"
  | "up"
  | "down"
  | "upDown"
  | "broken"
  | "alberti";

// What holding a chord does: sustain it, repeat it in a rhythm, or loop
// through its notes.
export type ChordStyleGroup = "Held" | "Rhythm" | "Arpeggio";

// The settings a play style listens to: the rate of its steps, the gap of its
// strums, both or neither.
export type ChordStyleSetting = "rate" | "strum";

export const CHORD_STYLES: readonly {
  id: ChordStyleId;
  name: string;
  detail: string;
  group: ChordStyleGroup;
  settings: readonly ChordStyleSetting[];
}[] = [
  {
    id: "block",
    name: "Block",
    detail: "Every note at once",
    group: "Held",
    settings: [],
  },
  {
    id: "strum",
    name: "Strum",
    detail: "Low to high, a sweep apart",
    group: "Held",
    settings: ["strum"],
  },
  {
    id: "roll",
    name: "Roll",
    detail: "Rolled up a step apart, then held",
    group: "Held",
    settings: ["rate"],
  },
  {
    id: "pulse",
    name: "Pulse",
    detail: "Short strikes, a gap apart",
    group: "Rhythm",
    settings: ["rate"],
  },
  {
    id: "strumPulse",
    name: "Strum pulse",
    detail: "A strum on every strike",
    group: "Rhythm",
    settings: ["rate", "strum"],
  },
  {
    id: "downUp",
    name: "Down-up strum",
    detail: "Down on the step, up on the next",
    group: "Rhythm",
    settings: ["rate", "strum"],
  },
  {
    id: "offbeat",
    name: "Offbeat",
    detail: "Short hits on every other step",
    group: "Rhythm",
    settings: ["rate"],
  },
  {
    id: "tresillo",
    name: "Tresillo",
    detail: "Three hits, 3 + 3 + 2",
    group: "Rhythm",
    settings: ["rate"],
  },
  {
    id: "gallop",
    name: "Gallop",
    detail: "Long, short, short",
    group: "Rhythm",
    settings: ["rate"],
  },
  {
    id: "up",
    name: "Arp up",
    detail: "One at a time, low to high",
    group: "Arpeggio",
    settings: ["rate"],
  },
  {
    id: "down",
    name: "Arp down",
    detail: "One at a time, high to low",
    group: "Arpeggio",
    settings: ["rate"],
  },
  {
    id: "upDown",
    name: "Up-down",
    detail: "Up, then back down",
    group: "Arpeggio",
    settings: ["rate"],
  },
  {
    id: "broken",
    name: "Broken",
    detail: "The root, then the rest",
    group: "Arpeggio",
    settings: ["rate"],
  },
  {
    id: "alberti",
    name: "Alberti",
    detail: "Low, high, middle, high",
    group: "Arpeggio",
    settings: ["rate"],
  },
];

// A pattern's steps a beat, 1/4 to 1/32 with triplets (the red knob), and a
// strum's gap between strings in ms (the blue knob).
export const CHORD_RATES: readonly number[] = [1, 2, 3, 4, 6, 8];
export const STRUM_GAPS: readonly number[] = [5, 10, 15, 20, 30, 40, 60, 80];

// A rhythm's strikes over a cycle of steps: the step each lands on, how many
// steps it holds (a little short of the next, so that one speaks), and
// whether it sweeps the chord a strum's gap at a time, rising (a down strum)
// or falling (an up strum).
type Strike = { at: number; hold: number; sweep?: "rising" | "falling" };

const RHYTHMS: Partial<
  Record<ChordStyleId, { cycle: number; strikes: readonly Strike[] }>
> = {
  pulse: { cycle: 1, strikes: [{ at: 0, hold: 0.5 }] },
  strumPulse: { cycle: 1, strikes: [{ at: 0, hold: 0.5, sweep: "rising" }] },
  downUp: {
    cycle: 2,
    strikes: [
      { at: 0, hold: 0.9, sweep: "rising" },
      { at: 1, hold: 0.9, sweep: "falling" },
    ],
  },
  offbeat: { cycle: 2, strikes: [{ at: 1, hold: 0.5 }] },
  tresillo: {
    cycle: 8,
    strikes: [
      { at: 0, hold: 2.5 },
      { at: 3, hold: 2.5 },
      { at: 6, hold: 1.5 },
    ],
  },
  gallop: {
    cycle: 4,
    strikes: [
      { at: 0, hold: 1.5 },
      { at: 2, hold: 0.75 },
      { at: 3, hold: 0.75 },
    ],
  },
};

export type ChordStyle = {
  id: ChordStyleId;
  perBeat: number;
  strum: number;
  // The saved play style it was picked as, if it was.
  saved?: string;
};

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
    STRUM_GAPS.includes(style.strum) &&
    (style.saved === undefined || typeof style.saved === "string")
  );
};

// A play style saved from the Device: a built-in pattern at its own rate and
// strum, under its own name.
export type SavedChordStyle = {
  id: string;
  name: string;
  pattern: ChordStyleId;
  perBeat: number;
  strum: number;
};

export const isSavedChordStyle = (value: unknown): value is SavedChordStyle => {
  const saved = value as SavedChordStyle;
  return (
    typeof saved?.id === "string" &&
    typeof saved.name === "string" &&
    isChordStyle({
      id: saved.pattern,
      perBeat: saved.perBeat,
      strum: saved.strum,
    })
  );
};

// A play style as the view lists it: the built-in ones at the default rate
// and strum, then the saved ones, each at its own, in a group of their own.
export type PlayStyle = {
  id: string;
  name: string;
  group: ChordStyleGroup | "Saved";
  settings: readonly ChordStyleSetting[];
  // What picking it plays.
  style: ChordStyle;
};

export function playStyles(saved: readonly SavedChordStyle[]): PlayStyle[] {
  const builtIn = (id: ChordStyleId) =>
    CHORD_STYLES.find((style) => style.id === id) ?? CHORD_STYLES[0];
  return [
    ...CHORD_STYLES.map(({ id, name, group, settings }) => ({
      id,
      name,
      group,
      settings,
      style: { ...DEFAULT_CHORD_STYLE, id },
    })),
    ...saved.map(({ id, name, pattern, perBeat, strum }) => ({
      id,
      name,
      group: "Saved" as const,
      settings: builtIn(pattern).settings,
      style: { id: pattern, perBeat, strum, saved: id },
    })),
  ];
}

// Whether `current` has moved off what `style` plays, in a setting it uses.
export const styleEdited = (
  current: ChordStyle,
  { settings, style }: PlayStyle,
) =>
  settings.some((setting) =>
    setting === "rate"
      ? current.perBeat !== style.perBeat
      : current.strum !== style.strum,
  );

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

export type ChordVoice = {
  on: (midi: number) => void;
  off: (midi: number) => void;
};

// Plays `midis` in `style` until the returned function stops it, which
// releases whatever still sounds. A pattern keeps going round while held,
// each note lasting its step, or a pulse's strike half of it. `stepMs`
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
  // A rhythm's strike: its sweep's notes still to come, and its end.
  const struck: ReturnType<typeof setTimeout>[] = [];
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

  const rhythm = RHYTHMS[style.id];
  if (style.id === "block" || notes.length < 2) {
    notes.forEach(on);
  } else if (rhythm) {
    // Each strike lets go of the last one, and its end cuts off any note of
    // its sweep still to come.
    const letGo = () => {
      struck.splice(0).forEach(clearTimeout);
      [...sounding].forEach(off);
    };
    const strike = ({ hold, sweep }: Strike, step: number) => {
      letGo();
      const order = sweep === "falling" ? [...notes].reverse() : notes;
      const gap = sweep ? style.strum : 0;
      order.forEach((midi, i) => {
        if (i === 0 || gap === 0) on(midi);
        else struck.push(setTimeout(() => on(midi), i * gap));
      });
      struck.push(setTimeout(letGo, hold * step));
    };
    let count = 0;
    let next = performance.now();
    const tick = () => {
      const step = stepMs();
      const at = count++ % rhythm.cycle;
      for (const hit of rhythm.strikes) if (hit.at === at) strike(hit, step);
      // After a stall (a hidden tab) carry on from now rather than catch up.
      next = Math.max(next + step, performance.now());
      timers[0] = setTimeout(tick, next - performance.now());
    };
    tick();
  } else if (style.id === "strum" || style.id === "roll") {
    // A roll spreads the chord a step a note rather than a strum's gap.
    const gap = style.id === "roll" ? stepMs() : style.strum;
    notes.forEach((midi, i) => {
      if (i === 0) on(midi);
      else timers.push(setTimeout(() => on(midi), i * gap));
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
    struck.forEach(clearTimeout);
    [...sounding].forEach(off);
  };
}
