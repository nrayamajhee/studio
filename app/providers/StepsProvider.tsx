import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DrumPieceId } from "../lib/physical";
import {
  deviceEngine,
  findPreset,
  isKit,
  keyPiece,
  type DevicePreset,
} from "../components/home/deviceEngine";
import { KEY_VELOCITY, meterIndexOf } from "../components/home/deviceMath";
import { setSteps, setTake } from "../components/home/sessionStore";
import {
  STEP_RESOLUTIONS,
  addHit,
  hitStep,
  hitsAt,
  kitRows,
  patternSteps,
  patternTake,
  takePattern,
  toggleHit,
} from "../components/home/stepPattern";
import { useStepPlayer } from "../hooks/useStepPlayer";
import { createStrictContext } from "./createStrictContext";
import { isTape, useLanes } from "./LanesProvider";
import { useNotePlayed } from "./PerformanceProvider";
import { useSound } from "./SoundProvider";
import { useDeviceTransport } from "./TransportProvider";
import { useView } from "./ViewProvider";

function useStepsValue() {
  const { view, setView } = useView();
  const transport = useDeviceTransport();
  const { stepKit, preset, presets, selectPreset } = useSound();
  const { stepPattern, focusedLane } = useLanes();
  const { meter } = transport.timing;
  const stepRows = stepKit ? kitRows(stepKit) : [];
  const stepCount = patternSteps(stepPattern, meter);
  const [stepCursor, setStepCursor] = useState(0);
  const stepHead = Math.min(stepCursor, stepCount - 1);
  const stepHeadRef = useRef(stepHead);
  useEffect(() => {
    stepHeadRef.current = stepHead;
  });
  const [stepRecording, setStepRecording] = useState(false);
  const stepPlayer = useStepPlayer(() => ({
    pattern: stepPattern,
    kit: stepKit ?? "drums",
    meter,
    bpm: transport.bpm,
  }));
  const getStepHead = () => stepPlayer.position() ?? stepHeadRef.current;
  const stepsRunning = view === "steps" && stepPlayer.running;
  const recordingSteps = stepsRunning && stepRecording;
  const stepHits = new Set(
    stepPattern.hits.flatMap((hit) => {
      const row = stepRows.indexOf(hit.piece);
      const at = hitStep(hit, stepPattern.perBeat);
      return row < 0 || at >= stepCount ? [] : [`${row}:${at}`];
    }),
  );

  // The drum pattern, drawn on the tape's row over the take: the tape's
  // other half.
  const patternClip = (() => {
    if (stepPattern.hits.length === 0) return undefined;
    const beat = 60_000 / transport.bpm;
    const drawn = patternTake(
      stepPattern,
      stepKit ?? "drums",
      meter,
      transport.bpm,
    );
    return {
      length: drawn.length / beat,
      offset: 0,
      repeats: 1,
      looped: false,
      notes: drawn.notes.map(({ note, start, duration }) => ({
        note,
        start: start / beat,
        length: duration / beat,
      })),
    };
  })();

  // The instrument the sequencer swapped for a drum kit, put back when it
  // closes, so the tape and keys don't stay on drums.
  const beforeSteps = useRef<DevicePreset | null>(null);
  const leaveSteps = useEffectEvent(() => {
    stepPlayer.stop();
    const before = beforeSteps.current;
    beforeSteps.current = null;
    if (before) selectPreset(before);
  });
  useEffect(() => {
    if (view !== "steps") leaveSteps();
  }, [view]);

  // A key in the sequencer: recording, it lands on the nearest step;
  // stopped, it sets or clears its piece at the head; playing, it only plays.
  const tapStep = (piece: DrumPieceId) => {
    if (recordingSteps) {
      const at = stepPlayer.nearest(piece);
      if (at !== null)
        setSteps((current) => addHit(current, piece, at, KEY_VELOCITY));
      return;
    }
    if (!stepsRunning)
      setSteps((current) =>
        toggleHit(current, piece, stepHeadRef.current, KEY_VELOCITY),
      );
  };

  useNotePlayed((midis) => {
    if (view !== "steps" || !stepKit) return;
    for (const piece of new Set(midis.map((midi) => keyPiece(stepKit, midi))))
      tapStep(piece);
  });

  // Moving the stopped head sounds the step it lands on, like scrubbing.
  const moveStepHead = (to: number) => {
    const at = Math.max(0, Math.min(stepCount - 1, to));
    if (at === stepHeadRef.current) return;
    stepHeadRef.current = at;
    setStepCursor(at);
    if (!stepKit || stepsRunning) return;
    deviceEngine.unlock();
    for (const hit of hitsAt(stepPattern, at))
      deviceEngine.hit(stepKit, hit.piece, hit.velocity);
  };

  // Stopping leaves the head where the loop got to.
  const stopSteps = () => {
    const at = stepPlayer.position();
    stepPlayer.stop();
    setStepRecording(false);
    if (at !== null) setStepCursor(at);
  };

  return {
    stepRows,
    stepCount,
    stepsPerBar: meter.beats * stepPattern.perBeat,
    stepHead,
    stepHits,
    getStepHead,
    stepsRunning,
    recordingSteps,
    patternClip,
    moveStepHead,
    moveStepHeadBy: (steps: number) =>
      moveStepHead(stepHeadRef.current + steps),
    stopSteps,
    playSteps: (recording: boolean) => {
      setStepRecording(recording);
      if (stepPlayer.running) return;
      transport.pauseTape();
      stepPlayer.start(stepHeadRef.current);
    },
    // Clicking a cell sets or clears it, sounding a hit it sets.
    toggleStep: (row: number, at: number) => {
      const piece = stepRows[row];
      if (!piece || !stepKit) return;
      if (!stepHits.has(`${row}:${at}`)) {
        deviceEngine.unlock();
        deviceEngine.hit(stepKit, piece, KEY_VELOCITY);
      }
      setSteps((current) => toggleHit(current, piece, at, KEY_VELOCITY));
    },
    // A new resolution keeps the head on the same beat.
    setStepResolution: (index: number) => {
      const perBeat = STEP_RESOLUTIONS[index];
      const beat = stepHeadRef.current / stepPattern.perBeat;
      setSteps((current) => ({ ...current, perBeat }));
      setStepCursor(Math.round(beat * perBeat));
    },
    setStepBars: (bars: number) =>
      setSteps((current) => ({ ...current, bars })),
    clearSteps: () => setSteps((current) => ({ ...current, hits: [] })),
    // Opens the sequencer on a kit: the one playing, or the drum kit. With a
    // drum track picked it loads the track, kit, grid and time signature, and
    // saving the pattern then updates the track.
    toggleSteps: () => {
      if (view === "steps") {
        setView("scope");
        return;
      }
      const loading =
        !isTape(focusedLane) && isKit(focusedLane.sound.target)
          ? focusedLane
          : null;
      const kit = loading
        ? presets.find(({ id }) => id === loading.presetId)
        : stepKit
          ? null
          : findPreset("drums");
      if (kit && kit.id !== preset.id) {
        if (!stepKit) beforeSteps.current = preset;
        selectPreset(kit);
      }
      // The tape holds just the track: its take is cleared too.
      if (loading && isKit(loading.sound.target)) {
        setSteps(
          takePattern(loading.take, loading.sound.target, loading.timing),
        );
        setTake(null);
        transport.setMeter(meterIndexOf(loading.timing.meter));
        setStepCursor(0);
      }
      setView("steps");
    },
  };
}

export type StepsValue = ReturnType<typeof useStepsValue>;

const [StepsContext, useSteps] =
  createStrictContext<StepsValue>("StepsProvider");
export { useSteps };

// The drum sequencer (Shift + Tape): the kit playing, a row a piece, on the
// tempo's meter. Stopped, keys set or clear their piece at the head (the
// green knob); Play loops the pattern, and Record loops it and lands each
// tap on the nearest step.
export function StepsProvider({ children }: { children: ReactNode }) {
  return <StepsContext value={useStepsValue()}>{children}</StepsContext>;
}
