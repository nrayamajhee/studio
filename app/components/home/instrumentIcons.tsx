import type { SVGProps } from "react";

// Stroke icons in the lucide style for instruments lucide doesn't cover.
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
