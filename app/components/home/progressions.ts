import { chordNotes, type ChordStyle } from "./chordStyles";
import { KEY_VELOCITY } from "./deviceMath";
import {
  barMs,
  beatMs,
  type PlayedNote,
  type Take,
  type Timing,
} from "./noteRecorder";

// A chord of a progression: its root in semitones above the home note, what
// it is built as, and, for an inversion, its bass note in semitones above
// the root. An 11 is voiced as pop plays it, a 9sus4, with no third under
// the 11th.
type Quality =
  | "maj"
  | "min"
  | "dim"
  | "aug"
  | "sus2"
  | "sus4"
  | "maj6"
  | "min6"
  | "maj7"
  | "min7"
  | "dom7"
  | "minMaj7"
  | "dim7"
  | "dom9"
  | "dom11";
type Step = readonly [root: number, quality: Quality, bass?: number];

const INTERVALS: Readonly<Record<Quality, readonly number[]>> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  maj6: [0, 4, 7, 9],
  min6: [0, 3, 7, 9],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  minMaj7: [0, 3, 7, 11],
  dim7: [0, 3, 6, 9],
  dom9: [0, 4, 7, 10, 14],
  dom11: [0, 5, 7, 10, 14],
};

// A key's tonic, by name, as semitones above C.
const TONICS = {
  C: 0,
  "C♯": 1,
  "D♭": 1,
  D: 2,
  "E♭": 3,
  E: 4,
  F: 5,
  "F♯": 6,
  G: 7,
  "A♭": 8,
  A: 9,
  "B♭": 10,
  B: 11,
} as const;
export type Tonic = keyof typeof TONICS;

export type ProgressionGroup =
  | "Pop"
  | "Major"
  | "Minor"
  | "Modal"
  | "Chromatic"
  | "Jazz"
  | "Blues and rock"
  | "Two chords"
  | "Cadences";

// A chord progression, a bar a chord, from David Bennett's videos (see
// docs/project/chord-progressions.md): named for what it is called, or else for the
// song it is known for, and in that song's key where one stands out (else
// C, or A minor). The key is the home note's: the major tonic, or the minor
// one for a progression written from i.
export type Progression = {
  id: string;
  name: string;
  // Roman numerals, case for quality (I major, i minor).
  numerals: string;
  group: ProgressionGroup;
  key: Tonic;
  chords: readonly Step[];
};

const I: Step = [0, "maj"];
const ii: Step = [2, "min"];
const iii: Step = [4, "min"];
const IV: Step = [5, "maj"];
const V: Step = [7, "maj"];
const vi: Step = [9, "min"];
const viio: Step = [11, "dim"];
const i: Step = [0, "min"];
const bII: Step = [1, "maj"];
const bIII: Step = [3, "maj"];
const iv: Step = [5, "min"];
const v: Step = [7, "min"];
const bVI: Step = [8, "maj"];
const bVII: Step = [10, "maj"];
const II: Step = [2, "maj"];
const III: Step = [4, "maj"];
const Iaug: Step = [0, "aug"];
const I6: Step = [0, "maj6"];
const i6: Step = [0, "min6"];
const Isus2: Step = [0, "sus2"];
const Isus4: Step = [0, "sus4"];
const Imaj7: Step = [0, "maj7"];
const IVmaj7: Step = [5, "maj7"];
const imaj7: Step = [0, "minMaj7"];
const I7: Step = [0, "dom7"];
const II7: Step = [2, "dom7"];
const III7: Step = [4, "dom7"];
const IV7: Step = [5, "dom7"];
const V7: Step = [7, "dom7"];
const bII7: Step = [1, "dom7"];
const bVII7: Step = [10, "dom7"];
const i7: Step = [0, "min7"];
const ii7: Step = [2, "min7"];
const iii7: Step = [4, "min7"];
const iv7: Step = [5, "min7"];
const vi7: Step = [9, "min7"];
const sIo7: Step = [1, "dim7"];
const siio7: Step = [3, "dim7"];
const II9: Step = [2, "dom9"];
const V11: Step = [7, "dom11"];
// Inversions: ♭II over its third, V over its third, I over its fifth.
const bII6: Step = [1, "maj", 4];
const V6: Step = [7, "maj", 4];
const I64: Step = [0, "maj", 7];

