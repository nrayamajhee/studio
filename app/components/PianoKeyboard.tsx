import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generatePianoKeys, type PianoKeyData } from '../audio/synthEngine';

interface PianoKeyboardProps {
  baseOctave: number;
  activeNotes: Set<number>;
  isKeyboardActive: boolean;
  onNotePress: (midiNote: number) => void;
  onNoteRelease: (midiNote: number) => void;
}

export function PianoKeyboard({
  baseOctave,
  activeNotes,
  isKeyboardActive,
  onNotePress,
  onNoteRelease,
}: PianoKeyboardProps) {
  const [isMouseDown, setIsMouseDown] = useState(false);
  const keys = generatePianoKeys(baseOctave);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Separate white and black keys while tracking white key indices
  const whiteKeys: { data: PianoKeyData; whiteIndex: number }[] = [];
  const blackKeys: { data: PianoKeyData; afterWhiteIndex: number }[] = [];

  let currentWhiteCount = 0;
  keys.forEach((key) => {
    if (!key.accidental) {
      whiteKeys.push({ data: key, whiteIndex: currentWhiteCount });
      currentWhiteCount++;
    } else {
      blackKeys.push({ data: key, afterWhiteIndex: currentWhiteCount - 1 });
    }
  });

  const totalWhiteKeys = whiteKeys.length;

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsMouseDown(false);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  const handleKeyStart = useCallback(
    (midiNote: number) => {
      onNotePress(midiNote);
    },
    [onNotePress]
  );

  const handleKeyEnd = useCallback(
    (midiNote: number) => {
      onNoteRelease(midiNote);
    },
    [onNoteRelease]
  );

  const handleMouseEnter = useCallback(
    (midiNote: number) => {
      if (isMouseDown) {
        onNotePress(midiNote);
      }
    },
    [isMouseDown, onNotePress]
  );

  const handleMouseLeave = useCallback(
    (midiNote: number) => {
      if (isMouseDown) {
        onNoteRelease(midiNote);
      }
    },
    [isMouseDown, onNoteRelease]
  );

  return (
    <div className="w-full select-none flex flex-col items-center">
      {/* Piano Outer Enclosure / Chassis */}
      <div
        className={`relative w-full max-w-5xl bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 p-4 sm:p-6 rounded-2xl shadow-2xl border-2 transition-all duration-200 ${
          isKeyboardActive
            ? 'border-cyan-500/70 shadow-[0_0_20px_rgba(6,182,212,0.25)]'
            : 'border-slate-700/80'
        }`}
      >
        {/* Felt Strip & Accent Top Bar */}
        <div className="w-full h-3 sm:h-4 bg-gradient-to-r from-red-950 via-red-800 to-red-950 rounded-t-sm mb-1 shadow-inner border-b border-red-900/50 flex items-center justify-center">
          <div className="w-full h-0.5 bg-red-600/40" />
        </div>

        {/* Keys Enclosure */}
        <div
          ref={containerRef}
          onMouseDown={() => setIsMouseDown(true)}
          className="relative w-full h-56 sm:h-64 md:h-72 flex rounded-b-lg overflow-hidden bg-slate-950 shadow-[inset_0_-8px_16px_rgba(0,0,0,0.6)]"
        >
          {/* 1. White Keys */}
          {whiteKeys.map(({ data, whiteIndex }) => {
            const isActive = activeNotes.has(data.midiNote);
            return (
              <button
                key={data.midiNote}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleKeyStart(data.midiNote);
                }}
                onMouseUp={(e) => {
                  e.preventDefault();
                  handleKeyEnd(data.midiNote);
                }}
                onMouseEnter={() => handleMouseEnter(data.midiNote)}
                onMouseLeave={() => handleMouseLeave(data.midiNote)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  handleKeyStart(data.midiNote);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleKeyEnd(data.midiNote);
                }}
                className={`group relative flex-1 h-full border-r border-slate-300/60 last:border-r-0 rounded-b-md transition-all duration-75 flex flex-col justify-end pb-3 items-center cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-b from-cyan-100 via-cyan-200 to-cyan-300 shadow-[inset_0_4px_12px_rgba(6,182,212,0.6),0_0_15px_rgba(6,182,212,0.8)] translate-y-1'
                    : 'bg-gradient-to-b from-white via-slate-50 to-slate-200 hover:from-slate-50 hover:to-slate-100 active:from-cyan-100 active:to-cyan-200 active:translate-y-1 shadow-[inset_0_-4px_6px_rgba(0,0,0,0.15),0_3px_5px_rgba(0,0,0,0.3)]'
                }`}
                style={{
                  zIndex: isActive ? 2 : 1,
                }}
              >
                {/* Visual Key Note & Shortcut */}
                <div className="flex flex-col items-center gap-1 pointer-events-none">
                  {/* Keyboard Shortcut Badge - ONLY shown when Solo Keys Mode is active */}
                  {isKeyboardActive && data.displayShortcut ? (
                    <span
                      className={`text-[10px] sm:text-xs font-mono font-bold px-1.5 py-0.5 rounded shadow-sm transition-colors ${
                        isActive
                          ? 'bg-slate-900 text-cyan-300 ring-1 ring-cyan-400'
                          : 'bg-slate-200 text-slate-700 group-hover:bg-slate-300'
                      }`}
                    >
                      {data.displayShortcut}
                    </span>
                  ) : null}
                  {/* Note Name */}
                  <span
                    className={`text-xs sm:text-sm font-semibold tracking-tight ${
                      isActive ? 'text-slate-950 font-bold' : 'text-slate-600'
                    }`}
                  >
                    {data.fullName}
                  </span>
                </div>
              </button>
            );
          })}

          {/* 2. Black Keys */}
          {blackKeys.map(({ data, afterWhiteIndex }) => {
            const isActive = activeNotes.has(data.midiNote);
            const leftPercent = ((afterWhiteIndex + 1) / totalWhiteKeys) * 100;

            return (
              <button
                key={data.midiNote}
                type="button"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleKeyStart(data.midiNote);
                }}
                onMouseUp={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleKeyEnd(data.midiNote);
                }}
                onMouseEnter={() => handleMouseEnter(data.midiNote)}
                onMouseLeave={() => handleMouseLeave(data.midiNote)}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleKeyStart(data.midiNote);
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleKeyEnd(data.midiNote);
                }}
                className={`absolute top-0 w-[5.5%] sm:w-[5%] md:w-[4.8%] h-[60%] sm:h-[62%] -translate-x-1/2 z-10 rounded-b-md transition-all duration-75 flex flex-col justify-end pb-2 items-center cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-b from-cyan-600 via-cyan-500 to-cyan-400 shadow-[0_0_18px_#06b6d4,inset_0_2px_4px_rgba(255,255,255,0.4)] translate-y-1'
                    : 'bg-gradient-to-b from-slate-900 via-slate-800 to-slate-950 border-x border-b border-slate-700/80 shadow-[0_4px_8px_rgba(0,0,0,0.8),inset_0_-2px_4px_rgba(255,255,255,0.1)] hover:from-slate-800 hover:to-slate-900 active:translate-y-1'
                }`}
                style={{
                  left: `${leftPercent}%`,
                }}
              >
                {/* Visual Black Key Note & Shortcut */}
                <div className="flex flex-col items-center gap-0.5 pointer-events-none">
                  {isKeyboardActive && data.displayShortcut ? (
                    <span
                      className={`text-[9px] sm:text-[10px] font-mono font-bold px-1 py-0.2 rounded shadow-sm ${
                        isActive
                          ? 'bg-slate-950 text-white ring-1 ring-cyan-200'
                          : 'bg-slate-800 text-slate-300 border border-slate-600'
                      }`}
                    >
                      {data.displayShortcut}
                    </span>
                  ) : null}
                  <span
                    className={`text-[10px] sm:text-xs font-semibold ${
                      isActive ? 'text-slate-950 font-bold' : 'text-slate-300'
                    }`}
                  >
                    {data.fullName}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Piano Front Edge Highlight */}
        <div className="w-full h-2 bg-gradient-to-b from-slate-700 to-slate-900 rounded-b-md mt-0.5" />
      </div>
    </div>
  );
}
