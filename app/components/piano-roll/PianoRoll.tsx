import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  generate10OctavesNotes,
  ACTIVE_STEPS,
  GROUP_SIZE,
  TOTAL_OCTAVES,
  ROW_HEIGHT,
  VERTICAL_WHITE_KEYS,
  VERTICAL_BLACK_KEYS,
} from "./types";
import { synth } from "../../lib/synth";
import { Button } from "../design-system/Button";
import { cn } from "../../lib/utils";

export interface PianoRollProps {
  className?: string;
  initialActiveNotes?: string[];
  activeNotes?: string[];
  onNotesChange?: (activeNotes: string[]) => void;
  currentStep?: number | null;
  isPlaying?: boolean;
  isRecording?: boolean;
}

export const PianoRoll: React.FC<PianoRollProps> = ({
  className,
  initialActiveNotes,
  activeNotes: controlledActiveNotes,
  onNotesChange,
  currentStep = null,
  isPlaying = false,
  isRecording = false,
}) => {
  const notes = useMemo(() => generate10OctavesNotes(), []);
  const containerRef = useRef<HTMLDivElement>(null);
  const c4RowRef = useRef<HTMLDivElement | null>(null);

  const [internalActiveNotes, setInternalActiveNotes] = useState<Set<string>>(
    () => {
      if (initialActiveNotes) {
        return new Set(initialActiveNotes);
      }
      return new Set([
        "C4-0",
        "E4-2",
        "G4-4",
        "B4-6",
        "C5-8",
        "G4-10",
        "E4-12",
        "C4-14",
      ]);
    },
  );

  const activeNotes = useMemo(() => {
    if (controlledActiveNotes !== undefined) {
      return new Set(controlledActiveNotes);
    }
    return internalActiveNotes;
  }, [controlledActiveNotes, internalActiveNotes]);

  const [pressedKey, setPressedKey] = useState<string | null>(null);

  const octavesList = useMemo(() => {
    return Array.from({ length: TOTAL_OCTAVES }, (_, i) => TOTAL_OCTAVES - i);
  }, []);

  const activePitches = useMemo(() => {
    const pitches = new Set<string>();
    for (const item of activeNotes) {
      const parts = item.split("-");
      if (parts.length >= 2) {
        pitches.add(parts[0]);
      }
    }
    return pitches;
  }, [activeNotes]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const c4El = c4RowRef.current;
      const container = containerRef.current;
      if (c4El && container) {
        const targetScrollTop =
          c4El.offsetTop - container.clientHeight / 2 + c4El.clientHeight / 2;
        container.scrollTop = Math.max(0, targetScrollTop);
      }
    }, 50);

    return () => clearTimeout(timeout);
  }, []);

  const handleKeyClick = (noteFullName: string) => {
    setPressedKey(noteFullName);
    synth.playNote(noteFullName, undefined, 0.4);
    setTimeout(() => {
      setPressedKey((current) => (current === noteFullName ? null : current));
    }, 180);
  };

  const toggleNote = (noteFullName: string, stepIndex: number) => {
    const noteKey = `${noteFullName}-${stepIndex}`;
    const next = new Set(activeNotes);
    if (next.has(noteKey)) {
      next.delete(noteKey);
    } else {
      next.add(noteKey);
      synth.playNote(noteFullName, undefined, 0.4);
    }

    if (controlledActiveNotes === undefined) {
      setInternalActiveNotes(next);
    }
    if (onNotesChange) {
      onNotesChange(Array.from(next));
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col w-full h-full flex-1 overflow-hidden bg-surface-light dark:bg-surface-dark",
        className,
      )}
    >
      <div
        ref={containerRef}
        className="flex-1 w-full overflow-auto relative bg-surface-light dark:bg-stone-950 select-none"
      >
        <div className="flex flex-col min-w-max w-full">
          <div className="sticky top-0 z-30 flex w-full bg-surface dark:bg-stone-900 border-b border-stone-300 dark:border-stone-700 shadow-sm">
            <div className="sticky left-0 z-40 w-32 sm:w-40 flex-shrink-0 bg-surface dark:bg-stone-900 px-3 py-2 border-r-2 border-stone-300 dark:border-stone-700" />

            <div className="flex flex-shrink-0">
              {Array.from({ length: ACTIVE_STEPS / GROUP_SIZE }).map(
                (_, groupIdx) => (
                  <div
                    key={groupIdx}
                    className="flex border-r-2 border-primary/50 dark:border-primary/50"
                  >
                    {Array.from({ length: GROUP_SIZE }).map((_, stepIdx) => {
                      const stepNumber = groupIdx * GROUP_SIZE + stepIdx;
                      const isCurrentStep = currentStep === stepNumber;

                      return (
                        <div
                          key={stepNumber}
                          className={cn(
                            "w-10 sm:w-12 h-8 flex flex-col items-center justify-center font-mono text-[11px] border-r border-stone-200 dark:border-stone-800 transition-colors flex-shrink-0",
                            isCurrentStep
                              ? "bg-primary text-white font-bold ring-1 ring-primary-light"
                              : stepIdx === 0
                                ? "font-bold text-font dark:text-surface bg-surface-light/80 dark:bg-stone-800/80"
                                : "text-font-light dark:text-font-light",
                          )}
                        >
                          <span>{stepNumber + 1}</span>
                          <span
                            className={cn(
                              "text-[9px]",
                              isCurrentStep ? "opacity-90" : "opacity-60",
                            )}
                          >
                            {groupIdx + 1}.{stepIdx + 1}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ),
              )}
            </div>

            <div className="flex-1 min-w-0 bg-stone-200/80 dark:bg-stone-950 border-l-2 border-stone-400 dark:border-stone-600" />
          </div>

          <div className="flex w-full relative">
            <div className="sticky left-0 z-20 w-32 sm:w-40 flex-shrink-0 flex flex-col bg-stone-900 border-r-2 border-stone-300 dark:border-stone-700 shadow-md">
              {octavesList.map((octave) => {
                const upperHeight = 7 * ROW_HEIGHT;
                const lowerHeight = 5 * ROW_HEIGHT;
                const upperKeyHeight = upperHeight / 4;
                const lowerKeyHeight = lowerHeight / 3;

                return (
                  <div
                    key={octave}
                    className="relative w-full flex-shrink-0"
                    style={{ height: 12 * ROW_HEIGHT }}
                  >
                    <div className="absolute inset-0 flex flex-col z-10">
                      {VERTICAL_WHITE_KEYS.map((keyDef) => {
                        const fullName = `${keyDef.name}${octave}`;
                        const isPressed = pressedKey === fullName;
                        const hasActiveNote = activePitches.has(fullName);
                        const isC = keyDef.name === "C";
                        const height =
                          keyDef.group === "upper"
                            ? upperKeyHeight
                            : lowerKeyHeight;

                        return (
                          <Button
                            key={fullName}
                            variant="solid"
                            tone="secondary"
                            size="sm"
                            onClick={() => handleKeyClick(fullName)}
                            aria-label={`Key ${fullName}`}
                            style={{ height }}
                            className={cn(
                              "w-full rounded-none border-0 border-b border-stone-300 dark:border-stone-300 px-3 text-xs font-mono font-medium transition-colors cursor-pointer select-none justify-end active:translate-y-0",
                              "!bg-gradient-to-r !from-stone-50 !via-white !to-stone-100 dark:!from-stone-50 dark:!via-white dark:!to-stone-100 hover:!from-amber-50 hover:!to-white active:!bg-stone-200 !text-stone-900 dark:!text-stone-900 shadow-sm",
                              isC &&
                                "border-b-2 border-b-primary/60 dark:border-b-primary/60 font-bold",
                              (hasActiveNote || isPressed) &&
                                "!bg-[#f1c784] dark:!bg-[#f1c784] ring-2 ring-[#d4a359] ring-inset !from-[#f1c784] !to-[#f1c784] dark:!from-[#f1c784] dark:!to-[#f1c784]",
                            )}
                          >
                            <span className="flex items-center gap-1.5">
                              {hasActiveNote && (
                                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                              )}
                              <span
                                className={cn(
                                  isC
                                    ? "font-bold text-primary dark:text-primary"
                                    : "text-stone-800 dark:text-stone-800 font-semibold",
                                )}
                              >
                                {fullName}
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
                      const isPressed = pressedKey === fullName;
                      const hasActiveNote = activePitches.has(fullName);
                      const top = keyDef.rowIndex * ROW_HEIGHT;

                      return (
                        <Button
                          key={fullName}
                          variant="solid"
                          tone="secondary"
                          size="sm"
                          onClick={() => handleKeyClick(fullName)}
                          aria-label={`Key ${fullName}`}
                          style={{
                            top,
                            height: ROW_HEIGHT,
                          }}
                          className={cn(
                            "absolute left-0 z-20 w-20 sm:w-24 px-2.5 text-xs font-mono rounded-none rounded-r border-0 border-y border-r border-stone-700 cursor-pointer select-none transition-all justify-between active:translate-y-0",
                            "!bg-gradient-to-r !from-stone-800 !via-stone-900 !to-black !text-stone-200 shadow-md shadow-black/80 hover:brightness-125 active:brightness-90",
                            (hasActiveNote || isPressed) &&
                              "!from-[#d4a359] !to-[#b5873e] !text-stone-950 !shadow-[#d4a359]/50 ring-1 ring-[#f1c784]",
                          )}
                        >
                          <span className="text-[10px] font-medium opacity-90">
                            {fullName}
                          </span>
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full transition-colors",
                              hasActiveNote
                                ? "bg-primary-light"
                                : "bg-stone-700/80",
                            )}
                          />
                        </Button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col flex-1 min-w-0">
              {notes.map((note) => (
                <div
                  key={note.id}
                  ref={(el) => {
                    if (el && note.fullName === "C4") {
                      c4RowRef.current = el;
                    }
                  }}
                  className={cn(
                    "flex w-full h-8 border-b border-stone-200/80 dark:border-stone-800/80 transition-colors",
                    note.isC &&
                      "border-b-2 border-b-primary/40 dark:border-b-primary/40",
                  )}
                >
                  <div className="flex flex-shrink-0">
                    {Array.from({ length: ACTIVE_STEPS / GROUP_SIZE }).map(
                      (_, groupIdx) => (
                        <div
                          key={groupIdx}
                          className="flex border-r-2 border-primary/40 dark:border-primary/40"
                        >
                          {Array.from({ length: GROUP_SIZE }).map(
                            (_, stepIdx) => {
                              const stepNumber =
                                groupIdx * GROUP_SIZE + stepIdx;
                              const noteKey = `${note.fullName}-${stepNumber}`;
                              const isNoteActive = activeNotes.has(noteKey);
                              const isCurrentStep =
                                currentStep === stepNumber &&
                                (isPlaying || isRecording);

                              return (
                                <Button
                                  key={stepNumber}
                                  variant="solid"
                                  tone="secondary"
                                  size="sm"
                                  onClick={() =>
                                    toggleNote(note.fullName, stepNumber)
                                  }
                                  aria-label={`${note.fullName} at step ${stepNumber + 1}`}
                                  className={cn(
                                    "w-10 sm:w-12 h-full rounded-none border-0 border-r border-stone-200/70 dark:border-stone-800/70 transition-colors relative cursor-pointer flex-shrink-0 p-0 hover:bg-transparent",
                                    isCurrentStep &&
                                      "bg-primary/15 dark:bg-primary/25",
                                    note.isBlack
                                      ? "bg-stone-100/70 dark:bg-stone-900/50 hover:bg-stone-200/80 dark:hover:bg-stone-800/70"
                                      : "bg-surface-light dark:bg-stone-950/40 hover:bg-blue-50/50 dark:hover:bg-stone-900/40",
                                  )}
                                >
                                  {isNoteActive && (
                                    <div className="absolute inset-0.5 rounded-sm bg-gradient-to-r from-primary to-primary-light text-white font-mono text-[9px] font-bold flex items-center justify-center shadow-sm pointer-events-none">
                                      {note.fullName}
                                    </div>
                                  )}
                                </Button>
                              );
                            },
                          )}
                        </div>
                      ),
                    )}
                  </div>

                  <div className="flex-1 min-w-0 bg-stone-200/50 dark:bg-black/70 border-l-2 border-stone-400/50 dark:border-stone-700/50" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PianoRoll;