// A chord an octave down, so a line keeps falling past the fourth below home
// rather than jumping back up.
const down = ([root, quality, bass]: Step): Step => [root - 12, quality, bass];

export const PROGRESSIONS: readonly Progression[] = [
  {
    id: "axis",
    name: "Axis",
    numerals: "I V vi IV",
    group: "Pop",
    key: "C",
    chords: [I, V, vi, IV],
  },
  {
    id: "minorAxis",
    name: "Minor axis",
    numerals: "vi IV I V",
    group: "Pop",
    key: "G",
    chords: [vi, IV, I, V],
  },
  {
    id: "momentum",
    name: "With or without you",
    numerals: "IV I V vi",
    group: "Pop",
    key: "D",
    chords: [IV, I, V, vi],
  },
  {
    id: "fastCar",
    name: "Fast car",
    numerals: "IV I vi V",
    group: "Pop",
    key: "A",
    chords: [IV, I, vi, V],
  },
  {
    id: "doowop",
    name: "Doo-wop",
    numerals: "I vi IV V",
    group: "Pop",
    key: "A",
    chords: [I, vi, IV, V],
  },
  {
    id: "purpleRain",
    name: "Purple rain",
    numerals: "I vi V IV",
    group: "Pop",
    key: "B♭",
    chords: [I, vi, V, IV],
  },
  {
    id: "axisCadence",
    name: "Halo",
    numerals: "I IV vi V",
    group: "Pop",
    key: "A",
    chords: [I, IV, vi, V],
  },
  {
    id: "angels",
    name: "Angels",
    numerals: "I IV vi V",
    group: "Pop",
    key: "E",
    chords: [I, IV, vi, V],
  },
  {
    id: "uplift",
    name: "Every breath",
    numerals: "I V IV V",
    group: "Pop",
    key: "A♭",
    chords: [I, V, IV, V],
  },
  {
    id: "subdominantClimb",
    name: "Closing time",
    numerals: "I V ii IV",
    group: "Pop",
    key: "G",
    chords: [I, V, ii, IV],
  },
  {
    id: "fromFour",
    name: "The Scientist",
    numerals: "IV I V",
    group: "Pop",
    key: "F",
    chords: [IV, I, V],
  },
  {
    id: "coldplay",
    name: "Coldplay's go-to",
    numerals: "IV I V",
    group: "Pop",
    key: "E♭",
    chords: [IV, I, V],
  },
  {
    id: "breadAndButter",
    name: "Bread and butter",
    numerals: "I IV I V",
    group: "Major",
    key: "G",
    chords: [I, IV, I, V],
  },
  {
    id: "climb",
    name: "Major scale climb",
    numerals: "I ii IV V",
    group: "Major",
    key: "C",
    chords: [I, ii, IV, V],
  },
  {
    id: "whatsUp",
    name: "What's up",
    numerals: "I ii IV I",
    group: "Major",
    key: "A",
    chords: [I, ii, IV, I],
  },
  {
    id: "getItOn",
    name: "Let's get it on",
    numerals: "I iii IV V",
    group: "Major",
    key: "E♭",
    chords: [I, iii, IV, V],
  },
  {
    id: "oneTwoThreeFour",
    name: "1-2-3-4",
    numerals: "I ii iii IV",
    group: "Major",
    key: "C",
    chords: [I, ii, iii, IV],
  },
  {
    id: "fourThreeTwoOne",
    name: "4-3-2-1",
    numerals: "IV iii ii I",
    group: "Major",
    key: "C",
    chords: [IV, iii, ii, I],
  },
  {
    id: "fourFiveSixOne",
    name: "4-5-6-1",
    numerals: "IV V vi I",
    group: "Major",
    key: "C",
    chords: [IV, V, vi, I],
  },
  {
    id: "pachelbel",
    name: "Pachelbel's canon",
    numerals: "I V vi iii IV I IV V",
    group: "Major",
    key: "D",
    chords: [I, V, vi, iii, IV, I, IV, V],
  },
  {
    id: "descendingBass",
    name: "Descending bass",
    numerals: "I V6 vi V",
    group: "Major",
    key: "C",
    chords: [I, V6, vi, V],
  },
  {
    id: "descendingScale",
    name: "Descending scale",
    numerals: "I vii° vi V IV iii ii I",
    group: "Major",
    key: "C",
    chords: [I, viio, vi, V, down(IV), down(iii), down(ii), down(I)],
  },
  {
    id: "andalusian",
    name: "Andalusian cadence",
    numerals: "i ♭VII ♭VI V",
    group: "Minor",
    key: "D",
    chords: [i, bVII, bVI, V],
  },
  {
    id: "aeolian",
    name: "Aeolian vamp",
    numerals: "i ♭VII ♭VI",
    group: "Minor",
    key: "C♯",
    chords: [i, bVII, bVI],
  },
  {
    id: "wonderwall",
    name: "Plagal cascade",
    numerals: "i ♭III ♭VII IV",
    group: "Minor",
    key: "F♯",
    chords: [i, bIII, bVII, IV],
  },
  {
    id: "cantStop",
    name: "Can't stop",
    numerals: "i ♭VII v ♭VI",
    group: "Minor",
    key: "E",
    chords: [i, bVII, v, bVI],
  },
  {
    id: "minorPlagal",
    name: "Minor plagal",
    numerals: "i ♭III ♭VII iv",
    group: "Minor",
    key: "A",
    chords: [i, bIII, bVII, iv],
  },
  {
    id: "harmonicAxis",
    name: "Harmonic minor axis",
    numerals: "i ♭VI ♭III V",
    group: "Minor",
    key: "G",
    chords: [i, bVI, bIII, V],
  },
  {
    id: "neapolitan",
    name: "Neapolitan",
    numerals: "♭II6 V i",
    group: "Minor",
    key: "C♯",
    chords: [bII6, V, i],
  },
  {
    id: "lineCliche",
    name: "Line cliché",
    numerals: "i imaj7 i7 i6",
    group: "Minor",
    key: "E",
    chords: [i, imaj7, i7, i6],
  },
  {
    id: "picardy",
    name: "Picardy third",
    numerals: "i iv V I",
    group: "Minor",
    key: "A",
    chords: [i, iv, V, I],
  },
  {
    id: "minorThree",
    name: "Minor three-chord",
    numerals: "i iv v",
    group: "Minor",
    key: "A",
    chords: [i, iv, v],
  },
  {
    id: "mixolydianBlend",
    name: "Waterfalls",
    numerals: "I V ♭VII IV",
    group: "Modal",
    key: "C",
    chords: [I, V, bVII, IV],
  },
  {
    id: "mixolydianVamp",
    name: "Mixolydian vamp",
    numerals: "I ♭VII IV I",
    group: "Modal",
    key: "D",
    chords: [I, bVII, IV, I],
  },
  {
    id: "mixolydian",
    name: "Mixolydian",
    numerals: "I ♭VII IV",
    group: "Modal",
    key: "D",
    chords: [I, bVII, IV],
  },
  {
    id: "magnolia",
    name: "Magnolia",
    numerals: "I ♭VII IV",
    group: "Modal",
    key: "C",
    chords: [I, bVII, IV],
  },
  {
    id: "mario",
    name: "Mario cadence",
    numerals: "♭VI ♭VII I",
    group: "Modal",
    key: "C",
    chords: [bVI, bVII, I],
  },
  {
    id: "minorFive",
    name: "Minor five",
    numerals: "I v IV",
    group: "Modal",
    key: "A",
    chords: [I, v, IV],
  },
  {
    id: "dorian",
    name: "Dorian",
    numerals: "i7 IV7",
    group: "Modal",
    key: "A",
    chords: [i7, IV7],
  },
  {
    id: "aeolianMode",
    name: "Aeolian",
    numerals: "i ♭VI ♭VII",
    group: "Modal",
    key: "A",
    chords: [i, bVI, bVII],
  },
  {
    id: "phrygian",
    name: "Phrygian vamp",
    numerals: "i ♭II",
    group: "Modal",
    key: "E",
    chords: [i, bII],
  },
  {
    id: "phrygianMode",
    name: "Phrygian",
    numerals: "i ♭II i",
    group: "Modal",
    key: "E",
    chords: [i, bII, i],
  },
  {
    id: "phrygianDominant",
    name: "Phrygian dominant",
    numerals: "I ♭II i",
    group: "Modal",
    key: "E",
    chords: [I, bII, i],
  },
  {
    id: "lydian",
    name: "Lydian",
    numerals: "I II",
    group: "Modal",
    key: "C",
    chords: [I, II],
  },
  {
    id: "whereIsMyMind",
    name: "Where is my mind",
    numerals: "I vi III IV",
    group: "Chromatic",
    key: "E",
    chords: [I, vi, III, IV],
  },
  {
    id: "shesElectric",
    name: "She's electric",
    numerals: "I III vi IV",
    group: "Chromatic",
    key: "A",
    chords: [I, III, vi, IV],
  },
  {
    id: "creep",
    name: "Creep",
    numerals: "I III IV iv",
    group: "Chromatic",
    key: "G",
    chords: [I, III, IV, iv],
  },
  {
    id: "something",
    name: "Something",
    numerals: "I Imaj7 I7 IV iv",
    group: "Chromatic",
    key: "C",
    chords: [I, Imaj7, I7, IV, iv],
  },
  {
    id: "minorFour",
    name: "Minor four",
    numerals: "IV iv I",
    group: "Chromatic",
    key: "G",
    chords: [IV, iv, I],
  },
  {
    id: "augmentedClimb",
    name: "Augmented climb",
    numerals: "I I+ I6 I7",
    group: "Chromatic",
    key: "C",
    chords: [I, Iaug, I6, I7],
  },
  {
    id: "augmented",
    name: "Augmented",
    numerals: "I I+ IV",
    group: "Chromatic",
    key: "C",
    chords: [I, Iaug, IV],
  },
  {
    id: "diminished",
    name: "Diminished",
    numerals: "I ♯I°7 ii ♯ii°7 I/V",
    group: "Chromatic",
    key: "C",
    chords: [I, sIo7, ii, siio7, I64],
  },
  {
    id: "gospelClimb",
    name: "Gospel climb",
    numerals: "I ♯I°7 ii7 V",
    group: "Chromatic",
    key: "C",
    chords: [I, sIo7, ii7, V],
  },
  {
    id: "chromaticMediants",
    name: "Chromatic mediants",
    numerals: "I ♭VI I III",
    group: "Chromatic",
    key: "C",
    chords: [I, bVI, I, III],
  },
  {
    id: "secondaryDominants",
    name: "Secondary dominants",
    numerals: "I V/vi vi V/V V",
    group: "Chromatic",
    key: "C",
    chords: [I, III7, vi, II7, V],
  },
  {
    id: "twoFiveOne",
    name: "2-5-1",
    numerals: "ii7 V7 Imaj7",
    group: "Jazz",
    key: "C",
    chords: [ii7, V7, Imaj7],
  },
  {
    id: "circleOfFifths",
    name: "Circle of fifths",
    numerals: "vi ii V I IV vii° iii",
    group: "Jazz",
    key: "C",
    chords: [vi, ii, V, I, IV, viio, iii],
  },
  {
    id: "tritoneSub",
    name: "Tritone sub",
    numerals: "ii7 ♭II7 Imaj7",
    group: "Jazz",
    key: "F",
    chords: [ii7, bII7, Imaj7],
  },
  {
    id: "royalRoad",
    name: "Royal road",
    numerals: "IVmaj7 V7 iii7 vi",
    group: "Jazz",
    key: "C",
    chords: [IVmaj7, V7, iii7, vi],
  },
  {
    id: "justTheTwoOfUs",
    name: "Just the two of us",
    numerals: "IVmaj7 III7 vi7 I7",
    group: "Jazz",
    key: "A♭",
    chords: [IVmaj7, III7, vi7, I7],
  },
  // Round the circle of fifths, rich with upper extensions.
  {
    id: "lovely",
    name: "Isn't she lovely",
    numerals: "vi7 II9 V11 I",
    group: "Jazz",
    key: "E",
    chords: [vi7, II9, V11, I],
  },
  {
    id: "backdoor",
    name: "Backdoor",
    numerals: "iv7 ♭VII7 I",
    group: "Jazz",
    key: "C",
    chords: [iv7, bVII7, I],
  },
  {
    id: "twelveBar",
    name: "12-bar blues",
    numerals: "I7 IV7 V7",
    group: "Blues and rock",
    key: "B♭",
    chords: [I7, I7, I7, I7, IV7, IV7, I7, I7, V7, IV7, I7, V7],
  },
  {
    id: "bluesRock",
    name: "Blues rock",
    numerals: "I ♭VII IV I",
    group: "Blues and rock",
    key: "E",
    chords: [I, bVII, IV, I],
  },
  {
    id: "twistAndShout",
    name: "Twist and shout",
    numerals: "I IV V",
    group: "Blues and rock",
    key: "D",
    chords: [I, IV, V],
  },
  {
    id: "threeChordRock",
    name: "Three-chord rock",
    numerals: "I IV ♭VII",
    group: "Blues and rock",
    key: "C",
    chords: [I, IV, bVII],
  },
  {
    id: "everydayPeople",
    name: "Everyday people",
    numerals: "I V",
    group: "Two chords",
    key: "C",
    chords: [I, V],
  },
  {
    id: "bornInTheUsa",
    name: "Born in the U.S.A.",
    numerals: "I IV",
    group: "Two chords",
    key: "B",
    chords: [I, IV],
  },
  {
    id: "myGeneration",
    name: "My generation",
    numerals: "I ii",
    group: "Two chords",
    key: "C",
    chords: [I, ii],
  },
  {
    id: "breathe",
    name: "Breathe",
    numerals: "i v",
    group: "Two chords",
    key: "E",
    chords: [i, v],
  },
  {
    id: "somethingInTheWay",
    name: "Something in the way",
    numerals: "I ♭VII",
    group: "Two chords",
    key: "C",
    chords: [I, bVII],
  },
  {
    id: "perfectCadence",
    name: "Perfect cadence",
    numerals: "V I",
    group: "Cadences",
    key: "C",
    chords: [V, I],
  },
  {
    id: "plagalCadence",
    name: "Plagal cadence",
    numerals: "IV I",
    group: "Cadences",
    key: "C",
    chords: [IV, I],
  },
  {
    id: "halfCadence",
    name: "Half cadence",
    numerals: "IV V",
    group: "Cadences",
    key: "C",
    chords: [IV, V],
  },
  {
    id: "deceptiveCadence",
    name: "Deceptive cadence",
    numerals: "V vi",
    group: "Cadences",
    key: "C",
    chords: [V, vi],
  },
  {
    id: "cadential64",
    name: "Cadential 6/4",
    numerals: "I6/4 V7 I",
    group: "Cadences",
    key: "C",
    chords: [I64, V7, I],
  },
  {
    id: "suspended",
    name: "Suspended",
    numerals: "Isus4 I Isus2 I",
    group: "Cadences",
    key: "C",
    chords: [Isus4, I, Isus2, I],
  },
  // C's vi is G's ii, D the V that lands in G.
  {
    id: "pivotChord",
    name: "Pivot chord",
    numerals: "I vi V/V V",
    group: "Cadences",
    key: "C",
    chords: [I, vi, II, V],
  },
];

