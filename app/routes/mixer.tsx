import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/mixer";
import { useTheme } from "../hooks/useTheme";
import { Button } from "../components/design-system/Button";
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
  Timer,
  Volume1,
  Volume2,
  VolumeX,
  Gauge,
  Piano,
  Drum,
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

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    synth.setMasterVolume(newVol);
  };

  const handleVolumeCycle = () => {
    const levels = [1.0, 0.75, 0.5, 0.25, 0];
    const currentIdx = levels.findIndex((l) => Math.abs(l - volume) < 0.1);
    const nextIdx =
      currentIdx === -1 || currentIdx === levels.length - 1
        ? 0
        : currentIdx + 1;
    handleVolumeChange(levels[nextIdx]);
  };

  const handleVolumeWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    handleVolumeChange(
      Math.max(0, Math.min(1, Math.round((volume + delta) * 100) / 100)),
    );
  };

  const cycleBpm = () => {
    const bpmPresets = [90, 105, 120, 130, 140, 160];
    const idx = bpmPresets.indexOf(bpm);
    const nextIdx = idx === -1 || idx === bpmPresets.length - 1 ? 0 : idx + 1;
    setBpm(bpmPresets[nextIdx]);
  };

  const handleBpmWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 5 : -5;
    setBpm((prev) => Math.max(60, Math.min(240, prev + delta)));
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
      <header className="w-full flex items-center justify-between px-3 sm:px-6 py-2 border-b border-stone-200 dark:border-stone-800 bg-surface-light/95 dark:bg-stone-900/95 backdrop-blur-sm flex-shrink-0 z-50">
        <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800/80 p-1 rounded-lg border border-stone-200 dark:border-stone-700">
          <Button
            asChild
            variant="solid"
            tone="secondary"
            size="sm"
            iconOnly
            title="Home"
            aria-label="Home"
            className="p-1.5 h-auto rounded bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-100"
          >
            <Link to="/">
              <Home className="w-3.5 h-3.5 fill-current" />
            </Link>
          </Button>

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
            <SkipBack className="w-3.5 h-3.5 fill-current" />
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
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
          </Button>

          <Button
            variant="solid"
            tone={isLooping ? "accent" : "secondary"}
            size="sm"
            iconOnly
            onClick={() => setIsLooping((prev) => !prev)}
            title={isLooping ? "Loop Enabled" : "Loop Disabled"}
            aria-label="Toggle loop"
            className={cn(
              "p-1.5 h-auto rounded",
              isLooping
                ? "bg-[#d4a359] text-stone-950 ring-1 ring-[#f1c784]"
                : "bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-100",
            )}
          >
            <Repeat className="w-3.5 h-3.5 fill-current" />
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
            <Circle className="w-3.5 h-3.5 fill-current" />
          </Button>

          <Button
            variant="solid"
            tone={isMetronomeOn ? "accent" : "secondary"}
            size="sm"
            iconOnly
            onClick={handleMetronomeToggle}
            title={isMetronomeOn ? "Metronome On" : "Metronome Off"}
            aria-label="Toggle metronome"
            className={cn(
              "p-1.5 h-auto rounded",
              isMetronomeOn
                ? "bg-[#d4a359] text-stone-950 ring-1 ring-[#f1c784]"
                : "bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-100",
            )}
          >
            <Timer className="w-3.5 h-3.5 fill-current" />
          </Button>

          <Button
            variant="solid"
            tone="secondary"
            size="sm"
            iconOnly
            onClick={cycleBpm}
            onWheel={handleBpmWheel}
            title={`Tempo: ${bpm} BPM (Click to cycle: 90, 105, 120, 130, 140, 160)`}
            aria-label={`Tempo: ${bpm} BPM`}
            className="p-1.5 h-auto rounded bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-100"
          >
            <Gauge className="w-3.5 h-3.5 fill-current" />
          </Button>

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
            <OctagonAlert className="w-3.5 h-3.5 fill-current" />
          </Button>
        </div>

        <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800/80 p-1 rounded-lg border border-stone-200 dark:border-stone-700">
          <Button
            variant="solid"
            tone="secondary"
            size="sm"
            iconOnly
            onClick={handleVolumeCycle}
            onWheel={handleVolumeWheel}
            title={`Master Volume: ${Math.round(volume * 100)}% (Click to cycle, scroll to adjust)`}
            aria-label={`Master Volume: ${Math.round(volume * 100)}%`}
            className="p-1.5 h-auto rounded bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-100"
          >
            {volume === 0 ? (
              <VolumeX className="w-3.5 h-3.5 fill-current" />
            ) : volume <= 0.5 ? (
              <Volume1 className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 fill-current" />
            )}
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
            <Trash2 className="w-3.5 h-3.5 fill-current" />
          </Button>

          <Button
            variant="solid"
            tone="secondary"
            size="sm"
            iconOnly
            className="p-1.5 h-auto rounded bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-100"
            title={`Theme: ${theme}. Click to switch to ${nextTheme}.`}
            aria-label={`Theme: ${theme}. Click to switch to ${nextTheme}.`}
            onClick={cycleTheme}
          >
            {nextTheme === "light" ? (
              <Sun className="w-3.5 h-3.5 fill-current" />
            ) : nextTheme === "dark" ? (
              <Moon className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Monitor className="w-3.5 h-3.5 fill-current" />
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
        <div className="w-full md:w-44 lg:w-48 xl:w-52 h-full min-h-0 flex-shrink-0 overflow-hidden">
          <PresetSelector
            selectedPreset={selectedPreset}
            onPresetChange={setSelectedPreset}
          />
        </div>

        <div className="flex-1 min-w-0 h-full min-h-0 overflow-hidden">
          <SynthControls selectedPreset={selectedPreset} />
        </div>

        <div className="w-full md:w-[330px] lg:w-[380px] xl:w-[420px] h-full min-h-0 flex-shrink-0 flex flex-col gap-1 overflow-hidden">
          <div className="flex items-center justify-between px-1 flex-shrink-0">
            <span className="text-[10px] font-mono uppercase font-bold text-stone-500 dark:text-stone-400">
              Player View
            </span>
            <div className="flex items-center gap-1 bg-[#0a0c10] p-0.5 rounded-lg border border-[#1f2533]">
              <Button
                variant="solid"
                tone={playerView === "keys" ? "accent" : "secondary"}
                size="sm"
                onClick={() => setPlayerView("keys")}
                aria-label="Piano keyboard view"
                className={cn(
                  "px-2 py-0.5 h-6 text-[10px] rounded transition-colors",
                  playerView === "keys"
                    ? "bg-[#d4a359] text-stone-950 font-bold border border-[#f1c784]"
                    : "bg-transparent text-stone-400 hover:text-white border border-transparent",
                )}
              >
                <Piano className="w-3 h-3 mr-1 inline" />
                Keys
              </Button>
              <Button
                variant="solid"
                tone={playerView === "drums" ? "accent" : "secondary"}
                size="sm"
                onClick={() => setPlayerView("drums")}
                aria-label="Drum pad view"
                className={cn(
                  "px-2 py-0.5 h-6 text-[10px] rounded transition-colors",
                  playerView === "drums"
                    ? "bg-[#d4a359] text-stone-950 font-bold border border-[#f1c784]"
                    : "bg-transparent text-stone-400 hover:text-white border border-transparent",
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
      </footer>
    </div>
  );
}
