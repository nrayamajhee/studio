import type { CSSProperties, KeyboardEvent } from "react";
import { Button } from "../design-system/Button";
import { cn } from "../../lib/utils";
import styles from "./Key.module.css";

export interface KeyProps {
  label: string;
  variant?: "white" | "black";
  note?: string;
  hotkey?: string;
  lit?: boolean;
  onPress?: () => void;
  onRelease?: () => void;
  className?: string;
  style?: CSSProperties;
}

const isActivation = (event: KeyboardEvent) =>
  event.key === " " || event.key === "Enter";

export function Key({
  label,
  variant = "white",
  note,
  hotkey,
  lit = false,
  onPress,
  onRelease,
  className,
  style,
}: KeyProps) {
  const release = () => onRelease?.();

  return (
    <Button
      variant="ghost"
      tone="secondary"
      aria-label={label}
      aria-keyshortcuts={hotkey}
      data-lit={lit || undefined}
      className={cn(styles.key, styles[variant], className)}
      style={style}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        onPress?.();
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onKeyDown={(event) => {
        if (!isActivation(event)) return;
        event.preventDefault();
        if (!event.repeat) onPress?.();
      }}
      onKeyUp={(event) => {
        if (!isActivation(event)) return;
        event.preventDefault();
        release();
      }}
      onBlur={release}
    >
      {(note || hotkey) && (
        <span className={styles.labels} aria-hidden="true">
          {hotkey && <kbd className={styles.hotkey}>{hotkey}</kbd>}
          {note && <span className={styles.note}>{note}</span>}
        </span>
      )}
    </Button>
  );
}
