import type { DrumPieceId, KitId } from "../../lib/physical";
import type { Meter, Take } from "./noteRecorder";
import { patternTake, type StepHit, type StepPattern } from "./stepPattern";

export type BeatStyle =
  | "Rock"
  | "Pop"
  | "Funk and soul"
  | "Jazz"
  | "Latin and reggae"
  | "Hip hop"
  | "Electronic"
  | "South Asian";

// A drum beat for the drum grid, on the kit and at the tempo that suit it
// (`bpm` counts the meter's beats, so an eighth in 6/8): each row a piece, a
// character a step (X accented, x played, o a ghost note, . rest; spaces
// only mark the beats), in `meter` at `perBeat` steps a beat, over as many
// bars as the rows run.
export type DrumBeat = {
  id: string;
  name: string;
  style: BeatStyle;
  kit: KitId;
  bpm: number;
  meter: Meter;
  perBeat: number;
  rows: Partial<Record<DrumPieceId, string>>;
};

type BeatSpec = Omit<DrumBeat, "style" | "meter" | "perBeat"> &
  Partial<Pick<DrumBeat, "meter" | "perBeat">>;

const FOUR: Meter = { beats: 4, unit: 4 };
// A preview plays the beat round until it has run this many bars.
const PREVIEW_BARS = 4;
const VELOCITY: Readonly<Record<string, number>> = { X: 1, x: 0.8, o: 0.45 };

// A style's beats, in 4/4 at four steps a beat unless they say otherwise.
const styled = (style: BeatStyle, beats: readonly BeatSpec[]): DrumBeat[] =>
  beats.map((beat) => ({ meter: FOUR, perBeat: 4, ...beat, style }));

// A hand drum's cycle, a stroke a beat (a taal's bols), as rows.
function strokes(bols: readonly DrumPieceId[], perBeat: number) {
  const rows: Partial<Record<DrumPieceId, string>> = {};
  bols.forEach((bol, beat) => {
    const row = (rows[bol] ??= ".".repeat(bols.length * perBeat)).split("");
    row[beat * perBeat] = "x";
    rows[bol] = row.join("");
  });
  return rows;
}

