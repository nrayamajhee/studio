import { beatMs, type Timing } from "./noteRecorder";
import { swingOn, swingTime } from "./swing";

// How a held chord sounds: all at once, strummed, or as a pattern of its
// notes in time with the tempo.
export type PlayStyleId =
  | "block"
  | "pulse"
  | "accentPulse"
  | "strum"
  | "strumPulse"
  | "rollPulse"
  | "downUp"
  | "accentDownUp"
  | "roll"
  | "offbeat"
  | "tresillo"
  | "gallop"
  | "folkStrum"
  | "rockEighths"
  | "skank"
  | "waltzStrum"
  | "up"
  | "down"
  | "upDown"
  | "broken"
  | "alberti";

// What holding a chord does: sustain it, repeat it in a rhythm, strum it as
// a guitarist would, or loop through its notes.
export type PlayStyleGroup = "Held" | "Rhythm" | "Strum" | "Arpeggio";

// The settings a play style listens to: the rate of its steps, the gap of its
// strums, both or neither.
export type PlayStyleSetting = "rate" | "strum";

export const PLAY_STYLES: readonly {
  id: PlayStyleId;
  name: string;
  detail: string;
  group: PlayStyleGroup;
  settings: readonly PlayStyleSetting[];
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
    id: "accentPulse",
    name: "Accent pulse",
    detail: "Four to a bar: three struck bright, two and four light",
    group: "Rhythm",
    settings: ["rate"],
  },
  {
    id: "rollPulse",
    name: "Roll pulse",
    detail: "Rolled up a step apart, again and again",
    group: "Rhythm",
    settings: ["rate"],
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
    id: "strumPulse",
    name: "Strum pulse",
    detail: "A strum on every strike",
    group: "Strum",
    settings: ["rate", "strum"],
  },
  {
    id: "downUp",
    name: "Down-up strum",
    detail: "Down on the step, up on the next",
    group: "Strum",
    settings: ["rate", "strum"],
  },
  {
    id: "accentDownUp",
    name: "Accent down-up",
    detail: "Light ups, every other down leaned on",
    group: "Strum",
    settings: ["rate", "strum"],
  },
  {
    id: "folkStrum",
    name: "Folk strum",
    detail: "Down, down-up, up-down-up",
    group: "Strum",
    settings: ["rate", "strum"],
  },
  {
    id: "rockEighths",
    name: "Rock eighths",
    detail: "A down strum every step",
    group: "Strum",
    settings: ["rate", "strum"],
  },
  {
    id: "skank",
    name: "Reggae skank",
    detail: "Short up-strums off the beat",
    group: "Strum",
    settings: ["rate", "strum"],
  },
  {
    id: "waltzStrum",
    name: "Waltz strum",
    detail: "Down, down-up, down-up in three",
    group: "Strum",
    settings: ["rate", "strum"],
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
// steps it holds (a little short of the next, so that one speaks), whether
// it sweeps the chord a strum's gap at a time, rising (a down strum) or
// falling (an up strum), and how hard it plays against the key's velocity.
type Strike = {
  at: number;
  hold: number;
  sweep?: "rising" | "falling";
  level?: number;
};

// Strike levels against the keys' velocity (0.8): a touch harder (0.9) or a
// touch lighter (0.7), as a player leans into a beat or eases off an upstroke.
const ACCENT = 0.9 / 0.8;
const LIGHT = 0.7 / 0.8;
// A piano player's four to the bar: the third struck full (the hardest,
// brightest hammer) and let ring, the first as the keys play it, two and
// four light and short. The lengths carry the accent as much as the levels,
// since a full chord already rides the limiter.
const FULL = 1 / 0.8;
const SOFT = 0.5 / 0.8;

const RHYTHMS: Partial<
  Record<PlayStyleId, { cycle: number; strikes: readonly Strike[] }>
> = {
  pulse: { cycle: 1, strikes: [{ at: 0, hold: 0.5 }] },
  accentPulse: {
    cycle: 4,
    strikes: [
      { at: 0, hold: 0.6 },
      { at: 1, hold: 0.35, level: SOFT },
      { at: 2, hold: 0.9, level: FULL },
      { at: 3, hold: 0.35, level: SOFT },
    ],
  },
  strumPulse: { cycle: 1, strikes: [{ at: 0, hold: 0.5, sweep: "rising" }] },
  downUp: {
    cycle: 2,
    strikes: [
      { at: 0, hold: 0.9, sweep: "rising" },
      { at: 1, hold: 0.9, sweep: "falling" },
    ],
  },
  accentDownUp: {
    cycle: 4,
    strikes: [
      { at: 0, hold: 0.9, sweep: "rising" },
      { at: 1, hold: 0.9, sweep: "falling", level: LIGHT },
      { at: 2, hold: 0.9, sweep: "rising", level: ACCENT },
      { at: 3, hold: 0.9, sweep: "falling", level: LIGHT },
    ],
  },
  // Down, down-up, up-down-up over a bar of eighths; where the hand misses
  // the strings, the strum before rings on.
  folkStrum: {
    cycle: 8,
    strikes: [
      { at: 0, hold: 1.9, sweep: "rising", level: ACCENT },
      { at: 2, hold: 0.9, sweep: "rising" },
      { at: 3, hold: 1.9, sweep: "falling", level: LIGHT },
      { at: 5, hold: 0.9, sweep: "falling", level: LIGHT },
      { at: 6, hold: 0.9, sweep: "rising" },
      { at: 7, hold: 0.9, sweep: "falling", level: LIGHT },
    ],
  },
  rockEighths: {
    cycle: 2,
    strikes: [
      { at: 0, hold: 0.8, sweep: "rising", level: ACCENT },
      { at: 1, hold: 0.8, sweep: "rising" },
    ],
  },
  // Short up-strums choked off on the offbeats.
  skank: { cycle: 2, strikes: [{ at: 1, hold: 0.4, sweep: "falling" }] },
  // A bar of 3/4 in eighths: the downbeat rings, then down-up, down-up.
  waltzStrum: {
    cycle: 6,
    strikes: [
      { at: 0, hold: 1.9, sweep: "rising", level: ACCENT },
      { at: 2, hold: 0.9, sweep: "rising" },
      { at: 3, hold: 0.9, sweep: "falling", level: LIGHT },
      { at: 4, hold: 0.9, sweep: "rising" },
      { at: 5, hold: 0.9, sweep: "falling", level: LIGHT },
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

export type PlayStyle = {
  id: PlayStyleId;
  perBeat: number;
  strum: number;
  // The saved play style it was picked as, if it was.
  saved?: string;
};

export const DEFAULT_PLAY_STYLE: PlayStyle = {
  id: "block",
  perBeat: 4,
  strum: 20,
};

export const isPlayStyle = (value: unknown): value is PlayStyle => {
  const style = value as PlayStyle;
  return (
    PLAY_STYLES.some(({ id }) => id === style?.id) &&
    CHORD_RATES.includes(style.perBeat) &&
    STRUM_GAPS.includes(style.strum) &&
    (style.saved === undefined || typeof style.saved === "string")
  );
};

// A play style saved from the Device: a built-in pattern at its own rate and
// strum, under its own name.
export type SavedPlayStyle = {
  id: string;
  name: string;
  pattern: PlayStyleId;
  perBeat: number;
  strum: number;
};

export const isSavedPlayStyle = (value: unknown): value is SavedPlayStyle => {
  const saved = value as SavedPlayStyle;
  return (
    typeof saved?.id === "string" &&
    typeof saved.name === "string" &&
    isPlayStyle({
      id: saved.pattern,
      perBeat: saved.perBeat,
      strum: saved.strum,
    })
  );
};

// The rate a built-in style starts at: the pulses a strike a beat, the other
// rhythms, strums and arpeggios in eighths, and a roll in sixteenths.
const startingRate = (id: PlayStyleId, group: PlayStyleGroup) =>
  id === "pulse" || id === "accentPulse"
    ? 1
    : group === "Held"
      ? DEFAULT_PLAY_STYLE.perBeat
      : 2;

// A play style as the view lists it: the built-in ones at their starting
// rate and the default strum, then the saved ones, each at its own, in a
// group of their own.
export type PlayStyleOption = {
  id: string;
  name: string;
  group: PlayStyleGroup | "Saved";
  settings: readonly PlayStyleSetting[];
  // What picking it plays.
  style: PlayStyle;
};

export function playStyleOptions(
  saved: readonly SavedPlayStyle[],
): PlayStyleOption[] {
  const builtIn = (id: PlayStyleId) =>
    PLAY_STYLES.find((style) => style.id === id) ?? PLAY_STYLES[0];
  return [
    ...PLAY_STYLES.map(({ id, name, group, settings }) => ({
      id,
      name,
      group,
      settings,
      style: { ...DEFAULT_PLAY_STYLE, id, perBeat: startingRate(id, group) },
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
  current: PlayStyle,
  { settings, style }: PlayStyleOption,
) =>
  settings.some((setting) =>
    setting === "rate"
      ? current.perBeat !== style.perBeat
      : current.strum !== style.strum,
  );

// A pattern's steps, each the notes it sounds as indices from the lowest.
function stepsOf(id: PlayStyleId, count: number): number[][] {
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

// A held chord in `style` as notes laid out ahead (ms from its start), as
// playChord would play it held for `length` at a step of `stepMs`: for
// writing a chord into the take rather than playing it live.
export function chordNotes(
  midis: readonly number[],
  style: PlayStyle,
  stepMs: number,
  length: number,
  velocity: number,
): { note: number; start: number; duration: number; velocity: number }[] {
  const notes = [...midis].sort((a, b) => a - b);
  const out: {
    note: number;
    start: number;
    duration: number;
    velocity: number;
  }[] = [];
  const add = (note: number, start: number, end: number, level = 1) => {
    if (start < length && end > start)
      out.push({
        note,
        start,
        duration: Math.min(end, length) - start,
        velocity: Math.min(1, velocity * level),
      });
  };
  const rhythm = RHYTHMS[style.id];
  if (style.id === "block" || notes.length < 2) {
    notes.forEach((note) => add(note, 0, length));
  } else if (rhythm) {
    for (let count = 0; count * stepMs < length; count++) {
      const at = count % rhythm.cycle;
      const start = count * stepMs;
      for (const { at: hit, hold, sweep, level } of rhythm.strikes) {
        if (hit !== at) continue;
        const order = sweep === "falling" ? [...notes].reverse() : notes;
        const gap = sweep ? style.strum : 0;
        const end = start + hold * stepMs;
        order.forEach((note, i) => add(note, start + i * gap, end, level));
      }
    }
  } else if (style.id === "rollPulse") {
    for (let count = 0; count * stepMs < length; count++) {
      const at = count % notes.length;
      const start = count * stepMs;
      add(notes[at], start, start + (notes.length - at) * stepMs);
    }
  } else if (style.id === "strum" || style.id === "roll") {
    const gap = style.id === "roll" ? stepMs : style.strum;
    notes.forEach((note, i) => add(note, i * gap, length));
  } else {
    const steps = stepsOf(style.id, notes.length);
    for (let count = 0; count * stepMs < length; count++) {
      const start = count * stepMs;
      for (const index of steps[count % steps.length])
        add(notes[index], start, start + stepMs);
    }
  }
  return out;
}

export type ChordVoice = {
  on: (midi: number, velocity: number) => void;
  off: (midi: number) => void;
};

// Plays `midis` in `style` at `velocity` until the returned function stops
// it, which releases whatever still sounds. A pattern keeps going round while
// held, each note lasting its step, or a pulse's strike half of it, and an
// accented rhythm's strikes louder or softer. `timing` is read every step,
// so a new tempo or swing takes hold at once; the steps swing from the
// chord's start as from a beat.
export function playChord(
  midis: readonly number[],
  style: PlayStyle,
  timing: () => Timing,
  voice: ChordVoice,
  velocity: number,
) {
  const stepMs = () => beatMs(timing()) / style.perBeat;
  // Where the next step falls straight (ms since the chord started), and how
  // long the step about to play lasts, swung.
  let straight = 0;
  const nextStep = () => {
    const now = timing();
    const beat = beatMs(now);
    const from = straight;
    straight += beat / style.perBeat;
    const swing = swingOn(now.swing, style.perBeat);
    return swing
      ? swingTime(straight, beat, swing) - swingTime(from, beat, swing)
      : straight - from;
  };
  const notes = [...midis].sort((a, b) => a - b);
  const sounding: number[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  // A rhythm's strike: its sweep's notes still to come, and its end.
  const struck: ReturnType<typeof setTimeout>[] = [];
  const on = (midi: number, level = 1) => {
    voice.on(midi, Math.min(1, velocity * level));
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
    notes.forEach((midi) => on(midi));
  } else if (rhythm) {
    // Each strike lets go of the last one, and its end cuts off any note of
    // its sweep still to come.
    const letGo = () => {
      struck.splice(0).forEach(clearTimeout);
      [...sounding].forEach(off);
    };
    const strike = ({ hold, sweep, level }: Strike, step: number) => {
      letGo();
      const order = sweep === "falling" ? [...notes].reverse() : notes;
      const gap = sweep ? style.strum : 0;
      order.forEach((midi, i) => {
        if (i === 0 || gap === 0) on(midi, level);
        else struck.push(setTimeout(() => on(midi, level), i * gap));
      });
      struck.push(setTimeout(letGo, hold * step));
    };
    let count = 0;
    let next = performance.now();
    const tick = () => {
      const step = nextStep();
      const at = count++ % rhythm.cycle;
      for (const hit of rhythm.strikes) if (hit.at === at) strike(hit, step);
      // After a stall (a hidden tab) carry on from now rather than catch up.
      next = Math.max(next + step, performance.now());
      timers[0] = setTimeout(tick, next - performance.now());
    };
    tick();
  } else if (style.id === "rollPulse") {
    // Rolls up a note a step and holds them, then lets go and rolls again.
    let count = 0;
    let next = performance.now();
    const tick = () => {
      const at = count++ % notes.length;
      if (at === 0) [...sounding].forEach(off);
      on(notes[at]);
      // After a stall (a hidden tab) carry on from now rather than catch up.
      next = Math.max(next + nextStep(), performance.now());
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
      current.forEach((midi) => on(midi));
      // After a stall (a hidden tab) carry on from now rather than catch up.
      next = Math.max(next + nextStep(), performance.now());
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
