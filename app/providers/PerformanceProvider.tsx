import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { deviceEngine } from "../components/home/deviceEngine";
import { F3_MIDI, KEY_VELOCITY } from "../components/home/deviceMath";
import { chordById } from "../components/home/chords";
import {
  DEFAULT_CHORD_STYLE,
  playChord,
  playStyles,
  styleEdited,
} from "../components/home/chordStyles";
import {
  setChordStyle,
  useChordMacros,
  useChordStyle,
  useSavedChordStyles,
} from "../components/home/chordStore";
import { beatMs } from "../components/home/noteRecorder";
import { createEmitter } from "../lib/emitter";
import { createStrictContext } from "./createStrictContext";
import { useHotkeys } from "./HotkeyProvider";
import { useSound } from "./SoundProvider";
import { useDeviceTransport } from "./TransportProvider";
import { useView } from "./ViewProvider";

type HeldKey = {
  semitones: number[];
  midis: number[];
  // Releases the key's notes, and stops its chord's pattern.
  stop: () => void;
};

type NoteListener = (midis: readonly number[]) => void;

function usePerformanceValue() {
  const keys = useHotkeys();
  const { view, leaveRevert } = useView();
  const transport = useDeviceTransport();
  const { octave } = useSound();
  const chordMacros = useChordMacros();
  const chordStyle = useChordStyle();
  const styles = playStyles(useSavedChordStyles());
  // The play style picked: the saved one it was picked as, or (if that's
  // gone) its built-in pattern.
  const savedIndex = styles.findIndex(({ id }) => id === chordStyle.saved);
  const chordStyleIndex = Math.max(
    0,
    savedIndex >= 0
      ? savedIndex
      : styles.findIndex(({ id }) => id === chordStyle.id),
  );
  // A chord latches on a click; its hotkey holds it while down.
  const [chord, setChord] = useState<number | null>(null);
  const [litNotes, setLitNotes] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const held = useRef(new Map<number, HeldKey>());
  const [notesPlayed] = useState(() => createEmitter<readonly number[]>());
  const macroChords = chordMacros.map(chordById);
  const activeChord = keys.chord ?? chord;

  // The timing a held chord's pattern reads each step, so it follows the
  // tempo as it changes.
  const liveTiming = useRef(transport.timing);
  useEffect(() => {
    liveTiming.current = transport.timing;
  });

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

  const pressKey = (root: number, chordToPlay = activeChord) => {
    if (held.current.has(root)) return;
    leaveRevert();
    deviceEngine.unlock();
    if (transport.tapMode) transport.tapNote();
    const intervals =
      chordToPlay === null ? [0] : macroChords[chordToPlay].intervals;
    const semitones = intervals.map((interval) => root + interval);
    const midis = semitones.map((semitone) => F3_MIDI + semitone + 12 * octave);
    // A chord plays in the play style; the sequencer takes it as a block.
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
    notesPlayed.emit(midis);
  };

  return {
    litNotes,
    chord,
    activeChord,
    macroChords,
    chordStyle,
    playStyles: styles,
    chordStyleIndex,
    // The rate or strum moved off what the picked play style plays.
    chordStyleEdited: styleEdited(chordStyle, styles[chordStyleIndex]),
    pressKey,
    releaseKey: (root: number) => {
      const entry = held.current.get(root);
      if (!entry) return;
      held.current.delete(root);
      entry.stop();
      syncLitNotes();
    },
    // Lets go of every key, and anything still sounding.
    releaseAll: () => {
      for (const entry of held.current.values()) entry.stop();
      held.current.clear();
      deviceEngine.allNotesOff();
      setLitNotes(new Set());
    },
    toggleChord: (index: number) =>
      setChord((current) => (current === index ? null : index)),
    dropChord: () => setChord(null),
    // Picking a play style plays it at its own rate and strum.
    pickChordStyle: (index: number) => {
      const { style } = styles[Math.max(0, Math.min(index, styles.length - 1))];
      setChordStyle({ ...style, saved: style.saved });
    },
    subscribeNotes: notesPlayed.subscribe,
  };
}

export type PerformanceValue = ReturnType<typeof usePerformanceValue>;

const [PerformanceContext, usePerformance] =
  createStrictContext<PerformanceValue>("PerformanceProvider");
export { usePerformance };

// Runs the handler with the notes of each key press, as it plays.
export function useNotePlayed(handler: NoteListener) {
  const { subscribeNotes } = usePerformance();
  const onNotes = useEffectEvent(handler);
  useEffect(() => subscribeNotes((midis) => onNotes(midis)), [subscribeNotes]);
}

// Playing the keybed: held keys and the notes they light, and the chord pads
// that turn a key into a chord in the play style.
export function PerformanceProvider({ children }: { children: ReactNode }) {
  return (
    <PerformanceContext value={usePerformanceValue()}>
      {children}
    </PerformanceContext>
  );
}