export const DRUM_BEATS: readonly DrumBeat[] = [
  ...styled("Rock", [
    {
      id: "rock",
      name: "Rock",
      bpm: 116,
      kit: "rockDrums",
      rows: {
        crash: "X... .... .... ....",
        kick: "x... .... x.x. ....",
        snare: ".... X... .... X...",
        closedHat: "x.x. x.x. x.x. x.x.",
      },
    },
    {
      id: "hardRock",
      name: "Hard rock",
      bpm: 110,
      kit: "rockDrums",
      rows: {
        kick: "x.x. .... x.x. ....",
        snare: ".... X... .... X...",
        bell: "x.x. x.x. x.x. x.x.",
      },
    },
    {
      id: "punk",
      name: "Punk",
      bpm: 180,
      kit: "rockDrums",
      rows: {
        crash: "X... .... .... ....",
        kick: "x... x... x... x...",
        snare: "..X. ..X. ..X. ..X.",
        closedHat: "x... x... x... x...",
      },
    },
    {
      id: "halfTime",
      name: "Half-time",
      bpm: 130,
      kit: "rockDrums",
      rows: {
        kick: "x... .... ..x. ....",
        snare: ".... .... X... ....",
        closedHat: "x.x. x.x. x.x. x.x.",
      },
    },
    {
      id: "tomGroove",
      name: "Tom groove",
      bpm: 108,
      kit: "rockDrums",
      rows: {
        kick: "x... ..x. ..x. ....",
        snare: ".... X... .... X...",
        lowTom: "..x. .... x.x. ..x.",
        highTom: "...x ...x .... ....",
      },
    },
    {
      id: "cowbell",
      name: "More cowbell",
      bpm: 112,
      kit: "rockDrums",
      rows: {
        kick: "x... .... x.x. ....",
        snare: ".... x... .... x...",
        cowbell: "x.x. x.x. x.x. x.x.",
      },
    },
  ]),
  ...styled("Pop", [
    {
      id: "pop",
      name: "Pop",
      bpm: 110,
      kit: "drums",
      rows: {
        kick: "x... .... x.x. ....",
        snare: ".... x... .... x...",
        closedHat: "x.x. x.x. x.x. x.x.",
        tambourine: "..x. ..x. ..x. ..x.",
      },
    },
    {
      id: "disco",
      name: "Disco",
      bpm: 120,
      kit: "drums",
      rows: {
        kick: "x... x... x... x...",
        snare: ".... x... .... x...",
        closedHat: "x... x... x... x...",
        openHat: "..x. ..x. ..x. ..x.",
      },
    },
    {
      id: "motown",
      name: "Motown",
      bpm: 128,
      kit: "drums",
      rows: {
        kick: "x... .... x.x. ....",
        snare: "o... X... o... X...",
        tambourine: "x... x... x... x...",
        closedHat: "..x. ..x. ..x. ..x.",
      },
    },
    {
      id: "popBallad",
      name: "Pop ballad",
      bpm: 72,
      kit: "drums",
      rows: {
        kick: "x... .... ..x. ....",
        stick: ".... x... .... x...",
        closedHat: "x.x. x.x. x.x. x.x.",
      },
    },
    {
      id: "shuffle",
      name: "Shuffle",
      bpm: 104,
      kit: "drums",
      perBeat: 3,
      rows: {
        kick: "x.. ... x.. ...",
        snare: "... x.. ... x..",
        closedHat: "x.x x.x x.x x.x",
      },
    },
  ]),
  ...styled("Funk and soul", [
    {
      id: "funk",
      name: "Funk",
      bpm: 100,
      kit: "drums",
      rows: {
        kick: "x..x ..x. ..x. .x..",
        snare: ".... x..o .o.. x..o",
        closedHat: "Xxxx Xxxx Xxxx Xxxx",
      },
    },
    {
      // No two pieces at once.
      id: "linearFunk",
      name: "Linear funk",
      bpm: 96,
      kit: "drums",
      rows: {
        kick: "x... ..x. .x.. ....",
        snare: ".... X... ...o X...",
        closedHat: ".oxo .x.o x.o. .oxo",
      },
    },
    {
      id: "purdie",
      name: "Purdie shuffle",
      bpm: 96,
      kit: "drums",
      perBeat: 3,
      rows: {
        kick: "x.. ..x x.. ...",
        snare: ".o. Xo. .o. Xo.",
        closedHat: "x.x x.x x.x x.x",
      },
    },
    {
      id: "neoSoul",
      name: "Neo soul",
      bpm: 84,
      kit: "drums",
      rows: {
        kick: "x... ...x ..x. ....",
        stick: ".... x... .... x...",
        snare: ".... .... .... ...o",
        closedHat: "x.xx x.x. x.xx x.x.",
      },
    },
  ]),
  // Swung on a triplet grid: the ride's "ding, ding-a" and the hat's foot on
  // 2 and 4, the kick feathered.
  ...styled("Jazz", [
    {
      id: "swing",
      name: "Swing",
      bpm: 150,
      kit: "jazzDrums",
      perBeat: 3,
      rows: {
        ride: "x.. x.x x.. x.x",
        closedHat: "... x.. ... x..",
        kick: "o.. o.. o.. o..",
      },
    },
    {
      id: "twoFeel",
      name: "Two-feel",
      bpm: 120,
      kit: "jazzDrums",
      perBeat: 3,
      rows: {
        ride: "x.. x.x x.. x.x",
        closedHat: "... x.. ... x..",
        kick: "o.. ... o.. ...",
        stick: "... ... ... x..",
      },
    },
    {
      // Comping: snare on the offbeats and a bomb from the kick.
      id: "bebop",
      name: "Bebop",
      bpm: 220,
      kit: "jazzDrums",
      perBeat: 3,
      rows: {
        ride: "x.. x.x x.. x.x x.. x.x x.. x.x",
        closedHat: "... x.. ... x.. ... x.. ... x..",
        snare: "..o ... ..o ... ... ..o ... ...",
        kick: "... ... ... ... ... ... ... ..X",
      },
    },
    {
      id: "brushSwing",
      name: "Brush swing",
      bpm: 120,
      kit: "jazzDrums",
      perBeat: 3,
      rows: {
        sweep: "x.. ... x.. ...",
        snare: "... x.o ... x.o",
        closedHat: "... x.. ... x..",
        kick: "o.. ... o.. ...",
      },
    },
    {
      id: "brushBallad",
      name: "Brush ballad",
      bpm: 64,
      kit: "jazzDrums",
      perBeat: 3,
      rows: {
        sweep: "x.. x.. x.. x..",
        snare: "... o.. ... o..",
        closedHat: "... x.. ... x..",
        kick: "o.. ... ... ...",
      },
    },
    {
      id: "waltz",
      name: "Jazz waltz",
      bpm: 160,
      kit: "jazzDrums",
      meter: { beats: 3, unit: 4 },
      perBeat: 3,
      rows: {
        ride: "x.. x.x x..",
        closedHat: "... x.. x..",
        kick: "o.. ... ...",
      },
    },
    {
      id: "jazzShuffle",
      name: "Jazz shuffle",
      bpm: 120,
      kit: "jazzDrums",
      perBeat: 3,
      rows: {
        ride: "x.x x.x x.x x.x",
        snare: "..o x.. ..o x..",
        closedHat: "... x.. ... x..",
        kick: "x.. ... x.. ...",
      },
    },
    {
      id: "secondLine",
      name: "Second line",
      bpm: 104,
      kit: "jazzDrums",
      rows: {
        kick: "x... ..x. ..x. ....",
        snare: "o.oo X.o. o.oo X.o.",
        closedHat: ".... x... .... x...",
      },
    },
  ]),
  ...styled("Latin and reggae", [
    {
      // The Brazilian clave on the rim, over two bars.
      id: "bossa",
      name: "Bossa nova",
      bpm: 132,
      kit: "jazzDrums",
      rows: {
        kick: "x..x x... x..x x... x..x x... x..x x...",
        stick: "x... ..x. .... x... .... x... ..x. ....",
        ride: "x.x. x.x. x.x. x.x. x.x. x.x. x.x. x.x.",
      },
    },
    {
      id: "samba",
      name: "Samba",
      bpm: 100,
      kit: "drums",
      rows: {
        kick: "x..x X..x x..x X..x",
        stick: "..x. .x.x ..x. .x.x",
        tambourine: "xxxX xxxX xxxX xxxX",
      },
    },
    {
      id: "chaCha",
      name: "Cha-cha",
      bpm: 120,
      kit: "drums",
      rows: {
        cowbell: "x... x... x... x...",
        kick: "x... .... x... ....",
        stick: ".... x... .... x...",
        lowTom: ".... .... .... x.x.",
      },
    },
    {
      // The son clave, 3-2, and the bass's tumbao on the kick.
      id: "mambo",
      name: "Mambo",
      bpm: 108,
      kit: "drums",
      rows: {
        cowbell: "x... x... x... x...",
        stick: "x..x ..x. ..x. x...",
        kick: ".... ..x. .... x...",
      },
    },
    {
      // The bembé bell, its twelve pulses spaced by the dotted quarter.
      id: "afroCuban",
      name: "Afro-Cuban 6/8",
      bpm: 300,
      kit: "jazzDrums",
      meter: { beats: 12, unit: 8 },
      perBeat: 2,
      rows: {
        bell: "x...x. ..x.x. ..x... x...x.",
        kick: "o..... o..... o..... o.....",
        closedHat: "...... x..... ...... x.....",
      },
    },
    {
      // Dembow.
      id: "reggaeton",
      name: "Reggaeton",
      bpm: 95,
      kit: "drums808",
      rows: {
        kick: "x... x... x... x...",
        snare: "...x ..x. ...x ..x.",
        closedHat: "x.x. x.x. x.x. x.x.",
      },
    },
    {
      id: "oneDrop",
      name: "One drop",
      bpm: 76,
      kit: "drums",
      perBeat: 3,
      rows: {
        kick: "... ... x.. ...",
        stick: "... ... x.. ...",
        closedHat: "x.x x.x x.x x.x",
      },
    },
  ]),
  ...styled("Hip hop", [
    {
      id: "boomBap",
      name: "Boom bap",
      bpm: 90,
      kit: "drums",
      rows: {
        kick: "x..x .... ..x. ....",
        snare: ".... x... .... x...",
        closedHat: "x.x. x.x. x.x. x.x.",
      },
    },
    {
      id: "trap",
      name: "Trap",
      bpm: 140,
      kit: "drums808",
      rows: {
        kick: "x... ...x ..x. ....",
        clap: ".... .... x... ....",
        closedHat: "xxxx xxxx xxxx xxxx",
        openHat: ".... .... .... ..x.",
      },
    },
    {
      // Lazy, swung sixteenths on a sextuplet grid.
      id: "loFi",
      name: "Lo-fi",
      bpm: 80,
      kit: "drums",
      perBeat: 6,
      rows: {
        kick: "x..... ...... ...x.. ......",
        snare: "...... x..... ...... x.....",
        closedHat: "x.ox.o x.ox.o x.ox.o x.ox.o",
      },
    },
    {
      id: "drill",
      name: "Drill",
      bpm: 142,
      kit: "drums808",
      perBeat: 6,
      rows: {
        kick: "x..... ....x. ...... ..x...",
        snare: "...... ...... x..... ....x.",
        closedHat: "x.x.x. x...x. x.x.x. x.x.x.",
      },
    },
    {
      id: "miami",
      name: "Miami bass",
      bpm: 128,
      kit: "drums808",
      rows: {
        kick: "x... ..x. ..x. ..x.",
        clap: ".... x... .... x...",
        closedHat: "x.x. x.x. x.x. x.x.",
        lowTom: ".... .... ..x. ....",
      },
    },
  ]),
  ...styled("Electronic", [
    {
      id: "house",
      name: "House",
      bpm: 124,
      kit: "drums909",
      rows: {
        kick: "x... x... x... x...",
        clap: ".... x... .... x...",
        openHat: "..x. ..x. ..x. ..x.",
      },
    },
    {
      id: "techno",
      name: "Techno",
      bpm: 132,
      kit: "drums909",
      rows: {
        kick: "x... x... x... x...",
        clap: ".... x... .... x...",
        closedHat: "xxXx xxXx xxXx xxXx",
        ride: "..x. ..x. ..x. ..x.",
      },
    },
    {
      id: "garage",
      name: "UK garage",
      bpm: 132,
      kit: "drums909",
      rows: {
        kick: "x... .... ..x. ....",
        clap: ".... x... .... x...",
        closedHat: "x.xx .x.x x.x. x.xx",
      },
    },
    {
      id: "breakbeat",
      name: "Breakbeat",
      bpm: 130,
      kit: "drums909",
      rows: {
        kick: "x... .... ..x. ....",
        snare: ".... x..x .x.. x...",
        closedHat: "x.x. x.x. x.x. x.x.",
      },
    },
    {
      id: "electro",
      name: "Electro",
      bpm: 125,
      kit: "drums808",
      rows: {
        kick: "x... ..x. ..x. ....",
        clap: ".... x... .... x...",
        closedHat: "xxxx xxxx xxxx xxxx",
        cowbell: "...x .... ..x. ....",
      },
    },
  ]),
  ...styled("South Asian", [
    {
      id: "teentaal",
      name: "Teentaal",
      bpm: 120,
      kit: "tabla",
      perBeat: 2,
      rows: strokes(
        [
          "dha",
          "dhin",
          "dhin",
          "dha",
          "dha",
          "dhin",
          "dhin",
          "dha",
          "dha",
          "tin",
          "tin",
          "na",
          "na",
          "dhin",
          "dhin",
          "dha",
        ],
        2,
      ),
    },
    {
      id: "keherwa",
      name: "Keherwa",
      bpm: 96,
      kit: "tabla",
      perBeat: 2,
      rows: strokes(["dha", "ge", "na", "te", "na", "ke", "dhin", "na"], 1),
    },
    {
      id: "dadra",
      name: "Dadra",
      bpm: 200,
      kit: "tabla",
      meter: { beats: 6, unit: 8 },
      perBeat: 2,
      rows: strokes(["dha", "dhin", "na", "dha", "tin", "na"], 2),
    },
    {
      id: "rupak",
      name: "Rupak",
      bpm: 180,
      kit: "tabla",
      meter: { beats: 7, unit: 8 },
      perBeat: 2,
      rows: strokes(["tin", "tin", "na", "dhin", "na", "dhin", "na"], 2),
    },
    {
      id: "jhaptaal",
      name: "Jhaptaal",
      bpm: 132,
      kit: "tabla",
      meter: { beats: 5, unit: 4 },
      perBeat: 2,
      rows: strokes(
        ["dhin", "na", "dhin", "dhin", "na", "tin", "na", "dhin", "dhin", "na"],
        2,
      ),
    },
    {
      id: "jhyaure",
      name: "Jhyaure",
      bpm: 210,
      kit: "madal",
      meter: { beats: 6, unit: 8 },
      perBeat: 2,
      rows: strokes(["dha", "ti", "ta", "dhin", "ti", "ta"], 2),
    },
    {
      id: "madalFour",
      name: "Folk four",
      bpm: 110,
      kit: "madal",
      perBeat: 2,
      rows: {
        dha: "x...............",
        ti: "..x...x...x...x.",
        ta: "....x.......x...",
        dhin: "........x.......",
        ka: "..............x.",
      },
    },
  ]),
];

