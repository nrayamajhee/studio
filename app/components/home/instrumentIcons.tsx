import type { ComponentType, SVGProps } from "react";
import { Bell, Drum, Hand } from "lucide-react";
import type { DrumPieceId } from "../../lib/physical";
import type { ChordStyleId } from "./chordStyles";

// Stroke icons in the lucide style for instruments and drum pieces lucide
// doesn't cover.
const base = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

// Scroll and neck over a waisted body with f-holes; the bow stands beside it.
export function ViolinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M13 2.5v5" />
      <path d="M11.3 7.5c-1.7 0-2.3 1.4-1.8 2.7.3.9 1.1 1.2 1.1 1.9s-1.9 1.1-1.9 3.4c0 2.3 1.7 3.9 4.3 3.9s4.3-1.6 4.3-3.9c0-2.3-1.9-2.7-1.9-3.4s.8-1 1.1-1.9c.5-1.3-.1-2.7-1.8-2.7z" />
      <path d="M11.6 14.2v2" />
      <path d="M14.4 14.2v2" />
      <path d="M4 21.5 6.5 3" />
    </svg>
  );
}

// A solid body with two pointed horns, a long neck and two pickups.
export function ElectricGuitarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 2v9.5" />
      <path d="M9.6 12.2 7.4 9.8c-1.4.4-2.1 1.7-1.7 3.1.3 1 1 1.5 1 2.4 0 1.1-1.4 1.8-1.4 3.4 0 1.9 1.9 3.3 4.2 3.3h5c2.3 0 4.2-1.4 4.2-3.3 0-1.6-1.4-2.3-1.4-3.4 0-.9.7-1.4 1-2.4.4-1.4-.3-2.7-1.7-3.1l-2.2 2.4" />
      <path d="M10 15.5h4" />
      <path d="M10 18.5h4" />
    </svg>
  );
}

// A classical guitar standing upright: round soundhole and a tie-block bridge.
export function NylonGuitarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 2v7.5" />
      <path d="M12 9.5c-2.2 0-3.5 1.2-3.5 2.8 0 1.2.8 1.7.8 2.4s-1.8 1.2-1.8 3.4c0 2.3 2 3.9 4.5 3.9s4.5-1.6 4.5-3.9c0-2.2-1.8-2.7-1.8-3.4s.8-1.2.8-2.4c0-1.6-1.3-2.8-3.5-2.8z" />
      <circle cx="12" cy="15" r="1.3" />
      <path d="M10.5 19h3" />
    </svg>
  );
}

// A cello: rounded shoulders, f-holes and an endpin, no bow.
export function CelloIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 1.5v5" />
      <path d="M12 6.5c-2.6 0-3.6 1.4-3.6 2.9 0 1.2 1.2 1.8 1.2 2.6s-2.4 1.4-2.4 4.1c0 2.6 2.1 4.4 4.8 4.4s4.8-1.8 4.8-4.4c0-2.7-2.4-3.3-2.4-4.1s1.2-1.4 1.2-2.6c0-1.5-1-2.9-3.6-2.9z" />
      <path d="M10.4 14v2.4" />
      <path d="M13.6 14v2.4" />
      <path d="M12 20.5v2" />
    </svg>
  );
}

// A harp: the column, the curved neck and the slanted soundboard, strung.
export function HarpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M5 21V4.5" />
      <path d="M5 4.5c2.5-1.8 4.5.8 7.5-.3s4-2 6.5-1.2" />
      <path d="M6 21 19 3" />
      <path d="M4 21h4" />
      <path d="M8.5 5v11" />
      <path d="M12 4.4v7.2" />
      <path d="M15.5 3.6v3.6" />
    </svg>
  );
}

