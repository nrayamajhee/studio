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
import {
  setPattern,
  setTake,
  setTakeModules,
} from "../components/home/sessionStore";
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
} from "../components/home/drumPattern";
import { trackModules, trackSource } from "../components/home/tracks";
import { useStepPlayer } from "../hooks/useStepPlayer";
import { createStrictContext } from "./createStrictContext";
import { isTake, useLanes } from "./LanesProvider";
import { useNotePlayed } from "./PerformanceProvider";
import { useSound } from "./SoundProvider";
import { useDeviceTransport } from "./TransportProvider";
import { useView } from "./ViewProvider";

function useDrumGridValue() {
  const { view, setView, mainView } = useView();
  const transport = useDeviceTransport();
  const { stepKit, preset, presets, selectPreset } = useSound();
  const { drumPattern, focusedLane } = useLanes();
  const { meter } = transport.timing;
  const stepRows = stepKit ? kitRows(stepKit) : [];
  const stepCount = patternSteps(drumPattern, meter);
  const [stepCursor, setStepCursor] = useState(0);
  const stepHead = Math.min(stepCursor, stepCount - 1);
  const stepHeadRef = useRef(stepHead);
  useEffect(() => {
    stepHeadRef.current = stepHead;
  });
  const [stepRecording, setStepRecording] = useState(false);
  const stepPlayer = useStepPlayer(() => ({
    pattern: drumPattern,
    kit: stepKit ?? "drums",
    meter,
    bpm: transport.bpm,
  }));
  const getStepHead = () => stepPlayer.position() ?? stepHeadRef.current;
  // The pattern stays live while the drum grid is the main view, whatever
  // shows over it.
  const drumGridLive = mainView === "drumGrid";
  const patternRunning = drumGridLive && stepPlayer.running;
  const recordingPattern = patternRunning && stepRecording;
  const stepHits = new Set(
    drumPattern.hits.flatMap((hit) => {
      const row = stepRows.indexOf(hit.piece);
      const at = hitStep(hit, drumPattern.perBeat);
      return row < 0 || at >= stepCount ? [] : [`${row}:${at}`];
    }),
  );

  // The drum pattern, drawn on the take's row over its notes: the take's
  // other half.
  const patternClip = (() => {
    if (drumPattern.hits.length === 0) return undefined;
    const beat = 60_000 / transport.bpm;
    const drawn = patternTake(
      drumPattern,
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

  // The instrument the drum grid swapped for a drum kit, put back when it
  // closes, so the piano roll and keys don't stay on drums.
  const beforeDrumGrid = useRef<DevicePreset | null>(null);
  const leaveDrumGrid = useEffectEvent(() => {
    stepPlayer.stop();
    const before = beforeDrumGrid.current;
    beforeDrumGrid.current = null;
    if (before) selectPreset(before);
  });
  // Keys land in the pattern only in the drum grid.
  if (view !== "drumGrid" && stepRecording) setStepRecording(false);
  useEffect(() => {
    if (!drumGridLive) leaveDrumGrid();
  }, [drumGridLive]);

  // A key in the drum grid: recording, it lands on the nearest step;
  // stopped, it sets or clears its piece at the head; playing, it only plays.
  const tapStep = (piece: DrumPieceId) => {
    if (recordingPattern) {
      const at = stepPlayer.nearest(piece);
      if (at !== null)
        setPattern((current) => addHit(current, piece, at, KEY_VELOCITY));
      return;
    }
    if (!patternRunning)
      setPattern((current) =>
        toggleHit(current, piece, stepHeadRef.current, KEY_VELOCITY),
      );
  };

  useNotePlayed((midis) => {
    if (view !== "drumGrid" || !stepKit) return;
    for (const piece of new Set(midis.map((midi) => keyPiece(stepKit, midi))))
      tapStep(piece);
  });

  // Moving the stopped head sounds the step it lands on, like scrubbing.
  const moveStepHead = (to: number) => {
    const at = Math.max(0, Math.min(stepCount - 1, to));
    if (at === stepHeadRef.current) return;
    stepHeadRef.current = at;
    setStepCursor(at);
    if (!stepKit || patternRunning) return;
    deviceEngine.unlock();
    for (const hit of hitsAt(drumPattern, at))
      deviceEngine.hit(stepKit, hit.piece, hit.velocity);
  };

  // Stopping leaves the head where the loop got to.
  const stopPattern = () => {
    const at = stepPlayer.position();
    stepPlayer.stop();
    setStepRecording(false);
    if (at !== null) setStepCursor(at);
  };

  return {
    stepRows,
    stepCount,
    stepsPerBar: meter.beats * drumPattern.perBeat,
    stepHead,
    stepHits,
    getStepHead,
    patternRunning,
    recordingPattern,
    patternClip,
    moveStepHead,
    moveStepHeadBy: (steps: number) =>
      moveStepHead(stepHeadRef.current + steps),
    stopPattern,
    playPattern: (recording: boolean) => {
      setStepRecording(recording);
      if (stepPlayer.running) return;
      transport.pauseTake();
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
      setPattern((current) => toggleHit(current, piece, at, KEY_VELOCITY));
    },
    // A new resolution keeps the head on the same beat.
    setStepResolution: (index: number) => {
      const perBeat = STEP_RESOLUTIONS[index];
      const beat = stepHeadRef.current / drumPattern.perBeat;
      setPattern((current) => ({ ...current, perBeat }));
      setStepCursor(Math.round(beat * perBeat));
    },
    setStepBars: (bars: number) =>
      setPattern((current) => ({ ...current, bars })),
    clearPattern: () => setPattern((current) => ({ ...current, hits: [] })),
    // Opens the drum grid on a kit: the one playing, or the drum kit. With a
    // track it made picked it loads the track as the take: its pattern, kit,
    // ADSR, LFO and FX, grid and time signature.
    toggleDrumGrid: () => {
      if (view === "drumGrid") {
        setView("scope");
        return;
      }
      const loading =
        !isTake(focusedLane) &&
        trackSource(focusedLane) === "drumGrid" &&
        isKit(focusedLane.sound.target)
          ? focusedLane
          : null;
      const kit = loading
        ? presets.find(({ id }) => id === loading.presetId)
        : stepKit
          ? null
          : findPreset("drums");
      if (kit && kit.id !== preset.id) {
        if (!stepKit) beforeDrumGrid.current = preset;
        selectPreset(kit);
      }
      // The take holds just the track: its notes is cleared too.
      if (loading && isKit(loading.sound.target)) {
        setPattern(
          takePattern(loading.take, loading.sound.target, loading.timing),
        );
        setTake(null);
        setTakeModules(trackModules(loading));
        transport.setMeter(meterIndexOf(loading.timing.meter));
        setStepCursor(0);
      }
      setView("drumGrid");
    },
  };
}

export type DrumGridValue = ReturnType<typeof useDrumGridValue>;

const [DrumGridContext, useDrumGrid] =
  createStrictContext<DrumGridValue>("DrumGridProvider");
export { useDrumGrid };

// The drum grid: the kit playing, a row a piece, on the
// tempo's meter. Stopped, keys set or clear their piece at the head (the
// green knob); Play loops the pattern, and Record loops it and lands each
// tap on the nearest step.
export function DrumGridProvider({ children }: { children: ReactNode }) {
  return (
    <DrumGridContext value={useDrumGridValue()}>{children}</DrumGridContext>
  );
}
