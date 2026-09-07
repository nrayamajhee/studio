import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { ChevronLeft, ChevronRight, Radio } from "lucide-react";
import {
  WHITE_KEY_NAMES,
  VERTICAL_WHITE_KEYS,
  VERTICAL_BLACK_KEYS,
  ROW_HEIGHT,
} from "./types";
import { synth } from "../../lib/synth";
import { Button } from "../design-system/Button";
import { Card } from "../design-system/Card";
import { PianoKey } from "./PianoKey";
import { cn } from "../../lib/utils";

export interface PianoKeyboardProps {
  className?: string;
  mode?: "keyboard" | "player";
  octaves?: number;
  startOctave?: number;
  orientation?: "horizontal" | "vertical";
  showLabels?: "all" | "c-only" | "none";
  includeEndC?: boolean;
  disabled?: boolean;
  playAudio?: boolean;
  activeNotes?: string[];
  externalPressedKeys?: string[];
  onKeyClick?: (note: string) => void;
  showMiniMap?: boolean;
  enableHotkeys?: boolean;
  showHotkeys?: boolean;
  showFooter?: boolean;
  isRecording?: boolean;
  onRecordNote?: (noteName: string) => void;
}

const BASE_HOTKEYS: Record<string, string> = {
  C: "a",
  "C#": "w",
  D: "s",
  "D#": "e",
  E: "d",
  F: "f",
  "F#": "t",
  G: "g",
  "G#": "y",
  A: "h",
  "A#": "u",
  B: "j",
};

const EXTENDED_HOTKEYS: Record<string, string> = {
  C: "k",
  "C#": "o",
  D: "l",
  "D#": "p",
  E: ";",
};

const HOTKEY_TO_NOTE_OFFSET: Record<string, { pitch: string; octDelta: number }> = {
  a: { pitch: "C", octDelta: 0 },
  w: { pitch: "C#", octDelta: 0 },
  s: { pitch: "D", octDelta: 0 },
  e: { pitch: "D#", octDelta: 0 },
  d: { pitch: "E", octDelta: 0 },
  f: { pitch: "F", octDelta: 0 },
  t: { pitch: "F#", octDelta: 0 },
  g: { pitch: "G", octDelta: 0 },
  y: { pitch: "G#", octDelta: 0 },
  h: { pitch: "A", octDelta: 0 },
  u: { pitch: "A#", octDelta: 0 },
  j: { pitch: "B", octDelta: 0 },
  k: { pitch: "C", octDelta: 1 },
  o: { pitch: "C#", octDelta: 1 },
  l: { pitch: "D", octDelta: 1 },
  p: { pitch: "D#", octDelta: 1 },
  ";": { pitch: "E", octDelta: 1 },
};

const CHROMATIC_SCALE: { pitch: string; isBlack: boolean }[] = [
  { pitch: "C", isBlack: false },
  { pitch: "C#", isBlack: true },
  { pitch: "D", isBlack: false },
  { pitch: "D#", isBlack: true },
  { pitch: "E", isBlack: false },
  { pitch: "F", isBlack: false },
  { pitch: "F#", isBlack: true },
  { pitch: "G", isBlack: false },
  { pitch: "G#", isBlack: true },
  { pitch: "A", isBlack: false },
  { pitch: "A#", isBlack: true },
  { pitch: "B", isBlack: false },
];

const MINI_MAP_OCTAVES = [1, 2, 3, 4, 5, 6, 7];
const BLACK_KEY_OFFSETS: Record<string, number> = {
  "C#": 0.65,
  "D#": 1.7,
  "F#": 3.65,
  "G#": 4.68,
  "A#": 5.72,
};

