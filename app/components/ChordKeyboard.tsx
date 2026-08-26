import React, { useState, useEffect, useCallback } from 'react';
import { NOTE_NAMES } from '../audio/synthEngine';

export interface ChordData {
  id: string;
  name: string;
  type: 'Major' | 'Minor';
  rootName: string;
  rootPitchClass: number;
  notesLabel: string;
  shortcutKey: string;
  displayShortcut: string;
  getMidiNotes: (baseOctave: number) => number[];
}

function makeChord(pc: number, type: 'Major' | 'Minor', shortcutKey: string, displayShortcut: string): ChordData {
  const rootName = NOTE_NAMES[pc];
  const thirdOffset = type === 'Major' ? 4 : 3;
  const thirdName = NOTE_NAMES[(pc + thirdOffset) % 12];
  const fifthName = NOTE_NAMES[(pc + 7) % 12];
  return {
    id: `${rootName.toLowerCase().replace('#', 's')}-${type.toLowerCase()}`,
    name: `${rootName} ${type === 'Major' ? 'Maj' : 'Min'}`,
    type,
    rootName,
    rootPitchClass: pc,
    notesLabel: `${rootName} • ${thirdName} • ${fifthName}`,
    shortcutKey,
    displayShortcut,
    getMidiNotes: (baseOctave) => {
      const root = (baseOctave + 1) * 12 + pc;
      return [root, root + thirdOffset, root + 7];
    },
  };
}

// Chromatic 24 chords: 12 Maj + 12 Min — generated in pitch-class order 0..11
// Naturals keep legacy shortcuts (a,w,s,e,d,r,f,t,g,y,h,u,j,i) for muscle memory
// Sharps use distinct keys q,2,3,4,6,7,8,9,0,-  to avoid collisions with piano/octave (z,x)
export const CHORD_DEFINITIONS: ChordData[] = [
  // Maj row (C=0 ... B=11)
  makeChord(0, 'Major', 'a', 'A'),
  makeChord(1, 'Major', 'q', 'Q'),
  makeChord(2, 'Major', 's', 'S'),
  makeChord(3, 'Major', '3', '3'),
  makeChord(4, 'Major', 'd', 'D'),
  makeChord(5, 'Major', 'f', 'F'),
  makeChord(6, 'Major', '6', '6'),
  makeChord(7, 'Major', 'g', 'G'),
  makeChord(8, 'Major', '8', '8'),
  makeChord(9, 'Major', 'h', 'H'),
  makeChord(10, 'Major', '0', '0'),
  makeChord(11, 'Major', 'j', 'J'),
  // Min row
  makeChord(0, 'Minor', 'w', 'W'),
  makeChord(1, 'Minor', '2', '2'),
  makeChord(2, 'Minor', 'e', 'E'),
  makeChord(3, 'Minor', '4', '4'),
  makeChord(4, 'Minor', 'r', 'R'),
  makeChord(5, 'Minor', 't', 'T'),
  makeChord(6, 'Minor', '7', '7'),
  makeChord(7, 'Minor', 'y', 'Y'),
  makeChord(8, 'Minor', '9', '9'),
  makeChord(9, 'Minor', 'u', 'U'),
  makeChord(10, 'Minor', '-', '-'),
  makeChord(11, 'Minor', 'i', 'I'),
];

const MAJOR_CHORDS = CHORD_DEFINITIONS.filter((c) => c.type === 'Major');
const MINOR_CHORDS = CHORD_DEFINITIONS.filter((c) => c.type === 'Minor');

interface ChordKeyboardProps {
  baseOctave: number;
  activeChordIds: Set<string>;
  isKeyboardActive: boolean;
  onChordPress: (chord: ChordData) => void;
  onChordRelease: (chord: ChordData) => void;
  highlightedChordIds?: Set<string>;
  progressionStepById?: Map<string, { step: number; roman: string }>;
  activeProgressionChordId?: string | null;
}

