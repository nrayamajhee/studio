import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { Link, useParams } from "react-router";
import {
  useStudioStorage,
  getActiveTrack,
  setActiveTrack,
  updateTrack,
  deleteTrack,
  addTrack,
  type Track,
} from "../lib/studioStorage";
import type { Route } from "./+types/studio";
import { useTheme } from "../hooks/useTheme";
import { Button } from "../components/design-system/Button";
import { Slider } from "../components/design-system/Slider";
import { Card } from "../components/design-system/Card";
import { Title, Caption } from "../components/design-system/Typography";
import { MixerTimeline } from "../components/mixer/MixerTimeline";
import { AddTrackDialog } from "../components/mixer/AddTrackDialog";
import { PresetSelector } from "../components/piano-roll/PresetSelector";
import { SynthControls } from "../components/piano-roll/SynthControls";
import { PianoRoll } from "../components/piano-roll/PianoRoll";
import { PianoPlayer } from "../components/piano-roll/PianoKeyboard";
import { DrumPad } from "../components/piano-roll/DrumPad";
import { OctaveJumpControl } from "../components/piano-roll/OctaveJumpControl";
import { StepLengthControl } from "../components/piano-roll/StepLengthControl";
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
  Metronome,
  Sun,
  Moon,
  Monitor,
  Volume2,
  Volume1,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  Piano,
  Drum,
  Music,
  PanelRightClose,
  PanelRight,
  X,
  OctagonAlert,
  Eraser,
} from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Studio - Music Production DAW & Synthesizer" },
    {
      name: "description",
      content:
        "Full-featured browser DAW with multitrack timeline sequencer, modal synthesizer, and 10-octave piano roll.",
    },
  ];
}