// A trumpet: mouthpiece, three valves over the leadpipe, a loop of tubing
// below and the flared bell.
export function TrumpetIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M2 8.5v3" />
      <path d="M2 10h12.5" />
      <path d="M14.5 9c3 0 4.8-1.9 7-3.5v9c-2.2-1.6-4-3.5-7-3.5" />
      <path d="M6 10v3.5c0 .8.6 1.5 1.5 1.5h7v-3" />
      <path d="M8 6.5V10" />
      <path d="M10.5 6.5V10" />
      <path d="M13 6.5V10" />
    </svg>
  );
}

// A bass trumpet: the trumpet's valves and loop, a longer wrap and a wider
// bell turned up.
export function BassTrumpetIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M2 11.5v3" />
      <path d="M2 13h11" />
      <path d="M13 12c2.6-.6 4-3 4.8-6.5L22 7.5c-1.4 3.4-3.7 6.6-8.4 7.4" />
      <path d="M5 13v4c0 .8.6 1.5 1.5 1.5H14V15" />
      <path d="M7 9.5V13" />
      <path d="M9.5 9.5V13" />
      <path d="M12 9.5V13" />
    </svg>
  );
}

// A trombone: the slide's long U in front, the bell section over it.
export function TromboneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4 9.5h11" />
      <path d="M14.5 8.5c3 0 4.8-1.8 7-3.3v8.6c-2.2-1.5-4-3.3-7-3.3" />
      <path d="M4 9.5c-1.4 0-2 .8-2 2s.6 2 2 2h10" />
      <path d="M7 9.5v4" />
      <path d="M14 12.5v2" />
    </svg>
  );
}

// A clarinet standing up: mouthpiece and ligature, the straight body with a
// few keys, and the flared bell.
export function ClarinetIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M11 2h2" />
      <path d="M12 2v15" />
      <path d="M10.8 5h2.4" />
      <path d="M14 9h1" />
      <path d="M14 12.5h1" />
      <path d="M9 10.5h1" />
      <path d="M12 17c0 2-2 3.5-3 4.5h6c-1-1-3-2.5-3-4.5" />
    </svg>
  );
}

// A sitar: the gourd at the foot of a long fretted neck, the small upper
// gourd behind its head.
export function SitarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 2v12.5" />
      <circle cx="12" cy="18.5" r="4" />
      <circle cx="14.6" cy="4.2" r="1.7" />
      <path d="M10.5 7h3" />
      <path d="M10.5 10h3" />
      <path d="M10.5 13h3" />
    </svg>
  );
}

// A harmonium: the folded bellows behind a keyboard on its case.
export function HarmoniumIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4 9 6 5l2 4 2-4 2 4 2-4 2 4 2-4 2 4" />
      <rect x="3" y="9" width="18" height="11" rx="1.5" />
      <path d="M3 14h18" />
      <path d="M7.5 9v2.5" />
      <path d="M11 9v2.5" />
      <path d="M16.5 9v2.5" />
    </svg>
  );
}

// A harmonica: the covers over a comb, its holes in a row.
export function HarmonicaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="2" y="8" width="20" height="8" rx="2" />
      <path d="M2 11h20" />
      <path d="M6 13v1" />
      <path d="M10 13v1" />
      <path d="M14 13v1" />
      <path d="M18 13v1" />
    </svg>
  );
}

// A ukulele: a small waisted body with a round soundhole on a short neck.
export function UkuleleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3v8" />
      <path d="M12 11c-1.8 0-2.8 1-2.8 2.2 0 .9.6 1.3.6 1.9s-1.4 1-1.4 2.6c0 1.8 1.6 3.1 3.6 3.1s3.6-1.3 3.6-3.1c0-1.6-1.4-2-1.4-2.6s.6-1 .6-1.9c0-1.2-1-2.2-2.8-2.2z" />
      <circle cx="12" cy="15.8" r="1" />
      <path d="M11 3h2" />
    </svg>
  );
}

// A banjo: a round drumhead body with its bridge, a long neck and the short
// fifth string's peg partway up.
export function BanjoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 2v8.5" />
      <circle cx="12" cy="16" r="5.5" />
      <path d="M10.5 17.5h3" />
      <path d="M12.5 6.5h2" />
    </svg>
  );
}

