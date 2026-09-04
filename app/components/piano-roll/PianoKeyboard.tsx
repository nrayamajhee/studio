import React, { useState } from "react";
import {
  WHITE_KEY_NAMES,
  HORIZONTAL_BLACK_KEYS,
  VERTICAL_WHITE_KEYS,
  VERTICAL_BLACK_KEYS,
  ROW_HEIGHT,
} from "./types";
import { synth } from "../../lib/synth";
import { Button } from "../design-system/Button";
import { cn } from "../../lib/utils";

export interface PianoKeyboardProps {
  className?: string;
  octaves?: number;
  startOctave?: number;
  activeNotes?: string[];
  onKeyClick?: (note: string) => void;
  showLabels?: "all" | "c-only" | "none";
  playAudio?: boolean;
  orientation?: "horizontal" | "vertical";
  includeEndC?: boolean;
  disabled?: boolean;
}

export const PianoKeyboard: React.FC<PianoKeyboardProps> = ({
  className,
  octaves = 2,
  startOctave = 4,
  activeNotes = [],
  onKeyClick,
  showLabels = "c-only",
  playAudio = true,
  orientation = "horizontal",
  includeEndC = true,
  disabled = false,
}) => {
  const [pressedNote, setPressedNote] = useState<string | null>(null);
  const activeSet = new Set(activeNotes);

  const octaveList = Array.from(
    { length: Math.max(1, octaves) },
    (_, idx) => startOctave + idx,
  );

  const handleKeyInteraction = (noteFullName: string) => {
    if (disabled) return;
    setPressedNote(noteFullName);
    if (playAudio) {
      synth.playNote(noteFullName, undefined, 0.45);
    }
    if (onKeyClick) {
      onKeyClick(noteFullName);
    }
    setTimeout(() => {
      setPressedNote((current) => (current === noteFullName ? null : current));
    }, 180);
  };

  if (orientation === "vertical") {
    const descendingOctaves = [...octaveList].reverse();

    return (
      <div
        role="group"
        aria-label="Piano keyboard"
        className={cn(
          "inline-flex flex-col select-none bg-stone-900 border-r-2 border-stone-300 dark:border-stone-700 shadow-md",
          className,
        )}
      >
        {descendingOctaves.map((octave) => {
          const octaveHeight = 12 * ROW_HEIGHT;
          const upperHeight = 7 * ROW_HEIGHT;
          const lowerHeight = 5 * ROW_HEIGHT;
          const upperKeyHeight = upperHeight / 4;
          const lowerKeyHeight = lowerHeight / 3;

          return (
            <div
              key={octave}
              className="relative w-32 sm:w-40 flex-shrink-0"
              style={{ height: octaveHeight }}
            >
              <div className="absolute inset-0 flex flex-col z-10">
                {VERTICAL_WHITE_KEYS.map((keyDef) => {
                  const fullName = `${keyDef.name}${octave}`;
                  const isPressed = pressedNote === fullName;
                  const isActive = activeSet.has(fullName);
                  const isC = keyDef.name === "C";
                  const height =
                    keyDef.group === "upper" ? upperKeyHeight : lowerKeyHeight;

                  return (
                    <Button
                      key={fullName}
                      variant="solid"
                      tone="secondary"
                      size="sm"
                      disabled={disabled}
                      onClick={() => handleKeyInteraction(fullName)}
                      aria-label={`Key ${fullName}`}
                      style={{ height }}
                      className={cn(
                        "w-full rounded-none border-0 border-b border-stone-200 dark:border-stone-800 px-3 text-xs font-mono font-medium transition-colors text-stone-800 dark:text-stone-100 cursor-pointer select-none justify-end active:translate-y-0",
                        "bg-white dark:bg-stone-100 hover:bg-stone-100 dark:hover:bg-stone-200 active:bg-stone-200",
                        isC &&
                          "border-b-2 border-b-primary/50 dark:border-b-primary/50",
                        (isActive || isPressed) &&
                          "!bg-primary/20 ring-2 ring-primary ring-inset",
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            isC ? "font-bold text-primary" : "text-stone-700",
                          )}
                        >
                          {showLabels === "all" ||
                          (showLabels === "c-only" && isC)
                            ? fullName
                            : ""}
                        </span>
                        {isC && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-primary text-white">
                            C{octave}
                          </span>
                        )}
                      </span>
                    </Button>
                  );
                })}
              </div>

              {VERTICAL_BLACK_KEYS.map((keyDef) => {
                const fullName = `${keyDef.name}${octave}`;
                const isPressed = pressedNote === fullName;
                const isActive = activeSet.has(fullName);
                const top = keyDef.rowIndex * ROW_HEIGHT;

                return (
                  <Button
                    key={fullName}
                    variant="solid"
                    tone="secondary"
                    size="sm"
                    disabled={disabled}
                    onClick={() => handleKeyInteraction(fullName)}
                    aria-label={`Key ${fullName}`}
                    style={{
                      top,
                      height: ROW_HEIGHT,
                    }}
                    className={cn(
                      "absolute left-0 z-20 w-20 sm:w-24 px-2.5 text-xs font-mono rounded-none rounded-r border-0 border-y border-r border-stone-700 cursor-pointer select-none transition-all justify-between active:translate-y-0",
                      "bg-gradient-to-r from-stone-900 to-stone-950 text-stone-100 shadow-md shadow-black/50 hover:brightness-125 active:brightness-90",
                      (isActive || isPressed) &&
                        "!from-primary-dark !to-primary text-white !shadow-primary/50 ring-1 ring-primary-light",
                    )}
                  >
                    <span className="text-[10px] font-medium opacity-90">
                      {showLabels === "all" ? fullName : ""}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-stone-700/80" />
                  </Button>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Piano keyboard"
      className={cn(
        "inline-flex flex-col select-none rounded-lg p-2.5 bg-stone-900 dark:bg-stone-950 shadow-2xl border border-stone-800",
        className,
      )}
    >
      <div className="h-3 w-full bg-gradient-to-b from-stone-950 via-stone-800 to-stone-900 rounded-t border-b border-stone-950/80 flex items-center justify-between px-3">
        <div className="h-1 w-10 bg-amber-600/50 rounded-full" />
        <span className="text-[9px] font-mono tracking-widest text-stone-400 uppercase font-semibold">
          Studio Piano
        </span>
        <div className="h-1 w-10 bg-amber-600/50 rounded-full" />
      </div>

      <div className="relative flex overflow-x-auto p-1 bg-stone-950/60 rounded-b shadow-inner">
        {octaveList.map((octave) => (
          <div key={octave} className="relative flex flex-shrink-0">
            <div className="flex flex-row">
              {WHITE_KEY_NAMES.map((keyName) => {
                const fullName = `${keyName}${octave}`;
                const isPressed = pressedNote === fullName;
                const isActive = activeSet.has(fullName);
                const isC = keyName === "C";

                return (
                  <Button
                    key={fullName}
                    variant="solid"
                    tone="secondary"
                    size="sm"
                    disabled={disabled}
                    onClick={() => handleKeyInteraction(fullName)}
                    aria-label={`Key ${fullName}`}
                    className={cn(
                      "w-10 sm:w-12 h-36 sm:h-44 flex flex-col justify-end pb-3 items-center rounded-none rounded-b-md border-0 border-x border-b border-stone-300 dark:border-stone-400 transition-all cursor-pointer select-none p-0 active:translate-y-0.5",
                      "bg-gradient-to-b from-stone-50 via-white to-stone-100 hover:from-blue-50 hover:to-white active:bg-stone-200 text-stone-800",
                      (isActive || isPressed) &&
                        "!bg-primary/20 ring-2 ring-primary ring-inset",
                    )}
                  >
                    {(showLabels === "all" ||
                      (showLabels === "c-only" && isC)) && (
                      <span
                        className={cn(
                          "text-[11px] font-mono font-medium",
                          isC
                            ? "font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/30"
                            : "text-stone-500",
                        )}
                      >
                        {fullName}
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>

            {HORIZONTAL_BLACK_KEYS.map((keyDef) => {
              const fullName = `${keyDef.name}${octave}`;
              const isPressed = pressedNote === fullName;
              const isActive = activeSet.has(fullName);

              return (
                <Button
                  key={fullName}
                  variant="solid"
                  tone="secondary"
                  size="sm"
                  disabled={disabled}
                  onClick={() => handleKeyInteraction(fullName)}
                  aria-label={`Key ${fullName}`}
                  style={{
                    left: `${(keyDef.seamIndex / 7) * 100}%`,
                  }}
                  className={cn(
                    "absolute top-0 z-20 -translate-x-1/2 w-6 sm:w-7 h-24 sm:h-28 flex flex-col justify-end pb-2 items-center rounded-none rounded-b-sm border-0 border-x border-b border-stone-700 transition-all cursor-pointer select-none p-0 active:translate-y-0.5",
                    "bg-gradient-to-b from-stone-800 via-stone-900 to-black text-stone-200 shadow-md shadow-black/60 hover:brightness-125 active:brightness-95",
                    (isActive || isPressed) &&
                      "!from-primary-dark !to-primary text-white !shadow-primary/50 ring-1 ring-primary-light",
                  )}
                >
                  {showLabels === "all" && (
                    <span className="text-[9px] font-mono font-medium opacity-80">
                      {fullName}
                    </span>
                  )}
                </Button>
              );
            })}
          </div>
        ))}

        {includeEndC &&
          (() => {
            const endOctave = startOctave + octaves;
            const endNoteName = `C${endOctave}`;
            const isPressed = pressedNote === endNoteName;
            const isActive = activeSet.has(endNoteName);

            return (
              <div className="relative flex flex-shrink-0">
                <Button
                  variant="solid"
                  tone="secondary"
                  size="sm"
                  disabled={disabled}
                  onClick={() => handleKeyInteraction(endNoteName)}
                  aria-label={`Key ${endNoteName}`}
                  className={cn(
                    "w-10 sm:w-12 h-36 sm:h-44 flex flex-col justify-end pb-3 items-center rounded-none rounded-b-md border-0 border-x border-b border-stone-300 dark:border-stone-400 transition-all cursor-pointer select-none p-0 active:translate-y-0.5",
                    "bg-gradient-to-b from-stone-50 via-white to-stone-100 hover:from-blue-50 hover:to-white active:bg-stone-200 text-stone-800",
                    (isActive || isPressed) &&
                      "!bg-primary/20 ring-2 ring-primary ring-inset",
                  )}
                >
                  {showLabels !== "none" && (
                    <span className="text-[11px] font-mono font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/30">
                      {endNoteName}
                    </span>
                  )}
                </Button>
              </div>
            );
          })()}
      </div>
    </div>
  );
};

export default PianoKeyboard;
