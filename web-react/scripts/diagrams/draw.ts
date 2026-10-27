// Box-and-arrow diagrams for the docs, drawn as SVG on a transparent
// background. Each diagram is drawn twice, once per palette, so the docs
// route can swap the dark twin in with the theme.

export type Tone = "ink" | "muted" | "faint" | "green" | "blue" | "red";

export type Palette = Record<Tone, string>;

// Picked against the docs' paper: #d6d5d0 in the light theme, #2a2a2d in
// the dark.
export const PALETTES = {
  light: {
    ink: "#171615",
    muted: "#4f4d48",
    faint: "#8b8880",
    green: "#1d7346",
    blue: "#1d4fd0",
    red: "#b3372a",
  },
  dark: {
    ink: "#f3f2ee",
    muted: "#bab8b2",
    faint: "#77756f",
    green: "#6fcf97",
    blue: "#8ab4f8",
    red: "#f28b7d",
  },
} satisfies Record<string, Palette>;

export type Point = [x: number, y: number];

export type TextOptions = {
  tone?: Tone;
  size?: number;
  anchor?: "start" | "middle" | "end";
  weight?: number;
  mono?: boolean;
  lineHeight?: number;
};

export type BoxOptions = {
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
  lines?: string[];
  tone?: Tone;
  // A tint of the tone behind it, for the box the diagram is about.
  filled?: boolean;
  // Greyed out: a stage that only some instruments have.
  dim?: boolean;
  // The title in monospace, for names from the code.
  mono?: boolean;
  // The title alone, in the middle of the box.
  center?: boolean;
};

export type LineOptions = {
  tone?: Tone;
  dashed?: boolean;
  width?: number;
};

export type ArrowOptions = LineOptions & {
  // A head at the start too.
  both?: boolean;
};

export type Canvas = {
  text: (
    x: number,
    y: number,
    content: string | string[],
    options?: TextOptions,
  ) => void;
  box: (options: BoxOptions) => void;
  line: (points: Point[], options?: LineOptions) => void;
  arrow: (points: Point[], options?: ArrowOptions) => void;
  circle: (x: number, y: number, r: number, label: string, tone?: Tone) => void;
  rect: (
    x: number,
    y: number,
    w: number,
    h: number,
    tone?: Tone,
    filled?: boolean,
  ) => void;
};

export type Diagram = {
  // Written to public/docs/<folder>/diagram-<name>.svg and .dark.svg.
  name: string;
  width: number;
  height: number;
  draw: (canvas: Canvas) => void;
};

const SANS =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const MONO =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

// Diagrams are drawn 860 wide and shown a little narrower in the docs, so
// their type is set a size up.
const TEXT_SCALE = 1.1;

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const HEAD = 9;

const arrowHead = ([x0, y0]: Point, [x1, y1]: Point) => {
  const angle = Math.atan2(y1 - y0, x1 - x0);
  const corner = (turn: number): Point => [
    x1 - HEAD * Math.cos(angle + turn),
    y1 - HEAD * Math.sin(angle + turn),
  ];
  return [corner(0.45), [x1, y1] as Point, corner(-0.45)];
};

// Pulls a line's end back so its stroke stops under the arrow's tip.
const shorten = ([x0, y0]: Point, [x1, y1]: Point, by: number): Point => {
  const length = Math.hypot(x1 - x0, y1 - y0) || 1;
  return [x1 - ((x1 - x0) / length) * by, y1 - ((y1 - y0) / length) * by];
};

const path = (points: Point[]) =>
  points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");

export function render(diagram: Diagram, palette: Palette) {
  const parts: string[] = [];

  const text: Canvas["text"] = (x, y, content, options = {}) => {
    const {
      tone = "ink",
      size = 14,
      anchor = "start",
      weight = 400,
      mono = false,
      lineHeight = size * 1.45,
    } = options;
    const lines = Array.isArray(content) ? content : [content];
    const spans = lines
      .map(
        (line, i) =>
          `<tspan x="${x}" dy="${i ? lineHeight : 0}">${escape(line) || "&#160;"}</tspan>`,
      )
      .join("");
    parts.push(
      `<text x="${x}" y="${y}" fill="${palette[tone]}" font-family='${mono ? MONO : SANS}' font-size="${size * TEXT_SCALE}" font-weight="${weight}" text-anchor="${anchor}">${spans}</text>`,
    );
  };

  const rect: Canvas["rect"] = (x, y, w, h, tone = "ink", filled = false) => {
    parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${filled ? palette[tone] : "none"}" fill-opacity="${filled ? 0.12 : 0}" stroke="${palette[tone]}" stroke-width="1.5"/>`,
    );
  };

  const box: Canvas["box"] = ({
    x,
    y,
    w,
    h,
    title,
    lines = [],
    tone = "ink",
    filled = false,
    dim = false,
    mono = false,
    center = false,
  }) => {
    const stroke = dim ? "faint" : tone;
    rect(x, y, w, h, stroke, filled);
    if (title && center)
      text(x + w / 2, y + h / 2 + 5, title, {
        tone: dim ? "muted" : tone,
        size: 15,
        weight: 600,
        anchor: "middle",
        mono,
      });
    else if (title)
      text(x + 16, y + 27, title, {
        tone: dim ? "muted" : tone,
        size: 15,
        weight: 600,
        mono,
      });
    if (lines.length)
      text(x + 16, y + (title ? 50 : 27), lines, { tone: "muted", size: 13.5 });
  };

  const line: Canvas["line"] = (points, options = {}) => {
    const { tone = "muted", dashed = false, width = 1.5 } = options;
    parts.push(
      `<path d="${path(points)}" fill="none" stroke="${palette[tone]}" stroke-width="${width}" stroke-linejoin="round"${dashed ? ' stroke-dasharray="6 5"' : ""}/>`,
    );
  };

  const head = (from: Point, to: Point, tone: Tone) =>
    parts.push(
      `<path d="${path(arrowHead(from, to))} Z" fill="${palette[tone]}" stroke="${palette[tone]}" stroke-width="1" stroke-linejoin="round"/>`,
    );

  const arrow: Canvas["arrow"] = (points, options = {}) => {
    const { tone = "muted", both = false } = options;
    const n = points.length;
    const trimmed = [...points];
    trimmed[n - 1] = shorten(points[n - 2], points[n - 1], HEAD * 0.8);
    if (both) trimmed[0] = shorten(points[1], points[0], HEAD * 0.8);
    line(trimmed, options);
    head(points[n - 2], points[n - 1], tone);
    if (both) head(points[1], points[0], tone);
  };

  const circle: Canvas["circle"] = (x, y, r, label, tone = "ink") => {
    parts.push(
      `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${palette[tone]}" stroke-width="1.5"/>`,
    );
    text(x, y + 5, label, { tone, size: 15, anchor: "middle", weight: 600 });
  };

  diagram.draw({ text, box, line, arrow, circle, rect });

  const { width, height } = diagram;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    ...parts.map((part) => `  ${part}`),
    "</svg>",
    "",
  ].join("\n");
}