// A xylophone: bars shortening up the scale, and a mallet.
export function XylophoneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4 4v13" />
      <path d="M8 5.5v10" />
      <path d="M12 7v7" />
      <path d="M16 8.5v4" />
      <path d="m13 21 6-6" />
      <circle cx="20.5" cy="13.5" r="1.5" />
    </svg>
  );
}

// A steel pan from above: the round face with its hammered note domes.
export function SteelPanIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="7.2" rx="2.2" ry="1.6" />
      <ellipse cx="7.6" cy="12.6" rx="1.6" ry="2.2" />
      <ellipse cx="16.4" cy="12.6" rx="1.6" ry="2.2" />
      <circle cx="12" cy="15.8" r="1.4" />
    </svg>
  );
}

// A kalimba: a box with a row of tines over the bridge, longest in the middle.
export function KalimbaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4" width="18" height="17" rx="3" />
      <path d="M6 8h12" />
      <path d="M8 8v5" />
      <path d="M10 8v7" />
      <path d="M12 8v8.5" />
      <path d="M14 8v7" />
      <path d="M16 8v5" />
    </svg>
  );
}

// The take: notes falling down the piano roll out of step, the tracks icon's
// staggered bars stood on end.
export function RollIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M5 6v12" />
      <path d="M12 4v10" />
      <path d="M19 12v8" />
    </svg>
  );
}

// How a chord style plays, as a little piano roll: a bar a note, time to
// the right and pitch upwards, [from, to, height].
const STYLE_NOTES: Readonly<Record<ChordStyleId, readonly number[][]>> = {
  block: [
    [5, 19, 17],
    [5, 19, 12],
    [5, 19, 7],
  ],
  pulse: [3, 8.5, 14, 19.5].flatMap((x) => [
    [x, x + 1.5, 17],
    [x, x + 1.5, 12],
    [x, x + 1.5, 7],
  ]),
  strum: [
    [4, 19, 17],
    [8, 19, 12],
    [12, 19, 7],
  ],
  up: [
    [4, 8, 17],
    [10, 14, 12],
    [16, 20, 7],
  ],
  down: [
    [4, 8, 7],
    [10, 14, 12],
    [16, 20, 17],
  ],
  upDown: [
    [3, 5, 17],
    [8, 10, 12],
    [13, 15, 7],
    [18, 20, 12],
  ],
  broken: [
    [4, 9, 17],
    [13, 20, 12],
    [13, 20, 7],
  ],
  alberti: [
    [3, 5, 17],
    [8, 10, 7],
    [13, 15, 12],
    [18, 20, 7],
  ],
};

export function ChordStyleIcon({
  pattern,
  ...props
}: SVGProps<SVGSVGElement> & { pattern: ChordStyleId }) {
  return (
    <svg {...base} {...props}>
      {STYLE_NOTES[pattern].map(([from, to, y]) => (
        <path key={`${from}-${y}`} d={`M${from} ${y}H${to}`} />
      ))}
    </svg>
  );
}

// A tabla pair from the side: the bowl-shaped bayan and the taller dayan.
export function TablaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <ellipse cx="7.5" cy="10" rx="5" ry="1.6" />
      <path d="M2.5 10c0 5.4 2.2 9.5 5 9.5s5-4.1 5-9.5" />
      <ellipse cx="17.5" cy="7" rx="3.5" ry="1.2" />
      <path d="M14 7v11c0 1 1.6 1.8 3.5 1.8S21 19 21 18V7" />
    </svg>
  );
}

// A madal lying on its side: a barrel with a head at each end, laced across.
export function MadalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <ellipse cx="4.5" cy="12" rx="1.8" ry="4.5" />
      <ellipse cx="19.5" cy="12" rx="1.5" ry="3.8" />
      <path d="M4.5 7.5c5-1.4 10-1.4 15 .7" />
      <path d="M4.5 16.5c5 1.4 10 1.4 15-.7" />
      <path d="m7.5 7.6 2.5 8.8 2.5-8.8 2.5 8.8 2.5-8.6" />
    </svg>
  );
}

