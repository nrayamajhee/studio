import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Asterisk, ChevronLeft, ChevronRight } from "lucide-react";
import { tv } from "../../lib/utils";
import { Button } from "../design-system/Button";
import { NoteRoll } from "./NoteRoll";
import { Oscilloscope } from "./Oscilloscope";
import { DEFAULT_TIMING, type Timing } from "./noteRecorder";
import type { TrackClip } from "./tracks";
import type { RollFrame } from "../../hooks/useTransport";
import { keepFocus } from "../design-system";

export type ScreenView =
  | "scope"
  | "synth"
  | "save"
  | "presets"
  | "chords"
  | "chordStyle"
  | "progressions"
  | "beats"
  | "album"
  | "revert"
  | "adsr"
  | "lfo"
  | "fx"
  | "tempo"
  | "roll"
  | "steps"
  | "tracks";

export type ScreenParam = {
  id: string;
  label: string;
  value: string;
  // The param the red and blue knobs are editing.
  selected?: boolean;
};

export type ScreenTile = {
  id: string;
  label: string;
  icon: ReactNode;
  // Small caption on the tile, e.g. the pads a preset is bound to.
  badge?: string;
};

// One module knob's reading, in knob order (white, green, red, blue).
export type ScreenReadout = {
  label: string;
  display: string;
  // 0–1: the knob position (the level, for the ADSR's sustain).
  amount: number;
};

// Module readouts in the colours of the knobs that set them.
const KNOB_COLORS = [
  "var(--color-screen-ink)",
  "var(--color-synth-green)",
  "var(--color-synth-red)",
  "var(--color-synth-blue)",
];

// The module views' graph over their four readouts. The FX stages are four
// columns, arrows joining drive, chorus and delay, which run in series; the
// reverb is fed separately by each instrument's send.
const moduleView = tv({
  slots: {
    graph: "min-h-0 w-full flex-1 overflow-hidden",
    wave: "animate-[lfo-scroll_var(--lfo-period)_linear_infinite] motion-reduce:animate-none",
    meters: "grid min-h-0 flex-1 grid-cols-4 gap-[18px]",
    stage: "relative flex justify-center",
    track:
      "relative h-full w-[56px] overflow-hidden rounded-[6px] bg-screen-ink/8",
    fill: "absolute inset-x-0 bottom-0 rounded-[6px]",
  },
  variants: {
    arrow: {
      true: {
        stage:
          "after:absolute after:top-1/2 after:-right-[14px] after:-translate-y-1/2 after:font-screen after:text-[12px] after:text-screen-ink/30 after:content-['→']",
      },
    },
  },
});
const graph = moduleView();

