import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { synth } from "../../lib/synth";
import { Button } from "../design-system/Button";
import { Card } from "../design-system/Card";
import { cn } from "../../lib/utils";
import { ChevronLeft, ChevronRight, Radio } from "lucide-react";

export interface PianoPlayerProps {
  className?: string;
  isRecording?: boolean;
  onRecordNote?: (noteName: string) => void;
  activeNotes?: string[];
}

interface KeyConfig {
  note: string;
  freq: number;
  isBlack: boolean;
  key: string;
  isPlus?: boolean;
}

const BASE_KEY_CONFIGS: KeyConfig[] = [
  { note: "C", freq: 261.63, isBlack: false, key: "a" },
  { note: "C#", freq: 277.18, isBlack: true, key: "w" },
  { note: "D", freq: 293.66, isBlack: false, key: "s" },
  { note: "D#", freq: 311.13, isBlack: true, key: "e" },
  { note: "E", freq: 329.63, isBlack: false, key: "d" },
  { note: "F", freq: 349.23, isBlack: false, key: "f" },
  { note: "F#", freq: 369.99, isBlack: true, key: "t" },
  { note: "G", freq: 392.0, isBlack: false, key: "g" },
  { note: "G#", freq: 415.3, isBlack: true, key: "y" },
  { note: "A", freq: 440.0, isBlack: false, key: "h" },
  { note: "A#", freq: 466.16, isBlack: true, key: "u" },
  { note: "B", freq: 493.88, isBlack: false, key: "j" },
  { note: "C", freq: 523.25, isBlack: false, key: "k", isPlus: true },
  { note: "C#", freq: 554.37, isBlack: true, key: "o", isPlus: true },
  { note: "D", freq: 587.33, isBlack: false, key: "l", isPlus: true },
  { note: "D#", freq: 622.25, isBlack: true, key: "p", isPlus: true },
  { note: "E", freq: 659.25, isBlack: false, key: ";", isPlus: true },
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

export const PianoPlayer: React.FC<PianoPlayerProps> = ({
  className,
  isRecording = false,
  onRecordNote,
  activeNotes = [],
}) => {
  const [baseOctave, setBaseOctave] = useState(4);
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const miniMapRef = useRef<HTMLDivElement>(null);
  const [isDraggingMap, setIsDraggingMap] = useState(false);

  const activeNotesSet = useMemo(() => new Set(activeNotes), [activeNotes]);

  const currentKeys = useMemo(() => {
    return BASE_KEY_CONFIGS.map((k) => {
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

  const playKey = useCallback(
    (keyItem: (typeof currentKeys)[0]) => {
      synth.playNote(keyItem.fullName, keyItem.freq);
      setPressedKeys((prev) => new Set(prev).add(keyItem.fullName));

      if (isRecording && onRecordNote) {
        onRecordNote(keyItem.fullName);
      }
    },
    [isRecording, onRecordNote],
  );

  const releaseKey = useCallback((keyItem: (typeof currentKeys)[0]) => {
    synth.stopNote(keyItem.fullName);
    setPressedKeys((prev) => {
      const next = new Set(prev);
      next.delete(keyItem.fullName);
      return next;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (
        targetTag === "input" ||
        targetTag === "select" ||
        targetTag === "textarea"
      ) {
        return;
      }

      const keyItem = keyMap.get(e.key.toLowerCase());
      if (keyItem) {
        e.preventDefault();
        playKey(keyItem);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const keyItem = keyMap.get(e.key.toLowerCase());
      if (keyItem) {
        e.preventDefault();
        releaseKey(keyItem);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [keyMap, playKey, releaseKey]);

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

  const viewportLeftPct = ((baseOctave - 1) / MINI_MAP_OCTAVES.length) * 100;
  const viewportWidthPct = (1.5 / MINI_MAP_OCTAVES.length) * 100;

  return (
    <Card
      elevation="mid"
      className={cn(
        "flex flex-col h-full w-full bg-[#0a0c10] border border-[#1f2533] rounded-xl overflow-hidden shadow-lg text-stone-100 p-2.5 gap-2 select-none",
        className,
      )}
    >
      <div className="flex flex-col gap-1.5 pb-1 border-b border-[#1f2533]">
        {isRecording && (
          <div className="flex items-center justify-end">
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 animate-pulse bg-red-950/40 px-1.5 py-0.5 rounded border border-red-800/50">
              <Radio className="w-3 h-3 fill-current" />
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
            disabled={baseOctave <= 1}
            aria-label="Scroll octave left"
            className="p-1 h-auto rounded bg-[#161a24] hover:bg-[#232a3b] border border-[#232a3b] text-stone-300"
          >
            <ChevronLeft className="w-3.5 h-3.5 fill-current" />
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
            className="relative flex-1 h-6 bg-[#07080c] border border-[#1f2533] rounded-md overflow-hidden cursor-pointer flex items-end shadow-inner focus-visible:ring-1 focus-visible:ring-[#d4a359]"
          >
            <div className="absolute inset-0 flex">
              {MINI_MAP_OCTAVES.map((oct) => (
                <div
                  key={oct}
                  className="flex-1 relative border-r border-stone-800/80 flex"
                >
                  {WHITE_NOTES_PER_OCT.map((noteName) => {
                    const noteKey = `${noteName}${oct}`;
                    const isActive =
                      pressedKeys.has(noteKey) || activeNotesSet.has(noteKey);
                    return (
                      <div
                        key={noteName}
                        className={cn(
                          "flex-1 h-full border-r border-stone-900 transition-colors",
                          isActive
                            ? "bg-[#d4a359]"
                            : "bg-[#dadce3] dark:bg-stone-300",
                        )}
                      />
                    );
                  })}

                  {Object.entries(BLACK_KEY_OFFSETS).map(
                    ([bNoteName, offsetFactor]) => {
                      const noteKey = `${bNoteName}${oct}`;
                      const isActive =
                        pressedKeys.has(noteKey) || activeNotesSet.has(noteKey);
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
                            isActive ? "bg-[#d4a359]" : "bg-black",
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
              className="absolute top-0 bottom-0 z-20 border-2 border-[#d4a359] bg-[#d4a359]/25 rounded-sm pointer-events-none shadow-sm shadow-[#d4a359]/40"
            />
          </div>

          <Button
            variant="solid"
            tone="secondary"
            size="sm"
            onClick={() => setBaseOctave((prev) => Math.min(6, prev + 1))}
            disabled={baseOctave >= 6}
            aria-label="Scroll octave right"
            className="p-1 h-auto rounded bg-[#161a24] hover:bg-[#232a3b] border border-[#232a3b] text-stone-300"
          >
            <ChevronRight className="w-3.5 h-3.5 fill-current" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center overflow-x-auto py-1">
        <div className="relative flex items-start bg-[#06080c] p-1.5 rounded-lg border border-[#1f2533] shadow-inner">
          {currentKeys.map((item) => {
            const isPressed =
              pressedKeys.has(item.fullName) ||
              activeNotesSet.has(item.fullName);

            if (item.isBlack) {
              return (
                <Button
                  key={item.fullName}
                  variant="solid"
                  tone="secondary"
                  size="sm"
                  onMouseDown={() => playKey(item)}
                  onMouseUp={() => releaseKey(item)}
                  onMouseLeave={() => releaseKey(item)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    playKey(item);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    releaseKey(item);
                  }}
                  aria-label={`Key ${item.fullName}`}
                  className={cn(
                    "relative z-20 w-6 sm:w-7 h-24 sm:h-28 -mx-3 sm:-mx-3.5 flex flex-col justify-end items-center pb-2 rounded-none rounded-b border-0 border-x border-b border-stone-800 transition-all cursor-pointer select-none p-0",
                    "bg-gradient-to-b from-stone-800 via-stone-900 to-black text-stone-200 shadow-md shadow-black/80 hover:brightness-125",
                    isPressed &&
                      "!from-[#d4a359] !to-[#b5873e] text-stone-950 !shadow-[#d4a359]/50 ring-1 ring-[#f1c784] translate-y-0.5",
                  )}
                >
                  <kbd className="text-[8px] font-mono px-1 rounded bg-stone-900 text-stone-300 uppercase mb-1">
                    {item.key}
                  </kbd>
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
                onMouseDown={() => playKey(item)}
                onMouseUp={() => releaseKey(item)}
                onMouseLeave={() => releaseKey(item)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  playKey(item);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  releaseKey(item);
                }}
                aria-label={`Key ${item.fullName}`}
                className={cn(
                  "relative z-10 w-9 sm:w-10 h-36 sm:h-40 flex flex-col justify-end items-center pb-2.5 rounded-none rounded-b-md border-0 border-x border-b border-stone-400 transition-all cursor-pointer select-none p-0",
                  "bg-gradient-to-b from-stone-50 via-white to-stone-200 hover:from-amber-50 hover:to-white text-stone-900 shadow-sm",
                  isPressed &&
                    "!bg-[#f1c784] ring-2 ring-[#d4a359] ring-inset translate-y-0.5",
                )}
              >
                <kbd className="text-[9px] font-mono px-1 rounded bg-stone-200 text-stone-700 uppercase mb-1 font-semibold">
                  {item.key}
                </kbd>
                <span className="text-[10px] font-mono font-medium text-stone-600">
                  {item.fullName}
                </span>
              </Button>
            );
          })}
        </div>
      </div>

      <div className="text-[10px] text-stone-400 text-center flex flex-wrap items-center justify-center gap-2 pt-1 border-t border-[#1f2533]">
        <span>
          White:{" "}
          <kbd className="bg-[#161a24] px-1 py-0.5 rounded border border-[#232a3b]">
            A
          </kbd>{" "}
          <kbd className="bg-[#161a24] px-1 py-0.5 rounded border border-[#232a3b]">
            S
          </kbd>{" "}
          <kbd className="bg-[#161a24] px-1 py-0.5 rounded border border-[#232a3b]">
            D
          </kbd>{" "}
          <kbd className="bg-[#161a24] px-1 py-0.5 rounded border border-[#232a3b]">
            F
          </kbd>{" "}
          <kbd className="bg-[#161a24] px-1 py-0.5 rounded border border-[#232a3b]">
            G
          </kbd>{" "}
          <kbd className="bg-[#161a24] px-1 py-0.5 rounded border border-[#232a3b]">
            H
          </kbd>{" "}
          <kbd className="bg-[#161a24] px-1 py-0.5 rounded border border-[#232a3b]">
            J
          </kbd>{" "}
          <kbd className="bg-[#161a24] px-1 py-0.5 rounded border border-[#232a3b]">
            K
          </kbd>{" "}
          <kbd className="bg-[#161a24] px-1 py-0.5 rounded border border-[#232a3b]">
            L
          </kbd>{" "}
          <kbd className="bg-[#161a24] px-1 py-0.5 rounded border border-[#232a3b]">
            ;
          </kbd>
        </span>
        <span className="text-stone-600">|</span>
        <span>
          Black:{" "}
          <kbd className="bg-[#161a24] px-1 py-0.5 rounded border border-[#232a3b]">
            W
          </kbd>{" "}
          <kbd className="bg-[#161a24] px-1 py-0.5 rounded border border-[#232a3b]">
            E
          </kbd>{" "}
          <kbd className="bg-[#161a24] px-1 py-0.5 rounded border border-[#232a3b]">
            T
          </kbd>{" "}
          <kbd className="bg-[#161a24] px-1 py-0.5 rounded border border-[#232a3b]">
            Y
          </kbd>{" "}
          <kbd className="bg-[#161a24] px-1 py-0.5 rounded border border-[#232a3b]">
            U
          </kbd>{" "}
          <kbd className="bg-[#161a24] px-1 py-0.5 rounded border border-[#232a3b]">
            O
          </kbd>{" "}
          <kbd className="bg-[#161a24] px-1 py-0.5 rounded border border-[#232a3b]">
            P
          </kbd>
        </span>
      </div>
    </Card>
  );
};

export default PianoPlayer;