// An envelope: attack up, decay down, a sustain plateau, release to zero.
export function AdsrIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M2 19 7.5 5l4 7H17l5 7" />
    </svg>
  );
}

// One cycle of a sine running into one of a square.
export function OscillatorIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M2 12C3.5 5 6.5 5 8 12s4.5 7 6 0V6h4v12h4v-6" />
    </svg>
  );
}

// Taller body with sloped shoulders on an endpin, no bow.
export function UprightBassIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 1.5v4.5" />
      <path d="M10.5 6c-1.4.5-2.6 1.6-2.6 3.3 0 1 .8 1.6.8 2.4s-2.2 1.3-2.2 4c0 2.6 2.4 4.3 5.5 4.3s5.5-1.7 5.5-4.3c0-2.7-2.2-3.2-2.2-4s.8-1.4.8-2.4c0-1.7-1.2-2.8-2.6-3.3z" />
      <path d="M10.3 13v2.6" />
      <path d="M13.7 13v2.6" />
      <path d="M12 20v2.5" />
    </svg>
  );
}

// Bass drum from the front: head, beater patch and two feet.
export function KickIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="11" r="8" />
      <circle cx="12" cy="11" r="2.5" />
      <path d="m7 18-2 4" />
      <path d="m17 18 2 4" />
    </svg>
  );
}

// A deep drum: head on top, shell below.
export function LowTomIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <ellipse cx="12" cy="6.5" rx="8" ry="3" />
      <path d="M4 6.5v10c0 1.7 3.6 3 8 3s8-1.3 8-3v-10" />
    </svg>
  );
}

// The same drum, smaller and shallower.
export function HighTomIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <ellipse cx="12" cy="9" rx="5.5" ry="2.2" />
      <path d="M6.5 9v5.5c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2V9" />
    </svg>
  );
}

// Two cymbals clamped shut into one lens, on a stand.
export function ClosedHatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M3 10c3-3.5 15-3.5 18 0-3 3.5-15 3.5-18 0z" />
      <path d="M12 13v8" />
      <path d="M8 21h8" />
    </svg>
  );
}

// Two cymbals held apart, on a stand.
export function OpenHatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M3 6.5c3-3 15-3 18 0" />
      <path d="M3 12c3 3 15 3 18 0" />
      <path d="M12 14.5V21" />
      <path d="M8 21h8" />
    </svg>
  );
}

// One tilted cymbal on a stand.
export function CrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <ellipse cx="12" cy="8" rx="9.5" ry="2.5" transform="rotate(-14 12 8)" />
      <path d="M12 10.5V21" />
      <path d="M8 21h8" />
    </svg>
  );
}

// What each key shows when a kit is selected: an icon, or for hand-drum
// strokes their syllable.
export const DRUM_PIECES: Readonly<
  Record<DrumPieceId, { name: string; Icon?: ComponentType }>
> = {
  kick: { name: "Kick", Icon: KickIcon },
  snare: { name: "Snare", Icon: Drum },
  lowTom: { name: "Low tom", Icon: LowTomIcon },
  highTom: { name: "High tom", Icon: HighTomIcon },
  clap: { name: "Clap", Icon: Hand },
  crash: { name: "Crash", Icon: CrashIcon },
  cowbell: { name: "Cowbell", Icon: Bell },
  closedHat: { name: "Closed hat", Icon: ClosedHatIcon },
  openHat: { name: "Open hat", Icon: OpenHatIcon },
  na: { name: "Na" },
  ta: { name: "Ta" },
  tin: { name: "Tin" },
  tun: { name: "Tun" },
  te: { name: "Te" },
  ti: { name: "Ti" },
  ge: { name: "Ge" },
  ke: { name: "Ke" },
  ka: { name: "Ka" },
  dha: { name: "Dha" },
  dhin: { name: "Dhin" },
};
