import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link } from "react-router";
import { useStudioStorage } from "../lib/studioStorage";
import type { Route } from "./+types/mixer";
import { useTheme } from "../hooks/useTheme";
import { Button } from "../components/design-system/Button";
import { GoogleIcon } from "../components/design-system/Icons";
import { Slider } from "../components/design-system/Slider";
import { PianoRoll } from "../components/piano-roll/PianoRoll";
import { PresetSelector } from "../components/piano-roll/PresetSelector";
import { SynthControls } from "../components/piano-roll/SynthControls";
import { PianoKeyboard } from "../components/piano-roll/PianoKeyboard";
import { DrumPad } from "../components/piano-roll/DrumPad";
import { StepLengthControl } from "../components/piano-roll/StepLengthControl";
import { OctaveJumpControl } from "../components/piano-roll/OctaveJumpControl";
import { MidiControl } from "../components/piano-roll/MidiControl";
import { getPresetJumpConfig } from "../components/piano-roll/types";
import { synth } from "../lib/synth";
import { midiManager } from "../lib/midi";
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
  PanelRightClose,
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

  const [studio, setStudio] = useStudioStorage();

  const user = studio.user;
  const activeNotes = useMemo(() => new Set(studio.notes), [studio.notes]);
  const setActiveNotes = useCallback(
    (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      setStudio((prev) => {
        const currentSet = new Set(prev.notes);
        const nextSet =
          typeof updater === "function" ? updater(currentSet) : updater;
        return { ...prev, notes: Array.from(nextSet) };
      });
    },
    [setStudio],
  );

  const disabledNotes = useMemo(
    () => new Set(studio.disabledNotes),
    [studio.disabledNotes],
  );
  const setDisabledNotes = useCallback(
    (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      setStudio((prev) => {
        const currentSet = new Set(prev.disabledNotes);
        const nextSet =
          typeof updater === "function" ? updater(currentSet) : updater;
        return { ...prev, disabledNotes: Array.from(nextSet) };
      });
    },
    [setStudio],
  );

  const noteVelocities = studio.noteVelocities;
  const setNoteVelocities = useCallback(
    (
      updater:
        | Record<string, number>
        | ((prev: Record<string, number>) => Record<string, number>),
    ) => {
      setStudio((prev) => ({
        ...prev,
        noteVelocities:
          typeof updater === "function" ? updater(prev.noteVelocities) : updater,
      }));
    },
    [setStudio],
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const isLooping = studio.isLooping;
  const setIsLooping = useCallback(
    (updater: boolean | ((prev: boolean) => boolean)) => {
      setStudio((prev) => ({
        ...prev,
        isLooping: typeof updater === "function" ? updater(prev.isLooping) : updater,
      }));
    },
    [setStudio],
  );

  const [isRecording, setIsRecording] = useState(false);
  const [isMetronomeOn, setIsMetronomeOn] = useState(false);
  const volume = studio.volume;
  const setVolume = useCallback(
    (val: number | ((prev: number) => number)) => {
      setStudio((prev) => ({
        ...prev,
        volume: typeof val === "function" ? val(prev.volume) : val,
      }));
    },
    [setStudio],
  );

  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = studio.totalSteps;
  const setTotalSteps = useCallback(
    (steps: number | ((prev: number) => number)) => {
      setStudio((prev) => ({
        ...prev,
        totalSteps: typeof steps === "function" ? steps(prev.totalSteps) : steps,
      }));
    },
    [setStudio],
  );

  const bpm = studio.bpm;
  const setBpm = useCallback(
    (val: number | ((prev: number) => number)) => {
      setStudio((prev) => ({
        ...prev,
        bpm: typeof val === "function" ? val(prev.bpm) : val,
      }));
    },
    [setStudio],
  );

  const selectedPreset = studio.selectedPreset;
  const jumpOctave = studio.jumpOctave;
  const setJumpOctave = useCallback(
    (val: number | ((prev: number) => number)) => {
      setStudio((prev) => ({
        ...prev,
        jumpOctave: typeof val === "function" ? val(prev.jumpOctave) : val,
      }));
    },
    [setStudio],
  );

  const playerView = studio.playerView;
  const setPlayerView = useCallback(
    (val: ("keys" | "drums") | ((prev: "keys" | "drums") => "keys" | "drums")) => {
      setStudio((prev) => ({
        ...prev,
        playerView: typeof val === "function" ? val(prev.playerView) : val,
      }));
    },
    [setStudio],
  );

  const velocity = studio.velocity;
  const setVelocity = useCallback(
    (val: number | ((prev: number) => number)) => {
      setStudio((prev) => ({
        ...prev,
        velocity: typeof val === "function" ? val(prev.velocity) : val,
      }));
    },
    [setStudio],
  );

  const handlePresetChange = useCallback(
    (preset: string) => {
      synth.loadPreset(preset);
      const cfg = getPresetJumpConfig(preset);
      const isDrumPreset = [
        "drum_set",
        "drum_808",
        "trap_kit",
        "electronic_drums",
        "acoustic_percussion",
      ].includes(preset);
      setStudio((prev) => ({
        ...prev,
        selectedPreset: preset,
        jumpOctave: cfg.defaultOctave,
        playerView: isDrumPreset ? "drums" : "keys",
        synthParams: { ...synth.params },
      }));
    },
    [setStudio],
  );

  useEffect(() => {
    synth.setMasterVolume(volume);
    synth.loadPreset(selectedPreset);
  }, [volume, selectedPreset]);

  const [isPlayerCollapsed, setIsPlayerCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 1380;
    }
    return false;
  });

  useEffect(() => {
    let prevWidth = typeof window !== "undefined" ? window.innerWidth : 1400;

    const handleResize = () => {
      const width = window.innerWidth;

      if (width < 1380 && prevWidth >= 1380) {
        setIsPlayerCollapsed(true);
      } else if (width >= 1380 && prevWidth < 1380) {
        setIsPlayerCollapsed(false);
      }

      prevWidth = width;
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [externalPressedKeys, setExternalPressedKeys] = useState<string[]>([]);
  const [externalPressedPads, setExternalPressedPads] = useState<string[]>([]);

  const currentStepRef = useRef(currentStep);
  const totalStepsRef = useRef(totalSteps);
  const isPlayingRef = useRef(isPlaying);
  const isLoopingRef = useRef(isLooping);
  const isMetronomeOnRef = useRef(isMetronomeOn);
  const activeNotesRef = useRef(activeNotes);
  const velocityRef = useRef(velocity);
  const noteVelocitiesRef = useRef(noteVelocities);
  const disabledNotesRef = useRef(disabledNotes);
  const playerViewRef = useRef(playerView);
  const isRecordingRef = useRef(isRecording);
  const selectedPresetRef = useRef(selectedPreset);

  useEffect(() => {
    currentStepRef.current = currentStep;
    totalStepsRef.current = totalSteps;
    isPlayingRef.current = isPlaying;
    isLoopingRef.current = isLooping;
    isMetronomeOnRef.current = isMetronomeOn;
    activeNotesRef.current = activeNotes;
    velocityRef.current = velocity;
    noteVelocitiesRef.current = noteVelocities;
    disabledNotesRef.current = disabledNotes;
    playerViewRef.current = playerView;
    isRecordingRef.current = isRecording;
    selectedPresetRef.current = selectedPreset;
  }, [
    currentStep,
    totalSteps,
    isPlaying,
    isLooping,
    isMetronomeOn,
    activeNotes,
    velocity,
    noteVelocities,
    disabledNotes,
    playerView,
    isRecording,
    selectedPreset,
  ]);


  const triggerStepNotes = useCallback(
    (stepIdx: number) => {
      if (isMetronomeOnRef.current && stepIdx % 4 === 0) {
        synth.playMetronomeTick(stepIdx === 0);
      }

      const suffix = `-${stepIdx}`;
      for (const item of activeNotesRef.current) {
        if (item.endsWith(suffix)) {
          if (disabledNotesRef.current.has(item)) continue;
          const noteName = item.slice(0, -suffix.length);
          const noteVelPercent =
            noteVelocitiesRef.current[item] ?? velocityRef.current;
          const vel = noteVelPercent / 100;
          const stepDurationSec = (60 / bpm / 4) * (2 + 3.5 * vel);
          synth.playNote(noteName, undefined, stepDurationSec, vel);
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

  const [isEditingBpm, setIsEditingBpm] = useState(false);
  const [rawBpmInput, setRawBpmInput] = useState("");
  const displayBpm = isEditingBpm ? rawBpmInput : String(bpm);

  const commitBpm = (value: string) => {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(40, Math.min(260, parsed));
      setBpm(clamped);
    }
    setIsEditingBpm(false);
  };

  const handleBpmInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsEditingBpm(true);
    setRawBpmInput(e.target.value);
  };

  const handleBpmInputBlur = () => {
    commitBpm(rawBpmInput);
  };

  const handleBpmInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      commitBpm(rawBpmInput);
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setIsEditingBpm(false);
      e.currentTarget.blur();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIsEditingBpm(false);
      const step = e.shiftKey ? 5 : 1;
      setBpm((prev) => Math.min(260, prev + step));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsEditingBpm(false);
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
    const delta = e.deltaY < 0 ? (e.shiftKey ? 5 : 1) : e.shiftKey ? -5 : -1;
    setBpm((prev) => Math.max(40, Math.min(260, prev + delta)));
  };

  const handleRecordNote = useCallback(
    (noteName: string, velocityVal?: number) => {
      const step = currentStepRef.current;
      const noteKey = `${noteName}-${step}`;
      setActiveNotes((prev) => {
        const next = new Set(prev);
        next.add(noteKey);
        return next;
      });
      if (velocityVal !== undefined) {
        setNoteVelocities((prev) => ({
          ...prev,
          [noteKey]: Math.max(1, Math.min(100, Math.round(velocityVal))),
        }));
      }
    },
    [setActiveNotes, setNoteVelocities],
  );

  useEffect(() => {
    const unsubNoteOn = midiManager.onNoteOn((e) => {
      const isDrum = e.isDrum || playerViewRef.current === "drums";
      if (isDrum) {
        setExternalPressedPads((prev) =>
          prev.includes(e.noteName) ? prev : [...prev, e.noteName],
        );
        const kit = selectedPresetRef.current.includes("drum")
          ? selectedPresetRef.current
          : "drum_set";
        synth.playDrum(e.noteName, e.velocity, kit);
        if (isRecordingRef.current) {
          handleRecordNote(e.noteName, e.velocity * 100);
        }
      } else {
        setExternalPressedKeys((prev) =>
          prev.includes(e.noteName) ? prev : [...prev, e.noteName],
        );
        synth.playNote(e.noteName, undefined, undefined, e.velocity);
        if (isRecordingRef.current) {
          handleRecordNote(e.noteName, e.velocity * 100);
        }
      }
    });

    const unsubNoteOff = midiManager.onNoteOff((e) => {
      const isDrum = e.isDrum || playerViewRef.current === "drums";
      if (isDrum) {
        setExternalPressedPads((prev) => prev.filter((k) => k !== e.noteName));
      } else {
        setExternalPressedKeys((prev) => prev.filter((k) => k !== e.noteName));
        synth.stopNote(e.noteName);
      }
    });

    const unsubCC = midiManager.onControlChange((e) => {
      synth.handleMidiCC(e.controller, e.value);
      if (e.controller === 7) {
        const clamped = Math.max(0, Math.min(1, e.normalizedValue));
        setVolume(clamped);
      }
    });

    const unsubPitchBend = midiManager.onPitchBend((e) => {
      synth.setPitchBend(e.semitones);
    });

    return () => {
      unsubNoteOn();
      unsubNoteOff();
      unsubCC();
      unsubPitchBend();
    };
  }, [handleRecordNote, setVolume]);

  const handleClearNotes = () => {
    setActiveNotes(new Set());
    setDisabledNotes(new Set());
    setSelectedNotes(new Set());
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
              tone={isLooping ? "info" : "secondary"}
              size="sm"
              iconOnly
              onClick={() => setIsLooping((prev) => !prev)}
              title={isLooping ? "Loop Enabled" : "Loop Disabled"}
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
              <Button
                variant="ghost"
                tone="secondary"
                size="sm"
                iconOnly
                onClick={handleBpmDecrement}
                disabled={bpm <= 40}
                title="Decrease tempo (-1 BPM, Shift: -5)"
                aria-label="Decrease tempo"
                className="h-6 w-4 sm:w-5 flex items-center justify-center rounded p-0 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 disabled:opacity-30 border-0"
              >
                <ChevronLeft className="w-3 h-3" />
              </Button>

              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={displayBpm}
                onChange={handleBpmInputChange}
                onBlur={handleBpmInputBlur}
                onKeyDown={handleBpmInputKeyDown}
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
                title="Increase tempo (+1 BPM, Shift: +5)"
                aria-label="Increase tempo"
                className="h-6 w-4 sm:w-5 flex items-center justify-center rounded p-0 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 disabled:opacity-30 border-0"
              >
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>

            <div className="h-4 w-[1px] bg-stone-300 dark:bg-stone-700 mx-0.5 flex-shrink-0" />

            <StepLengthControl
              totalSteps={totalSteps}
              onTotalStepsChange={setTotalSteps}
            />

            <div className="h-4 w-[1px] bg-stone-300 dark:bg-stone-700 mx-0.5 flex-shrink-0" />

            <OctaveJumpControl
              octave={jumpOctave}
              onOctaveChange={setJumpOctave}
              presetKey={selectedPreset}
            />

            <div className="h-4 w-[1px] bg-stone-300 dark:bg-stone-700 mx-0.5 flex-shrink-0" />

            <MidiControl />
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
          <div className="h-4 w-[1px] bg-stone-300 dark:bg-stone-700 mx-0.5 flex-shrink-0" />

          {/* User profile pill */}
          <Link
            to="/"
            title={
              user
                ? `Signed in as ${user.name} (${user.email || ""}) - Click to manage account`
                : "Guest - Click to login with Google"
            }
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-200/80 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 border border-stone-300 dark:border-stone-700 transition-colors text-xs select-none max-w-[150px]"
          >
            <span className="text-xs flex items-center justify-center">
              {user ? (
                <GoogleIcon className="w-3.5 h-3.5 flex-shrink-0" />
              ) : (
                "👤"
              )}
            </span>
            <span className="font-mono text-xs font-semibold text-stone-700 dark:text-stone-300 truncate">
              {user ? user.name : "Login"}
            </span>
          </Link>

          <div className="h-4 w-[1px] bg-stone-300 dark:bg-stone-700 mx-0.5 flex-shrink-0" />

          <Button
            variant="solid"
            tone="secondary"
            size="sm"
            iconOnly
            onClick={cycleTheme}
            title={`Switch to ${nextTheme} theme`}
            aria-label={`Current theme: ${theme}. Switch to ${nextTheme} theme.`}
            className="p-1.5 h-auto rounded bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-300"
          >
            {theme === "light" && (
              <Sun className="w-3.5 h-3.5 text-amber-500" />
            )}
            {theme === "dark" && <Moon className="w-3.5 h-3.5 text-blue-400" />}
            {theme === "system" && (
              <Monitor className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
            )}
          </Button>
        </div>
      </header>

      <main className="flex-[1.1] min-h-0 w-full overflow-hidden flex flex-col p-0 m-0 border-b-2 border-stone-300 dark:border-stone-800">
        <PianoRoll
          className="flex-1 w-full h-full"
          externalPressedKeys={externalPressedKeys}
          activeNotes={Array.from(activeNotes)}
          onNotesChange={(newNotes) => setActiveNotes(new Set(newNotes))}
          disabledNotes={Array.from(disabledNotes)}
          onDisabledNotesChange={(newDisabled) =>
            setDisabledNotes(new Set(newDisabled))
          }
          selectedNotes={Array.from(selectedNotes)}
          onSelectedNotesChange={(newSelected) =>
            setSelectedNotes(new Set(newSelected))
          }
          noteVelocities={noteVelocities}
          onNoteVelocitiesChange={setNoteVelocities}
          currentStep={isPlaying || isRecording ? currentStep : null}
          isPlaying={isPlaying}
          isRecording={isRecording}
          totalSteps={totalSteps}
          onTotalStepsChange={setTotalSteps}
          jumpOctave={jumpOctave}
          onJumpOctaveChange={setJumpOctave}
          velocity={velocity}
          onVelocityChange={setVelocity}
          selectedPreset={selectedPreset}
          rootKey={studio.rootKey}
          onRootKeyChange={(rk) =>
            setStudio((prev) => ({ ...prev, rootKey: rk }))
          }
          scale={studio.scale}
          onScaleChange={(sc) =>
            setStudio((prev) => ({ ...prev, scale: sc }))
          }
        />
      </main>

      <footer className="flex-1 min-h-0 w-full flex flex-row gap-2.5 p-2.5 bg-stone-100/60 dark:bg-[#06080c] overflow-x-auto overflow-y-hidden flex-shrink-0">
        <div className="w-16 lg:w-18 h-full min-h-0 flex-shrink-0 overflow-hidden">
          <PresetSelector
            selectedPreset={selectedPreset}
            onPresetChange={handlePresetChange}
          />
        </div>

        <div
          className={cn(
            "flex-1 min-w-0 h-full min-h-0 overflow-hidden",
            !isPlayerCollapsed && "hidden md:block",
          )}
        >
          <SynthControls
            selectedPreset={selectedPreset}
            rightHeaderSlot={
              isPlayerCollapsed ? (
                <Button
                  variant="solid"
                  tone="secondary"
                  size="sm"
                  iconOnly
                  onClick={() => setIsPlayerCollapsed(false)}
                  title={
                    playerView === "drums"
                      ? "Expand Drum Pad"
                      : "Expand Piano Keys"
                  }
                  aria-label={
                    playerView === "drums"
                      ? "Expand Drum Pad"
                      : "Expand Piano Keys"
                  }
                  className="self-center h-8 w-8 bg-white dark:bg-[#0a0d14] border border-stone-200 dark:border-[#1f2533] hover:border-stone-400 dark:hover:border-[#38435d] hover:bg-stone-50 dark:hover:bg-[#111520] text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm transition-all cursor-pointer select-none group p-0"
                >
                  {playerView === "drums" ? (
                    <Drum className="w-4 h-4 text-stone-600 dark:text-stone-400 group-hover:text-stone-900 dark:group-hover:text-white transition-colors" />
                  ) : (
                    <Piano className="w-4 h-4 text-stone-600 dark:text-stone-400 group-hover:text-stone-900 dark:group-hover:text-white transition-colors" />
                  )}
                </Button>
              ) : undefined
            }
          />
        </div>

        {!isPlayerCollapsed && (
          <div
            className={cn(
              "h-full min-h-0 flex flex-col gap-1 overflow-hidden",
              "flex-1 min-w-0 md:flex-initial md:w-[330px] lg:w-[380px] xl:w-[420px]",
            )}
          >
            <div className="flex items-center justify-between px-1 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono font-bold tracking-wider text-stone-700 dark:text-stone-300">
                  PLAYER
                </span>
                <Button
                  variant="ghost"
                  tone="secondary"
                  size="sm"
                  onClick={() => setIsPlayerCollapsed(true)}
                  title="Collapse player and show synth panel"
                  aria-label="Collapse player and show synth panel"
                  className="flex items-center gap-1 px-1.5 py-0.5 h-auto rounded text-stone-400 hover:text-stone-800 dark:text-stone-500 dark:hover:text-stone-200 hover:bg-stone-200/60 dark:hover:bg-[#161c28] transition-colors border-0"
                >
                  <PanelRightClose className="w-3.5 h-3.5" />
                  <span className="md:hidden text-[10px] font-mono">Synth</span>
                </Button>
              </div>
              <div className="flex items-center gap-1 bg-stone-200/80 dark:bg-[#0a0c10] p-0.5 rounded-lg border border-stone-300 dark:border-[#1f2533]">
                <Button
                  variant="solid"
                  tone={playerView === "keys" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => {
                    setPlayerView("keys");
                    if (selectedPreset.includes("drum")) {
                      handlePresetChange("grand_piano");
                    }
                  }}
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
                  onClick={() => {
                    setPlayerView("drums");
                    if (!selectedPreset.includes("drum")) {
                      handlePresetChange("drum_set");
                    }
                  }}
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
                <PianoKeyboard
                  mode="player"
                  isRecording={isRecording}
                  onRecordNote={handleRecordNote}
                  externalPressedKeys={externalPressedKeys}
                  activeNotes={Array.from(activeNotes)
                    .filter(
                      (item) =>
                        item.endsWith(`-${currentStep}`) &&
                        !disabledNotes.has(item),
                    )
                    .map((item) => item.replace(`-${currentStep}`, ""))}
                />
              ) : (
                <DrumPad
                  selectedPreset={selectedPreset}
                  isRecording={isRecording}
                  onRecordNote={handleRecordNote}
                  externalPressedPads={externalPressedPads}
                  activeNotes={Array.from(activeNotes)
                    .filter(
                      (item) =>
                        item.endsWith(`-${currentStep}`) &&
                        !disabledNotes.has(item),
                    )
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
