import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Button } from "../design-system/Button";
import { cn } from "../../lib/utils";

export type TimeSignature = "4/4" | "3/4" | "triplet";

export interface StepPreset {
  id: string;
  steps: number;
  timeSignature: TimeSignature;
  sigLabel: string;
  barsLabel: string;
  shortDesc: string;
}

export const STEP_PRESETS: StepPreset[] = [
  {
    id: "4-4-8",
    steps: 8,
    timeSignature: "4/4",
    sigLabel: "4/4",
    barsLabel: "1/2 Bar",
    shortDesc: "4/4 · ½B",
  },
  {
    id: "4-4-16",
    steps: 16,
    timeSignature: "4/4",
    sigLabel: "4/4",
    barsLabel: "1 Bar",
    shortDesc: "4/4 · 1B",
  },
  {
    id: "4-4-32",
    steps: 32,
    timeSignature: "4/4",
    sigLabel: "4/4",
    barsLabel: "2 Bars",
    shortDesc: "4/4 · 2B",
  },
  {
    id: "4-4-64",
    steps: 64,
    timeSignature: "4/4",
    sigLabel: "4/4",
    barsLabel: "4 Bars",
    shortDesc: "4/4 · 4B",
  },
  {
    id: "3-4-12",
    steps: 12,
    timeSignature: "3/4",
    sigLabel: "3/4",
    barsLabel: "1 Bar",
    shortDesc: "3/4 · 1B",
  },
  {
    id: "3-4-24",
    steps: 24,
    timeSignature: "3/4",
    sigLabel: "3/4",
    barsLabel: "2 Bars",
    shortDesc: "3/4 · 2B",
  },
  {
    id: "3-4-36",
    steps: 36,
    timeSignature: "3/4",
    sigLabel: "3/4",
    barsLabel: "3 Bars",
    shortDesc: "3/4 · 3B",
  },
  {
    id: "3-4-48",
    steps: 48,
    timeSignature: "3/4",
    sigLabel: "3/4",
    barsLabel: "4 Bars",
    shortDesc: "3/4 · 4B",
  },
  {
    id: "triplet-12",
    steps: 12,
    timeSignature: "triplet",
    sigLabel: "Trip",
    barsLabel: "1 Bar",
    shortDesc: "Trip · 1B",
  },
  {
    id: "triplet-24",
    steps: 24,
    timeSignature: "triplet",
    sigLabel: "Trip",
    barsLabel: "2 Bars",
    shortDesc: "Trip · 2B",
  },
  {
    id: "triplet-48",
    steps: 48,
    timeSignature: "triplet",
    sigLabel: "Trip",
    barsLabel: "4 Bars",
    shortDesc: "Trip · 4B",
  },
];

export const CYCLE_ORDER: StepPreset[] = [
  STEP_PRESETS[0],
  STEP_PRESETS[4],
  STEP_PRESETS[8],
  STEP_PRESETS[1],
  STEP_PRESETS[5],
  STEP_PRESETS[9],
  STEP_PRESETS[2],
  STEP_PRESETS[6],
  STEP_PRESETS[7],
  STEP_PRESETS[10],
  STEP_PRESETS[3],
];

export function findActivePreset(
  steps: number,
  timeSig?: TimeSignature,
): StepPreset {
  if (timeSig) {
    const exact = STEP_PRESETS.find(
      (p) => p.steps === steps && p.timeSignature === timeSig,
    );
    if (exact) return exact;
  }
  const match = STEP_PRESETS.find((p) => p.steps === steps);
  return match || STEP_PRESETS[1];
}

export function getStepDesc(steps: number): string {
  const match = STEP_PRESETS.find((p) => p.steps === steps);
  return match ? `${match.sigLabel} ${match.barsLabel}` : `${steps}s`;
}

export function getStepSummary(steps: number): string {
  return `${steps} (${getStepDesc(steps)})`;
}

export function getNextStepPreset(
  current: number,
  timeSig?: TimeSignature,
): StepPreset {
  const currentPreset = findActivePreset(current, timeSig);
  const idx = CYCLE_ORDER.findIndex((p) => p.id === currentPreset.id);
  if (idx !== -1) {
    return CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length];
  }
  return CYCLE_ORDER[0];
}