// The lowest note a progression's home lands on: every progression is
// written with its home from G3 up to F♯4, whatever octave the keys are on.
// Moving it up or down is left to the roll.
const HOME_LOW = 55;

// The note a progression is auditioned on: its key's tonic (moved into the
// home range when it is written).
export const previewHome = ({ key }: Progression) => 60 + TONICS[key];

// The progression as a take at `timing`'s tempo, on `home` (a note, moved by
// octaves into the home range), played in `style` as the chord pads would
// play it: each chord a bar long, its root moved by octaves to within a
// half-octave of home so the chords stay close, over its bass (the root,
// or an inversion's) an octave down.
export function progressionTake(
  { chords }: Progression,
  note: number,
  timing: Timing,
  style: ChordStyle,
): Take {
  const home = HOME_LOW + ((((note - HOME_LOW) % 12) + 12) % 12);
  const bar = barMs(timing);
  const stepMs = beatMs(timing) / style.perBeat;
  // Each chord lets go just before the next, so it speaks again.
  const hold = bar - Math.min(40, beatMs(timing) / 4);
  const notes: PlayedNote[] = chords.flatMap(
    ([offset, quality, bass = 0], index) => {
      // Written below home, a root stays where it is put (see `down`).
      const root = home + (offset < 0 ? offset : ((offset + 5) % 12) - 5);
      const voicing = [
        root + bass - 12,
        ...INTERVALS[quality].map((interval) => root + interval),
      ].filter((note) => note >= 0 && note <= 127);
      return chordNotes(voicing, style, stepMs, hold, KEY_VELOCITY).map(
        (note) => ({ ...note, start: note.start + index * bar }),
      );
    },
  );
  return { notes, length: chords.length * bar, bpm: timing.bpm };
}
