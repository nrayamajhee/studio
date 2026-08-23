import React from 'react';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { NOTE_NAMES } from '../audio/synthEngine';

interface PianoMiniMapProps {
  baseOctave: number;
  activeNotes: Set<number>;
  onChangeOctave: (octave: number) => void;
}

const TOTAL_OCTAVES = 7; // Octaves 1 to 7
const MIN_OCTAVE = 1;
const MAX_OCTAVE = 6; // baseOctave can be 1..6 (spanning 2 octaves)

export function PianoMiniMap({
  baseOctave,
  activeNotes,
  onChangeOctave,
}: PianoMiniMapProps) {
  // Generate full 7-octave piano keys for the mini-map
  const miniWhiteKeys: { midi: number; octave: number; noteName: string }[] = [];
  const miniBlackKeys: { midi: number; octave: number; noteName: string; afterWhiteIndex: number }[] = [];

  let whiteIndex = 0;
  for (let oct = 1; oct <= TOTAL_OCTAVES; oct++) {
    const startMidi = (oct + 1) * 12;
    for (let i = 0; i < 12; i++) {
      const midi = startMidi + i;
      const noteName = NOTE_NAMES[i];
      const isBlack = noteName.includes('#');

      if (!isBlack) {
        miniWhiteKeys.push({ midi, octave: oct, noteName });
        whiteIndex++;
      } else {
        miniBlackKeys.push({ midi, octave: oct, noteName, afterWhiteIndex: whiteIndex - 1 });
      }
    }
  }

  // Add final high C (C8)
  const finalC8Midi = (TOTAL_OCTAVES + 2) * 12;
  miniWhiteKeys.push({ midi: finalC8Midi, octave: TOTAL_OCTAVES + 1, noteName: 'C' });

  const totalWhiteKeys = miniWhiteKeys.length;

  // Calculate viewport lens position (starts at C(baseOctave), spans ~20 semitones or 12 white keys)
  // White keys per octave = 7. baseOctave 1 starts at white key 0, baseOctave 2 at white key 7, etc.
  const startWhiteKeyIndex = (baseOctave - 1) * 7;
  const viewportWidthWhiteKeys = 12; // 20 semitones = 12 white keys
  const leftPercent = (startWhiteKeyIndex / totalWhiteKeys) * 100;
  const widthPercent = (viewportWidthWhiteKeys / totalWhiteKeys) * 100;

  const handlePrev = () => {
    if (baseOctave > MIN_OCTAVE) {
      onChangeOctave(baseOctave - 1);
    }
  };

  const handleNext = () => {
    if (baseOctave < MAX_OCTAVE) {
      onChangeOctave(baseOctave + 1);
    }
  };

  const handleMiniMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickRatio = Math.max(0, Math.min(1, clickX / rect.width));
    // Determine clicked octave (1 to 6)
    const targetOctave = Math.min(MAX_OCTAVE, Math.max(MIN_OCTAVE, Math.floor(clickRatio * TOTAL_OCTAVES) + 1));
    onChangeOctave(targetOctave);
  };

  return (
    <div className="w-full max-w-5xl bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl p-2.5 sm:p-3 shadow-xl">
      <div className="flex items-center justify-between gap-2 mb-1.5 text-xs">
        
        {/* Back Button */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={baseOctave <= MIN_OCTAVE}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-sm"
          title="Back / Shift Octave Down [Z]"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-cyan-400" />
          <span>Back [Z]</span>
        </button>

        {/* Center Mini-map Status Label */}
        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
          <MapPin className="w-3.5 h-3.5 text-cyan-400" />
          <span>Piano Overview (C1 – C8)</span>
          <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
            Visible: C{baseOctave} – G{baseOctave + 1}
          </span>
        </div>

        {/* Front / Next Button */}
        <button
          type="button"
          onClick={handleNext}
          disabled={baseOctave >= MAX_OCTAVE}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-sm"
          title="Front / Shift Octave Up [X]"
        >
          <span>Front [X]</span>
          <ChevronRight className="w-3.5 h-3.5 text-cyan-400" />
        </button>
      </div>

      {/* Mini-Map Keyboard Visualizer Strip */}
      <div
        onClick={handleMiniMapClick}
        className="relative w-full h-8 sm:h-9 bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex shadow-inner cursor-pointer select-none group"
        title="Click anywhere on the mini-map to jump to that octave"
      >
        {/* 1. Mini White Keys */}
        {miniWhiteKeys.map((k) => {
          const isActive = activeNotes.has(k.midi);
          return (
            <div
              key={k.midi}
              className={`flex-1 h-full border-r border-slate-300/40 last:border-r-0 transition-colors ${
                isActive
                  ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]'
                  : 'bg-slate-200 group-hover:bg-slate-100'
              }`}
            />
          );
        })}

        {/* 2. Mini Black Keys */}
        {miniBlackKeys.map((k) => {
          const isActive = activeNotes.has(k.midi);
          const leftPercent = ((k.afterWhiteIndex + 1) / totalWhiteKeys) * 100;
          return (
            <div
              key={k.midi}
              className={`absolute top-0 w-[1.3%] h-[60%] -translate-x-1/2 z-10 rounded-b-xs transition-colors pointer-events-none ${
                isActive
                  ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]'
                  : 'bg-slate-900 border-x border-b border-slate-700'
              }`}
              style={{ left: `${leftPercent}%` }}
            />
          );
        })}

        {/* 3. Viewport Lens Highlight Box */}
        <div
          className="absolute top-0 bottom-0 z-20 pointer-events-none border-2 border-cyan-400 bg-cyan-500/25 backdrop-blur-[1px] rounded transition-all duration-150 shadow-[0_0_12px_rgba(6,182,212,0.6)] flex items-center justify-center"
          style={{
            left: `${leftPercent}%`,
            width: `${widthPercent}%`,
          }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_#67e8f9] animate-pulse" />
        </div>
      </div>
    </div>
  );
}
