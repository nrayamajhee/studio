import React, { useState, useEffect, useCallback } from 'react';

export interface ChordData {
  id: string;
  name: string;
  type: 'Major' | 'Minor';
  rootName: string;
  notesLabel: string;
  shortcutKey: string;
  displayShortcut: string;
  getMidiNotes: (baseOctave: number) => number[];
}

export const CHORD_DEFINITIONS: ChordData[] = [
  {
    id: 'c-maj',
    name: 'C Maj',
    type: 'Major',
    rootName: 'C',
    notesLabel: 'C • E • G',
    shortcutKey: 'a',
    displayShortcut: 'A',
    getMidiNotes: (baseOctave) => {
      const root = (baseOctave + 1) * 12 + 0;
      return [root, root + 4, root + 7];
    },
  },
  {
    id: 'c-min',
    name: 'C Min',
    type: 'Minor',
    rootName: 'C',
    notesLabel: 'C • D# • G',
    shortcutKey: 'w',
    displayShortcut: 'W',
    getMidiNotes: (baseOctave) => {
      const root = (baseOctave + 1) * 12 + 0;
      return [root, root + 3, root + 7];
    },
  },
  {
    id: 'd-maj',
    name: 'D Maj',
    type: 'Major',
    rootName: 'D',
    notesLabel: 'D • F# • A',
    shortcutKey: 's',
    displayShortcut: 'S',
    getMidiNotes: (baseOctave) => {
      const root = (baseOctave + 1) * 12 + 2;
      return [root, root + 4, root + 7];
    },
  },
  {
    id: 'd-min',
    name: 'D Min',
    type: 'Minor',
    rootName: 'D',
    notesLabel: 'D • F • A',
    shortcutKey: 'e',
    displayShortcut: 'E',
    getMidiNotes: (baseOctave) => {
      const root = (baseOctave + 1) * 12 + 2;
      return [root, root + 3, root + 7];
    },
  },
  {
    id: 'e-maj',
    name: 'E Maj',
    type: 'Major',
    rootName: 'E',
    notesLabel: 'E • G# • B',
    shortcutKey: 'd',
    displayShortcut: 'D',
    getMidiNotes: (baseOctave) => {
      const root = (baseOctave + 1) * 12 + 4;
      return [root, root + 4, root + 7];
    },
  },
  {
    id: 'e-min',
    name: 'E Min',
    type: 'Minor',
    rootName: 'E',
    notesLabel: 'E • G • B',
    shortcutKey: 'r',
    displayShortcut: 'R',
    getMidiNotes: (baseOctave) => {
      const root = (baseOctave + 1) * 12 + 4;
      return [root, root + 3, root + 7];
    },
  },
  {
    id: 'f-maj',
    name: 'F Maj',
    type: 'Major',
    rootName: 'F',
    notesLabel: 'F • A • C',
    shortcutKey: 'f',
    displayShortcut: 'F',
    getMidiNotes: (baseOctave) => {
      const root = (baseOctave + 1) * 12 + 5;
      return [root, root + 4, root + 7];
    },
  },
  {
    id: 'f-min',
    name: 'F Min',
    type: 'Minor',
    rootName: 'F',
    notesLabel: 'F • G# • C',
    shortcutKey: 't',
    displayShortcut: 'T',
    getMidiNotes: (baseOctave) => {
      const root = (baseOctave + 1) * 12 + 5;
      return [root, root + 3, root + 7];
    },
  },
  {
    id: 'g-maj',
    name: 'G Maj',
    type: 'Major',
    rootName: 'G',
    notesLabel: 'G • B • D',
    shortcutKey: 'g',
    displayShortcut: 'G',
    getMidiNotes: (baseOctave) => {
      const root = (baseOctave + 1) * 12 + 7;
      return [root, root + 4, root + 7];
    },
  },
  {
    id: 'g-min',
    name: 'G Min',
    type: 'Minor',
    rootName: 'G',
    notesLabel: 'G • A# • D',
    shortcutKey: 'y',
    displayShortcut: 'Y',
    getMidiNotes: (baseOctave) => {
      const root = (baseOctave + 1) * 12 + 7;
      return [root, root + 3, root + 7];
    },
  },
  {
    id: 'a-maj',
    name: 'A Maj',
    type: 'Major',
    rootName: 'A',
    notesLabel: 'A • C# • E',
    shortcutKey: 'h',
    displayShortcut: 'H',
    getMidiNotes: (baseOctave) => {
      const root = (baseOctave + 1) * 12 + 9;
      return [root, root + 4, root + 7];
    },
  },
  {
    id: 'a-min',
    name: 'A Min',
    type: 'Minor',
    rootName: 'A',
    notesLabel: 'A • C • E',
    shortcutKey: 'u',
    displayShortcut: 'U',
    getMidiNotes: (baseOctave) => {
      const root = (baseOctave + 1) * 12 + 9;
      return [root, root + 3, root + 7];
    },
  },
  {
    id: 'b-maj',
    name: 'B Maj',
    type: 'Major',
    rootName: 'B',
    notesLabel: 'B • D# • F#',
    shortcutKey: 'j',
    displayShortcut: 'J',
    getMidiNotes: (baseOctave) => {
      const root = (baseOctave + 1) * 12 + 11;
      return [root, root + 4, root + 7];
    },
  },
  {
    id: 'b-min',
    name: 'B Min',
    type: 'Minor',
    rootName: 'B',
    notesLabel: 'B • D • F#',
    shortcutKey: 'i',
    displayShortcut: 'I',
    getMidiNotes: (baseOctave) => {
      const root = (baseOctave + 1) * 12 + 11;
      return [root, root + 3, root + 7];
    },
  },
];