export function ChordKeyboard({
  baseOctave,
  activeChordIds,
  isKeyboardActive,
  onChordPress,
  onChordRelease,
  highlightedChordIds,
  progressionStepById,
  activeProgressionChordId,
}: ChordKeyboardProps) {
  const [isMouseDown, setIsMouseDown] = useState(false);

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsMouseDown(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const handleKeyStart = useCallback((chord: ChordData) => onChordPress(chord), [onChordPress]);
  const handleKeyEnd = useCallback((chord: ChordData) => onChordRelease(chord), [onChordRelease]);

  const handleMouseEnter = useCallback(
    (chord: ChordData) => {
      if (isMouseDown) onChordPress(chord);
    },
    [isMouseDown, onChordPress]
  );
  const handleMouseLeave = useCallback(
    (chord: ChordData) => {
      if (isMouseDown) onChordRelease(chord);
    },
    [isMouseDown, onChordRelease]
  );

  const renderPad = (chord: ChordData) => {
    const isActive = activeChordIds.has(chord.id);
    const isMinor = chord.type === 'Minor';
    const isSharp = chord.rootName.includes('#');
    const isHighlighted = highlightedChordIds?.has(chord.id) ?? false;
    const stepInfo = progressionStepById?.get(chord.id);
    const isProgressionActive = activeProgressionChordId === chord.id;
    return (
      <button
        key={chord.id}
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          handleKeyStart(chord);
        }}
        onMouseUp={(e) => {
          e.preventDefault();
          handleKeyEnd(chord);
        }}
        onMouseEnter={() => handleMouseEnter(chord)}
        onMouseLeave={() => handleMouseLeave(chord)}
        onTouchStart={(e) => {
          e.preventDefault();
          handleKeyStart(chord);
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          handleKeyEnd(chord);
        }}
        className={`group relative aspect-square rounded-xl border-2 flex flex-col items-center justify-between py-1.5 sm:py-2 px-0.5 cursor-pointer transition-all duration-75 select-none
          ${isProgressionActive
            ? 'bg-gradient-to-b from-amber-100 via-amber-200 to-amber-300 border-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.7),inset_0_4px_10px_rgba(245,158,11,0.5)] scale-[0.98] z-10'
            : isActive
              ? isMinor
                ? 'bg-gradient-to-b from-purple-100 via-purple-200 to-purple-300 border-purple-400 shadow-[inset_0_4px_10px_rgba(168,85,247,0.6),0_0_14px_rgba(168,85,247,0.7)] scale-[0.97]'
                : 'bg-gradient-to-b from-cyan-100 via-cyan-200 to-cyan-300 border-cyan-400 shadow-[inset_0_4px_10px_rgba(6,182,212,0.6),0_0_14px_rgba(6,182,212,0.7)] scale-[0.97]'
              : isHighlighted
                ? 'bg-slate-900 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-amber-500/50'
                : isSharp
                  ? isMinor
                    ? 'bg-gradient-to-b from-slate-800 via-slate-800 to-slate-900 border-amber-700/60 hover:border-amber-600 hover:from-slate-700 hover:to-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_6px_rgba(0,0,0,0.4)]'
                    : 'bg-gradient-to-b from-slate-800 via-slate-800 to-slate-900 border-cyan-700/60 hover:border-cyan-600 hover:from-slate-700 hover:to-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_6px_rgba(0,0,0,0.4)]'
                  : isMinor
                    ? 'bg-gradient-to-b from-slate-100 via-slate-50 to-slate-200 border-slate-300 hover:from-purple-50 hover:to-purple-100 border-slate-300/80 shadow-[inset_0_-3px_6px_rgba(0,0,0,0.12),0_2px_4px_rgba(0,0,0,0.2)]'
                    : 'bg-gradient-to-b from-white via-slate-50 to-slate-200 border-slate-300 hover:from-cyan-50 hover:to-cyan-100 shadow-[inset_0_-3px_6px_rgba(0,0,0,0.12),0_2px_4px_rgba(0,0,0,0.2)]'
          }
        `}
      >
        {/* Progression highlight badge */}
        {isHighlighted && stepInfo && (
          <>
            <div
              className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black border-2 shadow-lg z-20 ${
                isProgressionActive ? 'bg-amber-500 text-slate-950 border-amber-300 scale-110 animate-pulse' : 'bg-slate-900 text-amber-300 border-amber-500'
              }`}
            >
              {stepInfo.step + 1}
            </div>
            <div className="absolute -bottom-1 inset-x-1 flex justify-center pointer-events-none">
              <span
                className={`text-[7px] font-mono font-bold px-1 py-0.5 rounded border ${
                  isProgressionActive ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-amber-900/90 text-amber-200 border-amber-700/60'
                }`}
              >
                {stepInfo.roman}
              </span>
            </div>
          </>
        )}
        <div className="h-4 sm:h-5 flex items-center justify-center">
          {isKeyboardActive ? (
            <span
              className={`text-[8px] sm:text-[10px] font-mono font-bold px-1 sm:px-1.5 py-0.5 rounded shadow-sm border ${
                isProgressionActive
                  ? 'bg-amber-500 text-slate-950 border-amber-300 ring-1 ring-amber-400'
                  : isActive
                    ? 'bg-slate-900 text-purple-300 ring-1 ring-purple-400 border-slate-700'
                    : isHighlighted
                      ? 'bg-amber-900 text-amber-100 border-amber-600 ring-1 ring-amber-500/50'
                      : isSharp
                        ? isMinor
                          ? 'bg-amber-900 text-amber-100 border-amber-700'
                          : 'bg-cyan-900 text-cyan-100 border-cyan-700'
                        : isMinor
                          ? 'bg-purple-900 text-purple-100 border-purple-700'
                          : 'bg-slate-800 text-cyan-300 border-slate-700'
              }`}
            >
              {chord.displayShortcut}
            </span>
          ) : isHighlighted ? (
            <span className={`w-1.5 h-1.5 rounded-full ${isProgressionActive ? 'bg-amber-400 animate-pulse shadow-[0_0_6px_rgba(245,158,11,0.8)]' : 'bg-amber-500/80'}`} />
          ) : (
            <span className={`w-1 h-1 rounded-full ${isSharp ? 'bg-amber-500/60' : 'bg-slate-300/60'}`} />
          )}
        </div>

        <div className="flex flex-col items-center gap-0 pointer-events-none w-full">
          <span
            className={`text-[11px] sm:text-xs font-black tracking-tight leading-none ${
              isProgressionActive
                ? 'text-slate-950'
                : isHighlighted
                  ? 'text-amber-200'
                  : isActive
                    ? 'text-slate-950'
                    : isSharp
                      ? isMinor
                        ? 'text-amber-200'
                        : 'text-cyan-200'
                      : isMinor
                        ? 'text-purple-900'
                        : 'text-slate-800'
            }`}
          >
            {chord.rootName}
            <span
              className={`text-[9px] font-bold ml-0.5 ${
                isProgressionActive
                  ? 'text-slate-800'
                  : isHighlighted
                    ? 'text-amber-300'
                    : isActive
                      ? 'text-slate-800'
                      : isSharp
                        ? 'text-slate-400'
                        : isMinor
                          ? 'text-purple-700'
                          : 'text-slate-500'
              }`}
            >
              {chord.type === 'Major' ? '' : 'm'}
            </span>
          </span>
          <span
            className={`text-[7px] sm:text-[8px] font-mono tracking-tighter leading-none mt-0.5 ${
              isProgressionActive ? 'text-slate-900 font-bold' : isHighlighted ? 'text-amber-300' : isActive ? 'text-slate-900 font-bold' : isSharp ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {chord.notesLabel}
          </span>
        </div>

        <span
          className={`text-[8px] font-mono font-bold tracking-widest uppercase ${
            isProgressionActive ? 'text-slate-700' : isHighlighted ? 'text-amber-400/80' : isActive ? 'text-slate-700' : isMinor ? 'text-purple-700/60' : 'text-cyan-700/60'
          }`}
        >
          {chord.type === 'Major' ? 'MAJ' : 'MIN'}
        </span>
      </button>
    );
  };

  return (
    <div className="w-full select-none flex flex-col items-center">
      <div
        className={`relative w-full max-w-5xl bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 p-2.5 sm:p-3 rounded-2xl shadow-2xl border-2 transition-all duration-200 ${
          isKeyboardActive ? 'border-purple-500/70 shadow-[0_0_20px_rgba(168,85,247,0.25)]' : 'border-slate-700/80'
        }`}
      >
        <div onMouseDown={() => setIsMouseDown(true)} className="space-y-2">
          {/* Maj row */}
          <div>
            <div className="flex items-center gap-2 mb-1 px-1">
              <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-300/80 uppercase">Major</span>
              <div className="flex-1 h-px bg-cyan-800/40" />
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 sm:gap-2">
              {MAJOR_CHORDS.map(renderPad)}
            </div>
          </div>

          {/* Min row */}
          <div>
            <div className="flex items-center gap-2 mb-1 px-1">
              <span className="text-[10px] font-mono font-bold tracking-widest text-purple-300/80 uppercase">Minor</span>
              <div className="flex-1 h-px bg-purple-800/40" />
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 sm:gap-2">
              {MINOR_CHORDS.map(renderPad)}
            </div>
          </div>
        </div>

        <div className="w-full h-2 bg-gradient-to-b from-slate-700 to-slate-900 rounded-b-md mt-2" />
      </div>
    </div>
  );
}
