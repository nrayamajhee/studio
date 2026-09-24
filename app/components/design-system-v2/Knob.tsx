import { useRef } from "react";
import { Card } from "./Card";
import { cn } from "../../lib/utils";
import styles from "./Knob.module.css";

export interface KnobProps {
  label: string;
  value: number;
  displayValue?: string;
  onChange: (value: number) => void;
  className?: string;
}

export function Knob({
  label,
  value,
  displayValue = `${value}%`,
  onChange,
  className,
}: KnobProps) {
  const drag = useRef<{
    pointerId: number;
    x: number;
    value: number;
  } | null>(null);

  return (
    <label className={cn(styles.control, className)}>
      <span className={styles.knobTrack}>
        <span className={styles.ticks} aria-hidden="true">
          {[-135, 135].map((angle) => (
            <span
              key={angle}
              className={styles.tick}
              style={{ transform: `rotate(${angle}deg)` }}
            />
          ))}
        </span>
        <Card
          asChild
          variant="glass"
          elevation="low"
          aria-hidden="true"
          className={cn(
            styles.knob,
            "rounded-full bg-surface-light/25 p-2 dark:bg-surface-light/25",
          )}
          style={{ transform: `rotate(${-135 + value * 2.7}deg)` }}
        >
          <span>
            <span className={styles.indicator} />
          </span>
        </Card>
        <input
          className={styles.knobInput}
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          aria-label={label}
          aria-valuetext={displayValue}
          onChange={(event) => onChange(Number(event.target.value))}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = {
              pointerId: event.pointerId,
              x: event.clientX,
              value,
            };
          }}
          onPointerMove={(event) => {
            const start = drag.current;
            if (!start || start.pointerId !== event.pointerId) return;
            const distance = event.clientX - start.x;
            onChange(
              Math.max(
                0,
                Math.min(100, Math.round(start.value + distance / 1.6)),
              ),
            );
          }}
          onPointerUp={(event) => {
            drag.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onLostPointerCapture={() => {
            drag.current = null;
          }}
        />
      </span>
      <span className={styles.controlLabel}>{label}</span>
      <span className={styles.controlValue}>{displayValue}</span>
    </label>
  );
}
