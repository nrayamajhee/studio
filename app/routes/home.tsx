import { useState, useEffect, useCallback, useRef } from 'react';
import type { Route } from './+types/home';
import { synth, generatePianoKeys, type SynthSettings } from '../audio/synthEngine';
import { PianoKeyboard } from '../components/PianoKeyboard';
import { PianoMiniMap } from '../components/PianoMiniMap';
import { ChordKeyboard, CHORD_DEFINITIONS, type ChordData } from '../components/ChordKeyboard';
import { SynthControls } from '../components/SynthControls';
import { Visualizer } from '../components/Visualizer';
import { ShortcutModal } from '../components/ShortcutModal';
import { Info, OctagonX, Sparkles } from 'lucide-react';

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Studio" },
    { name: "description", content: "Interactive Web Audio API physical modeling synthesizer with pianos, guitars, mini-map and chords" },
  ];
}

export default function Home() {
  const [settings, setSettings] = useState<SynthSettings>(synth.getSettings());
  const [inputMode, setInputMode] = useState<'keys' | 'chords'>('keys');
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [activeChordIds, setActiveChordIds] = useState<Set<string>>(new Set());
  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState(false);

  // Keep track of physically held notes & chords (vs sustained notes)
  const heldNotesRef = useRef<Set<number>>(new Set());
  const heldChordsRef = useRef<Set<string>>(new Set());
  const isSustainActiveRef = useRef(false);
  const strumTimeoutsRef = useRef<number[]>([]);

  // Update synth engine whenever settings change
  const handleUpdateSettings = useCallback((newPartial: Partial<SynthSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newPartial };
      synth.updateSettings(updated);
      if (newPartial.sustainPedal !== undefined) {
        isSustainActiveRef.current = newPartial.sustainPedal;
      }
      return updated;
    });
  }, []);

  const handleResetPitch = useCallback(() => {
    handleUpdateSettings({
      baseOctave: 4,
      pitchShiftSemi: 0,
      fineTuneCents: 0,
      pitchBend: 0,
    });
  }, [handleUpdateSettings]);

  // Force Kill / Panic function to stop all stuck sounds immediately
  const handlePanic = useCallback(() => {
    strumTimeoutsRef.current.forEach((id) => clearTimeout(id));
    strumTimeoutsRef.current = [];
    synth.stopAllNotes(true);
    heldNotesRef.current.clear();
    heldChordsRef.current.clear();
    setActiveNotes(new Set());
    setActiveChordIds(new Set());
  }, []);

  // Single Note on / off handler
  const playNote = useCallback((midiNote: number) => {
    heldNotesRef.current.add(midiNote);
    synth.noteOn(midiNote);
    setActiveNotes((prev) => new Set(prev).add(midiNote));
  }, []);

  const stopNote = useCallback((midiNote: number) => {
    heldNotesRef.current.delete(midiNote);
    synth.noteOff(midiNote);

    if (!isSustainActiveRef.current) {
      setActiveNotes((prev) => {
        const next = new Set(prev);
        next.delete(midiNote);
        return next;
      });
    }
  }, []);

  // 3-Note Chord on / off handler with strumming support
  const playChord = useCallback((chord: ChordData) => {
    heldChordsRef.current.add(chord.id);
    const midiNotes = chord.getMidiNotes(settings.baseOctave);
    const strumSpeed = settings.strumSpeedMs || 0;

    if (strumSpeed > 0) {
      midiNotes.forEach((midi, index) => {
        const timeoutId = window.setTimeout(() => {
          heldNotesRef.current.add(midi);
          synth.noteOn(midi);
          setActiveNotes((prev) => new Set(prev).add(midi));
        }, index * strumSpeed);
        strumTimeoutsRef.current.push(timeoutId);
      });
    } else {
      midiNotes.forEach((midi) => {
        heldNotesRef.current.add(midi);
        synth.noteOn(midi);
      });
      setActiveNotes((prev) => {
        const next = new Set(prev);
        midiNotes.forEach((m) => next.add(m));
        return next;
      });
    }

    setActiveChordIds((prev) => new Set(prev).add(chord.id));
  }, [settings.baseOctave, settings.strumSpeedMs]);

  const stopChord = useCallback((chord: ChordData) => {
    heldChordsRef.current.delete(chord.id);
    const midiNotes = chord.getMidiNotes(settings.baseOctave);
    midiNotes.forEach((midi) => {
      heldNotesRef.current.delete(midi);
      synth.noteOff(midi);
    });

    if (!isSustainActiveRef.current) {
      setActiveNotes((prev) => {
        const next = new Set(prev);
        midiNotes.forEach((m) => next.delete(m));
        return next;
      });

      setActiveChordIds((prev) => {
        const next = new Set(prev);
        next.delete(chord.id);
        return next;
      });
    }
  }, [settings.baseOctave]);

  // Release sustained notes when sustain pedal is released
  const releaseSustainPedal = useCallback(() => {
    handleUpdateSettings({ sustainPedal: false });
    const held = heldNotesRef.current;
    setActiveNotes((prev) => {
      const next = new Set<number>();
      prev.forEach((midi) => {
        if (held.has(midi)) {
          next.add(midi);
        } else {
          synth.noteOff(midi, true);
        }
      });
      return next;
    });

    const heldChords = heldChordsRef.current;
    setActiveChordIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (heldChords.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [handleUpdateSettings]);

  // Global blur / visibility change listener
  useEffect(() => {
    const handleWindowBlur = () => {
      handlePanic();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handlePanic();
      }
    };

    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handlePanic]);

  // Keyboard shortcut listener for both single notes and chords
  useEffect(() => {
    const pianoKeys = generatePianoKeys(settings.baseOctave);
    const keyMap = new Map<string, number>();

    pianoKeys.forEach((keyData) => {
      if (keyData.shortcutKey) {
        keyMap.set(keyData.shortcutKey.toLowerCase(), keyData.midiNote);
      }
    });

    const chordMap = new Map<string, ChordData>();
    CHORD_DEFINITIONS.forEach((chord) => {
      chordMap.set(chord.shortcutKey.toLowerCase(), chord);
    });

    const pressedPhysicalKeys = new Set<string>();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs/sliders
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      // Escape key triggers panic sound stop
      if (e.key === 'Escape') {
        if (!isShortcutModalOpen) {
          handlePanic();
        }
        return;
      }

      // Tab key toggles between Keys mode and Chords mode
      if (e.key === 'Tab') {
        e.preventDefault();
        setInputMode((prev) => (prev === 'keys' ? 'chords' : 'keys'));
        return;
      }

      // Sustain Pedal: HOLD down spacebar
      if (e.code === 'Space') {
        e.preventDefault();
        if (!isSustainActiveRef.current) {
          handleUpdateSettings({ sustainPedal: true });
        }
        return;
      }

      if (e.repeat) return;

      const key = e.key.toLowerCase();

      // Pitch and Octave Shifting shortcuts (Back = Z, Front = X)
      if (key === 'z') {
        e.preventDefault();
        handleUpdateSettings({ baseOctave: Math.max(1, settings.baseOctave - 1) });
        return;
      }
      if (key === 'x') {
        e.preventDefault();
        handleUpdateSettings({ baseOctave: Math.min(6, settings.baseOctave + 1) });
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleUpdateSettings({ pitchShiftSemi: Math.min(12, settings.pitchShiftSemi + 1) });
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleUpdateSettings({ pitchShiftSemi: Math.max(-12, settings.pitchShiftSemi - 1) });
        return;
      }

      // Route keyboard based on active input mode:
      if (inputMode === 'chords') {
        const matchedChord = chordMap.get(key);
        if (matchedChord) {
          e.preventDefault();
          pressedPhysicalKeys.add(`chord-${key}`);
          playChord(matchedChord);
        }
      } else {
        const mappedMidi = keyMap.get(key) ?? (e.key === 'Enter' ? keyMap.get('enter') : undefined);
        if (mappedMidi !== undefined) {
          e.preventDefault();
          pressedPhysicalKeys.add(`note-${key}`);
          playNote(mappedMidi);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Sustain Pedal: RELEASE spacebar
      if (e.code === 'Space') {
        e.preventDefault();
        releaseSustainPedal();
        return;
      }

      const key = e.key.toLowerCase();

      if (pressedPhysicalKeys.has(`chord-${key}`)) {
        e.preventDefault();
        pressedPhysicalKeys.delete(`chord-${key}`);
        const matchedChord = chordMap.get(key);
        if (matchedChord) {
          stopChord(matchedChord);
        }
      } else if (pressedPhysicalKeys.has(`note-${key}`)) {
        e.preventDefault();
        pressedPhysicalKeys.delete(`note-${key}`);
        const mappedMidi = keyMap.get(key) ?? (e.key === 'Enter' ? keyMap.get('enter') : undefined);
        if (mappedMidi !== undefined) {
          stopNote(mappedMidi);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      strumTimeoutsRef.current.forEach((id) => clearTimeout(id));
      strumTimeoutsRef.current = [];
      pressedPhysicalKeys.forEach((keyId) => {
        if (keyId.startsWith('note-')) {
          const k = keyId.replace('note-', '');
          const midi = keyMap.get(k);
          if (midi !== undefined) stopNote(midi);
        } else if (keyId.startsWith('chord-')) {
          const k = keyId.replace('chord-', '');
          const chord = chordMap.get(k);
          if (chord) stopChord(chord);
        }
      });
    };
  }, [
    settings.baseOctave,
    settings.pitchShiftSemi,
    inputMode,
    isShortcutModalOpen,
    handleUpdateSettings,
    releaseSustainPedal,
    handlePanic,
    playNote,
    stopNote,
    playChord,
    stopChord,
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-3 sm:p-6 selection:bg-cyan-500 selection:text-slate-950">
      
      {/* Top Header / Studio Brand Navigation */}
      <header className="w-full max-w-5xl flex items-center justify-between gap-4 py-2 mb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-black text-lg">
            S
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            STUDIO
          </h1>
        </div>

        {/* Top Right Actions */}
        <div className="flex items-center gap-2">
          {/* Panic / Kill Notes Button */}
          <button
            type="button"
            onClick={handlePanic}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-800/70 hover:border-rose-700 transition-all text-xs font-semibold shadow-sm cursor-pointer"
            title="Force Stop All Audio [Esc]"
            aria-label="Force Stop All Audio"
          >
            <OctagonX className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Stop Sound</span>
          </button>

          {/* Info & Shortcuts Modal Button */}
          <button
            type="button"
            onClick={() => setIsShortcutModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 transition-all text-xs font-semibold shadow-sm group cursor-pointer"
            title="Keyboard Shortcuts & Info (i)"
            aria-label="Keyboard Shortcuts and Information"
          >
            <div className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-colors">
              <Info className="w-3.5 h-3.5" />
            </div>
            <span className="hidden sm:inline">Shortcuts</span>
          </button>
        </div>
      </header>

      {/* Main Studio Body */}
      <main className="w-full max-w-5xl flex flex-col items-center gap-4 my-auto py-2">
        
        {/* Real-Time Waveform Visualizer */}
        <Visualizer isPlaying={activeNotes.size > 0} />

        {/* Mini-Map of the Entire Piano Keyboard (C1-C8) with Back / Front Octave Navigation */}
        <PianoMiniMap
          baseOctave={settings.baseOctave}
          activeNotes={activeNotes}
          onChangeOctave={(oct) => handleUpdateSettings({ baseOctave: oct })}
        />

        {/* Main Interactive Piano Keyboard */}
        <PianoKeyboard
          baseOctave={settings.baseOctave}
          activeNotes={activeNotes}
          isKeyboardActive={inputMode === 'keys'}
          onNotePress={playNote}
          onNoteRelease={stopNote}
        />

        {/* Chords Keyboard Section (Major & Minor Triads) */}
        <ChordKeyboard
          baseOctave={settings.baseOctave}
          activeChordIds={activeChordIds}
          isKeyboardActive={inputMode === 'chords'}
          onChordPress={playChord}
          onChordRelease={stopChord}
        />

        {/* Synthesizer Parameters, Presets & Pitch Controls */}
        <SynthControls
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onResetPitch={handleResetPitch}
          onPanic={handlePanic}
        />
      </main>

      {/* Modal for Keyboard Shortcuts */}
      <ShortcutModal
        isOpen={isShortcutModalOpen}
        onClose={() => setIsShortcutModalOpen(false)}
      />
    </div>
  );
}
