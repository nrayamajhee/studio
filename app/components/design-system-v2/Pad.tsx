import {
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Button } from "../design-system/Button";
import { cn } from "../../lib/utils";
import styles from "./Pad.module.css";

export interface PadProps {
  label: string;
  accent?: string;
  lit?: boolean;
  pressed?: boolean;
  // Held down from outside, e.g. while its keyboard hotkey is held.
  held?: boolean;
  onPress?: () => void;
  children?: ReactNode;
  className?: string;
}

export function pressProps(onPress?: () => void) {
  return {
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (event.button === 0) onPress?.();
    },
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      // Pointer presses already fired on pointerdown; a click with detail 0 comes from the keyboard.
      if (event.detail === 0) onPress?.();
    },
  };
}

const isActivation = (event: KeyboardEvent) =>
  event.key === " " || event.key === "Enter";

export function Pad({
  label,
  accent = "#4ba078",
  lit = false,
  pressed,
  held = false,
  onPress,
  children,
  className,
}: PadProps) {
  const [down, setDown] = useState(false);
  const press = pressProps(onPress);
  const release = () => setDown(false);

  return (
    <Button
      variant="ghost"
      tone="secondary"
      aria-label={label}
      aria-pressed={pressed}
      data-lit={lit || pressed || undefined}
      data-held={held || down || undefined}
      className={cn(styles.pad, className)}
      style={{ "--pad-accent": accent } as CSSProperties}
      onPointerDown={(event) => {
        if (event.button === 0) setDown(true);
        press.onPointerDown(event);
      }}
      onClick={press.onClick}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onKeyDown={(event) => {
        if (isActivation(event) && !event.repeat) setDown(true);
      }}
      onKeyUp={(event) => {
        if (isActivation(event)) release();
      }}
      onBlur={release}
    >
      {children && (
        <span className={styles.face} aria-hidden="true">
          {children}
        </span>
      )}
    </Button>
  );
}
