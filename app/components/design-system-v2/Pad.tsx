import type { CSSProperties, MouseEvent, PointerEvent, ReactNode } from "react";
import { Button } from "../design-system/Button";
import { cn } from "../../lib/utils";
import styles from "./Pad.module.css";

export interface PadProps {
  label: string;
  accent?: string;
  lit?: boolean;
  pressed?: boolean;
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

export function Pad({
  label,
  accent = "#3aa655",
  lit = false,
  pressed,
  onPress,
  children,
  className,
}: PadProps) {
  return (
    <Button
      variant="ghost"
      tone="secondary"
      aria-label={label}
      aria-pressed={pressed}
      data-lit={lit || pressed || undefined}
      className={cn(styles.pad, className)}
      style={{ "--pad-accent": accent } as CSSProperties}
      {...pressProps(onPress)}
    >
      {children && (
        <span className={styles.face} aria-hidden="true">
          {children}
        </span>
      )}
    </Button>
  );
}