// Drawn across a fixed 100 × 40 box: attack, decay and release widen with their
// knobs, sustain fills the rest at its level, and decay and release curve like
// the engine's exponential segments. A zero attack rises straight up; decay and
// release never reach zero, so they always curve. Both ends sit inside the box
// so their strokes aren't clipped.
function EnvelopeGraph({ stages }: { stages: readonly ScreenReadout[] }) {
  const [attack, decay, sustain, release] = stages.map(({ amount }) => amount);
  const top = 2;
  const bottom = 38;
  const level = bottom - (bottom - top) * sustain;
  const x0 = 2;
  const x1 = x0 + 23 * attack;
  const x2 = x1 + 2 + 23 * decay;
  const x4 = 98;
  const x3 = x4 - (2 + 28 * release);
  const decayPath = `Q${x1} ${level} ${x2} ${level}`;
  const releasePath = `Q${x3} ${bottom} ${x4} ${bottom}`;
  const segments = [
    `M${x0} ${bottom} L${x1} ${top}`,
    `M${x1} ${top} ${decayPath}`,
    `M${x2} ${level} L${x3} ${level}`,
    `M${x3} ${level} ${releasePath}`,
  ];
  return (
    <svg
      className={graph.graph()}
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={`M${x0} ${bottom} L${x1} ${top} ${decayPath} L${x3} ${level} ${releasePath} Z`}
        style={{
          fill: "color-mix(in srgb, var(--color-screen-ink) 8%, transparent)",
        }}
      />
      {segments.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          style={{ stroke: KNOB_COLORS[i] }}
          strokeWidth={2.5}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

const LFO_CYCLE = 50;
const RANDOM_STEPS = [0.6, -0.35, 0.9, -0.8, 0.15, -0.55];

const lfoValue = (shape: number, x: number) => {
  const phase = (x / LFO_CYCLE) % 1;
  switch (shape) {
    case 0:
      return Math.sin(2 * Math.PI * phase);
    case 1:
      return 1 - 4 * Math.abs(phase - 0.5);
    case 2:
      return phase < 0.5 ? 1 : -1;
    default:
      return RANDOM_STEPS[Math.floor(x / LFO_CYCLE) % RANDOM_STEPS.length];
  }
};

// Two cycles of the LFO's shape across a 100 × 40 box, as tall as its depth,
// scrolling one cycle per LFO period (no faster than 10 Hz on screen).
function LfoGraph({
  shape,
  depth,
  rate,
}: {
  shape: number;
  depth: number;
  rate: number;
}) {
  const height = 17 * Math.max(0.08, depth);
  const points: string[] = [];
  for (let x = 0; x <= 3 * LFO_CYCLE; x += 0.5) {
    points.push(`${x} ${(20 - height * lfoValue(shape, x)).toFixed(2)}`);
  }
  return (
    <svg
      className={graph.graph()}
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0 20 H100"
        style={{
          stroke:
            "color-mix(in srgb, var(--color-screen-ink) 15%, transparent)",
        }}
        strokeDasharray="2 3"
        vectorEffect="non-scaling-stroke"
      />
      <path
        className={graph.wave()}
        style={
          {
            "--lfo-period": `${Math.max(1 / rate, 0.1)}s`,
            stroke: KNOB_COLORS[1],
          } as CSSProperties
        }
        d={`M${points.join(" L")}`}
        fill="none"
        strokeWidth={2.5}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// The FX stages left to right, each level as a bar in its knob colour.
function FxMeters({ stages }: { stages: readonly ScreenReadout[] }) {
  return (
    <div className={graph.meters()} aria-hidden="true">
      {stages.map((stage, i) => (
        <div key={stage.label} className={moduleView({ arrow: i < 2 }).stage()}>
          <div className={graph.track()}>
            <div
              className={graph.fill()}
              style={{
                height: `${Math.round(stage.amount * 100)}%`,
                background: KNOB_COLORS[i],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// A caption along the bottom of the screen; with `on`, a switch's name and
// then On or Off in a pill.
export type ScreenBadge = {
  label: string;
  on?: boolean;
};

// A row of the tracks view: its take's clip, where it starts on the timeline
// (beats), and whether it's muted, soloed and heard.
export type ScreenTrack = {
  id: string;
  name: string;
  // The preset that plays it.
  detail: string;
  color: string;
  start: number;
  clip: TrackClip;
  // 0–1, drawn as a red bar beside the lane.
  volume: number;
  muted: boolean;
  soloed: boolean;
  audible: boolean;
  // The take shown as a potential track: no mute or solo.
  potential?: boolean;
  // On the tape's row, the drum sequencer's pattern, drawn over the take
  // from the start: the tape's other half.
  pattern?: TrackClip;
};

// A track row: its name and flags, its volume strip, then its lane. Blue
// marks the track the blue knob picked, and keyboard focus is chalk. Muted
// or left out of a solo, the lane dims.
const trackRow = tv({
  slots: {
    base: "group relative grid min-h-0 cursor-pointer grid-cols-[168px_5px_minmax(0,1fr)] items-stretch justify-center gap-[8px] rounded-[6px] border border-transparent px-[4px] py-[3px] text-center text-screen-ink select-none aria-pressed:border-synth-blue focus-visible:border-screen-ink focus-visible:ring-2 focus-visible:ring-font-light focus-visible:ring-offset-2 focus-visible:outline-none aria-pressed:focus-visible:border-screen-ink",
    label: "flex min-w-0 items-center justify-between gap-[6px] text-left",
    name: "truncate text-[12px] leading-[15px] font-semibold tracking-[0.02em] first-letter:uppercase",
    number: "mr-[5px] text-screen-ink/55",
    flags: "flex gap-[3px] self-center",
    volume: "relative overflow-hidden rounded-[3px] bg-screen-ink/12",
    level: "absolute inset-x-0 bottom-0 rounded-[3px] bg-synth-red",
  },
  variants: {
    // The tape has no volume, but keeps the strip's column so its lane
    // lines up.
    potential: { true: { volume: "bg-transparent" } },
  },
});

// The studio's mute and solo buttons as pills: filled when on.
const flag = tv({
  base: "grid size-[18px] place-items-center rounded-[4px] border border-screen-ink/30 text-[12px] leading-none font-bold text-screen-ink/55",
  variants: {
    on: { true: "border-screen-ink bg-screen-ink text-screen" },
  },
});

// The lane is a window on the timeline; zoomed in (--zoom), its content
// stretches and slides so the window starts at --from (0–1 of it). A line
// marks the start of each bar. A clip's edges trim it when dragged: an
// unmarked strip astride each. A repeat's count is centred over its notes
// on a chip of the screen's black.
const trackLane = tv({
  slots: {
    base: "relative overflow-hidden rounded-[4px]",
    content:
      "absolute top-0 bottom-0 left-[calc(var(--from,0)*var(--zoom,1)*-100%)] w-[calc(var(--zoom,1)*100%)] bg-[linear-gradient(to_right,color-mix(in_srgb,var(--color-screen-ink)_12%,transparent)_1px,transparent_1px)] bg-size-[calc(100%/var(--bars))_100%]",
    edge: "absolute top-0 bottom-0 z-1 w-[12px] -translate-x-1/2 cursor-ew-resize touch-none",
    count:
      "absolute top-1/2 -translate-1/2 rounded-[3px] bg-screen/70 px-[3px] text-[12px] leading-[15px] font-bold",
  },
  variants: {
    quiet: { true: { base: "opacity-30" } },
  },
});
const lane = trackLane();

// Each pass of the take is a clip, with a dark seam before the next. The
// section a track is trimmed to is outlined in red; the drum pattern on the
// tape's row is dimmer than the take, in a faint frame, so the two halves
// read apart.
const passStyle = tv({
  base: "absolute top-0 bottom-0 rounded-[4px] border-r-2 border-r-screen",
  variants: {
    loop: { true: "shadow-[inset_0_0_0_1.5px_var(--color-synth-red)]" },
    steps: {
      true: "rounded-[3px] bg-transparent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-screen-ink)_22%,transparent)]",
    },
  },
});

const clipNote = tv({
  base: "absolute h-[3px] min-w-[2px] rounded-[1.5px] opacity-95",
  variants: {
    repeat: { true: "opacity-55" },
    steps: { true: "opacity-45" },
  },
});

// Where the mix is, across every lane, in the green of the knob that seeks
// it; hidden while it is stopped. It starts at the lane's left edge (past
// the 168px label and 5px volume strip) and spans the lane's width.
const PLAYHEAD =
  "absolute top-0 bottom-0 left-[calc(193px_+_var(--playhead,-1)_*_(100%_-_197px))] z-1 w-[2px] bg-synth-green opacity-[clamp(0,calc((var(--playhead,-1)_+_1)_*_1000),1)]";

// Rows the tracks view shows at once; past them the list scrolls a row at a
// time to keep the picked one in view.
const TRACKS_SHOWN = 4;

// Wheel travel (px) that moves the pick one track.
const WHEEL_PER_TRACK = 40;

// A wheel event's travel in pixels, whatever unit the browser reports.
const wheelPixels = (event: WheelEvent, delta: number, page: number) =>
  event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? delta * 16
    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
      ? delta * page
      : delta;

// The lanes' share of a row: everything but the 168px name, the 5px volume
// strip, their gaps and the row's padding.
const LANE_INSET = 197;

// The tracks' rows, with the mix's playhead: each frame sets --playhead (0–1
// across the lanes, or -1 while stopped or out of view) for the lanes'
// playhead lines. Zoomed in, the lanes show `span / zoom` beats from `from`.
// Scrolling the wheel over them picks a track, like the blue knob; scrolling
// sideways pans the zoomed lanes.
function TrackList({
  className,
  getPosition,
  span,
  zoom,
  from,
  onStep,
  onPan,
  children,
}: {
  className: string;
  getPosition: () => number | null;
  span: number;
  zoom: number;
  from: number;
  onStep?: (tracks: number) => void;
  onPan?: (beats: number) => void;
  children: ReactNode;
}) {
  const list = useRef<HTMLDivElement>(null);
  const readPosition = useEffectEvent(getPosition);
  const step = useRef(onStep);
  const pan = useRef<(pixels: number) => void>(undefined);
  useEffect(() => {
    step.current = onStep;
    pan.current = (pixels) => {
      const lanes = (list.current?.clientWidth ?? 0) - LANE_INSET;
      if (lanes > 0) onPan?.((pixels / lanes) * (span / zoom));
    };
  }, [onStep, onPan, span, zoom]);

  // React registers wheel listeners as passive, so preventDefault needs a
  // native one.
  useEffect(() => {
    const element = list.current;
    if (!element) return;
    let travel = 0;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        pan.current?.(wheelPixels(event, event.deltaX, element.clientWidth));
        return;
      }
      if (event.deltaY === 0 || !step.current) return;
      const pixels = wheelPixels(event, event.deltaY, element.clientHeight);
      // Turning back drops what was left over the other way.
      if (Math.sign(pixels) !== Math.sign(travel)) travel = 0;
      travel += pixels;
      const tracks = Math.trunc(travel / WHEEL_PER_TRACK);
      if (tracks === 0) return;
      travel -= tracks * WHEEL_PER_TRACK;
      step.current(tracks);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);
  useEffect(() => {
    const element = list.current;
    if (!element) return;
    let frame = 0;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const at = readPosition();
      const shown = at === null ? -1 : ((at - from) / span) * zoom;
      element.style.setProperty(
        "--playhead",
        String(shown < 0 || shown > 1 ? -1 : shown),
      );
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [span, zoom, from]);
  return (
    <div
      ref={list}
      className={className}
      role="group"
      aria-label="Tracks"
      style={{ "--zoom": zoom, "--from": from / span } as CSSProperties}
    >
      {children}
      <span className={PLAYHEAD} aria-hidden="true" />
    </div>
  );
}

// A track's lane, like a clip on the studio's timeline: bar lines, the take's
// notes as short bars at their pitch within the take's range (at least an
// octave), and fainter repeats after the first pass, marked ×2, ×3… in their
// middle. A track's own loop is outlined in red where it first plays.
// Past this many passes the repeats are too narrow to draw one by one (an
// hour of a short loop runs to thousands), so they show as one faded band
// labelled with the count. A repeat narrower than this share of the lane has
// no room for its own label.
const MAX_DRAWN_PASSES = 32;
const LABELLED_PASS = 0.06;

type LoopEdgeId = "start" | "end";

// An edge of a clip to drag along the lane, trimming it to a loop: an
// unmarked grab area with a resize cursor. It reports where on the timeline
// (beats) the pointer is.
function LoopEdge({
  edge,
  at,
  span,
  onMove,
  onDrag,
}: {
  edge: LoopEdgeId;
  at: number;
  span: number;
  onMove: (edge: LoopEdgeId, beats: number) => void;
  onDrag?: (dragging: boolean) => void;
}) {
  const move = (event: React.PointerEvent<HTMLSpanElement>) => {
    const lane = event.currentTarget.parentElement;
    if (!lane) return;
    const { left, width } = lane.getBoundingClientRect();
    onMove(
      edge,
      Math.min(1, Math.max(0, (event.clientX - left) / width)) * span,
    );
  };
  return (
    <span
      className={lane.edge()}
      style={{ left: `${(at / span) * 100}%` }}
      onPointerDown={(event) => {
        event.stopPropagation();
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        onDrag?.(true);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event);
      }}
      onPointerUp={(event) =>
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      onLostPointerCapture={() => onDrag?.(false)}
    />
  );
}

function TrackLane({
  track,
  span,
  barBeats,
  onLoopEdge,
  onLoopEdgeDrag,
}: {
  track: ScreenTrack;
  span: number;
  barBeats: number;
  onLoopEdge?: (edge: LoopEdgeId, beats: number) => void;
  onLoopEdgeDrag?: (dragging: boolean) => void;
}) {
  const { clip, start, color } = track;
  const passes: number[] = [];
  for (
    let at = start + clip.offset;
    clip.length > 0 && at < span && passes.length < clip.repeats;
    at += clip.length
  )
    passes.push(at);
  const banded = passes.length > MAX_DRAWN_PASSES;
  const drawn = banded ? passes.slice(0, 1) : passes;
  const bandEnd = Math.min(span, passes[passes.length - 1] + clip.length);
  const labelled = !banded && clip.length / span >= LABELLED_PASS;
  const { pattern } = track;
  const pitches = [...clip.notes, ...(pattern?.notes ?? [])].map(
    ({ note }) => note,
  );
  let low = Math.min(...pitches);
  let high = Math.max(...pitches);
  if (high - low < 12) {
    const middle = (high + low) / 2;
    low = middle - 6;
    high = middle + 6;
  }
  const percent = (beats: number) => `${(beats / span) * 100}%`;
  return (
    <span
      className={trackLane({ quiet: !track.audible }).base()}
      aria-hidden="true"
    >
      <span
        className={lane.content()}
        style={{ "--bars": span / barBeats } as CSSProperties}
      >
        {pattern && pattern.length > 0 && (
          <>
            <span
              className={passStyle({ steps: true })}
              style={{
                left: 0,
                width: percent(Math.min(pattern.length, span)),
              }}
            />
            {pattern.notes
              .filter((note) => note.start < span)
              .map((note, i) => (
                <span
                  key={`steps-${i}`}
                  className={clipNote({ steps: true })}
                  style={{
                    left: percent(note.start),
                    width: percent(Math.min(note.length, span - note.start)),
                    top: `${12 + (1 - (note.note - low) / (high - low)) * 70}%`,
                    background: color,
                  }}
                />
              ))}
          </>
        )}
        {drawn.map((at, pass) => (
          <span
            key={`pass-${pass}`}
            className={passStyle({ loop: clip.looped && pass === 0 })}
            style={{
              left: percent(at),
              width: percent(Math.min(clip.length, span - at)),
              background: `color-mix(in srgb, ${color} 12%, transparent)`,
            }}
          />
        ))}
        {drawn.flatMap((at, pass) =>
          clip.notes
            .filter((note) => at + note.start < span)
            .map((note, i) => (
              <span
                key={`${pass}-${i}`}
                className={clipNote({ repeat: pass > 0 })}
                style={{
                  left: percent(at + note.start),
                  width: percent(
                    Math.min(note.length, clip.length - note.start, span - at),
                  ),
                  top: `${12 + (1 - (note.note - low) / (high - low)) * 70}%`,
                  background: color,
                }}
              />
            )),
        )}
        {labelled &&
          passes.slice(1).map((at, i) => (
            <span
              key={`count-${i}`}
              className={lane.count()}
              style={{
                left: percent(at + Math.min(clip.length, span - at) / 2),
                color,
              }}
            >
              ×{i + 2}
            </span>
          ))}
        {onLoopEdge && passes.length > 0 && clip.length > 0 && (
          <>
            <LoopEdge
              edge="start"
              at={passes[0]}
              span={span}
              onMove={onLoopEdge}
              onDrag={onLoopEdgeDrag}
            />
            <LoopEdge
              edge="end"
              at={Math.min(span, passes[0] + clip.length)}
              span={span}
              onMove={onLoopEdge}
              onDrag={onLoopEdgeDrag}
            />
          </>
        )}
        {banded && (
          <>
            <span
              className={passStyle()}
              style={{
                left: percent(passes[1]),
                width: percent(bandEnd - passes[1]),
                background: `color-mix(in srgb, ${color} 7%, transparent)`,
              }}
            />
            <span
              className={lane.count()}
              style={{ left: percent((passes[1] + bandEnd) / 2), color }}
            >
              ×{passes.length}
            </span>
          </>
        )}
      </span>
    </span>
  );
}

// A row of the drum sequencer: a piece of the kit, shown by its icon or, for
// a hand-drum stroke, its syllable.
export type StepRow = {
  id: string;
  label: string;
  icon?: ReactNode;
};

// The drum sequencer: a row a piece, its icon in a narrow column, then the
// steps; each beat's first step a little brighter and each bar's set off by
// a line. The head is a green column over the steps (--head of --columns),
// red while recording.
const stepGrid = tv({
  slots: {
    row: "grid min-h-0 grid-cols-[30px_repeat(var(--columns),minmax(0,1fr))]",
    piece:
      "grid min-h-0 place-items-center overflow-hidden text-[10px] leading-none font-semibold tracking-[0.04em] first-letter:uppercase text-screen-ink/70 [&_svg]:size-[14px]",
    head: "pointer-events-none absolute -top-[2px] -bottom-[2px] left-[calc(30px_+_var(--head,0)_*_(100%_-_30px)_/_var(--columns))] w-[calc((100%_-_30px)_/_var(--columns))] rounded-[3px] bg-synth-green/30 shadow-[inset_0_0_0_1.5px_var(--color-synth-green)]",
  },
  variants: {
    recording: {
      true: {
        head: "bg-synth-red/30 shadow-[inset_0_0_0_1.5px_var(--color-synth-red)]",
      },
    },
  },
});
const stepParts = stepGrid();

const stepCell = tv({
  base: "relative min-h-0 cursor-pointer before:absolute before:inset-px before:rounded-[2px] before:bg-screen-ink/7",
  variants: {
    beat: { true: "before:bg-screen-ink/13" },
    bar: {
      true: "shadow-[inset_1px_0_color-mix(in_srgb,var(--color-screen-ink)_30%,transparent)]",
    },
    hit: { true: "before:bg-screen-ink" },
  },
});

// Up to this many steps show at once, in whole bars (or whole beats when a
// bar alone has more); the page follows the head.
const STEPS_PER_PAGE = 32;
// Wheel travel (px) that moves the head one step.
const WHEEL_PER_STEP = 40;

// The drum sequencer's grid: a row a piece, its icon on the left, and the
// steps running left to right, beats and bars marked. The head (where keys
// set hits, or where the loop plays) is read every frame.
function StepGrid({
  rows,
  steps,
  perBeat,
  barSteps,
  hits,
  getHead,
  recording,
  onToggle,
  onMove,
}: {
  rows: readonly StepRow[];
  steps: number;
  perBeat: number;
  barSteps: number;
  hits: ReadonlySet<string>;
  getHead: () => number;
  recording: boolean;
  onToggle?: (row: number, step: number) => void;
  onMove?: (steps: number) => void;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const pageSteps =
    barSteps <= STEPS_PER_PAGE
      ? barSteps * Math.floor(STEPS_PER_PAGE / barSteps)
      : perBeat * Math.floor(STEPS_PER_PAGE / perBeat);
  const [page, setPage] = useState(0);
  const shown = Math.min(page, Math.ceil(steps / pageSteps) - 1);
  const columns = Math.min(pageSteps, steps - shown * pageSteps);
  const move = useRef(onMove);
  useEffect(() => {
    move.current = onMove;
  }, [onMove]);
  const readHead = useEffectEvent(getHead);

  useEffect(() => {
    const element = grid.current;
    if (!element) return;
    let frame = 0;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const head = readHead();
      const at = Math.floor(head / pageSteps);
      setPage(at);
      element.style.setProperty("--head", String(head - at * pageSteps));
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [pageSteps]);

  // Sideways (or up and down) the wheel moves the head a step a notch.
  useEffect(() => {
    const element = grid.current;
    if (!element) return;
    let travel = 0;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const sideways = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      const pixels = wheelPixels(
        event,
        sideways ? event.deltaX : event.deltaY,
        element.clientWidth,
      );
      if (pixels === 0 || !move.current) return;
      if (Math.sign(pixels) !== Math.sign(travel)) travel = 0;
      travel += pixels;
      const notches = Math.trunc(travel / WHEEL_PER_STEP);
      if (notches === 0) return;
      travel -= notches * WHEEL_PER_STEP;
      move.current(notches);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div
      ref={grid}
      className={screenView({ kind: "steps" })}
      role="group"
      aria-label="Drum steps"
      style={
        {
          "--columns": columns,
          gridTemplateRows: `repeat(${rows.length}, minmax(0, 1fr))`,
        } as CSSProperties
      }
    >
      {rows.map((row, r) => (
        <div key={row.id} className={stepParts.row()}>
          <span className={stepParts.piece()} title={row.label}>
            {row.icon ?? row.label}
          </span>
          {Array.from({ length: columns }, (_, c) => {
            const step = shown * pageSteps + c;
            return (
              <span
                key={step}
                className={stepCell({
                  hit: hits.has(`${r}:${step}`),
                  beat: step % perBeat === 0,
                  bar: step % barSteps === 0,
                })}
                onPointerDown={(event) => {
                  event.preventDefault();
                  onToggle?.(r, step);
                }}
              />
            );
          })}
        </div>
      ))}
      <span className={stepGrid({ recording }).head()} aria-hidden="true" />
    </div>
  );
}

// A level shown over the current view, e.g. the volume while it changes.
// Without a value it is a message alone, e.g. asking for a second press.
export type ScreenOverlay = {
  label: string;
  // 0–1
  value?: number;
  display?: string;
};

// The setting the red knob picked (red) and its value, set by the blue knob
// (blue), for the footer.
export function ScreenSelection({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <>
      <span className="text-synth-red">{label}</span>{" "}
      <span className="text-synth-blue">{value}</span>
    </>
  );
}

// A pad's icon in an outlined badge, for hints that point at the pad: its
// name can mislead, since a pad's icon changes with what it does.
export function ScreenPad({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span
      className="mx-[2px] inline-grid h-[15px] place-items-center rounded-[4px] border border-current/45 px-[4px] align-top [&_svg]:size-[10px]"
      role="img"
      aria-label={label}
    >
      {children}
    </span>
  );
}

// Whatever the green knob moves through (a page counter, a param), in green.
export function ScreenSeek({ children }: { children: ReactNode }) {
  return <span className="text-synth-green">{children}</span>;
}

// A level the red knob sets, in red.
export function ScreenLevel({ children }: { children: ReactNode }) {
  return <span className="text-synth-red">{children}</span>;
}

// What to press, a little dimmer than the readings beside it.
export function ScreenHint({ children }: { children: ReactNode }) {
  return <span className="text-screen-ink/45">{children}</span>;
}

// A value the blue knob sets, in blue.
export function ScreenValue({ children }: { children: ReactNode }) {
  return <span className="text-synth-blue">{children}</span>;
}

// A view with pages: the one it is on, the knob that turns them, and the
// arrows either side of it that turn them too.
export type ScreenPager = {
  pages: readonly string[];
  at: number;
  color: "red" | "green";
  onPick: (page: number) => void;
};

// Three tabs in three equal columns: the page the view is on always in the
// middle, the one before it against ‹ and the one after it against ›, so
// paging never shifts them. Past the first or last page a column is empty.
const TAB_PLACES = ["start", "center", "end"] as const;
const tabWindow = ({ pages, at }: ScreenPager) =>
  TAB_PLACES.map((place, i) => {
    const page = at - 1 + i;
    return { place, page, name: pages[page] as string | undefined };
  });

export type DeviceScreenProps = {
  view?: ScreenView;
  // Leads the top line, or the footer where a pager or `statusLeft` holds the
  // top's left.
  title: string;
  // The preset in the title has edits that aren't saved.
  unsaved?: boolean;
  // Along the top: the status on the right, and on the left what it sets
  // apart (the scope's octave).
  status: ReactNode;
  statusLeft?: ReactNode;
  footer: readonly [left: ReactNode, right: ReactNode];
  // Centred along the bottom in place of the footer.
  badges?: readonly ScreenBadge[];
  getAnalyser?: () => AnalyserNode | null;
  // The synth view's params: the page showing, one module's worth.
  params?: readonly ScreenParam[];
  // Turns the readout into the view's pager: ‹ [page] ›.
  pager?: ScreenPager;
  tiles?: readonly ScreenTile[];
  selected?: number;
  // The knob that picks a tile, colouring the picked one; green unless set.
  selectedBy?: "green" | "blue";
  onSelect?: (index: number) => void;
  // A tile double-clicked: does what Save would with it.
  onActivate?: (index: number) => void;
  // Dragging a track's loop edge on the tracks view: which row, which edge
  // and where on the timeline (beats).
  onLoopEdge?: (index: number, edge: "start" | "end", beats: number) => void;
  // A clip edge's drag starting and ending.
  onLoopEdgeDrag?: (dragging: boolean) => void;
  // Tapping a param on the synth view selects it (its index on the page).
  onSelectParam?: (index: number) => void;
  // The four knob readings for the ADSR, LFO and FX views.
  readouts?: readonly ScreenReadout[];
  // The LFO view's shape (0–3) and rate in Hz.
  lfoShape?: number;
  lfoRate?: number;
  // Tempo, meter and grid, for the tempo view (a light per beat of the bar)
  // and the roll's lines; and the beat the metronome is on, or null while it
  // is stopped.
  timing?: Timing;
  beat?: number | null;
  // The tempo view's BPM dragged like a knob or typed in.
  onBpm?: (bpm: number) => void;
  // The tracks view's rows, and its timeline's length and bar, in beats; and
  // where the mix is playing (beats, or null), read every frame.
  tracks?: readonly ScreenTrack[];
  getTrackPosition?: () => number | null;
  trackSpan?: number;
  barBeats?: number;
  // How many times the timeline is stretched across the lanes, the beat at
  // their left edge, and panning them sideways (beats).
  trackZoom?: number;
  trackFrom?: number;
  onPanTracks?: (beats: number) => void;
  // The take for the roll view, read every frame, where it is scrolled to in
  // time and pitch, and wheel scrolling over it (see NoteRoll).
  getRoll?: () => RollFrame;
  rollPosition?: number | null;
  rollLow?: number;
  onRollScroll?: (ms: number) => void;
  onRollPitch?: (semitones: number) => void;
  // The drum sequencer: its rows, its length and grid in steps, the hits as
  // `row:step`, the head (read every frame), and clicking a cell or moving
  // the head with the wheel.
  stepRows?: readonly StepRow[];
  stepCount?: number;
  stepsPerBeat?: number;
  stepsPerBar?: number;
  stepHits?: ReadonlySet<string>;
  getStepHead?: () => number;
  // Recording, the head turns red.
  stepRecording?: boolean;
  onToggleStep?: (row: number, step: number) => void;
  onMoveStep?: (steps: number) => void;
  overlay?: ScreenOverlay;
  className?: string;
};

export const TILES_PER_PAGE: Record<string, number> = {
  save: 48,
  presets: 12,
  chords: 12,
  chordStyle: 12,
  progressions: 12,
  beats: 12,
  album: 12,
  revert: 12,
};

// The screen: black glass in a pressed-in bezel, as round as the pads so it
// sits square between the grilles, 2.39:1 unless the Device sets
// --screen-aspect. A readout line runs along the top and the footer along
// the bottom, the title leading one of them; on the roll the footer's line tightens to fit under the keys,
// so they stay put when a notice comes or goes.
// A paged view's tabs: the page it is on filled in the colour of the knob
// that turns the pages, the ones either side dim, to step to, filling grey
// under the pointer. Their negative margin keeps the readout's 18px line.
const pageTab = tv({
  base: "-my-[4px] max-w-full cursor-pointer truncate rounded-[10px] px-[7px] py-[3px] font-screen text-[14px] leading-[18px] font-semibold tracking-[0.02em] text-screen-ink/45 first-letter:uppercase [corner-shape:squircle] hover:bg-screen-ink/15 hover:text-screen-ink active:bg-screen-ink/75 active:text-screen",
  variants: {
    place: {
      start: "justify-self-start",
      center: "justify-self-stretch text-center",
      end: "justify-self-end",
    },
    current: {
      red: "cursor-default bg-synth-red text-white hover:bg-synth-red hover:text-white active:bg-synth-red active:text-white",
      green:
        "cursor-default bg-synth-green text-white hover:bg-synth-green hover:text-white active:bg-synth-green active:text-white",
    },
  },
});

const screen = tv({
  slots: {
    base: "aspect-[var(--screen-aspect,2.39)] rounded-[12px] border-t-[1.5px] border-b-[1.5px] border-t-screen-edge border-b-screen-lip bg-screen p-[8px] shadow-screen",
    glass:
      "relative flex h-full items-center rounded-[4px] px-[20px] text-screen-ink",
    readout:
      "absolute top-[9px] right-[20px] left-[20px] flex items-baseline justify-between gap-[16px] font-screen text-[14px] leading-[18px] font-medium tracking-[0.08em] whitespace-nowrap text-screen-ink/60 first-letter:uppercase",
    footer:
      "absolute right-[20px] bottom-[9px] left-[20px] flex items-baseline justify-between gap-[16px] font-screen text-[12px] leading-[15px] font-medium tracking-[0.08em] whitespace-nowrap text-screen-ink/60 first-letter:uppercase",
    badges:
      "absolute right-[20px] bottom-[9px] left-[20px] flex justify-center gap-[16px] font-screen text-[12px] leading-[15px] font-medium tracking-[0.08em] whitespace-nowrap text-screen-ink/60 first-letter:uppercase",
    // A line's left side gives way to its right, cutting short rather than
    // running under it.
    lead: "min-w-0 truncate",
    trail: "shrink-0",
    // An asterisk after the title, as editors mark a file with changes.
    unsaved:
      "ml-[2px] inline-grid place-items-center align-top text-screen-ink/75 [&_svg]:size-[0.9em]",
    // A paged view: an arrow at either end, a touch target each that fills
    // grey under the pointer; at the first or last page one fades.
    pager:
      "absolute top-[9px] right-[20px] left-[20px] flex items-center gap-[6px] font-screen text-[14px] leading-[18px] font-medium tracking-[0.08em] whitespace-nowrap text-screen-ink/60 first-letter:uppercase",
    pageTabs: "grid min-w-0 flex-1 grid-cols-3 items-center",
    pageArrow:
      "-my-[6px] grid size-[27px] shrink-0 cursor-pointer place-items-center rounded-[11px] text-screen-ink/70 [corner-shape:squircle] hover:bg-screen-ink/15 hover:text-screen-ink active:bg-screen-ink/75 active:text-screen disabled:cursor-default disabled:bg-transparent disabled:text-screen-ink/60 disabled:opacity-25 [&_svg]:size-[18px]",
    scope: "h-[160px] w-full text-screen-ink",
    // From under the title down to the footer's line, which holds its
    // labels.
    roll: "absolute top-[30px] right-[20px] bottom-[23px] left-[20px] h-[calc(100%_-_53px)] w-[calc(100%_-_40px)] text-screen-ink",
    stages:
      "grid grid-cols-4 gap-[18px] font-screen text-[14px] leading-[18px]",
    // Label over value, centred in its column.
    stage: "flex flex-col items-center whitespace-nowrap",
    stageLabel: "tracking-[0.02em] first-letter:uppercase text-screen-ink/55",
    stageValue: "font-semibold",
    // The tempo in green, as the green knob sets it, over a light per beat.
    bpm: "flex items-baseline gap-[10px] text-[72px] leading-none font-semibold tabular-nums",
    bpmUnit: "text-[14px] tracking-[0.08em] text-screen-ink/55",
    beats: "flex gap-[16px]",
    tracksEmpty:
      "row-span-full self-center justify-self-center text-[14px] leading-[18px] tracking-[0.08em] first-letter:uppercase text-screen-ink/55",
    switchLabel: "flex items-center gap-[8px]",
  },
  variants: {
    caption: {
      true: {
        footer: "bottom-[10px] leading-[12px]",
        badges: "bottom-[10px] leading-[12px]",
      },
    },
  },
});

// Views sit in the ~565 × 181 space between the two readouts. The library
// is two rows of 6 tiles filling it, near square; icons are four rows of 12, 48 a page;
// tracks are four rows a page, like the studio's track list.
const screenView = tv({
  base: "absolute top-[30px] right-[20px] bottom-[30px] left-[20px] m-0",
  variants: {
    kind: {
      params: "grid grid-cols-3 grid-rows-5 gap-x-[18px] gap-y-0 font-screen",
      tiles: "grid grid-cols-6 grid-rows-2 gap-[6px] overflow-hidden",
      icons:
        "grid grid-cols-12 grid-rows-4 justify-items-center gap-[6px] overflow-hidden",
      module: "flex flex-col gap-[6px]",
      tempo: "flex flex-col items-center justify-center gap-[18px] font-screen",
      tracks: "grid grid-rows-4 gap-[4px] font-screen",
      steps: "grid gap-[2px] font-screen",
    },
    // Under a pager's taller header, the content starts lower, leaving a gap.
    paged: { true: "top-[42px]" },
  },
});

// A param's name and value: a hairline that turns blue on keyboard focus,
// like the tiles, its margin keeping the text lined up with the readouts.
// The green knob picks the selected one and the blue knob sets its value.
const param = tv({
  slots: {
    base: "relative -mx-[7px] flex min-w-0 cursor-pointer items-center justify-between gap-[6px] rounded-[6px] border border-transparent px-[6px] text-center text-[14px] leading-[18px] font-normal text-screen-ink select-none [font-family:inherit] focus-visible:border-synth-blue focus-visible:shadow-[inset_0_0_0_1px_var(--color-synth-blue)] focus-visible:outline-none",
    label:
      "truncate tracking-[0.02em] first-letter:uppercase text-screen-ink/55",
    value: "font-semibold whitespace-nowrap",
  },
  variants: {
    selected: {
      true: { label: "text-synth-green", value: "text-synth-blue" },
    },
  },
});

// A tile: the picked one fills with the colour of the knob that picks it.
// Keyboard focus turns its hairline blue rather than drawing a ring, with a
// second pixel inside so it reads on a green tile too (on a blue one, ink).
// A name runs to two lines, so "Acoustic guitar" reads in full on a narrow
// tile. Icon tiles are squares as tall as a row (~41 px), centred in their
// columns.
const tile = tv({
  slots: {
    base: "group relative flex min-w-0 cursor-pointer flex-col items-center justify-center gap-[4px] rounded-[8px] border border-screen-ink/12 px-[6px] text-center text-[11px] font-medium text-screen-ink/75 select-none aria-pressed:text-white focus-visible:border-synth-blue focus-visible:shadow-[inset_0_0_0_1px_var(--color-synth-blue)] focus-visible:outline-none",
    // The icon and the name each keep two lines' room, their content centred
    // in it, so icons line up along a row whatever the names' lengths. A
    // text icon (a chord's symbol, a progression's numerals) wraps evenly,
    // cut short with an ellipsis past two lines.
    icon: "flex h-[26px] max-w-full items-center justify-center overflow-hidden font-screen text-[11px] leading-[13px] font-bold text-balance [&_svg]:size-[24px] [&>span]:line-clamp-2",
    name: "flex h-[26px] w-full items-center justify-center",
    nameText:
      "line-clamp-2 overflow-hidden font-screen text-[11px] leading-[13px] text-balance wrap-break-word first-letter:uppercase",
    badge:
      "absolute top-[3px] right-[4px] font-screen text-[11px] leading-[13px] font-bold text-synth-red group-aria-pressed:text-white",
  },
  variants: {
    icons: {
      true: {
        base: "aspect-square h-full w-auto p-0",
        icon: "[&_svg]:size-[22px]",
      },
    },
    selectedBy: {
      green: {
        base: "aria-pressed:border-synth-green aria-pressed:bg-synth-green aria-pressed:focus-visible:border-synth-blue",
      },
      blue: {
        base: "aria-pressed:border-synth-blue aria-pressed:bg-synth-blue aria-pressed:focus-visible:border-screen-ink aria-pressed:focus-visible:shadow-[inset_0_0_0_1px_var(--color-screen-ink)]",
      },
    },
  },
  defaultVariants: { selectedBy: "green" },
});

// Wide enough for "Off", so switching doesn't shift the label.
const onOff = tv({
  base: "min-w-[40px] rounded-[999px] border border-screen-ink/30 px-[5px] py-0 text-center text-[12px] leading-[13px] font-semibold text-screen-ink/55",
  variants: {
    on: { true: "border-screen-ink bg-screen-ink text-screen" },
  },
});

const beatLight = tv({
  base: "size-[10px] rounded-[50%] bg-screen-ink/18",
  variants: {
    on: { true: "bg-screen-ink" },
  },
});

// A level over the view, or a message alone, inverted white on black so it
// punches through.
const overlayMeter = tv({
  slots: {
    base: "pointer-events-none absolute inset-0 z-2 grid animate-[overlay-in_120ms_ease-out] place-items-center rounded-[inherit] bg-screen/55",
    meter:
      "flex w-[62%] flex-col gap-[10px] rounded-[10px] border border-screen-ink/18 bg-screen/92 px-[18px] pt-[14px] pb-[16px]",
    label:
      "flex justify-between font-screen text-[14px] leading-[18px] font-semibold tracking-[0.08em] first-letter:uppercase",
    text: "text-center font-screen text-[14px] leading-[20px] font-semibold tracking-[0.08em] text-balance first-letter:uppercase",
    track: "relative h-[12px] overflow-hidden rounded-[3px] bg-screen-ink/12",
    fill: "h-full bg-screen-ink transition-[width] duration-160 ease-[ease-out]",
  },
  variants: {
    alone: {
      true: {
        meter:
          "w-auto max-w-[78%] rounded-[14px] border-transparent bg-screen-ink px-[20px] py-[12px] text-screen",
      },
    },
  },
});

const bpmField = tv({
  base: "-my-[8px] h-[88px] w-[calc(3ch_+_28px)] rounded-[18px] border-2 border-transparent px-[12px] text-center text-synth-green tabular-nums outline-none [corner-shape:squircle]",
  variants: {
    editing: {
      true: "border-synth-green",
      false: "cursor-ew-resize hover:border-screen-ink/20",
    },
  },
});

// Pixels of sideways drag per beat per minute.
const BPM_DRAG = 4;

// The tempo view's BPM in green: dragged sideways like the knob, or clicked
// to type it in. Enter or a click away sets it; Esc leaves it as it was.
// Both states share a fixed height, as Chrome won't set an input's
// line-height below normal, so clicking it never moves the lights.
function BpmField({
  bpm,
  onBpm,
}: {
  bpm: number;
  onBpm?: (bpm: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const drag = useRef<{ pointerId: number; x: number; bpm: number } | null>(
    null,
  );
  const dragged = useRef(false);
  const cancelled = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const editing = draft !== null;

  useEffect(() => {
    if (!editing) return;
    input.current?.focus();
    input.current?.select();
  }, [editing]);

  if (!onBpm) return <ScreenSeek>{bpm}</ScreenSeek>;

  if (draft !== null)
    return (
      <input
        className={bpmField({ editing: true })}
        aria-label="Tempo in BPM"
        inputMode="numeric"
        maxLength={3}
        ref={input}
        value={draft}
        onChange={(event) =>
          setDraft(event.currentTarget.value.replace(/\D/g, ""))
        }
        onKeyDown={(event) => {
          if (event.key === "Escape") cancelled.current = true;
          if (event.key === "Enter" || event.key === "Escape")
            event.currentTarget.blur();
        }}
        onBlur={() => {
          const typed = Number.parseInt(draft, 10);
          if (!cancelled.current && Number.isFinite(typed)) onBpm(typed);
          setDraft(null);
        }}
      />
    );

  return (
    <Button
      unstyled
      aria-label={`Tempo: ${bpm} BPM`}
      className={bpmField({ editing: false })}
      {...keepFocus}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, x: event.clientX, bpm };
        dragged.current = false;
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start || start.pointerId !== event.pointerId) return;
        const distance = event.clientX - start.x;
        if (Math.abs(distance) >= 4) dragged.current = true;
        const next = start.bpm + Math.trunc(distance / BPM_DRAG);
        if (dragged.current && next !== bpm) onBpm(next);
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onClick={() => {
        if (dragged.current) {
          dragged.current = false;
          return;
        }
        cancelled.current = false;
        setDraft(String(bpm));
      }}
    >
      <span>{bpm}</span>
    </Button>
  );
}

const noAnalyser = () => null;
const EMPTY_ROLL: RollFrame = { now: 0, notes: [], state: "stopped" };
const noRoll = () => EMPTY_ROLL;
const noPosition = () => null;
const noHead = () => 0;
const NO_HITS: ReadonlySet<string> = new Set();

// The Device's display: a live scope by default, or the synth parameters, the
// Save icon picker or the preset grid.
export function DeviceScreen({
  view = "scope",
  title,
  unsaved = false,
  status,
  statusLeft,
  footer,
  badges,
  getAnalyser = noAnalyser,
  params = [],
  pager,
  tiles = [],
  selected = 0,
  selectedBy,
  onSelect,
  onActivate,
  onLoopEdge,
  onLoopEdgeDrag,
  onSelectParam,
  readouts = [],
  lfoShape = 0,
  lfoRate = 1,
  timing = DEFAULT_TIMING,
  beat = null,
  onBpm,
  tracks = [],
  getTrackPosition = noPosition,
  trackSpan = 16,
  barBeats = 4,
  trackZoom = 1,
  trackFrom = 0,
  onPanTracks,
  getRoll = noRoll,
  rollPosition = null,
  rollLow,
  stepRows = [],
  stepCount = 16,
  stepsPerBeat = 4,
  stepsPerBar = 16,
  stepHits = NO_HITS,
  getStepHead = noHead,
  stepRecording = false,
  onToggleStep,
  onMoveStep,
  onRollScroll,
  onRollPitch,
  overlay,
  className,
}: DeviceScreenProps) {
  const [trackTop, setTrackTop] = useState(0);
  if (view === "tracks") {
    const top = Math.min(
      Math.max(0, tracks.length - TRACKS_SHOWN),
      Math.max(selected - TRACKS_SHOWN + 1, Math.min(selected, trackTop)),
    );
    if (top !== trackTop) setTrackTop(top);
  }
  const perPage = TILES_PER_PAGE[view] ?? 1;
  const tilePage = Math.floor(selected / perPage);
  const visibleTiles = tiles.slice(
    tilePage * perPage,
    (tilePage + 1) * perPage,
  );
  const ui = screen();
  const bottom = screen({ caption: view === "roll" });
  // The title leads the top line, unless the pager's tabs or the left status
  // hold it; then it leads the footer.
  const titleBelow = pager !== undefined || statusLeft !== undefined;
  const titled = (
    <>
      <span aria-live="polite">{title}</span>
      {unsaved && (
        <span className={ui.unsaved()} title="Unsaved changes">
          <Asterisk aria-hidden="true" />
          <span className="sr-only">Unsaved</span>
        </span>
      )}
    </>
  );
  const tileParts = tile({ icons: view === "save", selectedBy });
  const level = overlayMeter({ alone: overlay?.value === undefined });

  return (
    <div className={ui.base({ className })}>
      <div className={ui.glass()}>
        {pager ? (
          <div className={ui.pager()}>
            <Button
              unstyled
              aria-label="Back a page"
              className={ui.pageArrow()}
              disabled={pager.at <= 0}
              {...keepFocus}
              onClick={() => pager.onPick(pager.at - 1)}
            >
              <ChevronLeft />
            </Button>
            <span className={ui.pageTabs()}>
              {tabWindow(pager).map(({ place, page, name }) =>
                name === undefined ? (
                  <span key={place} />
                ) : page === pager.at ? (
                  <span
                    key={place}
                    className={pageTab({ place, current: pager.color })}
                    aria-live="polite"
                  >
                    {name}
                  </span>
                ) : (
                  <Button
                    key={place}
                    unstyled
                    aria-label={`Go to ${name}`}
                    className={pageTab({ place })}
                    {...keepFocus}
                    onClick={() => pager.onPick(page)}
                  >
                    {name}
                  </Button>
                ),
              )}
            </span>
            <Button
              unstyled
              aria-label="Forward a page"
              className={ui.pageArrow()}
              disabled={pager.at >= pager.pages.length - 1}
              {...keepFocus}
              onClick={() => pager.onPick(pager.at + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        ) : (
          <div className={ui.readout()}>
            <span className={ui.lead()}>
              {titleBelow ? statusLeft : titled}
            </span>
            <span className={ui.trail()}>{status}</span>
          </div>
        )}

        {(view === "adsr" || view === "lfo" || view === "fx") &&
          readouts.length === 4 && (
            <div className={screenView({ kind: "module" })}>
              {view === "adsr" && <EnvelopeGraph stages={readouts} />}
              {view === "lfo" && (
                <LfoGraph
                  shape={lfoShape}
                  depth={readouts[1].amount}
                  rate={lfoRate}
                />
              )}
              {view === "fx" && <FxMeters stages={readouts} />}
              <div className={ui.stages()}>
                {readouts.map((stage, i) => (
                  <span key={stage.label} className={ui.stage()}>
                    <span className={ui.stageLabel()}>{stage.label}</span>
                    <span
                      className={ui.stageValue()}
                      style={{ color: KNOB_COLORS[i] }}
                    >
                      {stage.display}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

        {view === "tempo" && (
          <div className={screenView({ kind: "tempo" })}>
            <span className={ui.bpm()}>
              {/* Mirrors the unit, so the number centres over the lights. */}
              <span
                className={ui.bpmUnit({ class: "invisible" })}
                aria-hidden="true"
              >
                BPM
              </span>
              <BpmField bpm={timing.bpm} onBpm={onBpm} />
              <span className={ui.bpmUnit()}>BPM</span>
            </span>
            <span className={ui.beats()} aria-hidden="true">
              {Array.from({ length: timing.meter.beats }, (_, i) => (
                <span key={i} className={beatLight({ on: beat === i })} />
              ))}
            </span>
          </div>
        )}

        {view === "tracks" && (
          <TrackList
            className={screenView({ kind: "tracks" })}
            getPosition={getTrackPosition}
            span={trackSpan}
            zoom={trackZoom}
            from={trackFrom}
            onPan={onPanTracks}
            onStep={(step) =>
              onSelect?.(
                Math.min(tracks.length - 1, Math.max(0, selected + step)),
              )
            }
          >
            {tracks.length === 0 ? (
              <span className={ui.tracksEmpty()}>
                Save a take in record mode to add a track
              </span>
            ) : (
              tracks
                .slice(trackTop, trackTop + TRACKS_SHOWN)
                .map((track, i) => {
                  const index = trackTop + i;
                  const row = trackRow({ potential: track.potential });
                  return (
                    <Button
                      key={track.id}
                      unstyled
                      aria-label={
                        track.potential
                          ? `${track.name}, tape`
                          : `${track.name}, ${track.detail}, volume ${Math.round(
                              track.volume * 100,
                            )}%${track.muted ? ", muted" : ""}${
                              track.soloed ? ", solo" : ""
                            }`
                      }
                      aria-pressed={index === selected}
                      className={row.base()}
                      data-potential={track.potential || undefined}
                      {...keepFocus}
                      onClick={() => onSelect?.(index)}
                    >
                      <span className={row.label()} aria-hidden="true">
                        <span className={row.name()}>
                          {!track.potential && (
                            <span className={row.number()}>#{index}</span>
                          )}
                          {track.name}
                        </span>
                        {!track.potential && (
                          <span className={row.flags()}>
                            <span className={flag({ on: track.muted })}>M</span>
                            <span className={flag({ on: track.soloed })}>
                              S
                            </span>
                          </span>
                        )}
                      </span>
                      <span className={row.volume()} aria-hidden="true">
                        {!track.potential && (
                          <span
                            className={row.level()}
                            style={{ height: `${track.volume * 100}%` }}
                          />
                        )}
                      </span>
                      <TrackLane
                        track={track}
                        span={trackSpan}
                        barBeats={barBeats}
                        onLoopEdge={
                          onLoopEdge && !track.potential
                            ? (edge, beats) => onLoopEdge(index, edge, beats)
                            : undefined
                        }
                        onLoopEdgeDrag={onLoopEdgeDrag}
                      />
                    </Button>
                  );
                })
            )}
          </TrackList>
        )}

        {view === "roll" && (
          <NoteRoll
            className={ui.roll()}
            getFrame={getRoll}
            timing={timing}
            position={rollPosition}
            low={rollLow}
            onScroll={onRollScroll}
            onScrollPitch={onRollPitch}
          />
        )}

        {view === "steps" && (
          <StepGrid
            rows={stepRows}
            steps={stepCount}
            perBeat={stepsPerBeat}
            barSteps={stepsPerBar}
            hits={stepHits}
            getHead={getStepHead}
            recording={stepRecording}
            onToggle={onToggleStep}
            onMove={onMoveStep}
          />
        )}

        {view === "scope" && (
          <Oscilloscope className={ui.scope()} getAnalyser={getAnalyser} />
        )}

        {view === "synth" && (
          <div
            className={screenView({ kind: "params", paged: Boolean(pager) })}
            role="group"
            aria-label="Parameters"
          >
            {params.map((entry, i) => {
              const styles = param({ selected: entry.selected });
              return (
                <Button
                  key={entry.id}
                  unstyled
                  aria-label={`${entry.label}: ${entry.value}`}
                  aria-pressed={entry.selected ?? false}
                  className={styles.base()}
                  {...keepFocus}
                  onClick={() => onSelectParam?.(i)}
                >
                  <span className={styles.label()}>{entry.label}</span>
                  <span className={styles.value()}>{entry.value}</span>
                </Button>
              );
            })}
          </div>
        )}

        {(view === "save" ||
          view === "presets" ||
          view === "chords" ||
          view === "chordStyle" ||
          view === "progressions" ||
          view === "beats" ||
          view === "album" ||
          view === "revert") && (
          <div
            className={screenView({
              kind: view === "save" ? "icons" : "tiles",
              paged: Boolean(pager),
            })}
            role="group"
            aria-label={
              view === "save"
                ? "Instrument icon"
                : view === "chords"
                  ? "Chord palette"
                  : view === "chordStyle"
                    ? "Play style"
                    : view === "progressions"
                      ? "Progressions"
                      : view === "beats"
                        ? "Beats"
                        : view === "album"
                          ? "Albums"
                          : view === "revert"
                            ? "Revert"
                            : "Instruments"
            }
          >
            {visibleTiles.map((entry, i) => {
              const index = tilePage * perPage + i;
              return (
                <Button
                  key={entry.id}
                  unstyled
                  aria-label={entry.label}
                  aria-pressed={index === selected}
                  className={tileParts.base()}
                  {...keepFocus}
                  onClick={() => onSelect?.(index)}
                  onDoubleClick={() => onActivate?.(index)}
                >
                  <span className={tileParts.icon()} aria-hidden="true">
                    {entry.icon}
                  </span>
                  {(view === "presets" ||
                    view === "chords" ||
                    view === "chordStyle" ||
                    view === "progressions" ||
                    view === "beats" ||
                    view === "album" ||
                    view === "revert") && (
                    <span className={tileParts.name()} aria-hidden="true">
                      <span className={tileParts.nameText()}>
                        {entry.label}
                      </span>
                    </span>
                  )}
                  {entry.badge && (
                    <span className={tileParts.badge()} aria-hidden="true">
                      {entry.badge}
                    </span>
                  )}
                </Button>
              );
            })}
          </div>
        )}

        {(titleBelow || !badges) && (
          <div className={bottom.footer()}>
            <span className={ui.lead()}>
              {titleBelow && titled}
              {titleBelow && !badges && footer[0] ? " · " : null}
              {!badges && footer[0]}
            </span>
            {!badges && <span className={ui.trail()}>{footer[1]}</span>}
          </div>
        )}
        {badges && (
          <div className={bottom.badges()} aria-live="polite">
            {badges.map(({ label, on }) => (
              <span key={label} className={ui.switchLabel()}>
                {label}
                {on !== undefined && (
                  <span className={onOff({ on })}>{on ? "On" : "Off"}</span>
                )}
              </span>
            ))}
          </div>
        )}

        {overlay && (
          <div
            className={level.base()}
            role={overlay.value === undefined ? "status" : undefined}
            aria-hidden={overlay.value !== undefined || undefined}
          >
            <div className={level.meter()}>
              {overlay.value === undefined ? (
                <div className={level.text()}>{overlay.label}</div>
              ) : (
                <>
                  <div className={level.label()}>
                    <span>{overlay.label}</span>
                    <span>{overlay.display}</span>
                  </div>
                  <div className={level.track()}>
                    <div
                      className={level.fill()}
                      style={{ width: `${Math.round(overlay.value * 100)}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
