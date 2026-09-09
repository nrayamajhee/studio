import React, { useRef, useState } from "react";
import { type Track } from "../../lib/studioStorage";
import { TrackRow } from "./TrackRow";
import { Button } from "../design-system/Button";
import { Label, Caption } from "../design-system/Typography";
import {
  Magnet,
  ZoomIn,
  ZoomOut,
  Plus,
} from "lucide-react";

export interface MixerTimelineProps {
  tracks: Track[];
  activeTrackId: string;
  onSelectTrack: (id: string) => void;
  onUpdateTrack: (id: string, updates: Partial<Track>) => void;
  onDeleteTrack: (id: string) => void;
  onOpenInstrument: (id: string) => void;
  onAddTrackClick: () => void;
  currentStep: number;
  totalStepsPerBar: number;
  onSeekStep: (step: number) => void;
  isPlaying?: boolean;
}

export function MixerTimeline({
  tracks,
  activeTrackId,
  onSelectTrack,
  onUpdateTrack,
  onDeleteTrack,
  onOpenInstrument,
  onAddTrackClick,
  currentStep,
  totalStepsPerBar,
  onSeekStep,
}: MixerTimelineProps) {
  const [zoomLevel, setZoomLevel] = useState(1); // 0.75x to 1.75x
  const [isSnapEnabled, setIsSnapEnabled] = useState(true);

  const baseMeasureWidth = 140;
  const measureWidth = Math.round(baseMeasureWidth * zoomLevel);

  const maxTrackEnd = Math.max(
    1,
    ...tracks.map((t) => (t.startMeasure || 0) + (t.clipCount || 1)),
  );
  const totalMeasures = Math.max(16, maxTrackEnd + 4);

  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);

  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const measureClicked = clickX / measureWidth;

    let targetStep = Math.round(measureClicked * totalStepsPerBar);
    if (isSnapEnabled) {
      targetStep = Math.round(targetStep / 4) * 4;
    }
    onSeekStep(Math.max(0, targetStep));
  };

  const playheadLeftPx =
    (currentStep / totalStepsPerBar) * measureWidth;

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(1.8, Math.round((prev + 0.15) * 100) / 100));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(0.6, Math.round((prev - 0.15) * 100) / 100));
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (rulerRef.current) {
      rulerRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-surface dark:bg-surface-dark select-none">
      <div className="h-9 flex items-center border-b border-stone-200 dark:border-stone-800 bg-stone-100/90 dark:bg-stone-900 flex-shrink-0 z-20">
        <div className="w-72 lg:w-80 flex-shrink-0 px-3 flex items-center justify-between border-r border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <Label className="text-xs font-mono font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
              {tracks.length} {tracks.length === 1 ? "Track" : "Tracks"}
            </Label>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant={isSnapEnabled ? "solid" : "outline"}
              tone={isSnapEnabled ? "primary" : "secondary"}
              size="sm"
              onClick={() => setIsSnapEnabled(!isSnapEnabled)}
              title={isSnapEnabled ? "Grid Snap On" : "Grid Snap Off"}
              aria-label="Toggle snap"
              className="p-1 h-auto text-[10px] font-mono flex items-center gap-1"
            >
              <Magnet className="w-3 h-3" />
              <span className="hidden sm:inline text-[9px]">Snap</span>
            </Button>

            <Button
              variant="solid"
              tone="secondary"
              size="sm"
              iconOnly
              onClick={handleZoomOut}
              disabled={zoomLevel <= 0.65}
              title="Zoom Out (-)"
              aria-label="Zoom out"
              className="p-1 h-auto bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 disabled:opacity-30"
            >
              <ZoomOut className="w-3 h-3" />
            </Button>

            <Button
              variant="solid"
              tone="secondary"
              size="sm"
              iconOnly
              onClick={handleZoomIn}
              disabled={zoomLevel >= 1.75}
              title="Zoom In (+)"
              aria-label="Zoom in"
              className="p-1 h-auto bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 disabled:opacity-30"
            >
              <ZoomIn className="w-3 h-3" />
            </Button>
          </div>
        </div>

        <div
          ref={rulerRef}
          role="slider"
          aria-label="Timeline Ruler"
          aria-valuemin={0}
          aria-valuemax={totalMeasures * totalStepsPerBar}
          aria-valuenow={currentStep}
          tabIndex={0}
          onClick={handleRulerClick}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              onSeekStep(Math.max(0, currentStep - 4));
            } else if (e.key === "ArrowRight") {
              onSeekStep(Math.min(totalMeasures * totalStepsPerBar, currentStep + 4));
            } else if (e.key === "Home") {
              onSeekStep(0);
            }
          }}
          className="flex-1 h-full overflow-hidden relative cursor-pointer group/ruler focus:outline-none focus:ring-1 focus:ring-primary/40"
          style={{
            minWidth: `${measureWidth * totalMeasures}px`,
          }}
        >
          <div className="absolute inset-0 flex">
            {Array.from({ length: totalMeasures }).map((_, barIdx) => (
              <div
                key={barIdx}
                className="h-full border-r border-stone-300 dark:border-stone-800/80 flex flex-col justify-between px-1.5 py-0.5 text-[10px] font-mono font-semibold text-stone-500 dark:text-stone-400 select-none relative"
                style={{ width: `${measureWidth}px` }}
              >
                <Caption asChild>
                  <span>{barIdx + 1}</span>
                </Caption>

                <div className="w-full flex justify-between px-1">
                  <div className="w-[1px] h-1.5 bg-stone-300 dark:bg-stone-700" />
                  <div className="w-[1px] h-2 bg-stone-400 dark:bg-stone-600" />
                  <div className="w-[1px] h-1.5 bg-stone-300 dark:bg-stone-700" />
                </div>
              </div>
            ))}
          </div>

          <div
            className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-30 pointer-events-none transition-transform duration-75"
            style={{
              transform: `translateX(${playheadLeftPx}px)`,
            }}
          >
            <div className="w-3 h-2.5 bg-red-500 -ml-[5px] rounded-b-xs shadow-md flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-white" />
            </div>
          </div>
        </div>
      </div>

      <div
        ref={timelineContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto relative custom-scrollbar"
      >
        <div className="min-w-max relative pb-16">
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-red-500/80 pointer-events-none z-20 left-72 lg:left-80 transition-transform duration-75"
            style={{
              transform: `translateX(${playheadLeftPx}px)`,
            }}
          />

          {tracks.map((track, idx) => (
            <TrackRow
              key={track.id}
              track={track}
              index={idx}
              isActive={track.id === activeTrackId}
              measureWidth={measureWidth}
              totalMeasures={totalMeasures}
              isSnapEnabled={isSnapEnabled}
              onSelect={() => onSelectTrack(track.id)}
              onUpdate={(updates) => onUpdateTrack(track.id, updates)}
              onDelete={
                tracks.length > 1 ? () => onDeleteTrack(track.id) : undefined
              }
              onOpenInstrument={() => onOpenInstrument(track.id)}
            />
          ))}

          <div className="sticky left-0 w-72 lg:w-80 p-2.5 flex items-center z-30 bg-surface dark:bg-surface-dark">
            <Button
              variant="outline"
              tone="secondary"
              size="sm"
              onClick={onAddTrackClick}
              className="w-full border-2 border-dashed border-stone-300 dark:border-stone-800 hover:border-primary dark:hover:border-primary/80 rounded-lg py-3 px-2 text-stone-500 dark:text-stone-400 hover:text-primary dark:hover:text-primary transition-colors flex items-center justify-center gap-1.5 cursor-pointer bg-stone-50/50 dark:bg-stone-900/30 h-auto font-semibold text-xs"
            >
              <Plus className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Drop a loop or add track</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
