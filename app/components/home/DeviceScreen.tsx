import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "../../lib/utils";
import { Button } from "../design-system/Button";
import { NoteRoll } from "./NoteRoll";
import { Oscilloscope } from "./Oscilloscope";
import { DEFAULT_TIMING, type Timing } from "./noteRecorder";
import type { TrackClip } from "./tracks";
import type { RollFrame } from "../../hooks/useTransport";
import { keepFocus } from "../design-system";
import styles from "./DeviceScreen.module.css";

export type ScreenView =
  | "scope"
  | "synth"
  | "save"
  | "presets"
  | "chords"
  | "chordStyle"
  | "album"
  | "revert"
  | "adsr"
  | "lfo"
  | "fx"
  | "tempo"
  | "roll"
  | "steps"
  | "tracks";

export interface ScreenParam {
  id: string;
  label: string;
  value: string;
  // The param the red and blue knobs are editing.
  selected?: boolean;
}

export interface ScreenTile {
  id: string;
  label: string;
  icon: ReactNode;
  // Small caption on the tile, e.g. the pads a preset is bound to.
  badge?: string;
}

// One module knob's reading, in knob order (white, green, red, blue).
export interface ScreenReadout {
  label: string;
  display: string;
  // 0–1: the knob position (the level, for the ADSR's sustain).
  amount: number;
}

