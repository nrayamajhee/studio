import {
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Button } from "./Button";
import { tv } from "../../lib/utils";

export type PadProps = {
  label: string;
  accent?: string;
  lit?: boolean;
  pressed?: boolean;
  // Held down from outside, e.g. while its keyboard hotkey is held.
  held?: boolean;
  // Keyboard shortcut, shown as a small keycap in the top-right corner.
  hotkey?: string;
  // An LED in the top-left corner for a state the pad shows without being
  // pressed, e.g. a module switched on. Undefined leaves the pad without one.
  indicator?: boolean;
  onPress?: () => void;
  children?: ReactNode;
  className?: string;
};

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

// The Device is played from the keyboard, so a pointer press must not leave a
// control focused: Space or Return would then press it again natively. It also
// ends keyboard navigation, handing Space and Return back to the hotkeys.
export const keepFocus = {
  onMouseDown: (event: MouseEvent) => {
    event.preventDefault();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  },
};

// Space is the Device's Play key, so only Return presses a focused control.
const isActivation = (event: KeyboardEvent) => event.key === "Enter";

// Own transitions would snap to the end colour while --theme-dark fades
// (Firefox), so the pad has none. Its keycap badge sits in the top-right
// corner, smaller than the piano keys'; the LED mirrors it, its centre as
// far from the top-left corner.
const pad = tv({
  slots: {
    base: "relative inline-flex size-[68px] cursor-pointer touch-manipulation items-center justify-center rounded-[12px] bg-pad text-center text-pad-ink shadow-pad select-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#2f7de1] focus-visible:outline-solid",
    face: "grid place-items-center text-[15px] leading-none font-bold tracking-[0.01em] [&_svg]:size-[22px]",
    hotkey:
      "absolute top-[6px] right-[6px] grid h-[13px] min-w-[13px] place-items-center rounded-[4px] border border-current/35 px-[3px] text-[8px] leading-none font-semibold [font-family:inherit]",
    indicator:
      "absolute top-[9px] left-[9px] size-[7px] rounded-[50%] bg-current/25",
  },
  variants: {
    lit: { true: { base: "bg-(--pad-accent) text-white shadow-pad-lit" } },
    // Held down: the lip shrinks and the top shades in, like a held key.
    held: { true: { base: "bg-pad-held shadow-pad-held" } },
    on: {
      true: {
        indicator: "bg-(--pad-accent) shadow-[0_0_6px_var(--pad-accent)]",
      },
    },
  },
  compoundVariants: [
    {
      lit: true,
      held: true,
      class: {
        base: "bg-[color-mix(in_srgb,var(--pad-accent),#000000_12%)] shadow-pad-lit-held",
      },
    },
    // On a lit pad the accent is the pad itself, so the LED glows white.
    {
      lit: true,
      on: true,
      class: {
        indicator: "bg-white shadow-[0_0_6px_rgb(255_255_255/0.7)]",
      },
    },
  ],
});

export function Pad({
  label,
  accent = "#4ba078",
  lit = false,
  pressed,
  held = false,
  hotkey,
  indicator,
  onPress,
  children,
  className,
}: PadProps) {
  const [down, setDown] = useState(false);
  const press = pressProps(onPress);
  const release = () => setDown(false);
  const styles = pad({
    lit: lit || pressed,
    held: held || down,
    on: Boolean(indicator),
  });

  return (
    <Button
      unstyled
      aria-label={label}
      aria-pressed={pressed}
      aria-keyshortcuts={hotkey}
      className={styles.base({ className })}
      style={{ "--pad-accent": accent } as CSSProperties}
      onPointerDown={(event) => {
        if (event.button === 0) setDown(true);
        press.onPointerDown(event);
      }}
      onClick={press.onClick}
      {...keepFocus}
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
      {indicator !== undefined && (
        <span className={styles.indicator()} aria-hidden="true" />
      )}
      {hotkey && (
        <kbd className={styles.hotkey()} aria-hidden="true">
          {hotkey}
        </kbd>
      )}
      {children && (
        <span className={styles.face()} aria-hidden="true">
          {children}
        </span>
      )}
    </Button>
  );
}
