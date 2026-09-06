import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  generate10OctavesNotes,
  TOTAL_OCTAVES,
  MAX_OCTAVE,
  ROW_HEIGHT,
  VERTICAL_WHITE_KEYS,
  VERTICAL_BLACK_KEYS,
  ROOT_KEYS,
  SCALES,
  isNoteInKey,
  transposeNote,
  PATTERN_PRESETS,
  type ScaleType,
  getTargetNoteForPreset,
  getPresetJumpConfig,
} from "./types";
import { synth } from "../../lib/synth";
import { Button } from "../design-system/Button";
import { Dropdown } from "../design-system/Dropdown";
import { cn } from "../../lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowLeftRight,
  Shuffle,
  ZoomIn,
} from "lucide-react";

export interface PianoRollProps {
  className?: string;
  initialActiveNotes?: string[];
  activeNotes?: string[];
  onNotesChange?: (activeNotes: string[]) => void;
  noteVelocities?: Record<string, number>;
  onNoteVelocitiesChange?: (velocities: Record<string, number>) => void;
  onNoteVelocityChange?: (noteKey: string, velocity: number) => void;
  currentStep?: number | null;
  isPlaying?: boolean;
  isRecording?: boolean;
  totalSteps?: number;
  onTotalStepsChange?: (steps: number) => void;
  velocity?: number;
  onVelocityChange?: (velocity: number) => void;
  selectedPreset?: string;
}

