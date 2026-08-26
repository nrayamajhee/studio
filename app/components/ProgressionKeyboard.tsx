import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  PROGRESSION_DEFINITIONS,
  TONIC_PITCH_CLASSES,
  getProgressionChords,
  type ProgressionChord,
} from '../audio/progressions';

interface ProgressionKeyboardProps {
  baseOctave: number;
  activeNotes: Set<number>;
  isKeyboardActive: boolean;
  onChordPress: (midiNotes: number[]) => void;
  onChordRelease: (midiNotes: number[]) => void;
  onPanic?: () => void;
  onProgressionStateChange?: (state: {
    highlightedIds: Set<string>;
    activeId: string | null;
    stepById: Map<string, { step: number; roman: string }>;
    chords: ProgressionChord[];
  }) => void;
}

function chordIdForProgressionChord(c: ProgressionChord): string {
  return `${c.rootName.toLowerCase().replace('#', 's')}-${c.quality.toLowerCase()}`;
}

export function ProgressionKeyboard({
  baseOctave,
  activeNotes,
  isKeyboardActive,
  onChordPress,
  onChordRelease,
  onProgressionStateChange,
}: ProgressionKeyboardProps) {
  const [tonicPitchClass, setTonicPitchClass] = useState<number>(0); // C
  const [selectedProgressionId, setSelectedProgressionId] = useState<string>('axis');
  const [bpm, setBpm] = useState<number>(96);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const playbackTimersRef = useRef<number[]>([]);
  const isPlayingRef = useRef(false);

  const selectedProgression = PROGRESSION_DEFINITIONS.find((p) => p.id === selectedProgressionId) ?? PROGRESSION_DEFINITIONS[0];
  const chords: ProgressionChord[] = getProgressionChords(selectedProgression.id, tonicPitchClass, baseOctave);

  // Notify parent (and thus Chord pads in section 2) which pads to highlight
  useEffect(() => {
    if (!onProgressionStateChange) return;
    const highlightedIds = new Set(chords.map(chordIdForProgressionChord));
    const stepById = new Map<string, { step: number; roman: string }>();
    chords.forEach((c, idx) => {
      const id = chordIdForProgressionChord(c);
      // If multiple steps map to same chord id (e.g., Aeolian vamp repeats ♭VII), keep first step index
      if (!stepById.has(id)) stepById.set(id, { step: idx, roman: c.roman });
    });
    const activeId = activeStepIndex !== null && chords[activeStepIndex] ? chordIdForProgressionChord(chords[activeStepIndex]) : null;
    onProgressionStateChange({ highlightedIds, activeId, stepById, chords });
  }, [chords, activeStepIndex, onProgressionStateChange]);

  // Update BPM when progression changes (initialize to its default)
  useEffect(() => {
    setBpm(selectedProgression.bpmDefault);
  }, [selectedProgression.id]);

  const clearPlaybackTimers = useCallback(() => {
    playbackTimersRef.current.forEach((id) => clearTimeout(id));
    playbackTimersRef.current = [];
  }, []);

  const stopPlayback = useCallback(() => {
    clearPlaybackTimers();
    isPlayingRef.current = false;
    setIsPlaying(false);
    setActiveStepIndex(null);
    // release any held notes from autoplay
    if (activeStepIndex !== null) {
      const chord = chords[activeStepIndex];
      if (chord) onChordRelease(chord.midiNotes);
    }
  }, [clearPlaybackTimers, activeStepIndex, chords, onChordRelease]);

  // Stop playback if tonic/progression/baseOctave changes mid-play
  useEffect(() => {
    if (isPlaying) {
      stopPlayback();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tonicPitchClass, selectedProgressionId, baseOctave]);

  const playProgressionAuto = useCallback(() => {
    if (isPlayingRef.current) {
      stopPlayback();
      return;
    }
    isPlayingRef.current = true;
    setIsPlaying(true);

    const beatMs = 60000 / bpm;
    // each chord lasts 1 beat (hold 90% then gap)
    const holdMs = Math.max(120, beatMs * 0.9);
    const gapMs = beatMs - holdMs;

    let step = 0;
    const totalSteps = chords.length;

    const scheduleStep = (idx: number) => {
      if (!isPlayingRef.current) return;
      const chord = chords[idx];
      if (!chord) return;
      setActiveStepIndex(idx);
      onChordPress(chord.midiNotes);
      const releaseId = window.setTimeout(() => {
        onChordRelease(chord.midiNotes);
      }, holdMs);
      playbackTimersRef.current.push(releaseId);

      const nextId = window.setTimeout(() => {
        if (!isPlayingRef.current) return;
        const nextIdx = idx + 1;
        if (nextIdx < totalSteps) {
          scheduleStep(nextIdx);
        } else if (isLooping) {
          scheduleStep(0);
        } else {
          isPlayingRef.current = false;
          setIsPlaying(false);
          setActiveStepIndex(null);
        }
      }, beatMs);
      playbackTimersRef.current.push(nextId);
    };

    scheduleStep(0);
  }, [bpm, chords, isLooping, onChordPress, onChordRelease, stopPlayback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearPlaybackTimers();
  }, [clearPlaybackTimers]);

  const handleTonicSelect = (pc: number) => {
    setTonicPitchClass(pc);
  };

  const handleSelectProgression = (id: string) => {
    setSelectedProgressionId(id);
  };

  const tonicName = TONIC_PITCH_CLASSES.find((t) => t.pitchClass === tonicPitchClass)?.name ?? 'C';

  // Keyboard shortcuts when this block is active: 1-7 for presets, P to toggle play
  useEffect(() => {
    if (!isKeyboardActive) return;
    const presetKeys = ['1', '2', '3', '4', '5', '6', '7'];
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextInput =
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        (target?.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'range');
      if (isTextInput) return;
      if (target?.tagName === 'INPUT' && (target as HTMLInputElement).type === 'range') target.blur();
      if (e.code === 'Space' || e.key === 'Tab' || e.key === 'Escape') return; // handled globally
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      if (key === 'p') {
        e.preventDefault();
        playProgressionAuto();
        return;
      }
      if (presetKeys.includes(key)) {
        e.preventDefault();
        const idx = Number(key) - 1;
        const prog = PROGRESSION_DEFINITIONS[idx];
        if (prog) setSelectedProgressionId(prog.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isKeyboardActive, playProgressionAuto]);

  return (
    <div className="w-full select-none flex flex-col items-center">
      <div
        className={`relative w-full max-w-5xl bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 p-2.5 sm:p-3 rounded-2xl shadow-2xl border-2 transition-all duration-200 ${
          isKeyboardActive
            ? 'border-amber-500/70 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
            : 'border-slate-700/80'
        }`}
      >
        {/* Top accent bar */}
        <div className="w-full h-2 sm:h-2.5 bg-gradient-to-r from-amber-950 via-amber-700 to-amber-950 rounded-t-sm mb-2 shadow-inner border-b border-amber-900/50 flex items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <span className="text-[9px] sm:text-[10px] font-mono font-bold tracking-widest text-amber-200/90 uppercase">
              Chord Progressions — Highlights Pads Above
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[9px] font-mono text-amber-300/70">
            <span>Key</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-900/70 text-amber-200 font-bold border border-amber-700/50">
              {tonicName} {selectedProgression.category}
            </span>
            <span>•</span>
            <span>{selectedProgression.pattern}</span>
          </div>
        </div>

        {/* Controls row: Tonic selector + Playback */}
        <div className="flex flex-col gap-2 mb-2">
          {/* Tonic / Key selector — chromatic with sharps/flats */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] font-mono font-bold tracking-wider text-slate-300 uppercase">Tonic Key:</span>
              <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">(chromatic — includes ♯/♭)</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {TONIC_PITCH_CLASSES.map((t) => {
                const isActive = tonicPitchClass === t.pitchClass;
                return (
                  <button
                    key={t.pitchClass}
                    type="button"
                    onClick={() => handleTonicSelect(t.pitchClass)}
                    className={`px-1.5 sm:px-2 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer min-w-[2rem] text-center ${
                      isActive
                        ? t.isSharp
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.6)] scale-105'
                          : 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.5)] scale-105'
                        : t.isSharp
                          ? 'bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-700 hover:border-amber-700/50'
                          : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 hover:border-slate-600'
                    }`}
                    title={`${t.name} ${t.nameFlat !== t.name ? `(${t.nameFlat})` : ''}`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Playback controls */}
          <div className="flex flex-wrap items-center gap-2 justify-between bg-slate-950/70 rounded-xl border border-slate-800 px-2.5 py-2">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={playProgressionAuto}
                className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer border ${
                  isPlaying
                    ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.5)]'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                }`}
              >
                <span className="text-sm leading-none">{isPlaying ? '■' : '▶'}</span>
                <span>{isPlaying ? 'Stop' : 'Play Progression'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsLooping((v) => !v)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer border ${
                  isLooping
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
                title="Loop playback"
              >
                <span className={`w-2 h-2 rounded-full ${isLooping ? 'bg-slate-950 animate-pulse' : 'bg-slate-500'}`} />
                Loop
              </button>

              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-slate-400">BPM</span>
                <input
                  type="range"
                  min={60}
                  max={160}
                  step={2}
                  value={bpm}
                  onChange={(e) => setBpm(Number(e.target.value))}
                  className="w-20 sm:w-28 accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
                <span className="font-bold text-amber-300 min-w-[3ch]">{bpm}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
              <span className="hidden md:inline">Auto-plays 4 highlighted pads • {selectedProgression.name} in </span>
              <span className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-amber-200 font-bold">
                {tonicName} {selectedProgression.category === 'Minor' ? 'minor' : selectedProgression.category === 'Major' ? 'major' : 'mix'}
              </span>
              {isKeyboardActive && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-950/50 border border-amber-800/50 text-amber-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Keys 1-7 / P
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Progression Preset Buttons — 7 presets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-1.5 sm:gap-2 mb-2">
          {PROGRESSION_DEFINITIONS.map((prog) => {
            const isActive = selectedProgressionId === prog.id;
            const idx = PROGRESSION_DEFINITIONS.findIndex((p) => p.id === prog.id) + 1;
            return (
              <button
                key={prog.id}
                type="button"
                onClick={() => handleSelectProgression(prog.id)}
                onDoubleClick={playProgressionAuto}
                className={`p-2 rounded-xl flex flex-col gap-1 text-left transition-all border cursor-pointer relative overflow-hidden ${
                  isActive
                    ? 'bg-amber-500/15 border-amber-400 text-white shadow-[0_0_14px_rgba(245,158,11,0.3)] ring-1 ring-amber-400/50'
                    : 'bg-slate-950/70 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white'
                }`}
                title={`${prog.pattern} — ${prog.description} (double-click to play)`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded ${
                      isActive ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {idx}
                  </span>
                  <span className={`text-[9px] font-mono px-1 py-0.5 rounded border ${isActive ? 'bg-slate-900 text-amber-300 border-amber-700/50' : 'bg-slate-900 text-slate-500 border-slate-700'}`}>
                    {prog.category}
                  </span>
                </div>
                <span className="text-[11px] font-bold leading-tight">{prog.name}</span>
                <span className="text-[10px] font-mono text-slate-400 leading-none">{prog.pattern}</span>
                <span className="text-[9px] text-slate-500 leading-tight line-clamp-2 hidden lg:block">{prog.songs.slice(0, 2).join(' • ')}</span>
                {isActive && isPlaying && (
                  <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#10b981]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer info bar */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-400 px-1">
          <span className="flex items-center gap-1.5">
            <span className="hidden sm:inline">Example in {tonicName}:</span>
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200 font-bold">
              {chords.map((c) => c.chordName).join(' – ')}
            </span>
            <span className="hidden md:inline text-slate-500">• {selectedProgression.exampleInC} in C</span>
          </span>
          <span className="text-[9px] text-slate-500 text-right max-w-[50%] truncate hidden lg:inline">
            e.g. {selectedProgression.songs.join(' • ')}
          </span>
        </div>

        {/* Front edge */}
        <div className="w-full h-2 bg-gradient-to-b from-slate-700 to-slate-900 rounded-b-md mt-2" />
      </div>
    </div>
  );
}
