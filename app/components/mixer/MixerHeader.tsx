import React, { useState } from "react";
import { Link } from "react-router";
import { Button } from "../design-system/Button";
import { useTheme } from "../../hooks/useTheme";
import { cn } from "../../lib/utils";
import {
  Home,
  Play,
  Pause,
  SkipBack,
  Repeat,
  Sun,
  Moon,
  Monitor,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export interface MixerHeaderProps {
  isPlaying: boolean;
  onPlayToggle: () => void;
  onStop: () => void;
  isLooping: boolean;
  onLoopToggle: () => void;
  bpm: number;
  onBpmChange: (bpm: number) => void;
  timeSignature?: "4/4" | "3/4" | "triplet";
  onTimeSignatureChange?: (sig: "4/4" | "3/4" | "triplet") => void;
  currentStep: number;
  totalStepsPerBar: number;
  onAddTrackClick?: () => void;
  activeTrackId?: string;
  activeTrackName?: string;
  activeTrackColor?: string;
}

export function MixerHeader({
  isPlaying,
  onPlayToggle,
  onStop,
  isLooping,
  onLoopToggle,
  bpm,
  onBpmChange,
  currentStep,
  totalStepsPerBar,
}: MixerHeaderProps) {
  const { theme, nextTheme, cycleTheme } = useTheme();

  const [isEditingBpm, setIsEditingBpm] = useState(false);
  const [rawBpmInput, setRawBpmInput] = useState("");
  const displayBpm = isEditingBpm ? rawBpmInput : String(bpm);

  const commitBpm = (value: string) => {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(40, Math.min(260, parsed));
      onBpmChange(clamped);
    }
    setIsEditingBpm(false);
  };

  const handleBpmDecrement = (e: React.MouseEvent) => {
    const step = e.shiftKey ? 5 : 1;
    onBpmChange(Math.max(40, bpm - step));
  };

  const handleBpmIncrement = (e: React.MouseEvent) => {
    const step = e.shiftKey ? 5 : 1;
    onBpmChange(Math.min(260, bpm + step));
  };

  const handleBpmWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? (e.shiftKey ? 5 : 1) : e.shiftKey ? -5 : -1;
    onBpmChange(Math.max(40, Math.min(260, bpm + delta)));
  };

  const currentBar = Math.floor(currentStep / totalStepsPerBar) + 1;
  const currentBeat = Math.floor((currentStep % totalStepsPerBar) / 4) + 1;
  const currentTick = (currentStep % 4) * 25;

  const barStr = currentBar.toString().padStart(3, "0");
  const beatStr = currentBeat.toString().padStart(2, "0");
  const tickStr = currentTick.toString().padStart(2, "0");

  return (
    <header className="w-full flex items-center justify-between px-3 py-2 border-b border-stone-200 dark:border-stone-800 bg-surface-light/95 dark:bg-stone-900/95 backdrop-blur-sm flex-shrink-0 z-50">
      <div className="flex items-center gap-3 sm:gap-4">
        <Button
          asChild
          variant="solid"
          tone="secondary"
          size="sm"
          rounded
          iconOnly
          title="Home"
          aria-label="Home"
          className="p-1.5 h-8 w-8 rounded-full bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-100 shadow-sm"
        >
          <Link to="/">
            <Home className="w-4 h-4" />
          </Link>
        </Button>

        <div className="flex items-center gap-1.5">
          <Button
            variant="solid"
            tone="secondary"
            size="sm"
            iconOnly
            onClick={onStop}
            title="Rewind to Start (Bar 1)"
            aria-label="Rewind to start"
            className="p-1.5 h-auto rounded bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-100"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="solid"
            tone={isPlaying ? "primary" : "secondary"}
            size="sm"
            iconOnly
            onClick={onPlayToggle}
            title={isPlaying ? "Pause Playback" : "Play Timeline (Space)"}
            aria-label={isPlaying ? "Pause" : "Play"}
            className={cn(
              "p-1.5 h-auto rounded",
              !isPlaying &&
                "bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-100",
            )}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
          </Button>

          <Button
            variant="solid"
            tone={isLooping ? "info" : "secondary"}
            size="sm"
            iconOnly
            onClick={onLoopToggle}
            title={isLooping ? "Timeline Loop Active" : "Timeline Loop Off"}
            aria-label="Toggle loop"
            className={cn(
              "p-1.5 h-auto rounded",
              isLooping
                ? "bg-info text-white ring-1 ring-info-light shadow-sm"
                : "bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-100",
            )}
          >
            <Repeat className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div
          className="flex items-center px-2 py-1 bg-stone-200/70 dark:bg-stone-950 font-mono text-xs font-bold rounded border border-stone-300 dark:border-stone-800 tracking-wider shadow-inner"
          title="Timeline Position (Bar : Beat : Tick)"
        >
          <span className="text-primary-dark dark:text-primary-light">{barStr}</span>
          <span className="text-stone-400 mx-1">:</span>
          <span className="text-stone-700 dark:text-stone-200">{beatStr}</span>
          <span className="text-stone-400 mx-1">:</span>
          <span className="text-stone-500 text-[10px]">{tickStr}</span>
        </div>

        <div
          className="flex items-center bg-stone-200 dark:bg-stone-700 rounded h-7 px-0.5 text-stone-800 dark:text-stone-100"
          onWheel={handleBpmWheel}
          title={`Tempo: ${bpm} BPM (Scroll wheel or type to edit)`}
        >
          <Button
            variant="ghost"
            tone="secondary"
            size="sm"
            iconOnly
            onClick={handleBpmDecrement}
            disabled={bpm <= 40}
            title="Decrease tempo (-1 BPM)"
            aria-label="Decrease tempo"
            className="h-6 w-4 sm:w-5 flex items-center justify-center rounded p-0 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 disabled:opacity-30 border-0"
          >
            <ChevronLeft className="w-3 h-3" />
          </Button>

          <input
            type="text"
            inputMode="numeric"
            value={displayBpm}
            onChange={(e) => {
              setIsEditingBpm(true);
              setRawBpmInput(e.target.value);
            }}
            onBlur={() => commitBpm(rawBpmInput)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitBpm(rawBpmInput);
                e.currentTarget.blur();
              }
            }}
            aria-label={`Tempo: ${bpm} BPM`}
            className="w-7 sm:w-8 text-center font-mono text-xs font-semibold bg-transparent text-stone-800 dark:text-stone-100 focus:outline-none focus:bg-stone-100 dark:focus:bg-stone-800 rounded py-0.5 select-all cursor-text"
          />

          <Button
            variant="ghost"
            tone="secondary"
            size="sm"
            iconOnly
            onClick={handleBpmIncrement}
            disabled={bpm >= 260}
            title="Increase tempo (+1 BPM)"
            aria-label="Increase tempo"
            className="h-6 w-4 sm:w-5 flex items-center justify-center rounded p-0 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 disabled:opacity-30 border-0"
          >
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="solid"
          tone="secondary"
          size="sm"
          rounded
          iconOnly
          onClick={cycleTheme}
          title={`Theme: ${theme} (Click to switch to ${nextTheme})`}
          aria-label="Toggle theme"
          className="p-1.5 h-8 w-8 rounded-full bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-100 shadow-sm"
        >
          {theme === "light" && <Sun className="w-4 h-4" />}
          {theme === "dark" && <Moon className="w-4 h-4" />}
          {theme === "system" && <Monitor className="w-4 h-4" />}
        </Button>
      </div>
    </header>
  );
}
