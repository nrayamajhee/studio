import React, { useState, useMemo, useRef, useEffect } from "react";
import { generate10OctavesNotes, ACTIVE_STEPS, GROUP_SIZE } from "./types";
import { Button } from "../design-system/Button";
import { cn } from "../../lib/utils";

export interface PianoRollProps {
  className?: string;
  initialActiveNotes?: string[];
  onNotesChange?: (activeNotes: string[]) => void;
}

export const PianoRoll: React.FC<PianoRollProps> = ({
  className,
  initialActiveNotes,
  onNotesChange,
}) => {
  const notes = useMemo(() => generate10OctavesNotes(), []);
  const containerRef = useRef<HTMLDivElement>(null);
  const c4RowRef = useRef<HTMLDivElement | null>(null);

  const [activeNotes, setActiveNotes] = useState<Set<string>>(() => {
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
  });

  // Auto-scroll vertically on mount so C4 is centered
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

  const toggleNote = (noteFullName: string, stepIndex: number) => {
    const noteKey = `${noteFullName}-${stepIndex}`;
    setActiveNotes((prev) => {
      const next = new Set(prev);
      if (next.has(noteKey)) {
        next.delete(noteKey);
      } else {
        next.add(noteKey);
      }
      if (onNotesChange) {
        onNotesChange(Array.from(next));
      }
      return next;
    });
  };

  return (
    <div
      className={cn(
        "flex flex-col w-full h-full flex-1 overflow-hidden bg-surface-light dark:bg-surface-dark",
        className,
      )}
    >
      {/* Main Scrollable Canvas */}
      <div
        ref={containerRef}
        className="flex-1 w-full overflow-auto relative bg-surface-light dark:bg-stone-950 select-none"
      >
        <div className="flex flex-col min-w-max w-full">
          {/* Subtone Timeline Header (Sticky Top) */}
          <div className="sticky top-0 z-20 flex w-full bg-surface dark:bg-stone-900 border-b border-stone-300 dark:border-stone-700 shadow-sm">
            {/* Header label above key buttons */}
            <div className="sticky left-0 z-30 w-32 sm:w-40 flex-shrink-0 bg-surface dark:bg-stone-900 px-3 py-2 text-xs font-bold text-font-light dark:text-font-light border-r-2 border-stone-300 dark:border-stone-700 flex items-center justify-between">
              <span>Keys</span>
              <span className="font-mono text-[11px] opacity-70">10 Oct</span>
            </div>

            {/* 16 Active Subtone Steps (4 Groups of 4) */}
            <div className="flex flex-shrink-0">
              {Array.from({ length: ACTIVE_STEPS / GROUP_SIZE }).map(
                (_, groupIdx) => (
                  <div
                    key={groupIdx}
                    className="flex border-r-2 border-primary/50 dark:border-primary/50"
                  >
                    {Array.from({ length: GROUP_SIZE }).map((_, stepIdx) => {
                      const stepNumber = groupIdx * GROUP_SIZE + stepIdx;

                      return (
                        <div
                          key={stepNumber}
                          className={cn(
                            "w-10 sm:w-12 h-8 flex flex-col items-center justify-center font-mono text-[11px] border-r border-stone-200 dark:border-stone-800 transition-colors flex-shrink-0",
                            stepIdx === 0
                              ? "font-bold text-font dark:text-surface bg-surface-light/80 dark:bg-stone-800/80"
                              : "text-font-light dark:text-font-light",
                          )}
                        >
                          <span>{stepNumber + 1}</span>
                          <span className="text-[9px] opacity-60">
                            {groupIdx + 1}.{stepIdx + 1}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ),
              )}
            </div>

            {/* Extra Inactive Padding (Fills remaining width without horizontal scroll on wide screens) */}
            <div className="flex-1 min-w-0 bg-stone-200/80 dark:bg-stone-950 border-l-2 border-stone-400 dark:border-stone-600" />
          </div>

          {/* 10-Octave Note Rows */}
          <div className="flex flex-col w-full">
            {notes.map((note) => (
              <div
                key={note.id}
                ref={(el) => {
                  if (el && note.fullName === "C4") {
                    c4RowRef.current = el;
                  }
                }}
                className={cn(
                  "flex w-full h-7 sm:h-8 border-b border-stone-200/80 dark:border-stone-800/80 transition-colors",
                  note.isC &&
                    "border-b-2 border-b-primary/40 dark:border-b-primary/40",
                )}
              >
                {/* Horizontally placed Button as piano key (Sticky Left) */}
                <div className="sticky left-0 z-10 w-32 sm:w-40 flex-shrink-0 h-full">
                  <Button
                    variant="solid"
                    tone="secondary"
                    fullWidth
                    align="between"
                    size="sm"
                    aria-label={`Key ${note.fullName}`}
                    className={cn(
                      "h-full rounded-none border-0 border-r-2 border-stone-300 dark:border-stone-700 px-3 text-xs font-mono font-medium transition-colors cursor-pointer select-none",
                      note.isBlack
                        ? "!bg-stone-900 !text-stone-100 hover:!bg-stone-800 active:!bg-stone-700 dark:!bg-stone-950"
                        : "!bg-white !text-stone-900 hover:!bg-stone-100 active:!bg-stone-200 dark:!bg-stone-100",
                      note.isC &&
                        "!font-bold !text-primary dark:!text-primary-light ring-inset ring-1 ring-primary/30",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span>{note.fullName}</span>
                      {note.isC && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-primary text-white dark:bg-primary-dark">
                          C{note.octave}
                        </span>
                      )}
                    </span>

                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        note.isBlack ? "bg-stone-700" : "bg-stone-300",
                      )}
                    />
                  </Button>
                </div>

                {/* Active 16 Subtone Steps (4 Groups of 4) */}
                <div className="flex flex-shrink-0">
                  {Array.from({ length: ACTIVE_STEPS / GROUP_SIZE }).map(
                    (_, groupIdx) => (
                      <div
                        key={groupIdx}
                        className="flex border-r-2 border-primary/40 dark:border-primary/40"
                      >
                        {Array.from({ length: GROUP_SIZE }).map(
                          (_, stepIdx) => {
                            const stepNumber = groupIdx * GROUP_SIZE + stepIdx;
                            const noteKey = `${note.fullName}-${stepNumber}`;
                            const isNoteActive = activeNotes.has(noteKey);

                            return (
                              <Button
                                key={stepNumber}
                                variant="ghost"
                                tone="secondary"
                                size="sm"
                                onClick={() =>
                                  toggleNote(note.fullName, stepNumber)
                                }
                                aria-label={`${note.fullName} at step ${stepNumber + 1}`}
                                className={cn(
                                  "w-10 sm:w-12 h-full rounded-none border-0 border-r border-stone-200/70 dark:border-stone-800/70 transition-colors relative cursor-pointer flex-shrink-0 p-0 hover:bg-transparent",
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

                {/* Inactive Zone Padding (Fills remaining horizontal width) */}
                <div className="flex-1 min-w-0 bg-stone-200/50 dark:bg-black/70 border-l-2 border-stone-400/50 dark:border-stone-700/50" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PianoRoll;
