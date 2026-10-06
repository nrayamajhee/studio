import { useEffect, useState, type ReactNode } from "react";
import { deviceEngine } from "../components/home/deviceEngine";
import { F3_MIDI } from "../components/home/deviceMath";
import {
  ROLL_LANES,
  ROLL_LOW,
  ROLL_TOP,
  rollNote,
} from "../components/home/NoteRoll";
import { barMs, beatMs } from "../components/home/noteRecorder";
import { useScrub } from "../hooks/useScrub";
import { createStrictContext } from "./createStrictContext";
import { useLanes } from "./LanesProvider";
import { useMix } from "./MixProvider";
import { useOutput } from "./OutputProvider";
import { useSound } from "./SoundProvider";
import { useDeviceTransport } from "./TransportProvider";
import { useView } from "./ViewProvider";

const clampRollLow = (low: number) =>
  Math.min(ROLL_TOP, Math.max(ROLL_LOW, low));

function useTapeValue() {
  const { view, setView } = useView();
  const transport = useDeviceTransport();
  const { octave, preset, values } = useSound();
  const { levelStep } = useOutput();
  const { take, modulesKey } = useLanes();
  const { follow } = useMix();
  const { timing, rollPosition, setRollPosition } = transport;

  // The roll's lowest note in view, once scrolled; until then it follows the
  // keys, from just below their lowest.
  const [scrolledLow, setScrolledLow] = useState<number | null>(null);
  const rollLow = clampRollLow(scrolledLow ?? F3_MIDI - 1 + 12 * octave);
  const rollOctave = Math.floor((rollLow - ROLL_LOW) / 12);

  // Record arms a take on the roll and Play starts it, like a tape deck. It
  // stays armed only while the roll is showing.
  const [armed, setArmed] = useState(false);
  const [armedView, setArmedView] = useState(view);
  if (view !== armedView) {
    setArmedView(view);
    if (view !== "roll") setArmed(false);
  }
  const recordArmed = armed && view === "roll";

  // Stopped, the roll shows the whole take and scrolls by beats from its
  // start to its end. The keys line is the playhead: what crosses it plays.
  const beatLength = beatMs(timing);
  const rollEnd = transport.takeLength;
  const rollScrolls =
    view === "roll" && transport.state === "stopped" && rollEnd > 0;
  const rollAt = Math.min(rollEnd, rollPosition ?? 0);
  const barOf = (ms: number) => Math.max(1, Math.ceil(ms / barMs(timing)));

  // Scrolling scrubs the take: it plays at the speed it is scrolled.
  const scrub = useScrub(
    [
      transport.takeId,
      JSON.stringify(take),
      JSON.stringify(timing),
      preset.id,
      JSON.stringify(values),
      modulesKey,
      levelStep,
    ].join("|"),
    () => {
      const { now, notes } = transport.roll();
      return { notes, length: now };
    },
  );
  const stopScrub = scrub.stop;
  useEffect(() => {
    if (!rollScrolls) stopScrub();
  }, [rollScrolls, stopScrub]);

  // Starts the armed take. The tracks play along from the top, lined up
  // with it.
  const startRecording = () => {
    setArmed(false);
    const origin = transport.record();
    if (origin !== null) follow(origin);
  };

  return {
    recordArmed,
    rollLow,
    rollRange: `${rollNote(rollLow)}–${rollNote(rollLow + ROLL_LANES - 1)}`,
    // The blue knob moves the roll an octave a detent, keeping its semitone.
    rollOctave,
    rollOctaves: Math.floor((ROLL_TOP - ROLL_LOW) / 12) + 1,
    setRollOctave: (step: number) =>
      setScrolledLow(clampRollLow(rollLow + 12 * (step - rollOctave))),
    scrollRollPitch: (semitones: number) =>
      setScrolledLow(clampRollLow(rollLow + semitones)),
    rollScrolls,
    rollAt,
    rollEnd,
    rollSteps: Math.max(2, Math.ceil(rollEnd / beatLength) + 1),
    rollStep: Math.round(rollAt / beatLength),
    barOf,
    scrollRoll: (ms: number) =>
      setRollPosition(scrub.scrollBy(ms, rollAt, 0, rollEnd)),
    scrubRollTo: (step: number) => {
      const to = Math.min(rollEnd, step * beatLength);
      scrub.scrollTo(to, rollAt);
      setRollPosition(to);
    },
    // Play and pause in one: plays the take from where the stopped roll is
    // scrolled to (from the top when it rests at the end), and pauses it
    // while it plays. Armed, it starts recording; while recording, it ends
    // the take.
    togglePlay: () => {
      if (transport.recording) {
        transport.stop();
        return;
      }
      if (recordArmed) {
        deviceEngine.unlock();
        startRecording();
        return;
      }
      if (transport.playing) {
        transport.pause();
        return;
      }
      deviceEngine.unlock();
      const from =
        rollPosition !== null && rollPosition < transport.takeLength
          ? rollPosition
          : 0;
      setRollPosition(null);
      transport.play(from);
    },
    // Stops playback, holding like pause; on the roll a second press scrolls
    // the take back to the top. While recording it ends the take, and while
    // armed it disarms.
    stop: () => {
      if (transport.recording) {
        transport.stop();
        return;
      }
      if (recordArmed) {
        setArmed(false);
        return;
      }
      if (view === "roll" && !transport.playing) {
        setRollPosition(null);
        return;
      }
      if (transport.playing) transport.pause();
    },
    // Arms a take, showing the roll, or disarms it; Play then starts it.
    // While recording it ends the take where it stops. Each recording
    // replaces the take from the top; the tracks are never touched.
    toggleRecord: () => {
      deviceEngine.unlock();
      if (transport.recording) {
        transport.stop();
        return;
      }
      if (recordArmed) {
        setArmed(false);
        return;
      }
      setView("roll");
      setArmed(true);
    },
  };
}

export type TapeValue = ReturnType<typeof useTapeValue>;

const [TapeContext, useTape] = createStrictContext<TapeValue>("TapeProvider");
export { useTape };

// The tape view's roll: arming a take, scrolling and scrubbing it in time,
// and where it shows in pitch.
export function TapeProvider({ children }: { children: ReactNode }) {
  return <TapeContext value={useTapeValue()}>{children}</TapeContext>;
}
