import React, { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, Check, Minus, Plus } from "lucide-react";
import { cn } from "../../lib/utils";

export interface StepLengthControlProps {
  className?: string;
  totalSteps: number;
  onTotalStepsChange: (steps: number) => void;
  onDoubleSteps?: () => void;
  onHalveSteps?: () => void;
}

const STEP_PRESETS = [
  { steps: 8, label: "8 Steps", desc: "1/2 Bar" },
  { steps: 12, label: "12 Steps", desc: "3/4 Waltz" },
  { steps: 16, label: "16 Steps", desc: "1 Bar" },
  { steps: 24, label: "24 Steps", desc: "6/8 Triplet" },
  { steps: 32, label: "32 Steps", desc: "2 Bars" },
  { steps: 48, label: "48 Steps", desc: "3 Bars" },
  { steps: 64, label: "64 Steps", desc: "4 Bars" },
];

export function getStepSummary(steps: number): string {
  if (steps === 8) return "8 (1/2 Bar)";
  if (steps === 12) return "12 (3/4)";
  if (steps === 16) return "16 (1 Bar)";
  if (steps === 24) return "24 (6/8)";
  if (steps === 32) return "32 (2 Bars)";
  if (steps === 48) return "48 (3 Bars)";
  if (steps === 64) return "64 (4 Bars)";
  return `${steps} Steps`;
}

export const StepLengthControl: React.FC<StepLengthControlProps> = ({
  className,
  totalSteps,
  onTotalStepsChange,
  onDoubleSteps,
  onHalveSteps,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customInput, setCustomInput] = useState(totalSteps.toString());

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setCustomInput(totalSteps.toString());
    }
  };

  const handleCustomSubmit = () => {
    const parsed = parseInt(customInput, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 64) {
      onTotalStepsChange(parsed);
    } else {
      setCustomInput(totalSteps.toString());
    }
  };

  const handleStepDelta = (delta: number) => {
    const next = Math.max(1, Math.min(64, totalSteps + delta));
    onTotalStepsChange(next);
    setCustomInput(next.toString());
  };

  const handleHalve = () => {
    if (onHalveSteps) {
      onHalveSteps();
    } else {
      const next = Math.max(4, Math.floor(totalSteps / 2));
      onTotalStepsChange(next);
    }
  };

  const handleDouble = () => {
    if (onDoubleSteps) {
      onDoubleSteps();
    } else {
      const next = Math.min(64, totalSteps * 2);
      onTotalStepsChange(next);
    }
  };

  return (
    <div className={cn("flex items-center gap-1 flex-shrink-0 select-none", className)}>
      <Popover.Root open={isOpen} onOpenChange={handleOpenChange}>
        <Popover.Trigger asChild>
          <button
            type="button"
            title={`Pattern Length: ${totalSteps} Steps. Click to change.`}
            aria-label={`Pattern Length: ${totalSteps} Steps`}
            className="flex items-center gap-1.5 h-7 px-2 text-xs font-mono font-semibold rounded bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-100 transition-colors cursor-pointer shadow-xs border border-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <span className="text-[10px] uppercase font-bold text-stone-500 dark:text-stone-400">
              Steps:
            </span>
            <span className="font-bold">{getStepSummary(totalSteps)}</span>
            <ChevronDown className={cn("w-3 h-3 text-stone-500 transition-transform", isOpen && "rotate-180")} />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="start"
            sideOffset={6}
            className="z-50 w-56 bg-white dark:bg-[#0c0f17] border border-stone-200 dark:border-[#1f2533] rounded-xl shadow-2xl p-2.5 text-stone-900 dark:text-stone-100 flex flex-col gap-2.5 backdrop-blur-md animate-in fade-in zoom-in-95"
          >
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-mono uppercase font-bold text-stone-500 dark:text-stone-400 tracking-wider">
                Custom Length
              </span>
              <div className="flex items-center justify-between bg-stone-100 dark:bg-[#151922] p-1 rounded-lg border border-stone-200 dark:border-[#222938]">
                <button
                  type="button"
                  onClick={() => handleStepDelta(-1)}
                  disabled={totalSteps <= 1}
                  title="Decrease steps (-1)"
                  aria-label="Decrease steps"
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-stone-200 dark:hover:bg-[#1e2433] text-stone-700 dark:text-stone-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-1 font-mono">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onBlur={handleCustomSubmit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleCustomSubmit();
                        setIsOpen(false);
                      }
                    }}
                    aria-label="Custom step count"
                    className="w-8 text-center text-sm font-bold bg-transparent text-stone-900 dark:text-white focus:outline-none select-all"
                  />
                  <span className="text-[10px] text-stone-400">steps</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleStepDelta(1)}
                  disabled={totalSteps >= 64}
                  title="Increase steps (+1)"
                  aria-label="Increase steps"
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-stone-200 dark:hover:bg-[#1e2433] text-stone-700 dark:text-stone-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="h-px bg-stone-200 dark:bg-stone-800" />

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase font-bold text-stone-500 dark:text-stone-400 tracking-wider">
                Musical Presets
              </span>
              <div className="flex flex-col gap-0.5">
                {STEP_PRESETS.map((preset) => {
                  const isSelected = totalSteps === preset.steps;
                  return (
                    <button
                      key={preset.steps}
                      type="button"
                      onClick={() => {
                        onTotalStepsChange(preset.steps);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer",
                        isSelected
                          ? "bg-primary text-white font-bold shadow-xs"
                          : "hover:bg-stone-100 dark:hover:bg-[#161a24] text-stone-700 dark:text-stone-300",
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        {isSelected && <Check className="w-3 h-3" />}
                        <span>{preset.label}</span>
                      </span>
                      <span
                        className={cn(
                          "text-[10px]",
                          isSelected ? "text-white/80" : "text-stone-400 dark:text-stone-500",
                        )}
                      >
                        {preset.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <button
        type="button"
        onClick={handleHalve}
        disabled={totalSteps <= 4}
        title="Halve pattern length (÷2)"
        aria-label="Halve pattern length"
        className="h-7 px-1.5 text-[10px] font-mono font-bold rounded bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 border border-stone-300/80 dark:border-stone-600/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
      >
        ÷2
      </button>

      <button
        type="button"
        onClick={handleDouble}
        disabled={totalSteps >= 64}
        title="Double pattern length and duplicate notes (x2)"
        aria-label="Double pattern length and duplicate notes"
        className="h-7 px-1.5 text-[10px] font-mono font-bold rounded bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 border border-stone-300/80 dark:border-stone-600/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
      >
        x2
      </button>
    </div>
  );
};