export function getPrevStepPreset(
  current: number,
  timeSig?: TimeSignature,
): StepPreset {
  const currentPreset = findActivePreset(current, timeSig);
  const idx = CYCLE_ORDER.findIndex((p) => p.id === currentPreset.id);
  if (idx !== -1) {
    return CYCLE_ORDER[(idx - 1 + CYCLE_ORDER.length) % CYCLE_ORDER.length];
  }
  return CYCLE_ORDER[CYCLE_ORDER.length - 1];
}

export interface StepLengthControlProps {
  className?: string;
  totalSteps: number;
  onTotalStepsChange: (steps: number) => void;
  timeSignature?: TimeSignature;
  onTimeSignatureChange?: (timeSignature: TimeSignature) => void;
}

export const StepLengthControl: React.FC<StepLengthControlProps> = ({
  className,
  totalSteps,
  onTotalStepsChange,
  timeSignature: controlledTimeSig,
  onTimeSignatureChange,
}) => {
  const [internalTimeSig, setInternalTimeSig] = useState<TimeSignature>(() =>
    totalSteps === 12 || totalSteps === 24 ? "3/4" : "4/4",
  );
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeTimeSig = controlledTimeSig ?? internalTimeSig;
  const activePreset = findActivePreset(totalSteps, activeTimeSig);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !containerRef.current) return;
      if (!containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const selectPreset = (preset: StepPreset) => {
    onTotalStepsChange(preset.steps);
    if (onTimeSignatureChange) {
      onTimeSignatureChange(preset.timeSignature);
    }
    setInternalTimeSig(preset.timeSignature);
    setIsOpen(false);
  };

  const handlePrev = () => {
    const prev = getPrevStepPreset(totalSteps, activeTimeSig);
    selectPreset(prev);
  };

  const handleNext = () => {
    const next = getNextStepPreset(totalSteps, activeTimeSig);
    selectPreset(next);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleNext();
    } else {
      handlePrev();
    }
  };

  const fourFourPresets = STEP_PRESETS.filter((p) => p.timeSignature === "4/4");
  const threeFourPresets = STEP_PRESETS.filter((p) => p.timeSignature === "3/4");
  const tripletPresets = STEP_PRESETS.filter((p) => p.timeSignature === "triplet");

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex items-center bg-stone-200 dark:bg-stone-700 rounded h-7 px-0.5 text-stone-800 dark:text-stone-100 select-none",
        className,
      )}
      onWheel={handleWheel}
      title={`Steps: ${activePreset.steps} (${activePreset.sigLabel} • ${activePreset.barsLabel}). Click to choose time signature, < > to cycle, scroll to adjust.`}
    >
      <Button
        variant="ghost"
        tone="secondary"
        size="sm"
        onClick={handlePrev}
        title="Previous step preset (Click <)"
        aria-label="Previous step preset"
        className="!h-6 !w-4 sm:!w-5 !p-0 min-w-0 flex items-center justify-center rounded text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-300 dark:hover:bg-stone-600 border-0"
      >
        <ChevronLeft className="w-3 h-3" />
      </Button>

      <Button
        variant="ghost"
        tone="secondary"
        size="sm"
        onClick={() => setIsOpen((prev) => !prev)}
        title={`Steps: ${activePreset.steps} (${activePreset.sigLabel} • ${activePreset.barsLabel}). Click to choose time signature & length.`}
        aria-label={`Pattern Length: ${activePreset.steps} Steps, ${activePreset.sigLabel}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="!h-6 w-[100px] !px-1 min-w-[100px] max-w-[100px] flex items-center justify-center gap-1 font-mono text-xs font-semibold text-stone-800 dark:text-stone-100 rounded hover:bg-stone-300 dark:hover:bg-stone-600 border-0 flex-shrink-0"
      >
        <span className="font-bold flex-shrink-0">{activePreset.steps}</span>
        <span className="text-[9px] px-1 py-0.5 rounded font-mono font-bold bg-stone-300/80 dark:bg-stone-600/80 text-stone-700 dark:text-stone-200 flex-shrink-0">
          {activePreset.sigLabel}
        </span>
        <span className="text-[10px] text-stone-500 dark:text-stone-400 font-normal truncate">
          {activePreset.barsLabel}
        </span>
      </Button>

      <Button
        variant="ghost"
        tone="secondary"
        size="sm"
        onClick={handleNext}
        title="Next step preset (Click >)"
        aria-label="Next step preset"
        className="!h-6 !w-4 sm:!w-5 !p-0 min-w-0 flex items-center justify-center rounded text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-300 dark:hover:bg-stone-600 border-0"
      >
        <ChevronRight className="w-3 h-3" />
      </Button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Time signature and pattern length options"
          className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50 w-60 p-1.5 bg-surface-light dark:bg-[#0e121b] border border-stone-300 dark:border-stone-700 rounded-lg shadow-2xl text-xs select-none backdrop-blur-md"
        >
          <div className="mb-1.5 pb-1.5 border-b border-stone-200 dark:border-stone-800">
            <div className="px-2 py-0.5 text-[10px] font-mono font-bold text-stone-400 dark:text-stone-400 uppercase tracking-wider">
              4/4 Standard Time
            </div>
            <div className="grid grid-cols-2 gap-1 mt-1">
              {fourFourPresets.map((preset) => {
                const isSelected =
                  preset.steps === totalSteps && activeTimeSig === "4/4";
                return (
                  <Button
                    key={preset.id}
                    variant={isSelected ? "solid" : "ghost"}
                    tone={isSelected ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => selectPreset(preset)}
                    className={cn(
                      "!h-7 !px-2 !py-0 flex items-center justify-between text-left text-[11px] font-mono rounded border-0",
                      isSelected
                        ? "bg-primary text-white font-bold"
                        : "text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800",
                    )}
                  >
                    <span>
                      <strong className="mr-1">{preset.steps}</strong>
                      <span className="opacity-75 text-[10px]">({preset.barsLabel})</span>
                    </span>
                    {isSelected && <Check className="w-3 h-3 flex-shrink-0" />}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="mb-1.5 pb-1.5 border-b border-stone-200 dark:border-stone-800">
            <div className="px-2 py-0.5 text-[10px] font-mono font-bold text-stone-400 dark:text-stone-400 uppercase tracking-wider">
              3/4 Waltz Time
            </div>
            <div className="grid grid-cols-2 gap-1 mt-1">
              {threeFourPresets.map((preset) => {
                const isSelected =
                  preset.steps === totalSteps && activeTimeSig === "3/4";
                return (
                  <Button
                    key={preset.id}
                    variant={isSelected ? "solid" : "ghost"}
                    tone={isSelected ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => selectPreset(preset)}
                    className={cn(
                      "!h-7 !px-2 !py-0 flex items-center justify-between text-left text-[11px] font-mono rounded border-0",
                      isSelected
                        ? "bg-primary text-white font-bold"
                        : "text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800",
                    )}
                  >
                    <span>
                      <strong className="mr-1">{preset.steps}</strong>
                      <span className="opacity-75 text-[10px]">({preset.barsLabel})</span>
                    </span>
                    {isSelected && <Check className="w-3 h-3 flex-shrink-0" />}
                  </Button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="px-2 py-0.5 text-[10px] font-mono font-bold text-stone-400 dark:text-stone-400 uppercase tracking-wider">
              Triplets (12/8 Feel)
            </div>
            <div className="grid grid-cols-1 gap-1 mt-1">
              {tripletPresets.map((preset) => {
                const isSelected =
                  preset.steps === totalSteps && activeTimeSig === "triplet";
                return (
                  <Button
                    key={preset.id}
                    variant={isSelected ? "solid" : "ghost"}
                    tone={isSelected ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => selectPreset(preset)}
                    className={cn(
                      "!h-7 !px-2 !py-0 flex items-center justify-between text-left text-[11px] font-mono rounded border-0",
                      isSelected
                        ? "bg-primary text-white font-bold"
                        : "text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800",
                    )}
                  >
                    <span>
                      <strong className="mr-1">{preset.steps} Steps</strong>
                      <span className="opacity-75 text-[10px]">
                        ({preset.barsLabel} Triplet)
                      </span>
                    </span>
                    {isSelected && <Check className="w-3 h-3 flex-shrink-0" />}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StepLengthControl;
