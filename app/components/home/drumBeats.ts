import type { DrumPieceId, KitId } from "../../lib/physical";
import type { Meter } from "./noteRecorder";
import type { StepHit, StepPattern } from "./stepPattern";

export type BeatStyle =
  | "Rock"
  | "Pop"
  | "Funk and soul"
  | "Jazz"
  | "Latin and reggae"
  | "Hip hop"
  | "Electronic"
  | "South Asian";

// A drum beat for the drum grid, on the kit that suits it: each row a piece,
// a character a step (X accented, x played, o a ghost note, . rest; spaces
// only mark the beats), in `meter` at `perBeat` steps a beat, over as many
// bars as the rows run.
export type DrumBeat = {
  id: string;
  name: string;
  style: BeatStyle;
  kit: KitId;
  meter: Meter;
  perBeat: number;
  rows: Partial<Record<DrumPieceId, string>>;
};

type BeatSpec = Omit<DrumBeat, "style" | "meter" | "perBeat"> &
  Partial<Pick<DrumBeat, "meter" | "perBeat">>;

const FOUR: Meter = { beats: 4, unit: 4 };
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
      kit: "tabla",
      perBeat: 2,
      rows: strokes(["dha", "ge", "na", "te", "na", "ke", "dhin", "na"], 1),
    },
    {
      id: "dadra",
      name: "Dadra",
      kit: "tabla",
      meter: { beats: 6, unit: 8 },
      perBeat: 2,
      rows: strokes(["dha", "dhin", "na", "dha", "tin", "na"], 2),
    },
    {
      id: "rupak",
      name: "Rupak",
      kit: "tabla",
      meter: { beats: 7, unit: 8 },
      perBeat: 2,
      rows: strokes(["tin", "tin", "na", "dhin", "na", "dhin", "na"], 2),
    },
    {
      id: "jhaptaal",
      name: "Jhaptaal",
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
      kit: "madal",
      meter: { beats: 6, unit: 8 },
      perBeat: 2,
      rows: strokes(["dha", "ti", "ta", "dhin", "ti", "ta"], 2),
    },
    {
      id: "madalFour",
      name: "Folk four",
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
