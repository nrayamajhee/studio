import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  useStudioStorage,
  getActiveTrack,
  setActiveTrack,
  updateTrack,
  addTrack,
  deleteTrack,
  type Track,
} from "../lib/studioStorage";
import type { Route } from "./+types/mixer";
import { MixerHeader } from "../components/mixer/MixerHeader";
import { MixerTimeline } from "../components/mixer/MixerTimeline";
import { AddTrackDialog } from "../components/mixer/AddTrackDialog";
import { synth } from "../lib/synth";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Multitrack Mixer - Studio" },
    {
      name: "description",
      content:
        "DAW multitrack timeline sequencer and audio mixer with volume, pan, solo/mute, and repeating pattern clips.",
    },
  ];
}

export default function Mixer() {
  const navigate = useNavigate();
  const [studio, setStudio] = useStudioStorage();

  const tracks = studio.song.tracks;
  const activeTrack = useMemo(() => getActiveTrack(studio), [studio]);
  const bpm = studio.song.bpm;
  const timeSignature = studio.song.timeSignature || "4/4";

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [isAddTrackOpen, setIsAddTrackOpen] = useState(false);

  const totalStepsPerBar = 16;
  const maxClipCount = Math.max(
    1,
    ...tracks.map((t) => t.clipCount || 1),
  );
  const totalSongSteps = maxClipCount * totalStepsPerBar;

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

  useEffect(() => {
    synth.ensureContext();
    synth.setMasterVolume(0.9);
  }, []);

  const triggerStepAudio = useCallback(
    (stepIdx: number) => {
      const currentTracks = tracksRef.current;
      const anySolo = currentTracks.some((t) => t.isSolo);

      for (const track of currentTracks) {
        if (anySolo && !track.isSolo) continue;
        if (track.isMuted) continue;

        const clipCount = track.clipCount || 1;
        const currentBar = Math.floor(stepIdx / totalStepsPerBar);
        if (currentBar >= clipCount) continue;

        const stepInBar = stepIdx % (track.totalSteps || 16);
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

  const handleBpmChange = (newBpm: number) => {
    setStudio((prev) => ({
      ...prev,
      bpm: newBpm,
      song: {
        ...prev.song,
        bpm: newBpm,
      },
    }));
  };

  const handleSelectTrack = (trackId: string) => {
    setStudio((prev) => setActiveTrack(prev, trackId));
  };

  const handleUpdateTrack = (trackId: string, updates: Partial<Track>) => {
    setStudio((prev) => updateTrack(prev, trackId, updates));
  };

  const handleDeleteTrack = (trackId: string) => {
    setStudio((prev) => deleteTrack(prev, trackId));
  };

  const handleAddTrack = (trackProps: Partial<Track>) => {
    setStudio((prev) => addTrack(prev, trackProps));
  };

  const handleOpenInstrument = (trackId: string) => {
    setStudio((prev) => setActiveTrack(prev, trackId));
    navigate(`/instrument/${trackId}`);
  };

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

  return (
    <div className="h-screen w-screen max-w-full overflow-hidden bg-surface text-font dark:bg-[#07090e] dark:text-surface flex flex-col font-sans transition-colors duration-200">
      <MixerHeader
        isPlaying={isPlaying}
        onPlayToggle={handlePlayToggle}
        onStop={handleStop}
        isLooping={isLooping}
        onLoopToggle={() => setIsLooping((prev) => !prev)}
        bpm={bpm}
        onBpmChange={handleBpmChange}
        currentStep={currentStep}
        totalStepsPerBar={totalStepsPerBar}
      />

      <MixerTimeline
        tracks={tracks}
        activeTrackId={activeTrack.id}
        onSelectTrack={handleSelectTrack}
        onUpdateTrack={handleUpdateTrack}
        onDeleteTrack={handleDeleteTrack}
        onOpenInstrument={handleOpenInstrument}
        onAddTrackClick={() => setIsAddTrackOpen(true)}
        currentStep={currentStep}
        totalStepsPerBar={totalStepsPerBar}
        onSeekStep={handleSeekStep}
        isPlaying={isPlaying}
      />

      <AddTrackDialog
        isOpen={isAddTrackOpen}
        onClose={() => setIsAddTrackOpen(false)}
        onAddTrack={handleAddTrack}
        nextTrackNumber={tracks.length + 1}
      />
    </div>
  );
}
