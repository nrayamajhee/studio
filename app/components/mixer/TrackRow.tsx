import React from "react";
import { type Track } from "../../lib/studioStorage";
import { TrackClip } from "./TrackClip";
import { Button } from "../design-system/Button";
import { Slider } from "../design-system/Slider";
import { cn } from "../../lib/utils";
import {
  Drum,
  Piano,
  Music,
  Trash2,
} from "lucide-react";

export interface TrackRowProps {
  track: Track;
  index: number;
  isActive: boolean;
  measureWidth: number;
  totalMeasures: number;
  onSelect: () => void;
  onUpdate: (updates: Partial<Track>) => void;
  onDelete?: () => void;
  onOpenInstrument: () => void;
}

export function TrackRow({
  track,
  isActive,
  measureWidth,
  totalMeasures,
  onSelect,
  onUpdate,
  onDelete,
  onOpenInstrument,
}: TrackRowProps) {
  const isDrum =
    track.playerView === "drums" || track.preset.toLowerCase().includes("drum");
  const InstrumentIcon = isDrum ? Drum : track.playerView === "keys" ? Piano : Music;

  const handleVolumeChange = (newVol: number) => {
    onUpdate({ volume: Math.max(0, Math.min(1, newVol)) });
  };

  const handleMuteToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate({ isMuted: !track.isMuted });
  };

  const handleSoloToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate({ isSolo: !track.isSolo });
  };

  const volDb =
    track.volume <= 0.001
      ? "-∞ dB"
      : `${(20 * Math.log10(track.volume)).toFixed(1)} dB`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onSelect();
        }
      }}
      className={cn(
        "flex h-24 border-b border-stone-200 dark:border-stone-800 transition-colors group/row focus:outline-none focus:ring-1 focus:ring-primary/40",
        isActive
          ? "bg-stone-100/80 dark:bg-[#0f141f]"
          : "hover:bg-stone-50/50 dark:hover:bg-[#0a0d14]/50",
      )}
    >
      <div
        className={cn(
          "w-72 lg:w-80 flex-shrink-0 flex flex-col justify-between p-2.5 border-r border-stone-200 dark:border-stone-800 sticky left-0 z-10 select-none",
          isActive
            ? "bg-stone-100 dark:bg-[#111622]"
            : "bg-stone-50 dark:bg-[#0d1017]",
        )}
        style={{
          borderLeft: `4px solid ${track.color}`,
        }}
      >
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <InstrumentIcon
              className="w-4 h-4 flex-shrink-0"
              style={{ color: track.color }}
            />
            <Button
              variant="ghost"
              tone="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onOpenInstrument();
              }}
              title={`Edit ${track.name} in Instrument`}
              className="text-xs font-bold text-stone-800 dark:text-stone-100 truncate hover:underline p-0 h-auto border-0 justify-start"
            >
              {track.name}
            </Button>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="solid"
              tone={track.isMuted ? "warning" : "secondary"}
              size="sm"
              iconOnly
              onClick={handleMuteToggle}
              title={track.isMuted ? "Unmute Track" : "Mute Track (M)"}
              aria-label="Mute"
              className={cn(
                "w-5 h-5 rounded text-[10px] font-bold font-mono p-0",
                track.isMuted
                  ? "bg-amber-500 text-stone-900 shadow-sm"
                  : "bg-stone-200 dark:bg-[#1a2130] text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 border border-stone-300 dark:border-stone-700",
              )}
            >
              M
            </Button>

            <Button
              variant="solid"
              tone={track.isSolo ? "warning" : "secondary"}
              size="sm"
              iconOnly
              onClick={handleSoloToggle}
              title={track.isSolo ? "Unsolo Track" : "Solo Track (S)"}
              aria-label="Solo"
              className={cn(
                "w-5 h-5 rounded text-[10px] font-bold font-mono p-0",
                track.isSolo
                  ? "bg-yellow-400 text-stone-950 font-black shadow-sm"
                  : "bg-stone-200 dark:bg-[#1a2130] text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 border border-stone-300 dark:border-stone-700",
              )}
            >
              S
            </Button>

            {onDelete && (
              <Button
                variant="ghost"
                tone="error"
                size="sm"
                iconOnly
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                title="Delete Track"
                aria-label="Delete track"
                className="w-5 h-5 rounded p-0 text-stone-400 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover/row:opacity-100 border-0"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-0.5 pt-1">
          <div className="flex items-center justify-between text-[9px] font-mono text-stone-500 dark:text-stone-400">
            <span>VOL</span>
            <span>{volDb}</span>
          </div>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={track.volume}
            onChange={handleVolumeChange}
            size="sm"
            className="w-full"
          />
        </div>
      </div>

      <div
        className="flex-1 h-full relative overflow-hidden bg-stone-900/10 dark:bg-stone-950/40 p-1.5 flex items-center"
        style={{
          minWidth: `${measureWidth * totalMeasures}px`,
          backgroundImage: `repeating-linear-gradient(to right, transparent, transparent ${
            measureWidth - 1
          }px, var(--color-stone-300, #e7e5e4) ${measureWidth - 1}px, var(--color-stone-300, #e7e5e4) ${measureWidth}px)`,
        }}
      >
        <TrackClip
          track={track}
          measureWidth={measureWidth}
          isSelected={isActive}
          onClipCountChange={(count) => onUpdate({ clipCount: count })}
          onOpenInstrument={onOpenInstrument}
        />
      </div>
    </div>
  );
}
