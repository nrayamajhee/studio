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
  DEFAULT_PLAY_STYLE,
  playChord,
  playStyleOptions,
  styleEdited,
} from "../components/home/playStyles";
import {
  setPlayStyle,
  usePadChords,
  usePlayStyle,
  useSavedPlayStyles,
} from "../components/home/chordStore";
import {
  progressionTake,
  type Progression,
} from "../components/home/progressions";
import { setTake } from "../components/home/sessionStore";
import { createEmitter } from "../lib/emitter";
import { createStrictContext } from "./createStrictContext";
import { useFeedback } from "./FeedbackProvider";
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
  const { view, setView, leaveRevert } = useView();
  const feedback = useFeedback();
  const transport = useDeviceTransport();
  const { octave } = useSound();
  const padChordIds = usePadChords();
  const playStyle = usePlayStyle();
  const styles = playStyleOptions(useSavedPlayStyles());
  // The play style picked: the saved one it was picked as, or (if that's
  // gone) its built-in pattern.
  const savedIndex = styles.findIndex(({ id }) => id === playStyle.saved);
  const playStyleIndex = Math.max(
    0,
    savedIndex >= 0
      ? savedIndex
      : styles.findIndex(({ id }) => id === playStyle.id),
  );
  // A chord latches on a click; its hotkey holds it while down.
  const [chord, setChord] = useState<number | null>(null);
  const [litNotes, setLitNotes] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const held = useRef(new Map<number, HeldKey>());
  const [notesPlayed] = useState(() => createEmitter<readonly number[]>());
  const padChords = padChordIds.map(chordById);
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

  // A progression waiting for its home note: the next key played sets it
  // (its note, not its octave), and the progression becomes the take in
  // the play style. Leaving the view lets it go.
  const [homeFor, setHomeFor] = useState<Progression | null>(null);
  if (homeFor && view !== "progressions") setHomeFor(null);
  const writeProgression = (progression: Progression, home: number) => {
    setHomeFor(null);
    setTake(progressionTake(progression, home, transport.timing, playStyle));
    setView("roll");
    feedback.showNotice(`Loaded ${progression.name} as the take`);
  };

  const pressKey = (root: number, chordToPlay = activeChord) => {
    if (held.current.has(root)) return;
    leaveRevert();
    deviceEngine.unlock();
    if (transport.tapMode) transport.tapNote();
    const intervals =
      chordToPlay === null ? [0] : padChords[chordToPlay].intervals;
    const semitones = intervals.map((interval) => root + interval);
    const midis = semitones.map((semitone) => F3_MIDI + semitone + 12 * octave);
    if (homeFor) writeProgression(homeFor, F3_MIDI + root + 12 * octave);
    // A chord plays in the play style; the drum grid takes it as a block.
    const stop = playChord(
      midis,
      chordToPlay === null || view === "drumGrid"
        ? DEFAULT_PLAY_STYLE
        : playStyle,
      () => liveTiming.current,
      {
        on: (midi, velocity) => {
          deviceEngine.noteOn(midi, velocity);
          transport.capture(deviceEngine.takeNote(midi), true, velocity);
        },
        off: (midi) => {
          deviceEngine.noteOff(midi);
          transport.capture(deviceEngine.takeNote(midi), false);
        },
      },
      KEY_VELOCITY,
    );
    held.current.set(root, { semitones, midis, stop });
    syncLitNotes();
    notesPlayed.emit(midis);
  };

  return {
    litNotes,
    chord,
    activeChord,
    padChords,
    playStyle,
    playStyles: styles,
    playStyleIndex,
    // The rate or strum moved off what the picked play style plays.
    playStyleEdited: styleEdited(playStyle, styles[playStyleIndex]),
    pressKey,
    homeFor,
    awaitHome: setHomeFor,
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
    pickPlayStyle: (index: number) => {
      const { style } = styles[Math.max(0, Math.min(index, styles.length - 1))];
      setPlayStyle({ ...style, saved: style.saved });
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
