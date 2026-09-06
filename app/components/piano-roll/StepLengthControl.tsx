import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

export interface StepLengthControlProps {
  className?: string;
  totalSteps: number;
  onTotalStepsChange: (steps: number) => void;
}

export const STEP_PRESETS = [8, 12, 16, 24, 32, 48, 64];

export function getStepDesc(steps: number): string {
  if (steps === 8) return "1/2 Bar";
  if (steps === 12) return "3/4";
  if (steps === 16) return "1 Bar";
  if (steps === 24) return "6/8";
  if (steps === 32) return "2 Bars";
  if (steps === 48) return "3 Bars";
  if (steps === 64) return "4 Bars";
  return `${steps}s`;
}

export function getStepSummary(steps: number): string {
  return `${steps} (${getStepDesc(steps)})`;
}

export function getNextStepPreset(current: number): number {
  const idx = STEP_PRESETS.indexOf(current);
  if (idx !== -1) {
    return STEP_PRESETS[(idx + 1) % STEP_PRESETS.length];
  }
  const next = STEP_PRESETS.find((s) => s > current);
  return next !== undefined ? next : STEP_PRESETS[0];
}

export function getPrevStepPreset(current: number): number {
  const idx = STEP_PRESETS.indexOf(current);
  if (idx !== -1) {
    return STEP_PRESETS[(idx - 1 + STEP_PRESETS.length) % STEP_PRESETS.length];
  }
  const prev = [...STEP_PRESETS].reverse().find((s) => s < current);
  return prev !== undefined ? prev : STEP_PRESETS[STEP_PRESETS.length - 1];
}

export const StepLengthControl: React.FC<StepLengthControlProps> = ({
  className,
  totalSteps,
  onTotalStepsChange,
}) => {
  const handlePrev = () => {
    onTotalStepsChange(getPrevStepPreset(totalSteps));
  };

  const handleNext = () => {
    onTotalStepsChange(getNextStepPreset(totalSteps));
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
      title={`Pattern Length: ${totalSteps} Steps (${getStepDesc(totalSteps)}). Click < > or scroll to cycle.`}
    >
      <button
        type="button"
        onClick={handlePrev}
        title="Previous step preset (Click <)"
        aria-label="Previous step preset"
        className="h-6 w-4 sm:w-5 flex items-center justify-center rounded hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer"
      >
        <ChevronLeft className="w-3 h-3" />
      </button>

      <button
        type="button"
        onClick={handleNext}
        title={`Steps: ${totalSteps} (${getStepDesc(totalSteps)}). Click to cycle next.`}
        aria-label={`Pattern Length: ${totalSteps} Steps`}
        className="h-6 px-1.5 flex items-center justify-center gap-1 font-mono text-xs font-semibold hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-100 rounded transition-colors cursor-pointer"
      >
        <span className="font-bold">{totalSteps}</span>
        <span className="text-[10px] text-stone-500 dark:text-stone-400 font-normal hidden sm:inline">
          ({getStepDesc(totalSteps)})
        </span>
      </button>

      <button
        type="button"
        onClick={handleNext}
        title="Next step preset (Click >)"
        aria-label="Next step preset"
        className="h-6 w-4 sm:w-5 flex items-center justify-center rounded hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer"
      >
        <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
};

export default StepLengthControl;
