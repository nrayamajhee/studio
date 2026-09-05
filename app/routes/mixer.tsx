import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/mixer";
import { useTheme } from "../hooks/useTheme";
import { Button } from "../components/design-system/Button";
import { Slider } from "../components/design-system/Slider";
import { PianoRoll } from "../components/piano-roll/PianoRoll";
import { PresetSelector } from "../components/piano-roll/PresetSelector";
import { SynthControls } from "../components/piano-roll/SynthControls";
import { PianoPlayer } from "../components/piano-roll/PianoPlayer";
import { DrumPad } from "../components/piano-roll/DrumPad";
import { synth } from "../lib/synth";
import { cn } from "../lib/utils";
import {
  Home,
  Play,
  Pause,
  SkipBack,
  Repeat,
  Circle,
  Sun,
  Moon,
  Monitor,
  Trash2,
  OctagonAlert,
  Metronome,
  Volume1,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  Piano,
  Drum,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Mixer - Piano Roll & Hybrid Synthesizer - Studio" },
    {
      name: "description",
      content:
        "10-octave piano roll sequencer with modal impulser and physical modeling synthesizer.",
    },
  ];
}

export default function Mixer() {
  const { theme, nextTheme, cycleTheme } = useTheme();

  const [activeNotes, setActiveNotes] = useState<Set<string>>(() => {
    return new Set([
      "C4-0",
      "E4-2",
      "G4-4",
      "B4-6",
      "C5-8",
      "G4-10",
      "E4-12",
      "C4-14",
    ]);
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isMetronomeOn, setIsMetronomeOn] = useState(false);
  const [volume, setVolume] = useState(() => synth.getMasterVolume());
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(16);
  const [bpm, setBpm] = useState(120);
  const [selectedPreset, setSelectedPreset] = useState("grand_piano");
  const [playerView, setPlayerView] = useState<"keys" | "drums">("keys");
  const [isInstrumentsCollapsed, setIsInstrumentsCollapsed] = useState(false);
  const [isPlayerCollapsed, setIsPlayerCollapsed] = useState(false);

  const currentStepRef = useRef(currentStep);
  const totalStepsRef = useRef(totalSteps);
  const isPlayingRef = useRef(isPlaying);
  const isLoopingRef = useRef(isLooping);
  const isMetronomeOnRef = useRef(isMetronomeOn);
  const activeNotesRef = useRef(activeNotes);

  useEffect(() => {
    currentStepRef.current = currentStep;
    totalStepsRef.current = totalSteps;
    isPlayingRef.current = isPlaying;
    isLoopingRef.current = isLooping;
    isMetronomeOnRef.current = isMetronomeOn;
    activeNotesRef.current = activeNotes;
  }, [currentStep, totalSteps, isPlaying, isLooping, isMetronomeOn, activeNotes]);

  useEffect(() => {
    const isDrumPreset = [
      "drum_set",
      "drum_808",
      "trap_kit",
      "electronic_drums",
      "acoustic_percussion",
    ].includes(selectedPreset);
    setPlayerView(isDrumPreset ? "drums" : "keys");
  }, [selectedPreset]);

  const triggerStepNotes = useCallback(
    (stepIdx: number) => {
      if (isMetronomeOnRef.current && stepIdx % 4 === 0) {
        synth.playMetronomeTick(stepIdx === 0);
      }

      const suffix = `-${stepIdx}`;
      const stepDurationSec = Math.max(0.1, (60 / bpm / 4) * 0.9);
      for (const item of activeNotesRef.current) {
        if (item.endsWith(suffix)) {
          const noteName = item.slice(0, -suffix.length);
          synth.playNote(noteName, undefined, stepDurationSec);
        }
      }
    },
    [bpm],
  );

  useEffect(() => {
    if (!isPlaying) return;

    const stepDuration = 60000 / bpm / 4;

    const interval = setInterval(() => {
      const prevStep = currentStepRef.current;
      let nextStep = prevStep + 1;

      if (nextStep >= totalStepsRef.current) {
        if (isLoopingRef.current) {
          nextStep = 0;
        } else {
          setIsPlaying(false);
          return;
        }
      }

      setCurrentStep(nextStep);
      triggerStepNotes(nextStep);
    }, stepDuration);

    return () => clearInterval(interval);
  }, [isPlaying, bpm, triggerStepNotes]);

  const handlePlayToggle = () => {
    if (!isPlaying) {
      synth.ensureContext();
      triggerStepNotes(currentStep);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  };

  const handleSkipToFirst = () => {
    setCurrentStep(0);
    if (isPlaying) {
      triggerStepNotes(0);
    }
  };

  const handleRecordToggle = () => {
    synth.ensureContext();
    setIsRecording((prev) => {
      const next = !prev;
      if (next && !isPlaying) {
        setIsPlaying(true);
      }
      return next;
    });
  };

  const handleMetronomeToggle = () => {
    setIsMetronomeOn((prev) => {
      const next = !prev;
      if (next) {
        synth.playMetronomeTick(true);
      }
      return next;
    });
  };

  const handlePanicStop = () => {
    synth.panic();
    setIsPlaying(false);
    setIsRecording(false);
  };

  const prevVolumeRef = useRef(volume > 0 ? volume : 0.7);

  const handleVolumeChange = (newVol: number) => {
    const clamped = Math.max(0, Math.min(1, newVol));
    setVolume(clamped);
    synth.setMasterVolume(clamped);
    if (clamped > 0) {
      prevVolumeRef.current = clamped;
    }
  };

  const handleVolumeToggleMute = () => {
    if (volume > 0) {
      prevVolumeRef.current = volume;
      handleVolumeChange(0);
    } else {
      handleVolumeChange(prevVolumeRef.current || 0.7);
    }
  };

  const handleVolumeWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    handleVolumeChange(
      Math.max(0, Math.min(1, Math.round((volume + delta) * 100) / 100)),
    );
  };

  const [bpmInput, setBpmInput] = useState(String(bpm));

  useEffect(() => {
    setBpmInput(String(bpm));
  }, [bpm]);

  const commitBpm = (value: string) => {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(40, Math.min(260, parsed));
      setBpm(clamped);
      setBpmInput(String(clamped));
    } else {
      setBpmInput(String(bpm));
    }
  };

  const handleBpmInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBpmInput(e.target.value);
  };

  const handleBpmInputBlur = () => {
    commitBpm(bpmInput);
  };

  const handleBpmInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      commitBpm(bpmInput);
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setBpmInput(String(bpm));
      e.currentTarget.blur();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.shiftKey ? 5 : 1;
      setBpm((prev) => Math.min(260, prev + step));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const step = e.shiftKey ? 5 : 1;
      setBpm((prev) => Math.max(40, prev - step));
    }
  };

  const handleBpmDecrement = (e: React.MouseEvent) => {
    const step = e.shiftKey ? 5 : 1;
    setBpm((prev) => Math.max(40, prev - step));
  };

  const handleBpmIncrement = (e: React.MouseEvent) => {
    const step = e.shiftKey ? 5 : 1;
    setBpm((prev) => Math.min(260, prev + step));
  };

  const handleBpmWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? (e.shiftKey ? 5 : 1) : (e.shiftKey ? -5 : -1);
    setBpm((prev) => Math.max(40, Math.min(260, prev + delta)));
  };

  const handleRecordNote = (noteName: string) => {
    const step = currentStepRef.current;
    const noteKey = `${noteName}-${step}`;
    setActiveNotes((prev) => {
      const next = new Set(prev);
      next.add(noteKey);
      return next;
    });
  };

  const handleClearNotes = () => {
    setActiveNotes(new Set());
  };

  return (
    <div className="h-screen w-screen max-w-full overflow-hidden bg-surface text-font dark:bg-surface-dark dark:text-surface flex flex-col font-sans transition-colors duration-200">
      <header className="w-full flex items-center justify-between px-2 py-2 border-b border-stone-200 dark:border-stone-800 bg-surface-light/95 dark:bg-stone-900/95 backdrop-blur-sm flex-shrink-0 z-50">
        <div className="flex items-center gap-4 sm:gap-6">
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
              onClick={handleSkipToFirst}
              title="Skip to Start (Step 1)"
              aria-label="Skip to first step"
              className="p-1.5 h-auto rounded bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-100"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </Button>

            <Button
              variant="solid"
              tone={isPlaying ? "primary" : "secondary"}
              size="sm"
              iconOnly
              onClick={handlePlayToggle}
              title={isPlaying ? "Pause Sequencer" : "Play Sequencer"}
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
              tone={isLooping ? "primary" : "secondary"}
              size="sm"
              iconOnly
              onClick={() => setIsLooping((prev) => !prev)}
              title={isLooping ? "Loop Enabled" : "Loop Disabled"}
              aria-label="Toggle loop"
              className={cn(
                "p-1.5 h-auto rounded",
                isLooping
                  ? "bg-primary text-white ring-1 ring-primary-light shadow-sm"
                  : "bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-100",
              )}
            >
              <Repeat className="w-3.5 h-3.5" />
            </Button>

            <Button
              variant="solid"
              tone={isRecording ? "error" : "secondary"}
              size="sm"
              iconOnly
              onClick={handleRecordToggle}
              title={isRecording ? "Recording Active" : "Arm Record"}
              aria-label="Toggle record"
              className={cn(
                "p-1.5 h-auto rounded",
                isRecording
                  ? "animate-pulse"
                  : "bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-100",
              )}
            >
              <Circle className="w-3.5 h-3.5" />
            </Button>

            <Button
              variant="solid"
              tone={isMetronomeOn ? "primary" : "secondary"}
              size="sm"
              iconOnly
              onClick={handleMetronomeToggle}
              title={isMetronomeOn ? "Metronome On" : "Metronome Off"}
              aria-label="Toggle metronome"
              className={cn(
                "p-1.5 h-auto rounded",
                isMetronomeOn
                  ? "bg-primary text-white ring-1 ring-primary-light shadow-sm"
                  : "bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-100",
              )}
            >
              <Metronome className="w-3.5 h-3.5" />
            </Button>

            <div className="h-4 w-[1px] bg-stone-300 dark:bg-stone-700 mx-0.5 flex-shrink-0" />

            <div
              className="flex items-center bg-stone-200 dark:bg-stone-700 rounded h-7 px-0.5 text-stone-800 dark:text-stone-100"
              onWheel={handleBpmWheel}
              title={`Tempo: ${bpm} BPM (Click < > or scroll wheel to adjust, type to edit)`}
            >
              <button
                type="button"
                onClick={handleBpmDecrement}
                disabled={bpm <= 40}
                title="Decrease tempo (-1 BPM, Shift: -5)"
                aria-label="Decrease tempo"
                className="h-6 w-4 sm:w-5 flex items-center justify-center rounded hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>

              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={bpmInput}
                onChange={handleBpmInputChange}
                onBlur={handleBpmInputBlur}
                onKeyDown={handleBpmInputKeyDown}
                aria-label={`Tempo: ${bpm} BPM`}
                className="w-7 sm:w-8 text-center font-mono text-xs font-semibold bg-transparent text-stone-800 dark:text-stone-100 focus:outline-none focus:bg-stone-100 dark:focus:bg-stone-800 rounded py-0.5 select-all cursor-text"
              />

              <button
                type="button"
                onClick={handleBpmIncrement}
                disabled={bpm >= 260}
                title="Increase tempo (+1 BPM, Shift: +5)"
                aria-label="Increase tempo"
                className="h-6 w-4 sm:w-5 flex items-center justify-center rounded hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-1.5">
            <div
              className="flex items-center gap-1.5 px-0.5"
              onWheel={handleVolumeWheel}
            >
              <Button
                variant="solid"
                tone="secondary"
                size="sm"
                iconOnly
                onClick={handleVolumeToggleMute}
                title={`Master Volume: ${Math.round(volume * 100)}% (Click to toggle mute, scroll to adjust)`}
                aria-label={`Master Volume: ${Math.round(volume * 100)}%`}
                className="p-1.5 h-auto rounded bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-100 flex-shrink-0"
              >
                {volume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5 text-stone-400" />
                ) : volume <= 0.5 ? (
                  <Volume1 className="w-3.5 h-3.5" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </Button>

              <Slider
                tone="primary"
                size="sm"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(val) => handleVolumeChange(val)}
                className="w-14 sm:w-20"
              />

              <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400 w-7 text-right select-none flex-shrink-0">
                {Math.round(volume * 100)}%
              </span>
            </div>

            <div className="h-4 w-[1px] bg-stone-300 dark:bg-stone-700 mx-0.5 flex-shrink-0" />

            <Button
              variant="solid"
              tone="error"
              size="sm"
              iconOnly
              onClick={handlePanicStop}
              title="Panic Stop (Kill all sounds immediately)"
              aria-label="Panic stop"
              className="p-1.5 h-auto rounded bg-red-600 hover:bg-red-700 text-white shadow-sm"
            >
              <OctagonAlert className="w-3.5 h-3.5" />
            </Button>

            <Button
              variant="solid"
              tone="secondary"
              size="sm"
              iconOnly
              onClick={handleClearNotes}
              title="Clear all recorded notes"
              aria-label="Clear notes"
              className="p-1.5 h-auto rounded bg-stone-200 dark:bg-stone-700 hover:bg-red-500 hover:text-white dark:hover:bg-red-600 text-stone-700 dark:text-stone-300"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>

          <Button
            variant="solid"
            tone="secondary"
            size="sm"
            rounded
            iconOnly
            className="p-1.5 h-8 w-8 rounded-full bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-100 shadow-sm"
            title={`Theme: ${theme}. Click to switch to ${nextTheme}.`}
            aria-label={`Theme: ${theme}. Click to switch to ${nextTheme}.`}
            onClick={cycleTheme}
          >
            {nextTheme === "light" ? (
              <Sun className="w-4 h-4" />
            ) : nextTheme === "dark" ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Monitor className="w-4 h-4" />
            )}
          </Button>
        </div>
      </header>

      <main className="flex-[1.1] min-h-0 w-full overflow-hidden flex flex-col p-0 m-0 border-b-2 border-stone-300 dark:border-stone-800">
        <PianoRoll
          className="flex-1 w-full h-full"
          activeNotes={Array.from(activeNotes)}
          onNotesChange={(newNotes) => setActiveNotes(new Set(newNotes))}
          currentStep={isPlaying || isRecording ? currentStep : null}
          isPlaying={isPlaying}
          isRecording={isRecording}
          totalSteps={totalSteps}
          onTotalStepsChange={setTotalSteps}
        />
      </main>

      <footer className="flex-1 min-h-0 w-full flex flex-col md:flex-row gap-2.5 p-2.5 bg-stone-100/60 dark:bg-[#06080c] overflow-hidden flex-shrink-0">
        {!isInstrumentsCollapsed && (
          <div className="w-full md:w-16 lg:w-18 h-full min-h-0 flex-shrink-0 overflow-hidden">
            <PresetSelector
              selectedPreset={selectedPreset}
              onPresetChange={setSelectedPreset}
              onCollapse={() => setIsInstrumentsCollapsed(true)}
            />
          </div>
        )}

        <div className="flex-1 min-w-0 h-full min-h-0 overflow-hidden">
          <SynthControls
            selectedPreset={selectedPreset}
            leftHeaderSlot={
              isInstrumentsCollapsed ? (
                <button
                  type="button"
                  onClick={() => setIsInstrumentsCollapsed(false)}
                  title="Expand instruments panel"
                  aria-label="Expand instruments panel"
                  className="self-center h-8 px-2.5 sm:px-3 bg-white dark:bg-[#0a0d14] border border-stone-200 dark:border-[#1f2533] hover:border-stone-400 dark:hover:border-[#38435d] hover:bg-stone-50 dark:hover:bg-[#111520] text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white text-xs font-mono font-medium rounded-lg flex items-center gap-1.5 flex-shrink-0 shadow-sm transition-all cursor-pointer select-none"
                >
                  <PanelLeftOpen className="w-3.5 h-3.5 text-primary dark:text-primary-light" />
                  <span className="text-[11px]">Instruments</span>
                </button>
              ) : undefined
            }
            rightHeaderSlot={
              isPlayerCollapsed ? (
                <button
                  type="button"
                  onClick={() => setIsPlayerCollapsed(false)}
                  title="Expand player panel"
                  aria-label="Expand player panel"
                  className="self-center h-8 px-2.5 sm:px-3 bg-white dark:bg-[#0a0d14] border border-stone-200 dark:border-[#1f2533] hover:border-stone-400 dark:hover:border-[#38435d] hover:bg-stone-50 dark:hover:bg-[#111520] text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white text-xs font-mono font-medium rounded-lg flex items-center gap-1.5 flex-shrink-0 shadow-sm transition-all cursor-pointer select-none"
                >
                  <span className="text-[11px]">Player</span>
                  <PanelRightOpen className="w-3.5 h-3.5 text-primary dark:text-primary-light" />
                </button>
              ) : undefined
            }
          />
        </div>

        {!isPlayerCollapsed && (
          <div className="w-full md:w-[330px] lg:w-[380px] xl:w-[420px] h-full min-h-0 flex-shrink-0 flex flex-col gap-1 overflow-hidden">
            <div className="flex items-center justify-between px-1 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono font-bold tracking-wider text-stone-700 dark:text-stone-300">
                  PLAYER
                </span>
                <button
                  type="button"
                  onClick={() => setIsPlayerCollapsed(true)}
                  title="Collapse player panel"
                  aria-label="Collapse player panel"
                  className="p-0.5 rounded text-stone-400 hover:text-stone-800 dark:text-stone-500 dark:hover:text-primary-light hover:bg-stone-200/60 dark:hover:bg-[#161c28] transition-colors cursor-pointer"
                >
                  <PanelRightClose className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-1 bg-stone-200/80 dark:bg-[#0a0c10] p-0.5 rounded-lg border border-stone-300 dark:border-[#1f2533]">
                <Button
                  variant="solid"
                  tone={playerView === "keys" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setPlayerView("keys")}
                  aria-label="Piano keyboard view"
                  className={cn(
                    "px-2 py-0.5 h-6 text-[10px] rounded transition-colors",
                    playerView === "keys"
                      ? "bg-primary text-white font-bold border border-primary-light shadow-sm"
                      : "bg-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white border border-transparent",
                  )}
                >
                  <Piano className="w-3 h-3 mr-1 inline" />
                  Keys
                </Button>
                <Button
                  variant="solid"
                  tone={playerView === "drums" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setPlayerView("drums")}
                  aria-label="Drum pad view"
                  className={cn(
                    "px-2 py-0.5 h-6 text-[10px] rounded transition-colors",
                    playerView === "drums"
                      ? "bg-primary text-white font-bold border border-primary-light shadow-sm"
                      : "bg-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white border border-transparent",
                  )}
                >
                  <Drum className="w-3 h-3 mr-1 inline" />
                  Drum Pad
                </Button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              {playerView === "keys" ? (
                <PianoPlayer
                  isRecording={isRecording}
                  onRecordNote={handleRecordNote}
                  activeNotes={Array.from(activeNotes)
                    .filter((item) => item.endsWith(`-${currentStep}`))
                    .map((item) => item.replace(`-${currentStep}`, ""))}
                />
              ) : (
                <DrumPad
                  selectedPreset={selectedPreset}
                  isRecording={isRecording}
                  onRecordNote={handleRecordNote}
                  activeNotes={Array.from(activeNotes)
                    .filter((item) => item.endsWith(`-${currentStep}`))
                    .map((item) => item.replace(`-${currentStep}`, ""))}
                />
              )}
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