interface ChordKeyboardProps {
  baseOctave: number;
  activeChordIds: Set<string>;
  isKeyboardActive: boolean;
  onChordPress: (chord: ChordData) => void;
  onChordRelease: (chord: ChordData) => void;
}

export function ChordKeyboard({
  baseOctave,
  activeChordIds,
  isKeyboardActive,
  onChordPress,
  onChordRelease,
}: ChordKeyboardProps) {
  const [isMouseDown, setIsMouseDown] = useState(false);

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
    (chord: ChordData) => {
      onChordPress(chord);
    },
    [onChordPress]
  );

  const handleKeyEnd = useCallback(
    (chord: ChordData) => {
      onChordRelease(chord);
    },
    [onChordRelease]
  );

  const handleMouseEnter = useCallback(
    (chord: ChordData) => {
      if (isMouseDown) {
        onChordPress(chord);
      }
    },
    [isMouseDown, onChordPress]
  );

  const handleMouseLeave = useCallback(
    (chord: ChordData) => {
      if (isMouseDown) {
        onChordRelease(chord);
      }
    },
    [isMouseDown, onChordRelease]
  );

  return (
    <div className="w-full select-none flex flex-col items-center">
      {/* Piano Outer Enclosure */}
      <div
        className={`relative w-full max-w-5xl bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 p-2.5 sm:p-3 rounded-2xl shadow-2xl border-2 transition-all duration-200 ${
          isKeyboardActive
            ? 'border-purple-500/70 shadow-[0_0_20px_rgba(168,85,247,0.25)]'
            : 'border-slate-700/80'
        }`}
      >
        {/* Felt Strip & Header Accent */}
        <div className="w-full h-2 sm:h-2.5 bg-gradient-to-r from-purple-950 via-purple-800 to-purple-950 rounded-t-sm mb-1 shadow-inner border-b border-purple-900/50 flex items-center justify-between px-3">
          <div className="w-full h-0.5 bg-purple-400/40" />
        </div>

        {/* White Chord Keys Row (1/2 height) */}
        <div
          onMouseDown={() => setIsMouseDown(true)}
          className="relative w-full h-20 sm:h-24 md:h-28 flex rounded-b-lg overflow-hidden bg-slate-950 shadow-[inset_0_-8px_16px_rgba(0,0,0,0.6)]"
        >
          {CHORD_DEFINITIONS.map((chord) => {
            const isActive = activeChordIds.has(chord.id);
            const isMinor = chord.type === 'Minor';

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
                className={`group relative flex-1 h-full border-r border-slate-300/60 last:border-r-0 rounded-b-md transition-all duration-75 flex flex-col justify-between py-1.5 sm:py-2 px-0.5 items-center cursor-pointer ${
                  isActive
                    ? isMinor
                      ? 'bg-gradient-to-b from-purple-100 via-purple-200 to-purple-300 shadow-[inset_0_4px_12px_rgba(168,85,247,0.6),0_0_15px_rgba(168,85,247,0.8)] translate-y-1'
                      : 'bg-gradient-to-b from-cyan-100 via-cyan-200 to-cyan-300 shadow-[inset_0_4px_12px_rgba(6,182,212,0.6),0_0_15px_rgba(6,182,212,0.8)] translate-y-1'
                    : isMinor
                    ? 'bg-gradient-to-b from-slate-100 via-slate-50 to-slate-200 hover:from-purple-50 hover:to-purple-100 active:translate-y-1 shadow-[inset_0_-4px_6px_rgba(0,0,0,0.15),0_3px_5px_rgba(0,0,0,0.3)]'
                    : 'bg-gradient-to-b from-white via-slate-50 to-slate-200 hover:from-cyan-50 hover:to-cyan-100 active:translate-y-1 shadow-[inset_0_-4px_6px_rgba(0,0,0,0.15),0_3px_5px_rgba(0,0,0,0.3)]'
                }`}
                style={{
                  zIndex: isActive ? 2 : 1,
                }}
              >
                {/* Shortcut Key Badge */}
                <div className="h-4 sm:h-5 flex items-center justify-center">
                  {isKeyboardActive ? (
                    <span
                      className={`text-[8px] sm:text-[10px] font-mono font-bold px-1 sm:px-1.5 py-0.2 rounded shadow-sm transition-all ${
                        isActive
                          ? 'bg-slate-900 text-purple-300 ring-1 ring-purple-400 scale-105'
                          : isMinor
                          ? 'bg-purple-900 text-purple-100 border border-purple-700'
                          : 'bg-slate-800 text-cyan-300 border border-slate-700'
                      }`}
                    >
                      {chord.displayShortcut}
                    </span>
                  ) : (
                    <span className="w-1 h-1 rounded-full bg-slate-300/40" />
                  )}
                </div>

                {/* Chord Info Labels */}
                <div className="flex flex-col items-center gap-0 pointer-events-none w-full">
                  {/* Chord Full Name */}
                  <span
                    className={`text-[11px] sm:text-xs font-bold tracking-tight ${
                      isActive ? 'text-slate-950 font-black' : isMinor ? 'text-purple-900' : 'text-slate-800'
                    }`}
                  >
                    {chord.rootName}{chord.type === 'Major' ? '' : 'm'}
                  </span>

                  {/* Triad Notes (e.g. C • E • G) */}
                  <span
                    className={`text-[7px] sm:text-[9px] font-mono tracking-tighter leading-none ${
                      isActive ? 'text-slate-900 font-bold' : 'text-slate-500'
                    }`}
                  >
                    {chord.notesLabel}
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