export const PianoKeyboard: React.FC<PianoKeyboardProps> = ({
  className,
  mode = "keyboard",
  octaves,
  startOctave = 4,
  orientation = "horizontal",
  showLabels = "c-only",
  includeEndC = true,
  disabled = false,
  playAudio = true,
  activeNotes = [],
  externalPressedKeys = [],
  onKeyClick,
  showMiniMap,
  enableHotkeys,
  showHotkeys,
  isRecording = false,
  onRecordNote,
}) => {
  const isPlayer = mode === "player";
  const effectiveOctaves = Math.max(1, octaves ?? 1);
  const shouldShowMiniMap = showMiniMap ?? isPlayer;
  const shouldEnableHotkeys = enableHotkeys ?? true;
  const shouldShowHotkeys = showHotkeys ?? isPlayer;

  const maxOctave = Math.max(1, MINI_MAP_OCTAVES.length - effectiveOctaves + 1);

  const [octaveOffset, setOctaveOffset] = useState<number | null>(null);
  const baseOctave = Math.max(
    1,
    Math.min(maxOctave, octaveOffset ?? startOctave),
  );
  const setBaseOctave = useCallback(
    (action: number | ((prev: number) => number)) => {
      setOctaveOffset((prev) => {
        const current = Math.max(1, Math.min(maxOctave, prev ?? startOctave));
        const next = typeof action === "function" ? action(current) : action;
        return Math.max(1, Math.min(maxOctave, next));
      });
    },
    [maxOctave, startOctave],
  );

  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const miniMapRef = useRef<HTMLDivElement>(null);

  const activeNotesSet = useMemo(() => new Set(activeNotes), [activeNotes]);
  const externalPressedKeysSet = useMemo(
    () => new Set(externalPressedKeys),
    [externalPressedKeys],
  );

  const isNotePressed = useCallback(
    (key: string) =>
      pressedKeys.has(key) ||
      activeNotesSet.has(key) ||
      externalPressedKeysSet.has(key),
    [pressedKeys, activeNotesSet, externalPressedKeysSet],
  );

  const playKey = useCallback(
    (noteFullName: string) => {
      if (disabled) return;
      if (playAudio) {
        synth.playNote(noteFullName);
      }
      setPressedKeys((prev) => new Set(prev).add(noteFullName));
      if (isRecording && onRecordNote) {
        onRecordNote(noteFullName);
      }
      if (onKeyClick) {
        onKeyClick(noteFullName);
      }
    },
    [disabled, playAudio, isRecording, onRecordNote, onKeyClick],
  );

  const releaseKey = useCallback(
    (noteFullName: string) => {
      if (disabled) return;
      if (playAudio) {
        synth.stopNote(noteFullName);
      }
      setPressedKeys((prev) => {
        const next = new Set(prev);
        next.delete(noteFullName);
        return next;
      });
    },
    [disabled, playAudio],
  );

  const keysList = useMemo(() => {
    const list: {
      pitch: string;
      octave: number;
      fullName: string;
      isBlack: boolean;
      hotkey?: string;
    }[] = [];

    for (let i = 0; i < effectiveOctaves; i++) {
      const currentOct = baseOctave + i;
      for (const item of CHROMATIC_SCALE) {
        const fullName = `${item.pitch}${currentOct}`;
        const hotkey =
          currentOct === baseOctave
            ? BASE_HOTKEYS[item.pitch]?.toUpperCase()
            : currentOct === baseOctave + 1
              ? EXTENDED_HOTKEYS[item.pitch]?.toUpperCase()
              : undefined;

        list.push({
          pitch: item.pitch,
          octave: currentOct,
          fullName,
          isBlack: item.isBlack,
          hotkey,
        });
      }
    }

    if (includeEndC) {
      const endOct = baseOctave + effectiveOctaves;
      const fullName = `C${endOct}`;
      const hotkey =
        endOct === baseOctave + 1
          ? EXTENDED_HOTKEYS["C"]?.toUpperCase()
          : undefined;

      list.push({
        pitch: "C",
        octave: endOct,
        fullName,
        isBlack: false,
        hotkey,
      });
    }

    return list;
  }, [baseOctave, effectiveOctaves, includeEndC]);

  useEffect(() => {
    if (!shouldEnableHotkeys || disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (
        targetTag === "input" ||
        targetTag === "select" ||
        targetTag === "textarea" ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      const mapping = HOTKEY_TO_NOTE_OFFSET[e.key.toLowerCase()];
      if (mapping) {
        e.preventDefault();
        const noteFullName = `${mapping.pitch}${baseOctave + mapping.octDelta}`;
        playKey(noteFullName);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const mapping = HOTKEY_TO_NOTE_OFFSET[e.key.toLowerCase()];
      if (mapping) {
        e.preventDefault();
        const noteFullName = `${mapping.pitch}${baseOctave + mapping.octDelta}`;
        releaseKey(noteFullName);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [shouldEnableHotkeys, disabled, baseOctave, playKey, releaseKey]);

  const updateOctaveFromClientX = useCallback(
    (clientX: number) => {
      if (!miniMapRef.current) return;
      const rect = miniMapRef.current.getBoundingClientRect();
      const relativeX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const ratio = relativeX / rect.width;
      const targetOctave = Math.round(
        1 + ratio * (MINI_MAP_OCTAVES.length - effectiveOctaves),
      );
      const clamped = Math.max(1, Math.min(maxOctave, targetOctave));
      setBaseOctave(clamped);
    },
    [effectiveOctaves, maxOctave, setBaseOctave],
  );

  const handleMiniMapMouseDown = (e: React.MouseEvent) => {
    setIsDraggingMap(true);
    updateOctaveFromClientX(e.clientX);
  };

  useEffect(() => {
    if (!isDraggingMap) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateOctaveFromClientX(e.clientX);
    };

    const handleMouseUp = () => {
      setIsDraggingMap(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingMap, updateOctaveFromClientX]);

  const handleMiniMapWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) > 10 || Math.abs(e.deltaX) > 10) {
      e.preventDefault();
      const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
      if (delta > 0) {
        setBaseOctave((prev) => Math.min(maxOctave, prev + 1));
      } else {
        setBaseOctave((prev) => Math.max(1, prev - 1));
      }
    }
  };

  const handleMiniMapKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      setBaseOctave((prev) => Math.max(1, prev - 1));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      setBaseOctave((prev) => Math.min(maxOctave, prev + 1));
    }
  };

  const renderMiniMap = () => {
    const viewportLeftPct = ((baseOctave - 1) / MINI_MAP_OCTAVES.length) * 100;
    const viewportWidthPct =
      (Math.min(effectiveOctaves, MINI_MAP_OCTAVES.length) /
        MINI_MAP_OCTAVES.length) *
      100;

    return (
      <div className="flex flex-col gap-1.5 pb-1 border-b border-stone-200 dark:border-[#1f2533]">
        {isRecording && (
          <div className="flex items-center justify-end">
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 animate-pulse bg-red-950/40 px-1.5 py-0.5 rounded border border-red-800/50">
              <Radio className="w-3 h-3" />
              REC
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <Button
            variant="solid"
            tone="secondary"
            size="sm"
            onClick={() => setBaseOctave((prev) => Math.max(1, prev - 1))}
            disabled={disabled || baseOctave <= 1}
            aria-label="Scroll octave left"
            className="p-1 h-auto rounded bg-stone-100 hover:bg-stone-200 dark:bg-[#161a24] dark:hover:bg-[#232a3b] border border-stone-200 dark:border-[#232a3b] text-stone-700 dark:text-stone-300"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>

          <div
            ref={miniMapRef}
            role="slider"
            tabIndex={0}
            aria-label="Mini Piano Map"
            aria-valuemin={1}
            aria-valuemax={maxOctave}
            aria-valuenow={baseOctave}
            onKeyDown={handleMiniMapKeyDown}
            onMouseDown={handleMiniMapMouseDown}
            onWheel={handleMiniMapWheel}
            title="Mini Piano Map: Click or drag to scroll octaves"
            className="relative flex-1 h-6 bg-stone-100 dark:bg-[#07080c] border border-stone-200 dark:border-[#1f2533] rounded-md overflow-hidden cursor-pointer flex items-end shadow-inner focus-visible:ring-1 focus-visible:ring-primary"
          >
            <div className="absolute inset-0 flex">
              {MINI_MAP_OCTAVES.map((oct) => (
                <div
                  key={oct}
                  className="flex-1 relative border-r border-stone-300 dark:border-stone-800/80 flex"
                >
                  {WHITE_KEY_NAMES.map((noteName) => {
                    const noteKey = `${noteName}${oct}`;
                    const isActive = isNotePressed(noteKey);
                    return (
                      <div
                        key={noteName}
                        className={cn(
                          "flex-1 h-full border-r border-stone-300 dark:border-stone-900 transition-colors",
                          isActive
                            ? "bg-primary"
                            : "bg-white dark:bg-stone-300",
                        )}
                      />
                    );
                  })}

                  {Object.entries(BLACK_KEY_OFFSETS).map(
                    ([bNoteName, offsetFactor]) => {
                      const noteKey = `${bNoteName}${oct}`;
                      const isActive = isNotePressed(noteKey);
                      return (
                        <div
                          key={bNoteName}
                          style={{
                            left: `${(offsetFactor / 7) * 100}%`,
                            width: "7%",
                            height: "60%",
                          }}
                          className={cn(
                            "absolute top-0 z-10 rounded-b-[1px] transition-colors pointer-events-none",
                            isActive ? "bg-primary-light" : "bg-black",
                          )}
                        />
                      );
                    },
                  )}

                  <span className="absolute bottom-0 left-0.5 text-[7px] font-mono text-stone-900 font-bold pointer-events-none opacity-80">
                    C{oct}
                  </span>
                </div>
              ))}
            </div>

            <div
              style={{
                left: `${viewportLeftPct}%`,
                width: `${viewportWidthPct}%`,
              }}
              className="absolute top-0 bottom-0 z-20 border-2 border-primary bg-primary/20 rounded-sm pointer-events-none shadow-sm shadow-primary/40"
            />
          </div>

          <Button
            variant="solid"
            tone="secondary"
            size="sm"
            onClick={() => setBaseOctave((prev) => Math.min(maxOctave, prev + 1))}
            disabled={disabled || baseOctave >= maxOctave}
            aria-label="Scroll octave right"
            className="p-1 h-auto rounded bg-stone-100 hover:bg-stone-200 dark:bg-[#161a24] dark:hover:bg-[#232a3b] border border-stone-200 dark:border-[#232a3b] text-stone-700 dark:text-stone-300"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    );
  };

  if (orientation === "vertical") {
    const octaveList = Array.from(
      { length: effectiveOctaves },
      (_, idx) => baseOctave + idx,
    );
    const descendingOctaves = [...octaveList].reverse();

    return (
      <div
        role="group"
        aria-label="Piano keyboard"
        className={cn(
          "inline-flex flex-col select-none bg-white dark:bg-[#0a0c10] border border-stone-200 dark:border-[#1f2533] rounded-xl overflow-hidden shadow-sm dark:shadow-lg p-2.5",
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
                  const isPressed = isNotePressed(fullName);
                  const isActive = activeNotesSet.has(fullName);
                  const isC = keyDef.name === "C";
                  const height =
                    keyDef.group === "upper" ? upperKeyHeight : lowerKeyHeight;
                  const hotkey =
                    octave === baseOctave
                      ? BASE_HOTKEYS[keyDef.name]?.toUpperCase()
                      : octave === baseOctave + 1
                        ? EXTENDED_HOTKEYS[keyDef.name]?.toUpperCase()
                        : undefined;

                  return (
                    <PianoKey
                      key={fullName}
                      orientation="vertical"
                      variant="white"
                      note={fullName}
                      hotkey={hotkey}
                      showHotkey={shouldShowHotkeys && !!hotkey}
                      showLabel={
                        showLabels === "all" || (showLabels === "c-only" && isC)
                      }
                      isC={isC}
                      isPressed={isPressed}
                      isActive={isActive}
                      disabled={disabled}
                      style={{ height }}
                      onMouseDown={() => playKey(fullName)}
                      onMouseUp={() => releaseKey(fullName)}
                      onMouseLeave={() => releaseKey(fullName)}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        playKey(fullName);
                      }}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        releaseKey(fullName);
                      }}
                    />
                  );
                })}
              </div>

              {VERTICAL_BLACK_KEYS.map((keyDef) => {
                const fullName = `${keyDef.name}${octave}`;
                const isPressed = isNotePressed(fullName);
                const isActive = activeNotesSet.has(fullName);
                const top = keyDef.rowIndex * ROW_HEIGHT;
                const hotkey =
                  octave === baseOctave
                    ? BASE_HOTKEYS[keyDef.name]?.toUpperCase()
                    : octave === baseOctave + 1
                      ? EXTENDED_HOTKEYS[keyDef.name]?.toUpperCase()
                      : undefined;

                return (
                  <PianoKey
                    key={fullName}
                    orientation="vertical"
                    variant="black"
                    note={fullName}
                    hotkey={hotkey}
                    showHotkey={shouldShowHotkeys && !!hotkey}
                    showLabel={showLabels === "all"}
                    isPressed={isPressed}
                    isActive={isActive}
                    disabled={disabled}
                    style={{
                      top,
                      height: ROW_HEIGHT,
                    }}
                    className="absolute left-0 z-20"
                    onMouseDown={() => playKey(fullName)}
                    onMouseUp={() => releaseKey(fullName)}
                    onMouseLeave={() => releaseKey(fullName)}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      playKey(fullName);
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      releaseKey(fullName);
                    }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <Card
      elevation="mid"
      className={cn(
        "flex flex-col h-full w-full bg-white dark:bg-[#0a0c10] border border-stone-200 dark:border-[#1f2533] rounded-xl overflow-hidden shadow-sm dark:shadow-lg text-stone-900 dark:text-stone-100 p-2.5 gap-2 select-none",
        className,
      )}
    >
      {shouldShowMiniMap && renderMiniMap()}

      <div className="flex-1 flex items-center justify-center overflow-x-auto py-1">
        <div className="relative flex items-start bg-stone-100 dark:bg-[#06080c] p-1.5 rounded-lg border border-stone-200 dark:border-[#1f2533] shadow-inner">
          {keysList.map((item) => {
            const isPressed = isNotePressed(item.fullName);
            const isActive = activeNotesSet.has(item.fullName);
            const isC = item.pitch === "C";
            const shouldShowLabel =
              showLabels === "all" || (showLabels === "c-only" && isC);

            return (
              <PianoKey
                key={item.fullName}
                variant={item.isBlack ? "black" : "white"}
                note={item.fullName}
                hotkey={item.hotkey}
                showHotkey={shouldShowHotkeys && !!item.hotkey}
                showLabel={shouldShowLabel}
                isC={isC}
                isPressed={isPressed}
                isActive={isActive}
                disabled={disabled}
                onMouseDown={() => playKey(item.fullName)}
                onMouseUp={() => releaseKey(item.fullName)}
                onMouseLeave={() => releaseKey(item.fullName)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  playKey(item.fullName);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  releaseKey(item.fullName);
                }}
                className={cn(
                  item.isBlack
                    ? "relative z-20 w-6 sm:w-7 h-24 sm:h-28 -mx-3 sm:-mx-3.5 border-stone-800 shadow-md shadow-black/80"
                    : "relative z-10 w-9 sm:w-10 h-36 sm:h-40 border-stone-400",
                )}
              />
            );
          })}
        </div>
      </div>
    </Card>
  );
};

export const PianoPlayer: React.FC<PianoKeyboardProps> = (props) => (
  <PianoKeyboard mode="player" {...props} />
);

export type PianoPlayerProps = PianoKeyboardProps;

export default PianoKeyboard;
