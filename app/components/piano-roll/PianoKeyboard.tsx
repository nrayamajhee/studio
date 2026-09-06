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
  HORIZONTAL_BLACK_KEYS,
  VERTICAL_WHITE_KEYS,
  VERTICAL_BLACK_KEYS,
  ROW_HEIGHT,
} from "./types";
import { synth } from "../../lib/synth";
import { Button } from "../design-system/Button";
import { Card } from "../design-system/Card";
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

interface KeyConfig {
  note: string;
  isBlack: boolean;
  key: string;
  isPlus?: boolean;
}

const PLAYER_KEY_CONFIGS: KeyConfig[] = [
  { note: "C", isBlack: false, key: "a" },
  { note: "C#", isBlack: true, key: "w" },
  { note: "D", isBlack: false, key: "s" },
  { note: "D#", isBlack: true, key: "e" },
  { note: "E", isBlack: false, key: "d" },
  { note: "F", isBlack: false, key: "f" },
  { note: "F#", isBlack: true, key: "t" },
  { note: "G", isBlack: false, key: "g" },
  { note: "G#", isBlack: true, key: "y" },
  { note: "A", isBlack: false, key: "h" },
  { note: "A#", isBlack: true, key: "u" },
  { note: "B", isBlack: false, key: "j" },
  { note: "C", isBlack: false, key: "k", isPlus: true },
  { note: "C#", isBlack: true, key: "o", isPlus: true },
  { note: "D", isBlack: false, key: "l", isPlus: true },
  { note: "D#", isBlack: true, key: "p", isPlus: true },
  { note: "E", isBlack: false, key: ";", isPlus: true },
];

