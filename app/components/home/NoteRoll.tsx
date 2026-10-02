import { useEffect, useRef } from "react";
import { barMs, beatMs, type Timing } from "./noteRecorder";
import type { RollFrame } from "./useTransport";

export interface NoteRollProps {
  getFrame: () => RollFrame;
  timing: Timing;
  // The time on the keys line, when scrolled back from the frame's `now`.
  position?: number | null;
  // Wheel scrolling over the roll, in ms (positive is later).
  onScroll?: (ms: number) => void;
  className?: string;
}

// C0 to C10, the range of the studio's piano roll.
const LOW = 12;
const HIGH = 132;
const BLACK = new Set([1, 3, 6, 8, 10]);
const isBlack = (midi: number) => BLACK.has(midi % 12);
// White keys below each note, for laying keys and lanes out left to right.
const WHITES_BELOW: number[] = [];
for (let midi = LOW, whites = 0; midi <= HIGH; midi++) {
  WHITES_BELOW[midi] = whites;
  if (!isBlack(midi)) whites++;
}
const WHITE_KEYS = WHITES_BELOW[HIGH] + 1;
// Two bars of history above the keys.
export const ROLL_BARS = 2;
// Grid steps get a line once they are this far apart (CSS px).
const STEP_LINE_GAP = 6;
const KEYS_HEIGHT = 14;
const LABELS_HEIGHT = 14;
const LABEL_FONT = "ui-monospace, SFMono-Regular, Menlo, monospace";

// The take as a piano roll lying on its side: the keys run along the bottom,
// minimal white and black bars labelled at each C, and notes rise out of them
// as they play, red while recording and green on playback. Lines for the
// meter scroll with them: bars brightest, then beats, then the grid's steps.
export function NoteRoll({
  getFrame,
  timing,
  position = null,
  onScroll,
  className,
}: NoteRollProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const timed = useRef(timing);
  const scrolled = useRef(position);
  const scroll = useRef(onScroll);

  useEffect(() => {
    timed.current = timing;
    scrolled.current = position;
    scroll.current = onScroll;
  }, [timing, position, onScroll]);

  // A full roll height of wheel travel scrolls one window. React registers
  // wheel listeners as passive, so preventDefault needs a native one.
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!scroll.current) return;
      event.preventDefault();
      const span = ROLL_BARS * barMs(timed.current);
      scroll.current((event.deltaY / element.clientHeight) * span);
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
      const { now: live, notes, state } = getFrame();
      const now = scrolled.current ?? live;
      const color =
        state === "recording"
          ? style.getPropertyValue("--screen-red")
          : state === "playing"
            ? style.getPropertyValue("--screen-green")
            : ink;

      const keyWidth = width / WHITE_KEYS;
      const blackWidth = keyWidth * 0.62;
      const labelsTop = height - LABELS_HEIGHT * ratio;
      const keysTop = labelsTop - KEYS_HEIGHT * ratio;
      const floor = keysTop - 3 * ratio;
      const { meter } = timed.current;
      // With no grid, the lines are the beats.
      const perBeat = timed.current.perBeat || 1;
      const step = beatMs(timed.current) / perBeat;
      const span = ROLL_BARS * barMs(timed.current);
      const yAt = (time: number) => floor - ((now - time) / span) * floor;
      const lane = (midi: number) =>
        isBlack(midi)
          ? [WHITES_BELOW[midi] * keyWidth - blackWidth / 2, blackWidth]
          : [WHITES_BELOW[midi] * keyWidth + ratio / 2, keyWidth - ratio];

      context.fillStyle = ink;
      const steps =
        timed.current.perBeat > 0 &&
        (step / span) * floor >= STEP_LINE_GAP * ratio;
      for (let k = Math.ceil((now - span) / step); k * step <= now; k++) {
        const bar = k % (meter.beats * perBeat) === 0;
        const beat = k % perBeat === 0;
        if (!bar && !beat && !steps) continue;
        context.globalAlpha = bar ? 0.24 : beat ? 0.09 : 0.035;
        context.fillRect(0, Math.round(yAt(k * step)), width, ratio);
      }

      const sounding = new Set<number>();
      context.fillStyle = color;
      for (const { note, start, duration, velocity } of notes) {
        const end = start + duration;
        if (note < LOW || note > HIGH || end < now - span || start > now)
          continue;
        if (state !== "stopped" && start <= live && end >= live)
          sounding.add(note);
        const [x, w] = lane(note);
        const top = Math.max(0, yAt(start));
        const bottom = Math.min(floor, yAt(end));
        context.globalAlpha = 0.45 + 0.55 * velocity;
        context.beginPath();
        context.roundRect(x, top, w, Math.max(ratio, bottom - top), ratio);
        context.fill();
      }

      for (let midi = LOW; midi <= HIGH; midi++) {
        if (isBlack(midi)) continue;
        const [x, w] = lane(midi);
        context.globalAlpha = sounding.has(midi) ? 1 : 0.8;
        context.fillStyle = sounding.has(midi) ? color : ink;
        context.fillRect(x, keysTop, w, KEYS_HEIGHT * ratio);
      }
      for (let midi = LOW; midi <= HIGH; midi++) {
        if (!isBlack(midi)) continue;
        const [x, w] = lane(midi);
        context.globalAlpha = 1;
        context.fillStyle = sounding.has(midi)
          ? color
          : style.getPropertyValue("--screen-bg");
        context.fillRect(x, keysTop, w, KEYS_HEIGHT * 0.6 * ratio);
      }

      context.globalAlpha = 0.6;
      context.fillStyle = ink;
      context.font = `500 ${10 * ratio}px ${LABEL_FONT}`;
      context.textBaseline = "bottom";
      for (let midi = LOW; midi <= HIGH; midi += 12) {
        const x = (WHITES_BELOW[midi] + 0.5) * keyWidth;
        context.textAlign =
          midi === LOW ? "left" : midi === HIGH ? "right" : "center";
        context.fillText(
          `C${midi / 12 - 1}`,
          midi === LOW ? 0 : midi === HIGH ? width : x,
          height,
        );
      }
      context.globalAlpha = 1;
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [getFrame]);

  return <canvas ref={canvas} className={className} aria-hidden="true" />;
}
