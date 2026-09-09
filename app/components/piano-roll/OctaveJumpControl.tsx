import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../design-system/Button";
import { cn } from "../../lib/utils";
import { getPresetJumpConfig } from "./types";

export interface OctaveJumpControlProps {
  className?: string;
  octave: number;
  onOctaveChange: (octave: number) => void;
  presetKey?: string;
  presetOctaves?: number[];
}

export const OctaveJumpControl: React.FC<OctaveJumpControlProps> = ({
  className,
  octave,
  onOctaveChange,
  presetKey,
  presetOctaves,
}) => {
  const jumpConfig = presetOctaves
    ? { octaves: presetOctaves, defaultOctave: octave }
    : getPresetJumpConfig(presetKey);
  const octaves =
    jumpConfig.octaves && jumpConfig.octaves.length > 0
      ? jumpConfig.octaves
      : [3, 4, 5];

  const handlePrev = () => {
    const idx = octaves.indexOf(octave);
    if (idx !== -1) {
      const prevIdx = (idx - 1 + octaves.length) % octaves.length;
      onOctaveChange(octaves[prevIdx]);
    } else {
      const prev = [...octaves].reverse().find((o) => o < octave);
      onOctaveChange(prev !== undefined ? prev : octaves[octaves.length - 1]);
    }
  };

  const handleNext = () => {
    const idx = octaves.indexOf(octave);
    if (idx !== -1) {
      const nextIdx = (idx + 1) % octaves.length;
      onOctaveChange(octaves[nextIdx]);
    } else {
      const next = octaves.find((o) => o > octave);
      onOctaveChange(next !== undefined ? next : octaves[0]);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleNext();
    } else {
      handlePrev();
    }
  };

  return (
    <div
      className={cn(
        "flex items-center bg-stone-200 dark:bg-stone-700 rounded h-6 p-0.5 text-stone-800 dark:text-stone-100 select-none gap-0.5",
        className,
      )}
      onWheel={handleWheel}
      title={`Jump to Octave: C${octave}. Click < > to cycle, click label for next, scroll to adjust.`}
    >
      <Button
        variant="ghost"
        tone="secondary"
        size="sm"
        iconOnly
        onClick={handlePrev}
        title="Previous jump octave (Click <)"
        aria-label="Previous jump octave"
        className="h-5 w-4 p-0 rounded hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-300 border-0 flex items-center justify-center"
      >
        <ChevronLeft className="w-3 h-3" />
      </Button>

      <Button
        variant="solid"
        tone="secondary"
        size="sm"
        onClick={handleNext}
        title={`Jump: C${octave}. Click to cycle next.`}
        aria-label={`Jump to octave C${octave}`}
        className="h-5 px-1.5 rounded font-mono text-[11px] font-bold"
      >
        C{octave}
      </Button>

      <Button
        variant="ghost"
        tone="secondary"
        size="sm"
        iconOnly
        onClick={handleNext}
        title="Next jump octave (Click >)"
        aria-label="Next jump octave"
        className="h-5 w-4 p-0 rounded hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-300 border-0 flex items-center justify-center"
      >
        <ChevronRight className="w-3 h-3" />
      </Button>
    </div>
  );
};

export default OctaveJumpControl;
