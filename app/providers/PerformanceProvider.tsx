import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { deviceEngine, keyPiece } from "../components/home/deviceEngine";
import {
  CHORD_STYLES,
  DEFAULT_CHORD_STYLE,
  playChord,
} from "../components/home/chordStyles";
import { chordById } from "../components/home/chords";
import {
  setChordStyle,
  useChordMacros,
  useChordStyle,
} from "../components/home/chordStore";
import { F3_MIDI, KEY_VELOCITY } from "../components/home/input/keybed";
import type { HeldKey } from "../components/home/input/performance";
import { beatMs } from "../components/home/noteRecorder";
import { useHotkeys } from "./HotkeyProvider";
import { useSequencer } from "./SequencerProvider";
import { useTransportContext } from "./TransportProvider";
import { useView } from "./ViewProvider";

interface PerformanceValue {
  held: { current: Map<number, HeldKey> };
  keyNotes: { current: Map<number, number> };
  litNotes: ReadonlySet<number>;
  setLitNotes: (notes: ReadonlySet<number>) => void;
  octave: number;
  setOctave: (change: number | ((current: number) => number)) => void;
  shift: boolean;
  shiftLatched: boolean;
  setShiftLatched: (latched: boolean | ((on: boolean) => boolean)) => void;
  chord: number | null;
  setChord: (change: number | null | ((current: number | null) => number | null)) => void;
  chordIndex: number;
  setChordIndex: (change: number | ((current: number) => number)) => void;
  activeChord: number | null;
  chordMacros: readonly string[];
  macroChords: ReturnType<typeof chordById>[];
  chordStyle: ReturnType<typeof useChordStyle>;
  chordStyleIndex: number;
  tapMode: boolean;
  pickChordStyle: (index: number) => void;
  toggleChord: (index: number) => void;
  pressKey: (root: number, chordToPlay?: number | null) => void;
  releaseKey: (root: number) => void;
}

const PerformanceContext = createContext<PerformanceValue | null>(null);

export function PerformanceProvider({ children }: { children: ReactNode }) {
  const { view, leaveRevert } = useView();
  const transport = useTransportContext();
  const { stepKit, tapStep } = useSequencer();
  const keys = useHotkeys();

  const [octave, setOctave] = useState(0);
  const [shiftLatched, setShiftLatched] = useState(false);
  const [chord, setChord] = useState<number | null>(null);
  const [chordIndex, setChordIndex] = useState(0);
  const [litNotes, setLitNotes] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const held = useRef(new Map<number, HeldKey>());
  // The note each held piano key started, by its unshifted semitone.
  const keyNotes = useRef(new Map<number, number>());
  const chordMacros = useChordMacros();
  const chordStyle = useChordStyle();
  const chordStyleIndex = Math.max(
    0,
    CHORD_STYLES.findIndex(({ id }) => id === chordStyle.id),
  );
  const macroChords = chordMacros.map(chordById);
  const shift = shiftLatched || keys.shift;
  const activeChord = keys.chord ?? chord;
  const tapMode = transport.tapping && view === "tempo";

  // The timing a held chord's pattern reads each step, so it follows the
  // tempo as it changes.
  const liveTiming = useRef(transport.timing);
  useEffect(() => {
    liveTiming.current = transport.timing;
  });

  // Let go of everything when the page is left or hidden, so no note is left
  // sounding.
  useEffect(() => {
    const heldKeys = held.current;
    const releaseAll = () => {
      if (heldKeys.size === 0) return;
      for (const entry of heldKeys.values()) entry.stop();
      heldKeys.clear();
      deviceEngine.allNotesOff();
      setLitNotes(new Set());
    };
    const releaseWhenHidden = () => {
      if (document.hidden) releaseAll();
    };
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", releaseWhenHidden);
    return () => {
      releaseAll();
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", releaseWhenHidden);
    };
  }, []);

  const syncLitNotes = () =>
    setLitNotes(
      new Set([...held.current.values()].flatMap(({ semitones }) => semitones)),
    );

  const pressKey = (root: number, chordToPlay: number | null = activeChord) => {
    if (held.current.has(root)) return;
    leaveRevert();
    deviceEngine.unlock();
    if (tapMode) transport.tapNote();
    const intervals =
      chordToPlay === null ? [0] : macroChords[chordToPlay].intervals;
    const semitones = intervals.map((interval) => root + interval);
    const midis = semitones.map((semitone) => F3_MIDI + semitone + 12 * octave);
    // A chord plays in the chord style; the sequencer takes it as a block.
    const stop = playChord(
      midis,
      chordToPlay === null || view === "steps"
        ? DEFAULT_CHORD_STYLE
        : chordStyle,
      () => beatMs(liveTiming.current) / chordStyle.perBeat,
      {
        on: (midi) => {
          deviceEngine.noteOn(midi, KEY_VELOCITY);
          transport.capture(midi, true, KEY_VELOCITY);
        },
        off: (midi) => {
          deviceEngine.noteOff(midi);
          transport.capture(midi, false);
        },
      },
    );
    held.current.set(root, { semitones, midis, stop });
    syncLitNotes();
    if (view === "steps" && stepKit)
      for (const piece of new Set(midis.map((midi) => keyPiece(stepKit, midi))))
        tapStep(piece);
  };

  const releaseKey = (root: number) => {
    const entry = held.current.get(root);
    if (!entry) return;
    held.current.delete(root);
    entry.stop();
    syncLitNotes();
  };

  const toggleChord = (index: number) =>
    setChord((current) => (current === index ? null : index));

  const pickChordStyle = (index: number) =>
    setChordStyle({
      id: CHORD_STYLES[Math.max(0, Math.min(index, CHORD_STYLES.length - 1))]
        .id,
    });

  const value: PerformanceValue = {
    held,
    keyNotes,
    litNotes,
    setLitNotes,
    octave,
    setOctave,
    shift,
    shiftLatched,
    setShiftLatched,
    chord,
    setChord,
    chordIndex,
    setChordIndex,
    activeChord,
    chordMacros,
    macroChords,
    chordStyle,
    chordStyleIndex,
    tapMode,
    pickChordStyle,
    toggleChord,
    pressKey,
    releaseKey,
  };

  return (
    <PerformanceContext.Provider value={value}>
      {children}
    </PerformanceContext.Provider>
  );
}

export function usePerformance() {
  const context = useContext(PerformanceContext);
  if (!context) throw new Error("Wrap the Device in a PerformanceProvider");
  return context;
}