export default function Studio() {
  const { theme, nextTheme, cycleTheme } = useTheme();
  const { trackId } = useParams();

  const [studio, setStudio] = useStudioStorage();
  const tracks = studio.song.tracks;

  const activeTrack = useMemo(() => {
    if (trackId) {
      const found = tracks.find((t) => t.id === trackId);
      if (found) return found;
    }
    return getActiveTrack(studio);
  }, [studio, tracks, trackId]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isPianoRollOpen, setIsPianoRollOpen] = useState(true);
  const [activePanelTab, setActivePanelTab] = useState<"roll" | "keys" | "drums">("roll");
  const [isAddTrackOpen, setIsAddTrackOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());

  const [horizontalLayout] = useState<Record<string, number>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("studio_horizontal_layout");
        if (saved) return JSON.parse(saved);
      } catch {
        return { "workspace-panel": 78, "sound-design-panel": 22 };
      }
    }
    return { "workspace-panel": 78, "sound-design-panel": 22 };
  });

  const [verticalLayout] = useState<Record<string, number>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("studio_vertical_layout");
        if (saved) return JSON.parse(saved);
      } catch {
        return { "timeline-panel": 55, "piano-roll-panel": 45 };
      }
    }
    return { "timeline-panel": 55, "piano-roll-panel": 45 };
  });

  const [externalPressedKeys, setExternalPressedKeys] = useState<string[]>([]);
  const [externalPressedPads, setExternalPressedPads] = useState<string[]>([]);

  const bpm = studio.song.bpm ?? studio.bpm ?? 72;
  const timeSignature = studio.song.timeSignature || "4/4";

  const [isPlaying, setIsPlaying] = useState(false);
  const isLooping = studio.isLooping ?? true;
  const [currentStep, setCurrentStep] = useState(0);

  const totalStepsPerBar = 16;
  const maxTrackEnd = Math.max(
    1,
    ...tracks.map((t) => (t.startMeasure || 0) + (t.clipCount || 1)),
  );
  const totalSongSteps = Math.round(maxTrackEnd * totalStepsPerBar);

  const currentStepRef = useRef(currentStep);
  const isPlayingRef = useRef(isPlaying);
  const isLoopingRef = useRef(isLooping);
  const tracksRef = useRef(tracks);
  const totalSongStepsRef = useRef(totalSongSteps);

  useEffect(() => {
    currentStepRef.current = currentStep;
    isPlayingRef.current = isPlaying;
    isLoopingRef.current = isLooping;
    tracksRef.current = tracks;
    totalSongStepsRef.current = totalSongSteps;
  }, [currentStep, isPlaying, isLooping, tracks, totalSongSteps]);

  const isMetronomeOn = studio.isMetronomeOn ?? false;
  const isMetronomeOnRef = useRef(isMetronomeOn);

  useEffect(() => {
    isMetronomeOnRef.current = isMetronomeOn;
  }, [isMetronomeOn]);

  const handleMetronomeToggle = () => {
    const next = !isMetronomeOn;
    setStudio((prev) => ({ ...prev, isMetronomeOn: next }));
    if (next) {
      synth.ensureContext();
      synth.playMetronomeTick(true);
    }
  };

  const setTimeSignature = (ts: "4/4" | "3/4" | "triplet") => {
    setStudio((prev) => ({
      ...prev,
      song: { ...prev.song, timeSignature: ts },
    }));
  };

  const volume = studio.volume ?? 0.7;

  useEffect(() => {
    synth.ensureContext();
    synth.setMasterVolume(volume);
  }, [volume]);

  const handleVolumeChange = useCallback(
    (newVol: number) => {
      const clamped = Math.max(0, Math.min(1, newVol));
      setStudio((prev) => ({ ...prev, volume: clamped }));
      synth.setMasterVolume(clamped);
    },
    [setStudio],
  );

  const prevVolRef = useRef(volume > 0 ? volume : 0.7);
  const handleVolumeToggleMute = () => {
    if (volume > 0) {
      prevVolRef.current = volume;
      handleVolumeChange(0);
    } else {
      handleVolumeChange(prevVolRef.current || 0.7);
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

  const commitBpm = (valStr: string) => {
    const parsed = parseInt(valStr, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(40, Math.min(260, parsed));
      setStudio((prev) => ({
        ...prev,
        bpm: clamped,
        song: { ...prev.song, bpm: clamped },
      }));
    }
    setIsEditingBpm(false);
  };

  const handleBpmDecrement = (e: React.MouseEvent) => {
    const step = e.shiftKey ? 5 : 1;
    const nextBpm = Math.max(40, bpm - step);
    setStudio((prev) => ({
      ...prev,
      bpm: nextBpm,
      song: { ...prev.song, bpm: nextBpm },
    }));
  };

  const handleBpmIncrement = (e: React.MouseEvent) => {
    const step = e.shiftKey ? 5 : 1;
    const nextBpm = Math.min(260, bpm + step);
    setStudio((prev) => ({
      ...prev,
      bpm: nextBpm,
      song: { ...prev.song, bpm: nextBpm },
    }));
  };

  const handleBpmWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? (e.shiftKey ? 5 : 1) : e.shiftKey ? -5 : -1;
    const nextBpm = Math.max(40, Math.min(260, bpm + delta));
    setStudio((prev) => ({
      ...prev,
      bpm: nextBpm,
      song: { ...prev.song, bpm: nextBpm },
    }));
  };

  const triggerStepAudio = useCallback(
    (stepIdx: number) => {
      if (isMetronomeOnRef.current && stepIdx % 4 === 0) {
        synth.playMetronomeTick(stepIdx % totalStepsPerBar === 0);
      }

      const currentTracks = tracksRef.current;
      const anySolo = currentTracks.some((t) => t.isSolo);

      for (const track of currentTracks) {
        if (anySolo && !track.isSolo) continue;
        if (track.isMuted) continue;

        const startMeasure = track.startMeasure || 0;
        const clipCount = track.clipCount || 1;
        const startStep = Math.round(startMeasure * totalStepsPerBar);
        const endStep = startStep + Math.round(clipCount * totalStepsPerBar);

        if (stepIdx < startStep || stepIdx >= endStep) continue;

        const stepInBar = (stepIdx - startStep) % (track.totalSteps || 16);
        const disabledSet = new Set(track.disabledNotes || []);

        const isDrum =
          track.playerView === "drums" ||
          track.preset.toLowerCase().includes("drum");

        for (const item of track.notes) {
          const lastDash = item.lastIndexOf("-");
          if (lastDash === -1) continue;
          const noteName = item.slice(0, lastDash);
          const noteStep = parseInt(item.slice(lastDash + 1), 10);
          if (noteStep !== stepInBar) continue;
          if (disabledSet.has(item)) continue;

          const noteVelPercent = track.noteVelocities?.[item] ?? 80;
          const vel = (noteVelPercent / 100) * track.volume;
          const voiceKey = `${track.id}-${noteName}`;

          if (isDrum) {
            synth.playDrum(noteName, vel, track.preset, voiceKey);
          } else {
            const stepDurationSec = (60 / bpm / 4) * (2 + 3.5 * vel);
            synth.playNote(
              noteName,
              undefined,
              stepDurationSec,
              vel,
              track.synthParams || track.preset,
              voiceKey,
            );
          }
        }
      }
    },
    [bpm, totalStepsPerBar],
  );

  useEffect(() => {
    if (!isPlaying) return;

    const stepsPerBeat = timeSignature === "triplet" ? 3 : 4;
    const stepDuration = 60000 / bpm / stepsPerBeat;

    const interval = setInterval(() => {
      const prevStep = currentStepRef.current;
      let nextStep = prevStep + 1;

      if (nextStep >= totalSongStepsRef.current) {
        if (isLoopingRef.current) {
          nextStep = 0;
        } else {
          setIsPlaying(false);
          return;
        }
      }

      setCurrentStep(nextStep);
      triggerStepAudio(nextStep);
    }, stepDuration);

    return () => clearInterval(interval);
  }, [isPlaying, bpm, timeSignature, triggerStepAudio]);

  const handlePlayToggle = () => {
    if (!isPlaying) {
      synth.ensureContext();
      triggerStepAudio(currentStep);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentStep(0);
  };

  const handleSeekStep = (step: number) => {
    setCurrentStep(step);
    if (isPlaying) {
      triggerStepAudio(step);
    }
  };

  const handlePanicStop = () => {
    synth.panic();
    setIsPlaying(false);
  };

  const handleSelectTrack = (tId: string) => {
    setStudio((prev) => setActiveTrack(prev, tId));
    setIsPianoRollOpen(true);
  };

  const handleUpdateTrack = (tId: string, updates: Partial<Track>) => {
    setStudio((prev) => updateTrack(prev, tId, updates));
  };

  const handleDeleteTrack = (tId: string) => {
    setStudio((prev) => deleteTrack(prev, tId));
  };

  const handleAddTrack = (trackProps: Partial<Track>) => {
    setStudio((prev) => addTrack(prev, trackProps));
  };

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

      setStudio((prev) => {
        const updated = updateTrack(prev, activeTrack.id, {
          preset,
          playerView: isDrumPreset ? "drums" : "keys",
          synthParams: { ...synth.params },
        });
        return {
          ...updated,
          jumpOctave: cfg.defaultOctave,
        };
      });

      if (isDrumPreset) {
        setActivePanelTab("drums");
      }
    },
    [activeTrack.id, setStudio],
  );

  const handleClearNotes = () => {
    handleUpdateTrack(activeTrack.id, {
      notes: [],
      disabledNotes: [],
      noteVelocities: {},
    });
  };

  const handleRecordNote = useCallback(
    (noteName: string, step?: number) => {
      const targetStep =
        step !== undefined
          ? step
          : currentStepRef.current % (activeTrack.totalSteps || 16);
      const noteKey = `${noteName}-${targetStep}`;

      const nextNotes = Array.from(new Set([...activeTrack.notes, noteKey]));
      const nextVels = {
        ...activeTrack.noteVelocities,
        [noteKey]: studio.velocity ?? 85,
      };

      setStudio((prev) =>
        updateTrack(prev, activeTrack.id, {
          notes: nextNotes,
          noteVelocities: nextVels,
        }),
      );
    },
    [
      activeTrack.id,
      activeTrack.notes,
      activeTrack.noteVelocities,
      activeTrack.totalSteps,
      setStudio,
      studio.velocity,
    ],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        handlePlayToggle();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  useEffect(() => {
    const unsubOn = midiManager.onNoteOn((event) => {
      if (activeTrack.playerView === "drums") {
        setExternalPressedPads((prev) =>
          Array.from(new Set([...prev, event.noteName])),
        );
      } else {
        setExternalPressedKeys((prev) =>
          Array.from(new Set([...prev, event.noteName])),
        );
      }

      if (isRecording) {
        handleRecordNote(event.noteName);
      }
    });

    const unsubOff = midiManager.onNoteOff((event) => {
      if (activeTrack.playerView === "drums") {
        setExternalPressedPads((prev) =>
          prev.filter((p) => p !== event.noteName),
        );
      } else {
        setExternalPressedKeys((prev) =>
          prev.filter((k) => k !== event.noteName),
        );
      }
    });

    return () => {
      unsubOn();
      unsubOff();
    };
  }, [activeTrack.playerView, isRecording, handleRecordNote]);

  const currentBar = Math.floor(currentStep / totalStepsPerBar) + 1;
  const currentBeat = Math.floor((currentStep % totalStepsPerBar) / 4) + 1;
  const currentTick = (currentStep % 4) * 25;

  const barStr = currentBar.toString().padStart(3, "0");
  const beatStr = currentBeat.toString().padStart(2, "0");
  const tickStr = currentTick.toString().padStart(2, "0");

  return (
    <div className="h-screen w-screen max-w-full overflow-hidden bg-surface text-font dark:bg-surface-dark dark:text-surface flex flex-col font-sans transition-colors duration-200 select-none">
      {/* Top Header Transport */}
      <header className="relative w-full flex items-center justify-between px-3 py-2 border-b border-stone-200 dark:border-stone-800 bg-surface-light/95 dark:bg-stone-900/95 backdrop-blur-sm flex-shrink-0 z-50">
        <div className="flex items-center gap-2 sm:gap-3">
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
              onClick={handleStop}
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
              onClick={handlePlayToggle}
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
              onClick={() =>
                setStudio((prev) => ({ ...prev, isLooping: !isLooping }))
              }
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

            <Button
              variant="solid"
              tone={isMetronomeOn ? "primary" : "secondary"}
              size="sm"
              iconOnly
              onClick={handleMetronomeToggle}
              title={isMetronomeOn ? "Metronome Active" : "Metronome Off"}
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

        {/* Centered Time Display */}
        <div className="flex items-center justify-center sm:absolute sm:left-1/2 sm:-translate-x-1/2 pointer-events-auto">
          <Card
            elevation="low"
            className="flex flex-row items-center px-2 py-1 bg-stone-200/70 dark:bg-stone-950 font-mono text-xs font-bold rounded border border-stone-300 dark:border-stone-800 tracking-wider shadow-inner"
            title="Timeline Position (Bar : Beat : Tick)"
          >
            <Caption asChild>
              <span className="text-primary-dark dark:text-primary-light font-mono text-xs font-bold">
                {barStr}
              </span>
            </Caption>
            <Caption className="text-stone-400 mx-1">:</Caption>
            <Caption asChild>
              <span className="text-stone-700 dark:text-stone-200 font-mono text-xs font-bold">{beatStr}</span>
            </Caption>
            <Caption className="text-stone-400 mx-1">:</Caption>
            <Caption asChild>
              <span className="text-stone-500 text-[10px] font-mono font-bold">{tickStr}</span>
            </Caption>
          </Card>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <MidiControl />

          {/* Master Volume Slider */}
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
              className="p-1.5 h-auto rounded bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-100"
            >
              {volume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-stone-400" />
              ) : volume < 0.5 ? (
                <Volume1 className="w-3.5 h-3.5" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </Button>

            <Slider
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(val) => handleVolumeChange(val)}
              className="w-14 sm:w-20"
            />

            <Caption asChild>
              <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400 w-7 text-right select-none flex-shrink-0">
                {Math.round(volume * 100)}%
              </span>
            </Caption>
          </div>

          <Button
            variant="solid"
            tone="secondary"
            size="sm"
            iconOnly
            onClick={handlePanicStop}
            title="Panic (Stop all sound)"
            aria-label="Panic: Stop all sound"
            className="p-1.5 h-auto rounded bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-100"
          >
            <OctagonAlert className="w-3.5 h-3.5" />
          </Button>

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

          <Button
            variant="solid"
            tone={isSidebarOpen ? "primary" : "secondary"}
            size="sm"
            rounded
            iconOnly
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title={
              isSidebarOpen
                ? "Collapse Sound Design Panel"
                : "Expand Sound Design Panel"
            }
            aria-label="Toggle sound design panel"
            className="p-1.5 h-8 w-8 rounded-full bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-100 shadow-sm"
          >
            {isSidebarOpen ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelRight className="w-4 h-4" />
            )}
          </Button>
        </div>
      </header>

      {/* Main Workspace: 2-column resizable layout */}
      <Group
        orientation="horizontal"
        defaultLayout={horizontalLayout}
        onLayoutChanged={(layout) => {
          if (typeof window !== "undefined") {
            localStorage.setItem(
              "studio_horizontal_layout",
              JSON.stringify(layout),
            );
          }
        }}
        className="flex-1 min-h-0 w-full overflow-hidden"
      >
        {/* Left: Main Area (Song Tracks Timeline Top & Piano Roll / Player Bottom) */}
        <Panel
          id="workspace-panel"
          minSize="40%"
          className="h-full min-w-0 flex flex-col overflow-hidden relative"
        >
          <Group
            orientation="vertical"
            defaultLayout={verticalLayout}
            onLayoutChanged={(layout) => {
              if (typeof window !== "undefined") {
                localStorage.setItem(
                  "studio_vertical_layout",
                  JSON.stringify(layout),
                );
              }
            }}
            className="w-full h-full flex flex-col overflow-hidden"
          >
            {/* Top: Song Tracks Timeline */}
            <Panel
              id="timeline-panel"
              minSize="20%"
              className="w-full min-h-[140px] flex flex-col overflow-hidden"
            >
              <MixerTimeline
                tracks={tracks}
                activeTrackId={activeTrack.id}
                onSelectTrack={handleSelectTrack}
                onUpdateTrack={handleUpdateTrack}
                onDeleteTrack={handleDeleteTrack}
                onOpenInstrument={handleSelectTrack}
                onAddTrackClick={() => setIsAddTrackOpen(true)}
                currentStep={currentStep}
                totalStepsPerBar={totalStepsPerBar}
                onSeekStep={handleSeekStep}
                isPlaying={isPlaying}
              />
            </Panel>

            {/* Bottom: Piano Roll / Player Panel */}
            {isPianoRollOpen && (
              <>
                <Separator className="h-1 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 transition-colors cursor-row-resize flex items-center justify-center group select-none flex-shrink-0">
                  <div className="w-12 h-0.5 rounded-full bg-stone-400 dark:bg-stone-600 group-hover:bg-primary transition-colors" />
                </Separator>
                <Panel
                  id="piano-roll-panel"
                  minSize="20%"
                  defaultSize="45%"
                  className="w-full flex flex-col overflow-hidden bg-surface dark:bg-surface-dark z-10"
                >
                  {/* Toolbar */}
                  <div className="h-9 px-3 border-b border-stone-200 dark:border-stone-800 bg-stone-100/90 dark:bg-stone-900 flex items-center justify-between flex-shrink-0">
                    {/* Left: Active Track & View Switcher */}
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0 flex-shrink-0">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: activeTrack.color }}
                        />
                        <Title asChild>
                          <span className="text-xs font-bold font-mono text-stone-800 dark:text-stone-100 truncate max-w-[120px] sm:max-w-[160px]">
                            {activeTrack.name}
                          </span>
                        </Title>
                      </div>

                      {/* View Switcher: Roll vs Keys vs Drums */}
                      <Card
                        elevation="low"
                        className="flex flex-row items-center gap-0.5 bg-stone-200/80 dark:bg-stone-900 p-0.5 rounded-lg border border-stone-300 dark:border-stone-800"
                      >
                        <Button
                          variant="solid"
                          tone={
                            activePanelTab === "roll" ? "primary" : "secondary"
                          }
                          size="sm"
                          onClick={() => setActivePanelTab("roll")}
                          className={cn(
                            "px-2 py-0.5 h-6 text-[10px] rounded font-medium",
                            activePanelTab === "roll" && "font-bold shadow-xs",
                          )}
                        >
                          <Music className="w-3 h-3 mr-1 inline" />
                          Piano Roll
                        </Button>

                        <Button
                          variant="solid"
                          tone={
                            activePanelTab === "keys" ? "primary" : "secondary"
                          }
                          size="sm"
                          onClick={() => {
                            setActivePanelTab("keys");
                            handleUpdateTrack(activeTrack.id, {
                              playerView: "keys",
                            });
                            if (activeTrack.preset.includes("drum")) {
                              handlePresetChange("grand_piano");
                            }
                          }}
                          className={cn(
                            "px-2 py-0.5 h-6 text-[10px] rounded font-medium",
                            activePanelTab === "keys" && "font-bold shadow-xs",
                          )}
                        >
                          <Piano className="w-3 h-3 mr-1 inline" />
                          Keys
                        </Button>

                        <Button
                          variant="solid"
                          tone={
                            activePanelTab === "drums" ? "primary" : "secondary"
                          }
                          size="sm"
                          onClick={() => {
                            setActivePanelTab("drums");
                            handleUpdateTrack(activeTrack.id, {
                              playerView: "drums",
                            });
                            if (!activeTrack.preset.includes("drum")) {
                              handlePresetChange("drum_set");
                            }
                          }}
                          className={cn(
                            "px-2 py-0.5 h-6 text-[10px] rounded font-medium",
                            activePanelTab === "drums" && "font-bold shadow-xs",
                          )}
                        >
                          <Drum className="w-3 h-3 mr-1 inline" />
                          Drum Pad
                        </Button>
                      </Card>
                    </div>

                    {/* Right: Quick Controls & Close Button */}
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                      {activePanelTab !== "drums" && (
                        <OctaveJumpControl
                          octave={studio.jumpOctave}
                          onOctaveChange={(oct) =>
                            setStudio((prev) => ({ ...prev, jumpOctave: oct }))
                          }
                          presetKey={activeTrack.preset}
                        />
                      )}

                      <StepLengthControl
                        totalSteps={activeTrack.totalSteps || 16}
                        onTotalStepsChange={(steps) =>
                          handleUpdateTrack(activeTrack.id, {
                            totalSteps: steps,
                          })
                        }
                        timeSignature={timeSignature as "4/4" | "3/4" | "triplet"}
                        onTimeSignatureChange={setTimeSignature}
                      />

                      <Button
                        variant="solid"
                        tone={isRecording ? "error" : "secondary"}
                        size="sm"
                        onClick={() => setIsRecording(!isRecording)}
                        title={
                          isRecording ? "Stop Recording" : "Record Notes Live"
                        }
                        aria-label={
                          isRecording ? "Stop recording" : "Record notes live"
                        }
                        className={cn(
                          "px-2 py-0.5 h-6 text-[10px] rounded font-medium flex items-center gap-1.5",
                          isRecording && "font-bold shadow-xs",
                        )}
                      >
                        <span
                          className={cn(
                            "w-2 h-2 rounded-full flex-shrink-0",
                            isRecording
                              ? "bg-white animate-pulse"
                              : "bg-red-500",
                          )}
                        />
                        <span>REC</span>
                      </Button>

                      <Button
                        variant="solid"
                        tone="secondary"
                        size="sm"
                        onClick={handleClearNotes}
                        title="Clear Piano Roll Notes"
                        aria-label="Clear piano roll notes"
                        className="px-2 py-0.5 h-6 text-[10px] rounded font-medium flex items-center gap-1 text-stone-700 dark:text-stone-300 hover:text-red-500"
                      >
                        <Eraser className="w-3 h-3" />
                        <span className="hidden sm:inline">Clear</span>
                      </Button>

                      <div className="h-4 w-px bg-stone-300 dark:border-stone-800" />

                      <Button
                        variant="solid"
                        tone="secondary"
                        size="sm"
                        iconOnly
                        onClick={() => setIsPianoRollOpen(false)}
                        title="Close Piano Roll / Player"
                        aria-label="Close piano roll and player"
                        className="h-6 w-6 rounded flex items-center justify-center text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Body: Piano Roll OR Keys OR Drum Pad */}
                  <div className="flex-1 min-h-0 w-full overflow-hidden">
                    {activePanelTab === "roll" ? (
                      <PianoRoll
                        className="w-full h-full"
                        externalPressedKeys={externalPressedKeys}
                        activeNotes={activeTrack.notes}
                        onNotesChange={(newNotes) =>
                          handleUpdateTrack(activeTrack.id, { notes: newNotes })
                        }
                        disabledNotes={activeTrack.disabledNotes}
                        onDisabledNotesChange={(newDisabled) =>
                          handleUpdateTrack(activeTrack.id, {
                            disabledNotes: newDisabled,
                          })
                        }
                        selectedNotes={Array.from(selectedNotes)}
                        onSelectedNotesChange={(newSelected) =>
                          setSelectedNotes(new Set(newSelected))
                        }
                        noteVelocities={activeTrack.noteVelocities}
                        onNoteVelocitiesChange={(nextVel) =>
                          handleUpdateTrack(activeTrack.id, {
                            noteVelocities: nextVel,
                          })
                        }
                        currentStep={
                          isPlaying || isRecording
                            ? currentStep % (activeTrack.totalSteps || 16)
                            : null
                        }
                        isPlaying={isPlaying}
                        isRecording={isRecording}
                        totalSteps={activeTrack.totalSteps || 16}
                        onTotalStepsChange={(steps) =>
                          handleUpdateTrack(activeTrack.id, { totalSteps: steps })
                        }
                        timeSignature={timeSignature}
                        jumpOctave={studio.jumpOctave}
                        onJumpOctaveChange={(oct) =>
                          setStudio((prev) => ({ ...prev, jumpOctave: oct }))
                        }
                        velocity={studio.velocity}
                        onVelocityChange={(vel) =>
                          setStudio((prev) => ({ ...prev, velocity: vel }))
                        }
                        selectedPreset={activeTrack.preset}
                        rootKey={activeTrack.rootKey || studio.rootKey || "C"}
                        onRootKeyChange={(rk) => {
                          handleUpdateTrack(activeTrack.id, { rootKey: rk });
                          setStudio((prev) => ({ ...prev, rootKey: rk }));
                        }}
                        scale={activeTrack.scale || studio.scale || "major"}
                        onScaleChange={(sc) => {
                          handleUpdateTrack(activeTrack.id, { scale: sc });
                          setStudio((prev) => ({ ...prev, scale: sc }));
                        }}
                      />
                    ) : activePanelTab === "keys" ? (
                      <div className="h-full w-full flex flex-col p-2 overflow-hidden bg-stone-100/50 dark:bg-surface-dark">
                        <div className="flex-1 min-h-0 overflow-hidden">
                          <PianoPlayer
                            isRecording={isRecording}
                            onRecordNote={handleRecordNote}
                            externalPressedKeys={externalPressedKeys}
                            activeNotes={activeTrack.notes
                              .filter(
                                (item) =>
                                  item.endsWith(
                                    `-${currentStep % (activeTrack.totalSteps || 16)}`,
                                  ) && !activeTrack.disabledNotes.includes(item),
                              )
                              .map((item) =>
                                item.replace(
                                  `-${currentStep % (activeTrack.totalSteps || 16)}`,
                                  "",
                                ),
                              )}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="h-full w-full flex flex-col p-2 overflow-hidden bg-stone-100/50 dark:bg-surface-dark">
                        <div className="h-7 px-1 flex items-center justify-between flex-shrink-0 text-xs text-stone-500 font-mono">
                          <span>Interactive 4x4 Drum Pad</span>
                          <MidiControl />
                        </div>
                        <div className="flex-1 min-h-0 overflow-hidden">
                          <DrumPad
                            selectedPreset={activeTrack.preset}
                            isRecording={isRecording}
                            onRecordNote={handleRecordNote}
                            externalPressedPads={externalPressedPads}
                            activeNotes={activeTrack.notes
                              .filter(
                                (item) =>
                                  item.endsWith(
                                    `-${currentStep % (activeTrack.totalSteps || 16)}`,
                                  ) && !activeTrack.disabledNotes.includes(item),
                              )
                              .map((item) =>
                                item.replace(
                                  `-${currentStep % (activeTrack.totalSteps || 16)}`,
                                  "",
                                ),
                              )}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Panel>
              </>
            )}
          </Group>
        </Panel>

        {/* Right: Collapsible Sound Design (Presets + Synth) */}
        {isSidebarOpen && (
          <>
            <Separator className="w-1 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 transition-colors cursor-col-resize flex items-center justify-center group select-none flex-shrink-0">
              <div className="w-0.5 h-8 rounded-full bg-stone-400 dark:bg-stone-600 group-hover:bg-primary transition-colors" />
            </Separator>
            <Panel
              id="sound-design-panel"
              minSize="18%"
              defaultSize="22%"
              maxSize="45%"
              className="flex flex-col bg-stone-50/80 dark:bg-surface-dark z-20 relative select-none h-full overflow-hidden"
            >
              <div className="p-3 pb-4 border-b border-stone-200 dark:border-stone-800 flex-shrink-0">
                <PresetSelector
                  selectedPreset={activeTrack.preset}
                  onPresetChange={handlePresetChange}
                  variant="grid"
                />
              </div>
              <div className="flex-1 min-h-0 p-3 pt-4 overflow-hidden">
                <SynthControls
                  selectedPreset={activeTrack.preset}
                  orientation="vertical"
                  className="h-full"
                />
              </div>
            </Panel>
          </>
        )}
      </Group>

      <AddTrackDialog
        isOpen={isAddTrackOpen}
        onClose={() => setIsAddTrackOpen(false)}
        onAddTrack={handleAddTrack}
        nextTrackNumber={tracks.length + 1}
      />
    </div>
  );
}
