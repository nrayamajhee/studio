import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
        "flex items-center bg-stone-200 dark:bg-stone-700 rounded h-7 px-0.5 text-stone-800 dark:text-stone-100 select-none",
        className,
      )}
      onWheel={handleWheel}
      title={`Jump to Octave: C${octave}. Click < > to cycle, click label for next, scroll to adjust.`}
    >
      <button
        type="button"
        onClick={handlePrev}
        title="Previous jump octave (Click <)"
        aria-label="Previous jump octave"
        className="h-6 w-4 sm:w-5 flex items-center justify-center rounded hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer"
      >
        <ChevronLeft className="w-3 h-3" />
      </button>

      <button
        type="button"
        onClick={handleNext}
        title={`Jump: C${octave}. Click to cycle next.`}
        aria-label={`Jump to octave C${octave}`}
        className="h-6 px-1.5 flex items-center justify-center font-mono text-xs font-semibold hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-100 rounded transition-colors cursor-pointer"
      >
        <span className="font-bold">C{octave}</span>
      </button>

      <button
        type="button"
        onClick={handleNext}
        title="Next jump octave (Click >)"
        aria-label="Next jump octave"
        className="h-6 w-4 sm:w-5 flex items-center justify-center rounded hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer"
      >
        <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
};

export default OctaveJumpControl;