const MINI_MAP_OCTAVES = [1, 2, 3, 4, 5, 6, 7];
const WHITE_NOTES_PER_OCT = ["C", "D", "E", "F", "G", "A", "B"];
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
  octaves = 2,
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
  showFooter,
  isRecording = false,
  onRecordNote,
}) => {
  const isPlayer = mode === "player";
  const shouldShowMiniMap = showMiniMap ?? isPlayer;
  const shouldEnableHotkeys = enableHotkeys ?? isPlayer;
  const shouldShowHotkeys = showHotkeys ?? isPlayer;
  const shouldShowFooter = showFooter ?? isPlayer;

  const [baseOctave, setBaseOctave] = useState(() =>
    Math.max(1, Math.min(6, startOctave)),
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

  const currentKeys = useMemo(() => {
    return PLAYER_KEY_CONFIGS.map((k) => {
      const oct = baseOctave + (k.isPlus ? 1 : 0);
      const fullName = `${k.note}${oct}`;
      return {
        ...k,
        fullName,
      };
    });
  }, [baseOctave]);

  const keyMap = useMemo(() => {
    const map = new Map<string, (typeof currentKeys)[0]>();
    for (const k of currentKeys) {
      map.set(k.key.toLowerCase(), k);
    }
    return map;
  }, [currentKeys]);

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

      const keyItem = keyMap.get(e.key.toLowerCase());
      if (keyItem) {
        e.preventDefault();
        playKey(keyItem.fullName);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const keyItem = keyMap.get(e.key.toLowerCase());
      if (keyItem) {
        e.preventDefault();
        releaseKey(keyItem.fullName);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [shouldEnableHotkeys, disabled, keyMap, playKey, releaseKey]);

  const updateOctaveFromClientX = useCallback((clientX: number) => {
    if (!miniMapRef.current) return;
    const rect = miniMapRef.current.getBoundingClientRect();
    const relativeX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const ratio = relativeX / rect.width;
    const targetOctave = Math.round(
      1 + ratio * (MINI_MAP_OCTAVES.length - 1.5),
    );
    const clamped = Math.max(1, Math.min(6, targetOctave));
    setBaseOctave(clamped);
  }, []);

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
        setBaseOctave((prev) => Math.min(6, prev + 1));
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
      setBaseOctave((prev) => Math.min(6, prev + 1));
    }
  };

  const renderMiniMap = () => {
    const viewportLeftPct = ((baseOctave - 1) / MINI_MAP_OCTAVES.length) * 100;
    const viewportWidthPct = (1.5 / MINI_MAP_OCTAVES.length) * 100;

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
            aria-valuemax={6}
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
                  {WHITE_NOTES_PER_OCT.map((noteName) => {
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
            onClick={() => setBaseOctave((prev) => Math.min(6, prev + 1))}
            disabled={disabled || baseOctave >= 6}
            aria-label="Scroll octave right"
            className="p-1 h-auto rounded bg-stone-100 hover:bg-stone-200 dark:bg-[#161a24] dark:hover:bg-[#232a3b] border border-stone-200 dark:border-[#232a3b] text-stone-700 dark:text-stone-300"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    );
  };

  if (isPlayer) {
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
            {currentKeys.map((item) => {
              const isPressed = isNotePressed(item.fullName);

              if (item.isBlack) {
                return (
                  <Button
                    key={item.fullName}
                    variant="solid"
                    tone="secondary"
                    size="sm"
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
                    aria-label={`Key ${item.fullName}`}
                    className={cn(
                      "relative z-20 w-6 sm:w-7 h-24 sm:h-28 -mx-3 sm:-mx-3.5 flex flex-col justify-end items-center pb-2 rounded-none rounded-b border-0 border-x border-b border-stone-800 transition-all cursor-pointer select-none p-0",
                      "bg-gradient-to-b from-stone-800 via-stone-900 to-black text-stone-200 shadow-md shadow-black/80 hover:brightness-125",
                      isPressed &&
                        "!from-stone-700 !to-stone-800 !bg-stone-700 text-white ring-2 ring-stone-500 ring-inset translate-y-0.5 shadow-inner",
                    )}
                  >
                    {shouldShowHotkeys && (
                      <kbd className="text-[8px] font-mono px-1 rounded bg-stone-900 text-stone-300 uppercase mb-1">
                        {item.key}
                      </kbd>
                    )}
                    <span className="text-[9px] font-mono font-medium opacity-80">
                      {item.fullName}
                    </span>
                  </Button>
                );
              }

              return (
                <Button
                  key={item.fullName}
                  variant="solid"
                  tone="secondary"
                  size="sm"
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
                  aria-label={`Key ${item.fullName}`}
                  className={cn(
                    "relative z-10 w-9 sm:w-10 h-36 sm:h-40 flex flex-col justify-end items-center pb-2.5 rounded-none rounded-b-md border-0 border-x border-b border-stone-400 transition-all cursor-pointer select-none p-0",
                    "bg-gradient-to-b from-stone-50 via-white to-stone-200 hover:from-stone-100 hover:to-white text-stone-900 shadow-sm",
                    isPressed &&
                      "!bg-stone-200 dark:!bg-stone-300 ring-2 ring-stone-600 dark:ring-stone-400 ring-inset !text-stone-950 font-bold translate-y-0.5 shadow-inner",
                  )}
                >
                  {shouldShowHotkeys && (
                    <kbd className="text-[9px] font-mono px-1 rounded bg-stone-200 text-stone-700 uppercase mb-1 font-semibold">
                      {item.key}
                    </kbd>
                  )}
                  <span className="text-[10px] font-mono font-medium text-stone-600">
                    {item.fullName}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>

        {shouldShowFooter && (
          <div className="text-[10px] text-stone-500 dark:text-stone-400 text-center flex flex-wrap items-center justify-center gap-2 pt-1 border-t border-stone-200 dark:border-[#1f2533]">
            <span>
              White:{" "}
              {["A", "S", "D", "F", "G", "H", "J", "K", "L", ";"].map((k) => (
                <kbd
                  key={k}
                  className="mx-0.5 bg-stone-100 dark:bg-[#161a24] text-stone-800 dark:text-stone-300 px-1 py-0.5 rounded border border-stone-300 dark:border-[#232a3b]"
                >
                  {k}
                </kbd>
              ))}
            </span>
            <span className="text-stone-300 dark:text-stone-600">|</span>
            <span>
              Black:{" "}
              {["W", "E", "T", "Y", "U", "O", "P"].map((k) => (
                <kbd
                  key={k}
                  className="mx-0.5 bg-stone-100 dark:bg-[#161a24] text-stone-800 dark:text-stone-300 px-1 py-0.5 rounded border border-stone-300 dark:border-[#232a3b]"
                >
                  {k}
                </kbd>
              ))}
            </span>
          </div>
        )}
      </Card>
    );
  }

  const octaveList = Array.from(
    { length: Math.max(1, octaves) },
    (_, idx) => startOctave + idx,
  );

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
                  const isPressed = isNotePressed(fullName);
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
                      aria-label={`Key ${fullName}`}
                      style={{ height }}
                      className={cn(
                        "w-full rounded-none border-0 border-b border-stone-200 dark:border-stone-800 px-3 text-xs font-mono font-medium transition-colors text-stone-800 dark:text-stone-100 cursor-pointer select-none justify-end active:translate-y-0",
                        "bg-white dark:bg-stone-100 hover:bg-stone-100 dark:hover:bg-stone-200 active:bg-stone-200",
                        isC &&
                          "border-b-2 border-b-primary/50 dark:border-b-primary/50",
                        isPressed &&
                          "!bg-primary/20 ring-2 ring-primary ring-inset",
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            isC ? "font-bold text-stone-900" : "text-stone-700",
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
                const isPressed = isNotePressed(fullName);
                const top = keyDef.rowIndex * ROW_HEIGHT;

                return (
                  <Button
                    key={fullName}
                    variant="solid"
                    tone="secondary"
                    size="sm"
                    disabled={disabled}
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
                    aria-label={`Key ${fullName}`}
                    style={{
                      top,
                      height: ROW_HEIGHT,
                    }}
                    className={cn(
                      "absolute left-0 z-20 w-20 sm:w-24 px-2.5 text-xs font-mono rounded-none rounded-r border-0 border-y border-r border-stone-700 cursor-pointer select-none transition-all justify-between active:translate-y-0",
                      "bg-gradient-to-r from-stone-900 to-stone-950 text-stone-100 shadow-md shadow-black/50 hover:brightness-125 active:brightness-90",
                      isPressed &&
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
      {shouldShowMiniMap && renderMiniMap()}

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
                const isPressed = isNotePressed(fullName);
                const isC = keyName === "C";

                return (
                  <Button
                    key={fullName}
                    variant="solid"
                    tone="secondary"
                    size="sm"
                    disabled={disabled}
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
                    aria-label={`Key ${fullName}`}
                    className={cn(
                      "w-10 sm:w-12 h-36 sm:h-44 flex flex-col justify-end pb-3 items-center rounded-none rounded-b-md border-0 border-x border-b border-stone-300 dark:border-stone-400 transition-all cursor-pointer select-none p-0 active:translate-y-0.5",
                      "bg-gradient-to-b from-stone-50 via-white to-stone-100 hover:from-blue-50 hover:to-white active:bg-stone-200 text-stone-800",
                      isPressed &&
                        "!bg-primary/20 ring-2 ring-primary ring-inset",
                    )}
                  >
                    {(showLabels === "all" ||
                      (showLabels === "c-only" && isC)) && (
                      <span
                        className={cn(
                          "text-[11px] font-mono font-medium",
                          isC
                            ? "font-bold text-stone-900 dark:text-stone-100 px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
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
              const isPressed = isNotePressed(fullName);

              return (
                <Button
                  key={fullName}
                  variant="solid"
                  tone="secondary"
                  size="sm"
                  disabled={disabled}
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
                  aria-label={`Key ${fullName}`}
                  style={{
                    left: `${(keyDef.seamIndex / 7) * 100}%`,
                  }}
                  className={cn(
                    "absolute top-0 z-20 -translate-x-1/2 w-6 sm:w-7 h-24 sm:h-28 flex flex-col justify-end pb-2 items-center rounded-none rounded-b-sm border-0 border-x border-b border-stone-700 transition-all cursor-pointer select-none p-0 active:translate-y-0.5",
                    "bg-gradient-to-b from-stone-800 via-stone-900 to-black text-stone-200 shadow-md shadow-black/60 hover:brightness-125 active:brightness-95",
                    isPressed &&
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
            const isPressed = isNotePressed(endNoteName);

            return (
              <div className="relative flex flex-shrink-0">
                <Button
                  variant="solid"
                  tone="secondary"
                  size="sm"
                  disabled={disabled}
                  onMouseDown={() => playKey(endNoteName)}
                  onMouseUp={() => releaseKey(endNoteName)}
                  onMouseLeave={() => releaseKey(endNoteName)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    playKey(endNoteName);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    releaseKey(endNoteName);
                  }}
                  aria-label={`Key ${endNoteName}`}
                  className={cn(
                    "w-10 sm:w-12 h-36 sm:h-44 flex flex-col justify-end pb-3 items-center rounded-none rounded-b-md border-0 border-x border-b border-stone-300 dark:border-stone-400 transition-all cursor-pointer select-none p-0 active:translate-y-0.5",
                    "bg-gradient-to-b from-stone-50 via-white to-stone-100 hover:from-blue-50 hover:to-white active:bg-stone-200 text-stone-800",
                    isPressed &&
                      "!bg-primary/20 ring-2 ring-primary ring-inset",
                  )}
                >
                  {showLabels !== "none" && (
                    <span className="text-[11px] font-mono font-bold text-stone-900 dark:text-stone-100 px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 border border-stone-300 dark:border-stone-700">
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

export const PianoPlayer: React.FC<PianoKeyboardProps> = (props) => (
  <PianoKeyboard mode="player" {...props} />
);

export type PianoPlayerProps = PianoKeyboardProps;

export default PianoKeyboard;
