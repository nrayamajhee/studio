import { useEffect, useEffectEvent, useRef } from "react";
import { barMs, beatMs, type Timing } from "./noteRecorder";
import type { RollFrame } from "../../hooks/useTransport";

export type NoteRollProps = {
  getFrame: () => RollFrame;
  timing: Timing;
  // The time on the keys line, when scrolled back from the frame's `now`.
  position?: number | null;
  // The lowest note in view; ROLL_LANES semitones show up from it.
  low?: number;
  // Sideways wheel scrolling over the roll, in ms (positive is later).
  onScroll?: (ms: number) => void;
  // Wheel scrolling up and down, in semitones (positive is higher).
  onScrollPitch?: (semitones: number) => void;
  className?: string;
};

// C0 to C10, the range of the studio's piano roll, two octaves of it in view
// at a time, a lane a semitone.
export const ROLL_LOW = 12;
export const ROLL_HIGH = 132;
export const ROLL_LANES = 25;
// The highest the view's lowest note goes.
export const ROLL_TOP = ROLL_HIGH - ROLL_LANES + 1;
const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const BLACK = new Set([1, 3, 6, 8, 10]);
const isBlack = (midi: number) => BLACK.has(midi % 12);
export const rollNote = (midi: number) =>
  `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
// Two bars of history beside the keys.
const ROLL_BARS = 2;
// Grid steps get a line once they are this far apart (CSS px).
const STEP_LINE_GAP = 6;
const KEYS_WIDTH = 30;
// The black keys' share of the keys' width, at the side facing the notes.
const BLACK_DEPTH = 0.55;
const LABEL_FONT = "ui-monospace, SFMono-Regular, Menlo, monospace";

// The take as a piano roll: the keys stand along the left, high notes at the
// top, each C named on its key, and the keys are now. Recording, notes run
// out of them to the right as they are played, in red; otherwise what's
// coming lies to the right and moves left into them, green as it plays.
// Lines for the meter scroll with them: bars brightest, then beats, then the
// grid's steps.
export function NoteRoll({
  getFrame,
  timing,
  position = null,
  low = 52,
  onScroll,
  onScrollPitch,
  className,
}: NoteRollProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const timed = useRef(timing);
  const scrolled = useRef(position);
  const lowest = useRef(low);
  const scroll = useRef(onScroll);
  const scrollPitch = useRef(onScrollPitch);
  const readFrame = useEffectEvent(getFrame);

  useEffect(() => {
    timed.current = timing;
    scrolled.current = position;
    lowest.current = low;
    scroll.current = onScroll;
    scrollPitch.current = onScrollPitch;
  }, [timing, position, low, onScroll, onScrollPitch]);

  // Each wheel move goes the way it mostly points. Sideways (the roll is
  // stopped), the notes follow it, a roll's width of travel scrolling its
  // whole span of time; up and
  // down, a lane of travel moves a semitone, and turning back starts afresh.
  // React registers wheel listeners as passive, so preventDefault needs a
  // native one.
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let travel = 0;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        const span = ROLL_BARS * barMs(timed.current);
        const reach = element.clientWidth - KEYS_WIDTH;
        scroll.current?.((event.deltaX / reach) * span);
        return;
      }
      if (!scrollPitch.current || event.deltaY === 0) return;
      if (Math.sign(event.deltaY) !== Math.sign(travel)) travel = 0;
      travel += event.deltaY;
      const lane = element.clientHeight / ROLL_LANES;
      const semitones = Math.trunc(travel / lane);
      if (semitones === 0) return;
      travel -= semitones * lane;
      scrollPitch.current(-semitones);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    let frame = 0;

    const draw = () => {
      frame = requestAnimationFrame(draw);
      const ratio = window.devicePixelRatio || 1;
      const width = Math.round(element.clientWidth * ratio);
      const height = Math.round(element.clientHeight * ratio);
      if (element.width !== width || element.height !== height) {
        element.width = width;
        element.height = height;
      }
      context.clearRect(0, 0, width, height);
      const style = getComputedStyle(element);
      const ink = style.color;
      const background = style.getPropertyValue("--color-screen");
      const { now: live, notes, state } = readFrame();
      const now = scrolled.current ?? live;
      const color =
        state === "recording"
          ? style.getPropertyValue("--color-synth-red")
          : state === "playing"
            ? style.getPropertyValue("--color-synth-green")
            : ink;

      const bottom = lowest.current;
      const top = bottom + ROLL_LANES - 1;
      const lane = height / ROLL_LANES;
      const laneTop = (midi: number) => height - (midi - bottom + 1) * lane;
      const keysWidth = KEYS_WIDTH * ratio;
      const blackLeft = keysWidth * (1 - BLACK_DEPTH);
      const floor = keysWidth + 3 * ratio;
      const reach = width - floor;
      const { meter } = timed.current;
      // With no grid, the lines are the beats.
      const perBeat = timed.current.perBeat || 1;
      const step = beatMs(timed.current) / perBeat;
      const span = ROLL_BARS * barMs(timed.current);
      const recording = state === "recording";
      const from = recording ? now - span : now;
      const to = recording ? now : now + span;
      const xAt = (time: number) =>
        floor + ((recording ? now - time : time - now) / span) * reach;

      context.fillStyle = ink;
      const steps =
        timed.current.perBeat > 0 &&
        (step / span) * reach >= STEP_LINE_GAP * ratio;
      for (let k = Math.ceil(from / step); k * step <= to; k++) {
        const bar = k % (meter.beats * perBeat) === 0;
        const beat = k % perBeat === 0;
        if (!bar && !beat && !steps) continue;
        context.globalAlpha = bar ? 0.24 : beat ? 0.09 : 0.035;
        context.fillRect(Math.round(xAt(k * step)), 0, ratio, height);
      }

      const sounding = new Set<number>();
      context.fillStyle = color;
      for (const { note, start, duration, velocity } of notes) {
        const end = start + duration;
        if (note < bottom || note > top || end < from || start > to) continue;
        if (state !== "stopped" && start <= live && end >= live)
          sounding.add(note);
        const left = Math.max(floor, Math.min(xAt(start), xAt(end)));
        const right = Math.min(width, Math.max(xAt(start), xAt(end)));
        context.globalAlpha = 0.45 + 0.55 * velocity;
        context.beginPath();
        context.roundRect(
          left,
          laneTop(note) + ratio / 2,
          Math.max(ratio, right - left),
          lane - ratio,
          ratio,
        );
        context.fill();
      }

      // A white key reaches halfway into each black neighbour's lane.
      for (let midi = bottom - 1; midi <= top + 1; midi++) {
        if (isBlack(midi)) continue;
        const upper = isBlack(midi + 1)
          ? laneTop(midi + 1) + lane / 2
          : laneTop(midi);
        const lower = isBlack(midi - 1)
          ? laneTop(midi - 1) + lane / 2
          : laneTop(midi) + lane;
        context.globalAlpha = sounding.has(midi) ? 1 : 0.8;
        context.fillStyle = sounding.has(midi) ? color : ink;
        context.fillRect(
          0,
          upper + ratio / 2,
          keysWidth,
          lower - upper - ratio,
        );
      }
      for (let midi = bottom; midi <= top; midi++) {
        if (!isBlack(midi)) continue;
        context.globalAlpha = 1;
        context.fillStyle = sounding.has(midi) ? color : background;
        context.fillRect(blackLeft, laneTop(midi), keysWidth - blackLeft, lane);
      }

      context.globalAlpha = 0.85;
      context.fillStyle = background;
      context.font = `600 ${Math.min(8, (lane / ratio) * 1.1) * ratio}px ${LABEL_FONT}`;
      context.textAlign = "left";
      context.textBaseline = "middle";
      for (let midi = Math.ceil(bottom / 12) * 12; midi <= top; midi += 12) {
        const middle = laneTop(midi) + lane * 0.25;
        context.fillText(rollNote(midi), 2 * ratio, middle);
      }
      context.globalAlpha = 1;
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={canvas} className={className} aria-hidden="true" />;
}
