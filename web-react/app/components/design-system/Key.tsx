import {
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Button } from "./Button";
import { tv } from "../../lib/utils";
import { keepFocus } from "./Pad";

export type KeyProps = {
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
};

// 50 × 210px white and 30 × 128px black keys unless a container sets the
// sizes, with the keycap and note low on the key. Own transitions would snap
// to the end colour while --theme-dark fades (Firefox), so it has none.
const key = tv({
  slots: {
    base: "relative inline-flex cursor-pointer touch-none items-center justify-center text-center select-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#2f7de1] focus-visible:outline-solid",
    labels:
      "pointer-events-none absolute right-0 bottom-[16px] left-0 flex flex-col items-center gap-[6px] leading-none",
    hotkey:
      "grid h-[18px] min-w-[18px] place-items-center rounded-[5px] border border-current/35 px-[4px] text-[10px] font-semibold [font-family:inherit]",
    note: "text-[13px] font-bold tracking-[0.01em] [&_svg]:block [&_svg]:size-[18px]",
  },
  variants: {
    variant: {
      white: {
        base: "h-[var(--white-key-height,210px)] w-[var(--white-key-width,50px)] rounded-b-[8px] bg-key-white text-[#5f5d57] shadow-key-white",
      },
      black: {
        base: "z-2 h-[var(--black-key-height,128px)] w-[var(--black-key-width,30px)] rounded-b-[6px] bg-key-black text-white/72 shadow-key-black",
        labels: "gap-[5px]",
        hotkey: "h-[16px] min-w-[16px] px-[3px]",
        note: "text-[10px] [&_svg]:size-[16px]",
      },
    },
    lit: { true: {} },
  },
  compoundVariants: [
    {
      variant: "white",
      lit: true,
      class: { base: "bg-key-white-lit shadow-key-white-lit" },
    },
    {
      variant: "black",
      lit: true,
      class: { base: "bg-key-black-lit shadow-key-black-lit" },
    },
  ],
});

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
  const styles = key({ variant, lit });
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
      unstyled
      aria-label={label}
      aria-keyshortcuts={hotkey}
      className={styles.base({ className })}
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
        <span className={styles.labels()} aria-hidden="true">
          {hotkey && <kbd className={styles.hotkey()}>{hotkey}</kbd>}
          {note && <span className={styles.note()}>{note}</span>}
        </span>
      )}
    </Button>
  );
}
