import type { ComponentType, SVGProps } from "react";
import { Bell, Drum, Hand } from "lucide-react";
import type { DrumPieceId } from "../../lib/physical";

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

// An envelope: attack up, decay down, a sustain plateau, release to zero.
export function AdsrIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M2 19 7.5 5l4 7H17l5 7" />
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

// What each key shows when a kit is selected.
export const DRUM_PIECES: Readonly<
  Record<DrumPieceId, { name: string; Icon: ComponentType }>
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
};
