import { useEffect, useEffectEvent, useRef, type CSSProperties } from "react";
import { Button } from "./Button";
import { tv } from "../../lib/utils";
import { keepFocus } from "./Pad";

export type KnobProps = {
  label: string;
  valueLabel?: string;
  step: number;
  steps?: number;
  color?: string;
  markColor?: string;
  onChange?: (step: number) => void;
  className?: string;
  // Continuous: the value is a float over 0..steps-1 and one drag covers the
  // whole range, for scrubbing rather than stepping.
  fine?: boolean;
};

const TEETH = 36;
// [radius %, angle offset in degrees] of the four corners of each tooth.
const TOOTH_PROFILE = [
  [46.5, 0],
  [50, 1.5],
  [50, 5],
  [46.5, 6.5],
];

const GEAR_EDGE = `polygon(${Array.from({ length: TEETH }, (_, tooth) =>
  TOOTH_PROFILE.map(([radius, offset]) => {
    const angle = ((tooth * 360) / TEETH + offset) * (Math.PI / 180);
    const x = 50 + radius * Math.cos(angle);
    const y = 50 + radius * Math.sin(angle);
    return `${x.toFixed(2)}% ${y.toFixed(2)}%`;
  }),
)
  .flat()
  .join(", ")})`;

// Pad-sized (68px) unless a container sets --knob-size; its parts scale
// with it. Keyboard focus shows just an outline: it has no box shadow of its
// own, and drops a soft shadow that follows the gear edge.
const knob = tv({
  slots: {
    base: "group relative inline-flex size-(--size) cursor-ew-resize touch-none items-center justify-center rounded-[50%] drop-shadow-knob select-none [--size:var(--knob-size,68px)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#2f7de1] focus-visible:outline-solid",
    cap: "flex size-full items-center justify-center bg-(--knob-color) bg-[radial-gradient(circle,rgb(0_0_0/0)_72%,rgb(0_0_0/0.22)_88%,rgb(0_0_0/0.34)_100%)] transition-transform duration-200 ease-[ease] motion-reduce:transition-none",
    top: "flex size-[calc(var(--size)*52/68)] justify-center rounded-[50%] bg-(--knob-color) bg-[radial-gradient(circle_at_38%_30%,rgb(255_255_255/0.42),rgb(255_255_255/0)_55%),radial-gradient(circle,rgb(0_0_0/0)_70%,rgb(0_0_0/0.12))] shadow-[0_0_0_1.5px_rgb(0_0_0/0.14),0_1px_2px_rgb(0_0_0/0.25)] group-active:brightness-95",
    mark: "mt-[calc(var(--size)*5/68)] h-[calc(var(--size)*14/68)] w-[calc(var(--size)*4/68)] rounded-[2px] bg-(--knob-mark)",
  },
});

const styles = knob();

// Horizontal drag distance and trackpad scroll distance (px) per detent.
const DRAG_STEP = 24;
const WHEEL_STEP = 50;
// With `fine`, a horizontal drag of this many px covers the whole range, and
// one wheel notch or click moves this fraction of it.
const FINE_TRAVEL = 260;
const FINE_NOTCH = 120;

export function Knob({
  label,
  valueLabel,
  step,
  steps = 4,
  color = "#1d1d1f",
  markColor = "#ffffff",
  onChange,
  className,
  fine = false,
}: KnobProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const drag = useRef<{
    pointerId: number;
    x: number;
    step: number;
    moved: boolean;
  } | null>(null);
  const dragged = useRef(false);
  const angle = -135 + (270 / (steps - 1)) * step;

  const set = (next: number) => {
    const clamped = Math.min(steps - 1, Math.max(0, next));
    if (clamped !== step) onChange?.(clamped);
  };

  const nudge = useEffectEvent((detents: number) =>
    set(step + (fine ? (detents * (steps - 1)) / FINE_NOTCH : detents)),
  );

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let travel = 0;
    // React registers wheel listeners as passive, so preventDefault needs a native listener.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const notch =
        event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL ||
        Math.abs(event.deltaY) >= WHEEL_STEP;
      travel = notch
        ? -Math.sign(event.deltaY) * WHEEL_STEP
        : travel - event.deltaY;
      const detents = Math.trunc(travel / WHEEL_STEP);
      if (detents === 0) return;
      travel -= detents * WHEEL_STEP;
      nudge(detents);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <Button
      ref={ref}
      unstyled
      aria-label={valueLabel ? `${label}: ${valueLabel}` : label}
      className={styles.base({ className })}
      style={
        { "--knob-color": color, "--knob-mark": markColor } as CSSProperties
      }
      {...keepFocus}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          step,
          moved: false,
        };
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start || start.pointerId !== event.pointerId) return;
        const distance = event.clientX - start.x;
        if (Math.abs(distance) >= 4) start.moved = true;
        set(
          fine
            ? start.step + (distance / FINE_TRAVEL) * (steps - 1)
            : start.step + Math.trunc(distance / DRAG_STEP),
        );
      }}
      onPointerUp={() => {
        dragged.current = drag.current?.moved ?? false;
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
        onChange?.(
          fine
            ? Math.min(steps - 1, step + (steps - 1) / FINE_NOTCH)
            : (step + 1) % steps,
        );
      }}
    >
      <span
        className={styles.cap()}
        style={{ clipPath: GEAR_EDGE, transform: `rotate(${angle}deg)` }}
      >
        <span className={styles.top()}>
          <span className={styles.mark()} />
        </span>
      </span>
    </Button>
  );
}