// Module readouts in the colours of the knobs that set them.
const KNOB_COLORS = [
  "var(--screen-ink)",
  "var(--screen-green)",
  "var(--screen-red)",
  "var(--screen-blue)",
];

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
      className={styles.moduleGraph}
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={`M${x0} ${bottom} L${x1} ${top} ${decayPath} L${x3} ${level} ${releasePath} Z`}
        style={{
          fill: "color-mix(in srgb, var(--screen-ink) 8%, transparent)",
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
      className={styles.moduleGraph}
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0 20 H100"
        style={{
          stroke: "color-mix(in srgb, var(--screen-ink) 15%, transparent)",
        }}
        strokeDasharray="2 3"
        vectorEffect="non-scaling-stroke"
      />
      <path
        className={styles.lfoWave}
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
    <div className={styles.fxMeters} aria-hidden="true">
      {stages.map((stage, i) => (
        <div key={stage.label} className={styles.fxStage}>
          <div className={styles.fxTrack}>
            <div
              className={styles.fxFill}
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
export interface ScreenBadge {
  label: string;
  on?: boolean;
}

// A row of the tracks view: its take's clip, where it starts on the timeline
// (beats), and whether it's muted, soloed and heard.
export interface ScreenTrack {
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
}

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

// The lanes' share of a row: everything but the 112px name, the 5px volume
// strip, their gaps and the row's padding.
const LANE_INSET = 141;

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
      const at = getPosition();
      const shown = at === null ? -1 : ((at - from) / span) * zoom;
      element.style.setProperty(
        "--playhead",
        String(shown < 0 || shown > 1 ? -1 : shown),
      );
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [getPosition, span, zoom, from]);
  return (
    <div
      ref={list}
      className={className}
      role="group"
      aria-label="Tracks"
      style={{ "--zoom": zoom, "--from": from / span } as CSSProperties}
    >
      {children}
      <span className={styles.playhead} aria-hidden="true" />
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
      className={styles.loopEdge}
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
    <span className={styles.lane} aria-hidden="true">
      <span
        className={styles.laneContent}
        style={{ "--bars": span / barBeats } as CSSProperties}
      >
        {pattern && pattern.length > 0 && (
          <>
            <span
              className={styles.pass}
              data-steps
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
                  className={styles.clipNote}
                  data-steps
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
            className={styles.pass}
            data-loop={(clip.looped && pass === 0) || undefined}
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
                className={styles.clipNote}
                data-repeat={pass > 0 || undefined}
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
              className={styles.passCount}
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
              className={styles.pass}
              style={{
                left: percent(passes[1]),
                width: percent(bandEnd - passes[1]),
                background: `color-mix(in srgb, ${color} 7%, transparent)`,
              }}
            />
            <span
              className={styles.passCount}
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
export interface StepRow {
  id: string;
  label: string;
  icon?: ReactNode;
}

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

  useEffect(() => {
    const element = grid.current;
    if (!element) return;
    let frame = 0;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const head = getHead();
      const at = Math.floor(head / pageSteps);
      setPage(at);
      element.style.setProperty("--head", String(head - at * pageSteps));
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [getHead, pageSteps]);

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
      className={styles.steps}
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
        <div key={row.id} className={styles.stepRow}>
          <span className={styles.stepPiece} title={row.label}>
            {row.icon ?? row.label}
          </span>
          {Array.from({ length: columns }, (_, c) => {
            const step = shown * pageSteps + c;
            return (
              <span
                key={step}
                className={styles.stepCell}
                data-hit={hits.has(`${r}:${step}`) || undefined}
                data-beat={step % perBeat === 0 || undefined}
                data-bar={step % barSteps === 0 || undefined}
                onPointerDown={(event) => {
                  event.preventDefault();
                  onToggle?.(r, step);
                }}
              />
            );
          })}
        </div>
      ))}
      <span
        className={styles.stepHead}
        data-recording={recording || undefined}
        aria-hidden="true"
      />
    </div>
  );
}

// A level shown over the current view, e.g. the volume while it changes.
// Without a value it is a message alone, e.g. asking for a second press.
export interface ScreenOverlay {
  label: string;
  // 0–1
  value?: number;
  display?: string;
}

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
      <span className={styles.selectionLabel}>{label}</span>{" "}
      <span className={styles.selectionValue}>{value}</span>
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
    <span className={styles.padBadge} role="img" aria-label={label}>
      {children}
    </span>
  );
}

// Whatever the green knob moves through (a page counter, a param), in green.
export function ScreenSeek({ children }: { children: ReactNode }) {
  return <span className={styles.seeking}>{children}</span>;
}

// A level the red knob sets, in red.
export function ScreenLevel({ children }: { children: ReactNode }) {
  return <span className={styles.selectionLabel}>{children}</span>;
}

// A value the blue knob sets, in blue.
export function ScreenValue({ children }: { children: ReactNode }) {
  return <span className={styles.selectionValue}>{children}</span>;
}

export interface DeviceScreenProps {
  view?: ScreenView;
  title: string;
  // The preset in the title has edits that aren't saved.
  unsaved?: boolean;
  status: ReactNode;
  footer: readonly [left: ReactNode, right: ReactNode];
  // Centred along the bottom in place of the footer.
  badges?: readonly ScreenBadge[];
  getAnalyser?: () => AnalyserNode | null;
  params?: readonly ScreenParam[];
  page?: number;
  tiles?: readonly ScreenTile[];
  selected?: number;
  onSelect?: (index: number) => void;
  // Dragging a track's loop edge on the tracks view: which row, which edge
  // and where on the timeline (beats).
  onLoopEdge?: (index: number, edge: "start" | "end", beats: number) => void;
  // A clip edge's drag starting and ending.
  onLoopEdgeDrag?: (dragging: boolean) => void;
  // Tapping a param on the synth view selects it, like the red knob.
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
}

export const PARAMS_PER_PAGE = 15;
export const TILES_PER_PAGE: Record<string, number> = {
  save: 48,
  presets: 8,
  chords: 8,
  chordStyle: 8,
  album: 8,
  revert: 8,
};

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
  footer,
  badges,
  getAnalyser = noAnalyser,
  params = [],
  page = 0,
  tiles = [],
  selected = 0,
  onSelect,
  onLoopEdge,
  onLoopEdgeDrag,
  onSelectParam,
  readouts = [],
  lfoShape = 0,
  lfoRate = 1,
  timing = DEFAULT_TIMING,
  beat = null,
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

  return (
    <div className={cn(styles.screen, className)}>
      <div className={styles.glass}>
        <div className={styles.readout}>
          <span className={styles.title}>
            <span aria-live="polite">{title}</span>
            {unsaved && <span className={styles.unsaved}>Unsaved</span>}
          </span>
          <span>{status}</span>
        </div>

        {(view === "adsr" || view === "lfo" || view === "fx") &&
          readouts.length === 4 && (
            <div className={styles.module}>
              {view === "adsr" && <EnvelopeGraph stages={readouts} />}
              {view === "lfo" && (
                <LfoGraph
                  shape={lfoShape}
                  depth={readouts[1].amount}
                  rate={lfoRate}
                />
              )}
              {view === "fx" && <FxMeters stages={readouts} />}
              <div className={styles.stages}>
                {readouts.map((stage, i) => (
                  <span key={stage.label} className={styles.stage}>
                    <span>{stage.label}</span>
                    <span style={{ color: KNOB_COLORS[i] }}>
                      {stage.display}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

        {view === "tempo" && (
          <div className={styles.tempo}>
            <span className={styles.bpm}>
              <span className={styles.seeking}>{timing.bpm}</span>
              <span className={styles.bpmUnit}>BPM</span>
            </span>
            <span className={styles.beats} aria-hidden="true">
              {Array.from({ length: timing.meter.beats }, (_, i) => (
                <span
                  key={i}
                  className={styles.beat}
                  data-on={beat === i || undefined}
                />
              ))}
            </span>
          </div>
        )}

        {view === "tracks" && (
          <TrackList
            className={styles.tracks}
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
              <span className={styles.tracksEmpty}>
                Save a take in record mode to add a track
              </span>
            ) : (
              tracks
                .slice(trackTop, trackTop + TRACKS_SHOWN)
                .map((track, i) => {
                  const index = trackTop + i;
                  return (
                    <Button
                      key={track.id}
                      variant="ghost"
                      tone="secondary"
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
                      className={styles.track}
                      data-quiet={!track.audible || undefined}
                      data-potential={track.potential || undefined}
                      {...keepFocus}
                      onClick={() => onSelect?.(index)}
                    >
                      <span className={styles.trackLabel} aria-hidden="true">
                        <span className={styles.trackName}>
                          {!track.potential && (
                            <span className={styles.trackNumber}>#{index}</span>
                          )}
                          {track.name}
                        </span>
                        {!track.potential && (
                          <span className={styles.trackFlags}>
                            <span data-on={track.muted || undefined}>M</span>
                            <span data-on={track.soloed || undefined}>S</span>
                          </span>
                        )}
                      </span>
                      <span
                        className={styles.trackVolume}
                        data-empty={track.potential || undefined}
                        aria-hidden="true"
                      >
                        {!track.potential && (
                          <span style={{ height: `${track.volume * 100}%` }} />
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
            className={styles.roll}
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
          <Oscilloscope className={styles.scope} getAnalyser={getAnalyser} />
        )}

        {view === "synth" && (
          <div className={styles.params} role="group" aria-label="Parameters">
            {params
              .slice(page * PARAMS_PER_PAGE, (page + 1) * PARAMS_PER_PAGE)
              .map((param, i) => (
                <Button
                  key={param.id}
                  variant="ghost"
                  tone="secondary"
                  aria-label={`${param.label}: ${param.value}`}
                  aria-pressed={param.selected ?? false}
                  className={cn(
                    styles.param,
                    param.selected && styles.selected,
                  )}
                  {...keepFocus}
                  onClick={() => onSelectParam?.(page * PARAMS_PER_PAGE + i)}
                >
                  <span className={styles.paramLabel}>{param.label}</span>
                  <span className={styles.paramValue}>{param.value}</span>
                </Button>
              ))}
          </div>
        )}

        {(view === "save" ||
          view === "presets" ||
          view === "chords" ||
          view === "chordStyle" ||
          view === "album" ||
          view === "revert") && (
          <div
            className={cn(styles.tiles, view === "save" && styles.iconTiles)}
            role="group"
            aria-label={
              view === "save"
                ? "Preset icon"
                : view === "chords"
                  ? "Chord palette"
                  : view === "chordStyle"
                    ? "Chord style"
                    : view === "album"
                      ? "Album"
                      : view === "revert"
                        ? "Revert"
                        : "Preset library"
            }
          >
            {visibleTiles.map((tile, i) => {
              const index = tilePage * perPage + i;
              return (
                <Button
                  key={tile.id}
                  variant="ghost"
                  tone="secondary"
                  aria-label={tile.label}
                  aria-pressed={index === selected}
                  className={styles.tile}
                  {...keepFocus}
                  onClick={() => onSelect?.(index)}
                >
                  <span className={styles.tileIcon} aria-hidden="true">
                    {tile.icon}
                  </span>
                  {(view === "presets" ||
                    view === "chords" ||
                    view === "chordStyle" ||
                    view === "album" ||
                    view === "revert") && (
                    <span className={styles.tileName} aria-hidden="true">
                      {tile.label}
                    </span>
                  )}
                  {tile.badge && (
                    <span className={styles.badge} aria-hidden="true">
                      {tile.badge}
                    </span>
                  )}
                </Button>
              );
            })}
          </div>
        )}

        {badges ? (
          <div
            className={cn(styles.badges, view === "roll" && styles.rollCaption)}
            aria-live="polite"
          >
            {badges.map(({ label, on }) => (
              <span key={label} className={styles.switchLabel}>
                {label}
                {on !== undefined && (
                  <span className={styles.switch} data-on={on || undefined}>
                    {on ? "On" : "Off"}
                  </span>
                )}
              </span>
            ))}
          </div>
        ) : (
          <div
            className={cn(
              styles.readout,
              styles.readoutBottom,
              view === "roll" && styles.rollCaption,
            )}
          >
            <span>{footer[0]}</span>
            <span>{footer[1]}</span>
          </div>
        )}

        {overlay && (
          <div
            className={styles.overlay}
            role={overlay.value === undefined ? "status" : undefined}
            aria-hidden={overlay.value !== undefined || undefined}
          >
            <div
              className={styles.meter}
              data-message={overlay.value === undefined || undefined}
            >
              {overlay.value === undefined ? (
                <div className={styles.meterMessage}>{overlay.label}</div>
              ) : (
                <>
                  <div className={styles.meterLabel}>
                    <span>{overlay.label}</span>
                    <span>{overlay.display}</span>
                  </div>
                  <div className={styles.meterTrack}>
                    <div
                      className={styles.meterFill}
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
