import { useEffect, useEffectEvent, useRef, type CSSProperties } from "react";
import { Button } from "./Button";
import { cn } from "../../lib/utils";
import { keepFocus } from "./Pad";
import styles from "./Knob.module.css";

export interface KnobProps {
  label: string;
  valueLabel?: string;
  step: number;
  steps?: number;
  color?: string;
  markColor?: string;
  onChange?: (step: number) => void;
  className?: string;
}

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

// Horizontal drag distance and trackpad scroll distance (px) per detent.
const DRAG_STEP = 24;
const WHEEL_STEP = 50;

export function Knob({
  label,
  valueLabel,
  step,
  steps = 4,
  color = "#1d1d1f",
  markColor = "#ffffff",
  onChange,
  className,
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

  const nudge = useEffectEvent((detents: number) => set(step + detents));

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
      variant="ghost"
      tone="secondary"
      aria-label={valueLabel ? `${label}: ${valueLabel}` : label}
      className={cn(styles.knob, className)}
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
        set(start.step + Math.trunc(distance / DRAG_STEP));
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
        onChange?.((step + 1) % steps);
      }}
    >
      <span
        className={styles.cap}
        style={{ clipPath: GEAR_EDGE, transform: `rotate(${angle}deg)` }}
      >
        <span className={styles.top}>
          <span className={styles.mark} />
        </span>
      </span>
    </Button>
  );
}
