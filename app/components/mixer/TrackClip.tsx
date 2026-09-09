import React, { useMemo, useState, useRef } from "react";
import { type Track } from "../../lib/studioStorage";
import { Button } from "../design-system/Button";
import { Caption } from "../design-system/Typography";
import { cn } from "../../lib/utils";
import { Drum, Piano, Music, X, Plus, Minus, GripVertical } from "lucide-react";

export interface TrackClipProps {
  track: Track;
  measureWidth: number;
  isSnapEnabled?: boolean;
  onClipCountChange?: (count: number) => void;
  onMoveClip?: (startMeasure: number) => void;
  onOpenInstrument?: () => void;
  isSelected?: boolean;
}

const NOTE_SEMITONES: Record<string, number> = {
  C: 0,
  "C#": 1,
  DB: 1,
  D: 2,
  "D#": 3,
  EB: 3,
  E: 4,
  F: 5,
  "F#": 6,
  GB: 6,
  G: 7,
  "G#": 8,
  AB: 8,
  A: 9,
  "A#": 10,
  BB: 10,
  B: 11,
};

function noteToMidi(noteName: string): number {
  const match = noteName.match(/^([A-Ga-g][#b]?)(-?\d+)$/);
  if (!match) return 60;
  const letter = match[1].toUpperCase();
  const octave = parseInt(match[2], 10);
  const semi = NOTE_SEMITONES[letter] ?? 0;
  return (octave + 1) * 12 + semi;
}

export function TrackClip({
  track,
  measureWidth,
  isSnapEnabled = true,
  onClipCountChange,
  onMoveClip,
  onOpenInstrument,
  isSelected = false,
}: TrackClipProps) {
  const [dragMeasureOffset, setDragMeasureOffset] = useState<number | null>(null);
  const dragRef = useRef<{
    startX: number;
    initialMeasure: number;
    hasMoved: boolean;
  } | null>(null);

  const startMeasure = track.startMeasure || 0;
  const effectiveStartMeasure =
    dragMeasureOffset !== null ? dragMeasureOffset : startMeasure;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if (e.button !== 0) return;

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      initialMeasure: startMeasure,
      hasMoved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const deltaX = e.clientX - dragRef.current.startX;
    if (!dragRef.current.hasMoved && Math.abs(deltaX) < 4) return;
    dragRef.current.hasMoved = true;

    const deltaMeasures = deltaX / measureWidth;
    let targetMeasure = dragRef.current.initialMeasure + deltaMeasures;

    if (isSnapEnabled) {
      targetMeasure = Math.round(targetMeasure);
    } else {
      targetMeasure = Math.round(targetMeasure * 4) / 4;
    }

    setDragMeasureOffset(Math.max(0, targetMeasure));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_e) {
      // Ignored if capture already released
    }

    if (dragRef.current.hasMoved && dragMeasureOffset !== null) {
      onMoveClip?.(dragMeasureOffset);
    }
    dragRef.current = null;
    setDragMeasureOffset(null);
  };

  const handlePointerCancel = () => {
    dragRef.current = null;
    setDragMeasureOffset(null);
  };

  const parsedNotes = useMemo(() => {
    const disabledSet = new Set(track.disabledNotes || []);
    const items: Array<{
      noteName: string;
      step: number;
      midi: number;
      velocity: number;
    }> = [];

    for (const key of track.notes) {
      if (disabledSet.has(key)) continue;
      const lastDash = key.lastIndexOf("-");
      if (lastDash === -1) continue;
      const noteName = key.substring(0, lastDash);
      const step = parseInt(key.substring(lastDash + 1), 10);
      if (isNaN(step)) continue;
      const midi = noteToMidi(noteName);
      const vel = track.noteVelocities?.[key] ?? 80;
      items.push({ noteName, step, midi, velocity: vel });
    }

    return items;
  }, [track.notes, track.disabledNotes, track.noteVelocities]);

  const { minMidi, maxMidi } = useMemo(() => {
    if (parsedNotes.length === 0) return { minMidi: 48, maxMidi: 72 };
    let min = Infinity;
    let max = -Infinity;
    for (const n of parsedNotes) {
      if (n.midi < min) min = n.midi;
      if (n.midi > max) max = n.midi;
    }
    if (max - min < 12) {
      const mid = Math.round((max + min) / 2);
      min = mid - 6;
      max = mid + 6;
    }
    return { minMidi: min, maxMidi: max };
  }, [parsedNotes]);

  const isDrum =
    track.playerView === "drums" || track.preset.toLowerCase().includes("drum");

  const InstrumentIcon = isDrum ? Drum : track.playerView === "keys" ? Piano : Music;

  const clipCount = Math.max(1, track.clipCount || 1);
  const totalSteps = track.totalSteps || 16;

  const renderNoteStripes = (isRepeated = false) => {
    if (parsedNotes.length === 0) {
      return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[10px] text-stone-400/70 dark:text-stone-600/70 font-mono italic">
            Empty pattern
          </span>
        </div>
      );
    }

    const midiSpan = Math.max(1, maxMidi - minMidi);

    return (
      <div className="absolute inset-x-1 top-6 bottom-1 overflow-hidden pointer-events-none">
        {parsedNotes.map((n, i) => {
          const leftPct = (n.step / totalSteps) * 100;
          const widthPct = Math.max(3.5, (1 / totalSteps) * 90);
          const topRatio = 1 - (n.midi - minMidi) / midiSpan;
          const topPct = 8 + topRatio * 74;

          return (
            <div
              key={i}
              className="absolute rounded-[1.5px] shadow-sm transition-opacity"
              style={{
                left: `${leftPct}%`,
                width: `${widthPct}%`,
                top: `${topPct}%`,
                height: "4px",
                backgroundColor: track.color,
                opacity: isRepeated ? 0.65 : 0.95,
              }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className={cn(
        "flex h-full relative select-none rounded group/clip cursor-grab active:cursor-grabbing focus:outline-none transition-[margin-left] duration-75",
        isSelected && "ring-1 ring-primary/80",
        dragMeasureOffset !== null &&
          "ring-2 ring-primary shadow-xl opacity-90 z-30 !transition-none",
      )}
      style={{
        marginLeft: `${effectiveStartMeasure * measureWidth}px`,
        width: `${measureWidth * clipCount}px`,
        minWidth: `${measureWidth * clipCount}px`,
        maxWidth: `${measureWidth * clipCount}px`,
      }}
      onDoubleClick={onOpenInstrument}
      title="Drag to move horizontally | Arrow keys to nudge | Double click to edit"
    >
      {dragMeasureOffset !== null && (
        <div className="absolute top-1 left-1.5 px-2 py-0.5 rounded bg-primary text-white text-[10px] font-mono font-bold shadow-lg pointer-events-none z-50 flex items-center gap-1 whitespace-nowrap">
          <span>Bar {Math.floor(effectiveStartMeasure) + 1}</span>
          {effectiveStartMeasure % 1 !== 0 && (
            <span className="opacity-80">
              : Beat {Math.round((effectiveStartMeasure % 1) * 4) + 1}
            </span>
          )}
        </div>
      )}

      {Array.from({ length: clipCount }).map((_, barIdx) => {
        const isFirst = barIdx === 0;

        return (
          <div
            key={barIdx}
            className={cn(
              "relative h-full flex-shrink-0 flex-grow-0 border-r border-t border-b transition-colors flex flex-col justify-between overflow-hidden",
              isFirst
                ? "rounded-l border-l shadow-xs"
                : "border-l",
              barIdx === clipCount - 1 && "rounded-r",
            )}
            style={{
              width: `${measureWidth}px`,
              minWidth: `${measureWidth}px`,
              maxWidth: `${measureWidth}px`,
              borderColor: `${track.color}44`,
              backgroundColor: isFirst
                ? `${track.color}1e`
                : `${track.color}10`,
            }}
          >
            <div
              className={cn(
                "h-5 px-1.5 flex items-center justify-between text-[10px] font-mono font-medium border-b",
                isFirst
                  ? "bg-stone-900/30 dark:bg-stone-900/50"
                  : "bg-stone-900/20 dark:bg-stone-900/30 opacity-75",
              )}
              style={{
                borderColor: `${track.color}33`,
              }}
            >
              <div className="flex items-center gap-1 min-w-0 overflow-hidden text-stone-800 dark:text-stone-200">
                {!isFirst && onClipCountChange && (
                  <Button
                    variant="ghost"
                    tone="secondary"
                    size="sm"
                    iconOnly
                    title="Remove repeated measure"
                    aria-label="Remove repeated measure"
                    className="p-0.5 h-auto opacity-50 hover:opacity-100 border-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onClipCountChange(clipCount - 1);
                    }}
                  >
                    <X className="w-2.5 h-2.5" />
                  </Button>
                )}

                {isFirst && (
                  <GripVertical className="w-2.5 h-2.5 text-stone-400 dark:text-stone-500 opacity-60 group-hover/clip:opacity-100 flex-shrink-0 -ml-0.5 mr-0.5" />
                )}

                <InstrumentIcon
                  className="w-3 h-3 flex-shrink-0"
                  style={{ color: track.color }}
                />

                <Caption asChild>
                  <span className="truncate font-semibold text-[10px]">
                    {isFirst ? track.name : `${track.name} #${barIdx + 1}`}
                  </span>
                </Caption>
              </div>

              {isFirst && (
                <Button
                  variant="ghost"
                  tone="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenInstrument?.();
                  }}
                  className="opacity-60 hover:opacity-100 hover:text-primary transition-opacity text-[9px] underline px-1 h-auto py-0 border-0"
                  title="Open in Instrument Editor"
                >
                  Edit
                </Button>
              )}
            </div>

            <div className="flex-1 relative">
              {renderNoteStripes(!isFirst)}
            </div>

            <div className="h-1 w-full bg-stone-900/10 dark:bg-stone-100/5" />
          </div>
        );
      })}

      {onClipCountChange && (
        <div className="absolute -right-3.5 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover/clip:opacity-100 group-hover/row:opacity-90 hover:!opacity-100 transition-opacity z-30">
          <Button
            variant="solid"
            tone="secondary"
            size="sm"
            rounded
            iconOnly
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onClipCountChange(clipCount + 1);
            }}
            title="Repeat 1 more bar"
            aria-label="Add repeat measure"
            className="w-5 h-5 rounded-full bg-stone-800 text-white hover:bg-stone-700 flex items-center justify-center shadow-md border border-stone-600 text-[10px] p-0"
          >
            <Plus className="w-3 h-3" />
          </Button>
          {clipCount > 1 && (
            <Button
              variant="solid"
              tone="secondary"
              size="sm"
              rounded
              iconOnly
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onClipCountChange(clipCount - 1);
              }}
              title="Reduce 1 bar"
              aria-label="Remove repeat measure"
              className="w-5 h-5 rounded-full bg-stone-800 text-white hover:bg-stone-700 flex items-center justify-center shadow-md border border-stone-600 text-[10px] p-0"
            >
              <Minus className="w-3 h-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
