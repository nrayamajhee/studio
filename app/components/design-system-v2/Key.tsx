import type { CSSProperties } from "react";
import { Button } from "../design-system/Button";
import { Card } from "./Card";
import { cn } from "../../lib/utils";
import styles from "./Key.module.css";

export interface KeyProps {
  note: string;
  label?: string;
  glyph?: string;
  ariaLabel?: string;
  hotkey?: string;
  variant?: "white" | "black";
  isPressed?: boolean;
  isSelected?: boolean;
  onPress?: (note: string) => void;
  onRelease?: (note: string) => void;
  className?: string;
  style?: CSSProperties;
}

export function Key({
  note,
  label,
  glyph,
  ariaLabel,
  hotkey,
  variant = "white",
  isPressed = false,
  isSelected = false,
  onPress,
  onRelease,
  className,
  style,
}: KeyProps) {
  return (
    <Card
      asChild
      variant="glass"
      elevation="low"
      className={cn(
        styles.key,
        variant === "black" && styles.black,
        glyph && styles.glyphKey,
        isSelected && styles.selected,
        className,
      )}
      style={style}
    >
      <Button
        type="button"
        variant="ghost"
        tone="secondary"
        aria-label={ariaLabel ?? `Play ${note.replace("#", " sharp ")}`}
        aria-keyshortcuts={hotkey?.toLowerCase()}
        aria-pressed={isPressed}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          onPress?.(note);
        }}
        onPointerUp={() => onRelease?.(note)}
        onPointerCancel={() => onRelease?.(note)}
        onLostPointerCapture={() => onRelease?.(note)}
        onKeyDown={(event) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            if (!event.repeat) onPress?.(note);
          }
        }}
        onKeyUp={(event) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            onRelease?.(note);
          }
        }}
        onBlur={() => onRelease?.(note)}
      >
        {glyph ? (
          <span className={styles.glyph} aria-hidden="true">
            {glyph}
          </span>
        ) : (
          <span className={styles.labels} aria-hidden="true">
            {hotkey && (
              <kbd className={styles.hotkey}>{hotkey.toUpperCase()}</kbd>
            )}
            {variant === "white" && (
              <span className={styles.note}>
                {label ?? note.replace(/-?\d+$/, "")}
              </span>
            )}
          </span>
        )}
      </Button>
    </Card>
  );
}
