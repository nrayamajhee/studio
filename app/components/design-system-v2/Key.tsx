import {
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Button } from "../design-system/Button";
import { cn } from "../../lib/utils";
import { keepFocus } from "./Pad";
import styles from "./Key.module.css";

export interface KeyProps {
  label: string;
  variant?: "white" | "black";
  // The engraved note name, or an icon (e.g. a drum piece).
  note?: ReactNode;
  hotkey?: string;
  lit?: boolean;
  onPress?: () => void;
  onRelease?: () => void;
  className?: string;
  style?: CSSProperties;
}

// Space is the Device's Play key, so only Return presses a focused control.
const isActivation = (event: KeyboardEvent) => event.key === "Enter";

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
  // Whether the pointer is what holds this key, so hovering off a key held
  // from the keyboard leaves it sounding.
  const pointerHeld = useRef(false);
  const pointerPress = () => {
    pointerHeld.current = true;
    onPress?.();
  };
  const pointerRelease = () => {
    if (!pointerHeld.current) return;
    pointerHeld.current = false;
    release();
  };

  return (
    <Button
      variant="ghost"
      tone="secondary"
      aria-label={label}
      aria-keyshortcuts={hotkey}
      data-lit={lit || undefined}
      className={cn(styles.key, styles[variant], className)}
      style={style}
      {...keepFocus}
      // Held down, the pointer slides from key to key, playing each one it
      // enters, even after leaving the keybed and coming back. Touch captures
      // its pointer by default, so it lets go to slide too.
      onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0) return;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        pointerPress();
      }}
      onPointerEnter={(event) => {
        if (event.buttons & 1) pointerPress();
      }}
      onPointerLeave={pointerRelease}
      onPointerUp={pointerRelease}
      onPointerCancel={pointerRelease}
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