export const PianoRoll: React.FC<PianoRollProps> = ({
  className,
  initialActiveNotes,
  activeNotes: controlledActiveNotes,
  onNotesChange,
  noteVelocities: controlledNoteVelocities,
  onNoteVelocitiesChange,
  onNoteVelocityChange,
  currentStep = null,
  isPlaying = false,
  isRecording = false,
  totalSteps: controlledTotalSteps,
  onTotalStepsChange,
  velocity: controlledVelocity,
  onVelocityChange,
  selectedPreset = "grand_piano",
}) => {
  const notes = useMemo(() => generate10OctavesNotes(), []);
  const containerRef = useRef<HTMLDivElement>(null);
  const jumpConfig = useMemo(
    () => getPresetJumpConfig(selectedPreset),
    [selectedPreset],
  );
  const [activeJumpOctave, setActiveJumpOctave] = useState<number>(
    jumpConfig.defaultOctave,
  );

  const [internalVelocity, setInternalVelocity] = useState(85);
  const velocity = controlledVelocity ?? internalVelocity;

  const [internalNoteVelocities, setInternalNoteVelocities] = useState<
    Record<string, number>
  >(() => ({
    "C3-0": 85,
    "C4-0": 95,
    "E4-0": 80,
    "G4-0": 88,
    "C4-2": 90,
    "E4-2": 82,
    "G4-2": 85,
    "G2-4": 85,
  }));
  const noteVelocities = controlledNoteVelocities ?? internalNoteVelocities;

  const updateNoteVelocities = useCallback(
    (next: Record<string, number>) => {
      setInternalNoteVelocities(next);
      if (onNoteVelocitiesChange) {
        onNoteVelocitiesChange(next);
      }
    },
    [onNoteVelocitiesChange],
  );

  const handleNoteVelocityChange = useCallback(
    (noteKey: string, val: number) => {
      const clamped = Math.max(5, Math.min(100, Math.round(val)));
      const next = { ...noteVelocities, [noteKey]: clamped };
      updateNoteVelocities(next);
      if (onNoteVelocityChange) {
        onNoteVelocityChange(noteKey, clamped);
      }
    },
    [noteVelocities, updateNoteVelocities, onNoteVelocityChange],
  );

  const [hoveredNote, setHoveredNote] = useState<string | null>(null);
  const [isDraggingSlider, setIsDraggingSlider] = useState<string | null>(null);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDraggingSlider(null);
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);

  const handleVelocityChange = (val: number) => {
    const clamped = Math.max(10, Math.min(100, Math.round(val)));
    setInternalVelocity(clamped);
    if (onVelocityChange) {
      onVelocityChange(clamped);
    }
  };

  const [internalTotalSteps, setInternalTotalSteps] = useState(16);
  const totalSteps = controlledTotalSteps ?? internalTotalSteps;

  const setTotalSteps = (steps: number) => {
    setInternalTotalSteps(steps);
    if (onTotalStepsChange) {
      onTotalStepsChange(steps);
    }
  };

  const groupSize = totalSteps === 12 || totalSteps === 24 ? 3 : 4;
  const [rootKey, setRootKey] = useState<string>("C");
  const [scale, setScale] = useState<ScaleType>("chromatic");
  const [zoomLevel, setZoomLevel] = useState<"compact" | "normal" | "wide">("normal");

  const [internalActiveNotes, setInternalActiveNotes] = useState<Set<string>>(
    () => {
      if (initialActiveNotes) {
        return new Set(initialActiveNotes);
      }
      return new Set([
        "C3-0",
        "C4-0",
        "E4-0",
        "G4-0",
        "C4-2",
        "E4-2",
        "G4-2",
        "G2-4",
        "G3-4",
        "B3-4",
        "D4-4",
        "G3-6",
        "B3-6",
        "D4-6",
        "A2-8",
        "A3-8",
        "C4-8",
        "E4-8",
        "A3-10",
        "C4-10",
        "E4-10",
        "F2-12",
        "F3-12",
        "A3-12",
        "C4-12",
        "F3-14",
        "A3-14",
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

  const updateNotes = (next: Set<string>) => {
    if (controlledActiveNotes === undefined) {
      setInternalActiveNotes(next);
    }
    if (onNotesChange) {
      onNotesChange(Array.from(next));
    }
  };

  const [pressedKey, setPressedKey] = useState<string | null>(null);

  const octavesList = useMemo(() => {
    return Array.from({ length: TOTAL_OCTAVES }, (_, i) => MAX_OCTAVE - i);
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

  const scrollToNote = useCallback((targetNote: string, smooth = true) => {
    const container = containerRef.current;
    if (!container) return;
    const el = document.getElementById(`piano-roll-row-${targetNote}`);
    if (el) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = el.getBoundingClientRect();
      const relativeTop = targetRect.top - containerRect.top + container.scrollTop;
      const targetScrollTop =
        relativeTop - container.clientHeight / 2 + targetRect.height / 2;
      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }, []);

  const scrollToOctave = useCallback(
    (octave: number, smooth = true) => {
      scrollToNote(`C${octave}`, smooth);
    },
    [scrollToNote],
  );

  const handleJump = useCallback(
    (octave: number) => {
      setActiveJumpOctave(octave);
      scrollToOctave(octave);
    },
    [scrollToOctave],
  );

  const isFirstRender = useRef(true);

  useEffect(() => {
    const targetNote = getTargetNoteForPreset(selectedPreset);
    setActiveJumpOctave(jumpConfig.defaultOctave);
    const timeout = setTimeout(() => {
      scrollToNote(targetNote, !isFirstRender.current);
      isFirstRender.current = false;
    }, 60);

    return () => clearTimeout(timeout);
  }, [selectedPreset, jumpConfig.defaultOctave, scrollToNote]);

  const handleKeyClick = (noteFullName: string) => {
    setPressedKey(noteFullName);
    const vel = velocity / 100;
    const sustainSec = 0.8 + 1.2 * vel;
    synth.playNote(noteFullName, undefined, sustainSec, vel);
    setTimeout(() => {
      setPressedKey((current) => (current === noteFullName ? null : current));
    }, 180);
  };

  const toggleNote = (noteFullName: string, stepIndex: number) => {
    const noteKey = `${noteFullName}-${stepIndex}`;
    const next = new Set(activeNotes);
    if (next.has(noteKey)) {
      next.delete(noteKey);
      if (noteVelocities[noteKey] !== undefined) {
        const nextVel = { ...noteVelocities };
        delete nextVel[noteKey];
        updateNoteVelocities(nextVel);
      }
    } else {
      next.add(noteKey);
      const noteVel = noteVelocities[noteKey] ?? velocity;
      handleNoteVelocityChange(noteKey, noteVel);
      const vel = noteVel / 100;
      const sustainSec = 0.8 + 1.2 * vel;
      synth.playNote(noteFullName, undefined, sustainSec, vel);
    }
    updateNotes(next);
  };

  const shiftNotes = (offset: number) => {
    const next = new Set<string>();
    const nextVelocities: Record<string, number> = {};
    for (const item of activeNotes) {
      const lastDash = item.lastIndexOf("-");
      if (lastDash === -1) continue;
      const noteName = item.slice(0, lastDash);
      const step = parseInt(item.slice(lastDash + 1), 10);
      const newStep = (step + offset + totalSteps) % totalSteps;
      const newKey = `${noteName}-${newStep}`;
      next.add(newKey);
      nextVelocities[newKey] = noteVelocities[item] ?? velocity;
    }
    updateNoteVelocities(nextVelocities);
    updateNotes(next);
  };

  const transposeNotes = (semitones: number) => {
    const next = new Set<string>();
    const nextVelocities: Record<string, number> = {};
    for (const item of activeNotes) {
      const lastDash = item.lastIndexOf("-");
      if (lastDash === -1) continue;
      const noteName = item.slice(0, lastDash);
      const step = item.slice(lastDash + 1);
      const transposed = transposeNote(noteName, semitones);
      const newKey = `${transposed}-${step}`;
      next.add(newKey);
      nextVelocities[newKey] = noteVelocities[item] ?? velocity;
    }
    updateNoteVelocities(nextVelocities);
    updateNotes(next);
  };

  const reverseNotes = () => {
    const next = new Set<string>();
    const nextVelocities: Record<string, number> = {};
    for (const item of activeNotes) {
      const lastDash = item.lastIndexOf("-");
      if (lastDash === -1) continue;
      const noteName = item.slice(0, lastDash);
      const step = parseInt(item.slice(lastDash + 1), 10);
      const newStep = totalSteps - 1 - step;
      const newKey = `${noteName}-${newStep}`;
      next.add(newKey);
      nextVelocities[newKey] = noteVelocities[item] ?? velocity;
    }
    updateNoteVelocities(nextVelocities);
    updateNotes(next);
  };

  const randomizeNotes = () => {
    const inKeyNotes = notes.filter(
      (n) => isNoteInKey(n.name, rootKey, scale) && n.octave >= 3 && n.octave <= 5,
    );
    if (inKeyNotes.length === 0) return;
    const next = new Set<string>();
    const nextVelocities: Record<string, number> = {};
    for (let step = 0; step < totalSteps; step += 2) {
      if (Math.random() > 0.2) {
        const randomNote =
          inKeyNotes[Math.floor(Math.random() * inKeyNotes.length)];
        const newKey = `${randomNote.fullName}-${step}`;
        next.add(newKey);
        nextVelocities[newKey] = Math.floor(70 + Math.random() * 30);
      }
    }
    updateNoteVelocities(nextVelocities);
    updateNotes(next);
  };

  const loadPattern = (presetId: string) => {
    const pattern = PATTERN_PRESETS.find((p) => p.id === presetId);
    if (!pattern) return;

    const rootIndex = ROOT_KEYS.indexOf(rootKey as (typeof ROOT_KEYS)[number]);
    const semitoneOffset = rootIndex !== -1 ? rootIndex : 0;

    const next = new Set<string>();
    for (const item of pattern.notes) {
      const lastDash = item.lastIndexOf("-");
      if (lastDash === -1) continue;
      let noteName = item.slice(0, lastDash);
      const step = parseInt(item.slice(lastDash + 1), 10);
      if (step < totalSteps) {
        if (pattern.category === "chord" && semitoneOffset !== 0) {
          noteName = transposeNote(noteName, semitoneOffset);
        }
        next.add(`${noteName}-${step}`);
      }
    }
    updateNotes(next);
  };

  const stepWidthClass =
    zoomLevel === "compact"
      ? "w-12 sm:w-14"
      : zoomLevel === "wide"
        ? "w-24 sm:w-28"
        : "w-18 sm:w-20";

  const numGroups = Math.ceil(totalSteps / groupSize);

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
            <div className="sticky left-0 z-40 w-32 sm:w-40 flex-shrink-0 bg-surface dark:bg-stone-900 px-3 py-2 border-r-2 border-stone-300 dark:border-stone-700 flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-stone-400">
                PITCH
              </span>
              <span className="text-[10px] font-mono font-bold text-stone-700 dark:text-stone-300">
                {rootKey} {scale !== "chromatic" ? scale : ""}
              </span>
            </div>

            <div className="flex flex-shrink-0">
              {Array.from({ length: numGroups }).map((_, groupIdx) => {
                const stepsInGroup = Math.min(
                  groupSize,
                  totalSteps - groupIdx * groupSize,
                );

                return (
                  <div
                    key={groupIdx}
                    className="flex border-r-2 border-primary/50 dark:border-primary/50"
                  >
                    {Array.from({ length: stepsInGroup }).map((_, stepIdx) => {
                      const stepNumber = groupIdx * groupSize + stepIdx;
                      const isCurrentStep = currentStep === stepNumber;

                      return (
                        <div
                          key={stepNumber}
                          className={cn(
                            "h-8 flex flex-col items-center justify-center font-mono text-[11px] border-r border-stone-200 dark:border-stone-800 transition-colors flex-shrink-0",
                            stepWidthClass,
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
                );
              })}
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
                        const inKey = isNoteInKey(keyDef.name, rootKey, scale);
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
                                "!bg-blue-100 dark:!bg-blue-950/80 ring-2 ring-primary ring-inset !from-blue-100 !to-blue-200 dark:!from-blue-950/80 dark:!to-blue-900/80 !text-stone-900 dark:!text-white font-bold",
                            )}
                          >
                            <span className="flex items-center gap-1.5">
                              {inKey && scale !== "chromatic" && (
                                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                              )}
                              {hasActiveNote && (
                                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                              )}
                              <span
                                className={cn(
                                  isC
                                    ? "font-bold text-stone-900 dark:text-stone-900"
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
                      const inKey = isNoteInKey(keyDef.name, rootKey, scale);
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
                              "!from-primary-dark !to-primary !text-white !shadow-primary/50 ring-1 ring-primary-light",
                          )}
                        >
                          <span className="text-[10px] font-medium opacity-90">
                            {fullName}
                          </span>
                          <span className="flex items-center gap-1">
                            {inKey && scale !== "chromatic" && (
                              <span className="w-1.5 h-1.5 rounded-full bg-primary-light" />
                            )}
                            <span
                              className={cn(
                                "w-1.5 h-1.5 rounded-full transition-colors",
                                hasActiveNote
                                  ? "bg-primary-light"
                                  : "bg-stone-700/80",
                              )}
                            />
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col flex-1 min-w-0">
              {notes.map((note) => {
                const inKey = isNoteInKey(note.name, rootKey, scale);

                return (
                  <div
                    key={note.id}
                    id={`piano-roll-row-${note.fullName}`}
                    className={cn(
                      "flex w-full h-8 border-b border-stone-200/80 dark:border-stone-800/80 transition-colors",
                      note.isC &&
                        "border-b-2 border-b-primary/40 dark:border-b-primary/40",
                      inKey && scale !== "chromatic"
                        ? "bg-primary/[0.04] dark:bg-primary/[0.06]"
                        : scale !== "chromatic"
                          ? "opacity-60 dark:opacity-50"
                          : "",
                    )}
                  >
                    <div className="flex flex-shrink-0">
                      {Array.from({ length: numGroups }).map((_, groupIdx) => {
                        const stepsInGroup = Math.min(
                          groupSize,
                          totalSteps - groupIdx * groupSize,
                        );

                        return (
                          <div
                            key={groupIdx}
                            className="flex border-r-2 border-primary/40 dark:border-primary/40"
                          >
                            {Array.from({ length: stepsInGroup }).map(
                              (_, stepIdx) => {
                                const stepNumber =
                                  groupIdx * groupSize + stepIdx;
                                const noteKey = `${note.fullName}-${stepNumber}`;
                                const isNoteActive = activeNotes.has(noteKey);
                                const isCurrentStep =
                                  currentStep === stepNumber &&
                                  (isPlaying || isRecording);

                                const noteVel =
                                  noteVelocities[noteKey] ?? velocity;
                                const isHovered =
                                  hoveredNote === noteKey ||
                                  isDraggingSlider === noteKey;

                                return (
                                  <div
                                    key={stepNumber}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() =>
                                      toggleNote(note.fullName, stepNumber)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        toggleNote(note.fullName, stepNumber);
                                      }
                                    }}
                                    aria-label={`${note.fullName} at step ${stepNumber + 1}`}
                                    className={cn(
                                      "h-full rounded-none border-0 border-r border-stone-200/70 dark:border-stone-800/70 transition-colors relative cursor-pointer flex-shrink-0 p-0 select-none",
                                      stepWidthClass,
                                      isHovered ? "z-30" : "z-0",
                                      isCurrentStep &&
                                        "bg-primary/15 dark:bg-primary/25",
                                      note.isBlack
                                        ? "bg-stone-100/70 dark:bg-stone-900/50 hover:bg-stone-200/80 dark:hover:bg-stone-800/70"
                                        : "bg-surface-light dark:bg-stone-950/40 hover:bg-blue-50/50 dark:hover:bg-stone-900/40",
                                    )}
                                  >
                                    {isNoteActive && (
                                      <div
                                        className="relative w-full h-full"
                                        onMouseEnter={() =>
                                          setHoveredNote(noteKey)
                                        }
                                        onMouseLeave={() => {
                                          if (isDraggingSlider !== noteKey) {
                                            setHoveredNote(null);
                                          }
                                        }}
                                        onWheel={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          const delta = e.deltaY < 0 ? 5 : -5;
                                          handleNoteVelocityChange(
                                            noteKey,
                                            Math.max(
                                              5,
                                              Math.min(100, noteVel + delta),
                                            ),
                                          );
                                        }}
                                      >
                                        <div
                                          className="absolute inset-0.5 rounded-sm bg-gradient-to-r from-primary to-primary-light text-white font-mono text-[9px] font-bold flex flex-col justify-between px-1.5 py-0.5 shadow-sm transition-opacity"
                                          style={{
                                            opacity:
                                              0.5 + (noteVel / 100) * 0.5,
                                          }}
                                        >
                                          <div className="flex items-center justify-between w-full leading-none">
                                            <span className="leading-tight font-bold">
                                              {note.fullName}
                                            </span>
                                            <span className="text-[8px] font-mono opacity-80 select-none">
                                              {noteVel}%
                                            </span>
                                          </div>
                                          <div className="w-full">
                                            <div className="h-1 w-full bg-black/25 dark:bg-white/20 rounded-full overflow-hidden">
                                              <div
                                                className="h-full bg-white rounded-full transition-all"
                                                style={{
                                                  width: `${noteVel}%`,
                                                }}
                                              />
                                            </div>
                                          </div>
                                        </div>

                                        {isHovered && (
                                          <div
                                            onClick={(e) => e.stopPropagation()}
                                            onMouseDown={(e) =>
                                              e.stopPropagation()
                                            }
                                            className={cn(
                                              "absolute left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-2.5 py-1.5 bg-stone-900/95 dark:bg-[#0c0f17] text-white rounded-lg shadow-2xl border border-stone-700/80 dark:border-stone-700 backdrop-blur-md pointer-events-auto select-none min-w-[136px]",
                                              note.octave >= 10
                                                ? "top-full mt-1.5"
                                                : "bottom-full mb-1.5",
                                            )}
                                          >
                                            <span className="text-[9px] font-mono text-stone-400 uppercase font-semibold flex-shrink-0">
                                              Vel
                                            </span>
                                            <input
                                              type="range"
                                              min={5}
                                              max={100}
                                              step={1}
                                              value={noteVel}
                                              onChange={(e) => {
                                                const val = Number(
                                                  e.target.value,
                                                );
                                                handleNoteVelocityChange(
                                                  noteKey,
                                                  val,
                                                );
                                              }}
                                              onMouseDown={(e) => {
                                                e.stopPropagation();
                                                setIsDraggingSlider(noteKey);
                                              }}
                                              onMouseUp={() => {
                                                setIsDraggingSlider(null);
                                                const v = noteVel / 100;
                                                synth.playNote(
                                                  note.fullName,
                                                  undefined,
                                                  0.3,
                                                  v,
                                                );
                                              }}
                                              aria-label={`${note.fullName} velocity`}
                                              className="w-20 h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-primary"
                                            />
                                            <span className="text-[10px] font-mono font-bold text-primary-light min-w-[28px] text-right">
                                              {noteVel}%
                                            </span>
                                            <div
                                              className={cn(
                                                "absolute left-1/2 -translate-x-1/2 border-4 border-transparent",
                                                note.octave >= 10
                                                  ? "bottom-full border-b-stone-900/95 dark:border-b-[#0c0f17]"
                                                  : "top-full border-t-stone-900/95 dark:border-t-[#0c0f17]",
                                              )}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              },
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex-1 min-w-0 bg-stone-200/50 dark:bg-black/70 border-l-2 border-stone-400/50 dark:border-stone-700/50" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full flex items-center justify-between px-2.5 py-1.5 bg-stone-100/90 dark:bg-[#07090e] border-t border-stone-300 dark:border-stone-800 gap-2 overflow-x-auto flex-shrink-0 select-none z-30 no-scrollbar">
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] font-mono uppercase font-bold text-stone-500 dark:text-stone-400">
            Steps:
          </span>
          {[8, 12, 16, 24, 32].map((steps) => (
            <Button
              key={steps}
              variant="solid"
              tone={totalSteps === steps ? "primary" : "secondary"}
              size="sm"
              onClick={() => setTotalSteps(steps)}
              className={cn(
                "px-2 py-0.5 h-6 text-[10px] font-mono rounded border transition-colors",
                totalSteps === steps
                  ? "bg-primary text-white border-primary-light font-bold shadow-sm ring-1 ring-primary/40"
                  : "bg-white dark:bg-[#12151c] text-stone-700 dark:text-stone-300 border-stone-200 dark:border-[#1f2533] hover:text-stone-900 dark:hover:text-white",
              )}
            >
              {steps}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] font-mono uppercase font-bold text-stone-500 dark:text-stone-400">
            Key:
          </span>
          <Dropdown
            size="xs"
            value={rootKey}
            onChange={(val) => setRootKey(val)}
            options={ROOT_KEYS.map((k) => ({ value: k, label: k }))}
            className="w-16"
          />

          <Dropdown
            size="xs"
            value={scale}
            onChange={(val) => setScale(val as ScaleType)}
            options={Object.entries(SCALES).map(([sKey, sVal]) => ({
              value: sKey,
              label: sVal.name,
            }))}
            className="w-36"
          />
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] font-mono uppercase font-bold text-stone-500 dark:text-stone-400">
            Presets:
          </span>
          <Dropdown
            size="xs"
            placeholder="Load Preset..."
            value=""
            onChange={(val) => {
              if (val) loadPattern(val);
            }}
            options={PATTERN_PRESETS.map((p) => ({
              value: p.id,
              label: p.name,
            }))}
            className="w-44 sm:w-52"
          />
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="solid"
            tone="secondary"
            size="sm"
            onClick={() => shiftNotes(-1)}
            title="Shift pattern left by 1 step"
            className="px-1.5 py-0.5 h-6 text-[10px] rounded bg-white dark:bg-[#12151c] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-[#1f2533] hover:text-stone-900 dark:hover:text-white"
          >
            <ChevronLeft className="w-3 h-3" />
            Shift
          </Button>
          <Button
            variant="solid"
            tone="secondary"
            size="sm"
            onClick={() => shiftNotes(1)}
            title="Shift pattern right by 1 step"
            className="px-1.5 py-0.5 h-6 text-[10px] rounded bg-white dark:bg-[#12151c] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-[#1f2533] hover:text-stone-900 dark:hover:text-white"
          >
            Shift
            <ChevronRight className="w-3 h-3" />
          </Button>

          <Button
            variant="solid"
            tone="secondary"
            size="sm"
            onClick={() => transposeNotes(1)}
            title="Transpose +1 semitone"
            className="px-1.5 py-0.5 h-6 text-[10px] rounded bg-white dark:bg-[#12151c] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-[#1f2533] hover:text-stone-900 dark:hover:text-white"
          >
            <ArrowUp className="w-3 h-3" />
            +1
          </Button>
          <Button
            variant="solid"
            tone="secondary"
            size="sm"
            onClick={() => transposeNotes(-1)}
            title="Transpose -1 semitone"
            className="px-1.5 py-0.5 h-6 text-[10px] rounded bg-white dark:bg-[#12151c] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-[#1f2533] hover:text-stone-900 dark:hover:text-white"
          >
            <ArrowDown className="w-3 h-3" />
            -1
          </Button>

          <Button
            variant="solid"
            tone="secondary"
            size="sm"
            onClick={reverseNotes}
            title="Reverse pattern horizontally"
            className="px-1.5 py-0.5 h-6 text-[10px] rounded bg-white dark:bg-[#12151c] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-[#1f2533] hover:text-stone-900 dark:hover:text-white"
          >
            <ArrowLeftRight className="w-3 h-3" />
            Flip
          </Button>

          <Button
            variant="solid"
            tone="secondary"
            size="sm"
            onClick={randomizeNotes}
            title="Randomize in-key notes"
            className="px-1.5 py-0.5 h-6 text-[10px] rounded bg-white dark:bg-[#12151c] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-[#1f2533] hover:text-stone-900 dark:hover:text-white"
          >
            <Shuffle className="w-3 h-3" />
            Rnd
          </Button>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] font-mono uppercase font-bold text-stone-500 dark:text-stone-400">
            Jump:
          </span>
          {jumpConfig.octaves.map((oct) => {
            const isSelected = activeJumpOctave === oct;
            const isDefault = oct === jumpConfig.defaultOctave;
            return (
              <Button
                key={oct}
                variant="solid"
                tone={isSelected ? "primary" : "secondary"}
                size="sm"
                onClick={() => handleJump(oct)}
                title={`Jump to C${oct}${isDefault ? " (Default)" : ""}`}
                className={cn(
                  "px-2 py-0.5 h-6 text-[10px] font-mono rounded border transition-colors",
                  isSelected
                    ? "bg-primary text-white border-primary-light font-bold shadow-sm ring-1 ring-primary/40"
                    : "bg-white dark:bg-[#12151c] text-stone-700 dark:text-stone-300 border-stone-200 dark:border-[#1f2533] hover:text-stone-900 dark:hover:text-white",
                )}
              >
                C{oct}
              </Button>
            );
          })}
        </div>

        <div className="h-4 w-px bg-stone-300 dark:bg-stone-700 mx-0.5 flex-shrink-0" />

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] font-mono uppercase font-bold text-stone-500 dark:text-stone-400">
            Default Vel:
          </span>
          <div className="flex items-center gap-1.5 bg-white dark:bg-[#12151c] px-2 py-0.5 h-6 rounded border border-stone-200 dark:border-[#1f2533]">
            <input
              type="range"
              min={10}
              max={100}
              step={1}
              value={velocity}
              onChange={(e) => handleVelocityChange(Number(e.target.value))}
              aria-label="Note velocity"
              title={`Velocity: ${velocity}%`}
              className="w-16 h-1 bg-stone-300 dark:bg-stone-700 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <span className="text-[10px] font-mono font-bold text-stone-700 dark:text-stone-300 min-w-[28px] text-right select-none">
              {velocity}%
            </span>
          </div>
        </div>

        <div className="h-4 w-px bg-stone-300 dark:bg-stone-700 mx-0.5 flex-shrink-0" />

        <Button
          variant="solid"
          tone="secondary"
          size="sm"
          onClick={() =>
            setZoomLevel((prev) =>
              prev === "compact"
                ? "normal"
                : prev === "normal"
                  ? "wide"
                  : "compact",
            )
          }
          title={`Zoom: ${zoomLevel}`}
          className="px-1.5 py-0.5 h-6 text-[10px] font-mono uppercase rounded bg-white dark:bg-[#12151c] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-[#1f2533] hover:text-stone-900 dark:hover:text-white flex-shrink-0"
        >
          <ZoomIn className="w-3 h-3 mr-0.5" />
          {zoomLevel[0].toUpperCase()}
        </Button>
      </div>
    </div>
  );
};

export default PianoRoll;
