import React from "react";
import { Button } from "../design-system/Button";
import { cn } from "../../lib/utils";

export interface PianoKeyProps {
  variant?: "white" | "black";
  note: string;
  hotkey?: string;
  isActive?: boolean;
  isPressed?: boolean;
  isC?: boolean;
  showHotkey?: boolean;
  showLabel?: boolean;
  orientation?: "horizontal" | "vertical";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const PianoKey: React.FC<PianoKeyProps> = ({
  variant = "white",
  note,
  hotkey,
  isActive = false,
  isPressed = false,
  isC = false,
  showHotkey = false,
  showLabel = true,
  orientation = "horizontal",
  disabled = false,
  onClick,
  className,
  style,
}) => {
  const activeOrPressed = isActive || isPressed;

  if (orientation === "vertical") {
    if (variant === "black") {
      return (
        <Button
          variant="solid"
          tone="secondary"
          size="sm"
          disabled={disabled}
          onClick={onClick}
          aria-label={`Key ${note}`}
          style={style}
          className={cn(
            "h-8 w-20 sm:w-24 px-2.5 text-xs font-mono rounded-none rounded-r border-0 border-y border-r border-stone-700 cursor-pointer select-none transition-all justify-between active:translate-y-0",
            "bg-gradient-to-r from-stone-900 to-stone-950 text-stone-100 shadow-md shadow-black/60 hover:brightness-125 active:brightness-90",
            activeOrPressed &&
              "!from-primary-dark !to-primary text-white !shadow-primary/50 ring-1 ring-primary-light",
            className,
          )}
        >
          <span className="text-[10px] font-medium opacity-90">
            {showLabel ? note : ""}
          </span>
          {showHotkey && hotkey ? (
            <kbd className="text-[9px] font-mono px-1 py-0.5 rounded bg-stone-800 text-stone-300">
              {hotkey}
            </kbd>
          ) : (
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-colors",
                activeOrPressed ? "bg-primary-light" : "bg-stone-700/80",
              )}
            />
          )}
        </Button>
      );
    }

    return (
      <Button
        variant="solid"
        tone="secondary"
        size="sm"
        disabled={disabled}
        onClick={onClick}
        aria-label={`Key ${note}`}
        style={style}
        className={cn(
          "w-full h-8 rounded-none border-0 border-b border-stone-200 dark:border-stone-800 px-3 text-xs font-mono font-medium transition-colors text-stone-800 dark:text-stone-900 cursor-pointer select-none justify-end active:translate-y-0",
          "bg-white hover:bg-stone-100 active:bg-stone-200",
          isC &&
            "border-b-2 border-b-primary/50 dark:border-b-primary/50 font-bold",
          activeOrPressed && "!bg-primary/20 ring-2 ring-primary ring-inset",
          className,
        )}
      >
        <span className="flex items-center gap-1.5">
          {showHotkey && hotkey && (
            <kbd className="text-[9px] font-mono px-1 py-0.5 rounded bg-stone-200 text-stone-600">
              {hotkey}
            </kbd>
          )}
          {showLabel && (
            <span
              className={cn(isC ? "font-bold text-stone-900" : "text-stone-700")}
            >
              {note}
            </span>
          )}
          {isC && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-primary text-white">
              {note}
            </span>
          )}
        </span>
      </Button>
    );
  }

  if (variant === "black") {
    return (
      <Button
        variant="solid"
        tone="secondary"
        size="sm"
        disabled={disabled}
        onClick={onClick}
        aria-label={`Key ${note}`}
        style={style}
        className={cn(
          "w-6 sm:w-7 h-24 sm:h-28 flex flex-col justify-end pb-2 items-center rounded-none rounded-b-sm border-0 border-x border-b border-stone-700 transition-all cursor-pointer select-none p-0 active:translate-y-0.5",
          "bg-gradient-to-b from-stone-800 via-stone-900 to-black text-stone-200 shadow-md shadow-black/60 hover:brightness-125 active:brightness-95",
          activeOrPressed &&
            "!from-primary-dark !to-primary text-white !shadow-primary/50 ring-1 ring-primary-light",
          className,
        )}
      >
        {showHotkey && hotkey && (
          <kbd className="text-[8px] font-mono px-1 rounded bg-stone-800 text-stone-300 mb-1">
            {hotkey}
          </kbd>
        )}
        {showLabel && (
          <span className="text-[9px] font-mono font-medium opacity-80">
            {note}
          </span>
        )}
      </Button>
    );
  }

  return (
    <Button
      variant="solid"
      tone="secondary"
      size="sm"
      disabled={disabled}
      onClick={onClick}
      aria-label={`Key ${note}`}
      style={style}
      className={cn(
        "w-10 sm:w-12 h-36 sm:h-44 flex flex-col justify-end pb-3 items-center rounded-none rounded-b-md border-0 border-x border-b border-stone-300 dark:border-stone-400 transition-all cursor-pointer select-none p-0 active:translate-y-0.5",
        "bg-gradient-to-b from-stone-50 via-white to-stone-100 hover:from-blue-50 hover:to-white active:bg-stone-200 text-stone-800",
        activeOrPressed && "!bg-primary/20 ring-2 ring-primary ring-inset",
        className,
      )}
    >
      {showHotkey && hotkey && (
        <kbd className="text-[9px] font-mono px-1 rounded bg-stone-200 text-stone-600 mb-1">
          {hotkey}
        </kbd>
      )}
      {showLabel && (
        <span
          className={cn(
            "text-[11px] font-mono font-medium",
            isC
              ? "font-bold text-stone-900 dark:text-stone-100 px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
              : "text-stone-500",
          )}
        >
          {note}
        </span>
      )}
    </Button>
  );
};

export default PianoKey;