// How many steps a bar of the beat holds.
const stepsPerBar = ({ meter, perBeat }: DrumBeat) => meter.beats * perBeat;

// The beat as the drum grid's pattern.
export function beatPattern(beat: DrumBeat): StepPattern {
  const rows = Object.entries(beat.rows).map(
    ([piece, row]) => [piece as DrumPieceId, row.replaceAll(" ", "")] as const,
  );
  const length = Math.max(...rows.map(([, row]) => row.length));
  const hits: StepHit[] = rows.flatMap(([piece, row]) =>
    [...row].flatMap((mark, step) =>
      mark in VELOCITY
        ? [{ piece, beat: step / beat.perBeat, velocity: VELOCITY[mark] }]
        : [],
    ),
  );
  return {
    perBeat: beat.perBeat,
    bars: Math.max(1, Math.ceil(length / stepsPerBar(beat))),
    hits,
  };
}

// The beat as the drum grid will play it, on its kit at its tempo, played
// round for PREVIEW_BARS: what the preview tape auditions.
export function beatPreview(beat: DrumBeat): Take {
  const pattern = beatPattern(beat);
  const pass = patternTake(pattern, beat.kit, beat.meter, beat.bpm);
  const times = Math.ceil(PREVIEW_BARS / pattern.bars);
  return {
    notes: Array.from({ length: times }, (_, time) =>
      pass.notes.map((note) => ({
        ...note,
        start: note.start + time * pass.length,
      })),
    ).flat(),
    length: times * pass.length,
    bpm: beat.bpm,
  };
}
