import { chordNotes, type ChordStyle } from "./chordStyles";
import { KEY_VELOCITY } from "./deviceMath";
import {
  barMs,
  beatMs,
  type PlayedNote,
  type Take,
  type Timing,
} from "./noteRecorder";

// A chord of a progression: its root in semitones above the home note, and
// what it is built as.
type Quality = "maj" | "min" | "dom7";
type Step = readonly [root: number, quality: Quality];

const INTERVALS: Readonly<Record<Quality, readonly number[]>> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dom7: [0, 4, 7, 10],
};

export type ProgressionGroup = "Major" | "Minor" | "Modal" | "Blues";

// A chord progression, a bar a chord, from David Bennett's videos on the
// most common ones. The home note is the key's tonic: the major one for the
// major and modal progressions, the minor one for the minor.
export type Progression = {
  id: string;
  name: string;
  // Roman numerals, case for quality (I major, i minor).
  numerals: string;
  group: ProgressionGroup;
  chords: readonly Step[];
};

const I: Step = [0, "maj"];
const ii: Step = [2, "min"];
const IV: Step = [5, "maj"];
const V: Step = [7, "maj"];
const vi: Step = [9, "min"];
const bVII: Step = [10, "maj"];
const i: Step = [0, "min"];
const bII: Step = [1, "maj"];
const bIII: Step = [3, "maj"];
const iv: Step = [5, "min"];
const v: Step = [7, "min"];
const bVI: Step = [8, "maj"];
const I7: Step = [0, "dom7"];
const IV7: Step = [5, "dom7"];
const V7: Step = [7, "dom7"];

export const PROGRESSIONS: readonly Progression[] = [
  {
    id: "axis",
    name: "Axis",
    numerals: "I V vi IV",
    group: "Major",
    chords: [I, V, vi, IV],
  },
  {
    id: "doowop",
    name: "Doo-wop",
    numerals: "I vi IV V",
    group: "Major",
    chords: [I, vi, IV, V],
  },
  {
    id: "breadAndButter",
    name: "Bread and butter",
    numerals: "I IV I V",
    group: "Major",
    chords: [I, IV, I, V],
  },
  {
    id: "uplift",
    name: "Uplifting loop",
    numerals: "I V IV V",
    group: "Major",
    chords: [I, V, IV, V],
  },
  {
    id: "climb",
    name: "Major scale climb",
    numerals: "I ii IV V",
    group: "Major",
    chords: [I, ii, IV, V],
  },
  {
    id: "subdominantClimb",
    name: "Subdominant climb",
    numerals: "I V ii IV",
    group: "Major",
    chords: [I, V, ii, IV],
  },
  {
    id: "axisCadence",
    name: "Axis to a cadence",
    numerals: "I IV vi V",
    group: "Major",
    chords: [I, IV, vi, V],
  },
  {
    id: "fromFour",
    name: "From the four",
    numerals: "IV I V",
    group: "Major",
    chords: [IV, I, V],
  },
  {
    id: "momentum",
    name: "Momentum",
    numerals: "IV I V vi",
    group: "Major",
    chords: [IV, I, V, vi],
  },
  {
    id: "minorAxis",
    name: "Minor axis",
    numerals: "i ♭VI ♭III ♭VII",
    group: "Minor",
    chords: [i, bVI, bIII, bVII],
  },
  {
    id: "andalusian",
    name: "Andalusian cadence",
    numerals: "i ♭VII ♭VI V",
    group: "Minor",
    chords: [i, bVII, bVI, V],
  },
  {
    id: "aeolian",
    name: "Aeolian vamp",
    numerals: "i ♭VII ♭VI",
    group: "Minor",
    chords: [i, bVII, bVI],
  },
  {
    id: "wonderwall",
    name: "Plagal cascade",
    numerals: "i ♭III ♭VII IV",
    group: "Minor",
    chords: [i, bIII, bVII, IV],
  },
  {
    id: "cantStop",
    name: "Can't stop",
    numerals: "i ♭VII v IV",
    group: "Minor",
    chords: [i, bVII, v, IV],
  },
  {
    id: "minorPlagal",
    name: "Minor plagal",
    numerals: "i ♭III ♭VII iv",
    group: "Minor",
    chords: [i, bIII, bVII, iv],
  },
  {
    id: "mixolydianBlend",
    name: "Mixolydian blend",
    numerals: "I V ♭VII IV",
    group: "Modal",
    chords: [I, V, bVII, IV],
  },
  {
    id: "mixolydianVamp",
    name: "Mixolydian vamp",
    numerals: "I ♭VII IV I",
    group: "Modal",
    chords: [I, bVII, IV, I],
  },
  {
    id: "phrygian",
    name: "Phrygian vamp",
    numerals: "i ♭II",
    group: "Modal",
    chords: [i, bII],
  },
  {
    id: "twelveBar",
    name: "12-bar blues",
    numerals: "I7 IV7 V7",
    group: "Blues",
    chords: [I7, I7, I7, I7, IV7, IV7, I7, I7, V7, IV7, I7, V7],
  },
];

// The progression as a take at `timing`'s tempo, on `home` (a keybed note),
// played in `style` as the chord pads would play it: each chord a bar long,
// its root moved by octaves to within a half-octave of home so the chords
// stay close, over that root an octave down.
export function progressionTake(
  { chords }: Progression,
  home: number,
  timing: Timing,
  style: ChordStyle,
): Take {
  const bar = barMs(timing);
  const stepMs = beatMs(timing) / style.perBeat;
  // Each chord lets go just before the next, so it speaks again.
  const hold = bar - Math.min(40, beatMs(timing) / 4);
  const notes: PlayedNote[] = chords.flatMap(([offset, quality], index) => {
    const root = home + (((offset + 5) % 12) - 5);
    const voicing = [
      root - 12,
      ...INTERVALS[quality].map((interval) => root + interval),
    ].filter((note) => note >= 0 && note <= 127);
    return chordNotes(voicing, style, stepMs, hold, KEY_VELOCITY).map(
      (note) => ({ ...note, start: note.start + index * bar }),
    );
  });
  return { notes, length: chords.length * bar, bpm: timing.bpm };
}
