import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DrumPieceId, KitId } from "../lib/physical";
import { deviceEngine, isKit } from "../components/home/deviceEngine";
import { KEY_VELOCITY } from "../components/home/input/keybed";
import {
  STEP_RESOLUTIONS,
  addHit,
  hitStep,
  hitsAt,
  kitRows,
  patternSteps,
  toggleHit,
} from "../components/home/stepPattern";
import { setSteps, useSession } from "../components/home/sessionStore";
import { useStepPlayer } from "../hooks/useStepPlayer";
import { useSound } from "./SoundProvider";
import { useTransportContext } from "./TransportProvider";
import { useView } from "./ViewProvider";

interface SequencerValue {
  stepKit: KitId | null;
  stepRows: readonly DrumPieceId[];
  stepCount: number;
  stepPerBeat: number;
  stepsPerBar: number;
  stepHead: number;
  stepHits: ReadonlySet<string>;
  stepsRunning: boolean;
  recordingSteps: boolean;
  stepRecording: boolean;
  stepPlayer: ReturnType<typeof useStepPlayer>;
  stepHeadRef: { current: number };
  getStepHead: () => number;
  setStepRecording: (recording: boolean) => void;
  setStepCursor: (at: number) => void;
  tapStep: (piece: DrumPieceId) => void;
  toggleStep: (row: number, at: number) => void;
  moveStepHead: (to: number) => void;
  setStepResolution: (index: number) => void;
  stopSteps: () => void;
}

const SequencerContext = createContext<SequencerValue | null>(null);

export function SequencerProvider({ children }: { children: ReactNode }) {
  const { view } = useView();
  const { preset } = useSound();
  const transport = useTransportContext();
  const { steps: stepPattern } = useSession();

  const stepKit = isKit(preset.target) ? preset.target : null;
  const stepRows = stepKit ? kitRows(stepKit) : [];
  const stepCount = patternSteps(stepPattern, transport.timing.meter);
  const stepsPerBar = transport.timing.meter.beats * stepPattern.perBeat;

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
    meter: transport.timing.meter,
    bpm: transport.bpm,
  }));
  const stepPosition = stepPlayer.position;
  const getStepHead = () => stepPosition() ?? stepHeadRef.current;
  const stepsRunning = view === "steps" && stepPlayer.running;
  const recordingSteps = stepsRunning && stepRecording;
  const stepHits = new Set(
    stepPattern.hits.flatMap((hit) => {
      const row = stepRows.indexOf(hit.piece);
      const at = hitStep(hit, stepPattern.perBeat);
      return row < 0 || at >= stepCount ? [] : [`${row}:${at}`];
    }),
  );

  // A key in the sequencer: recording, it lands on the nearest step; stopped,
  // it sets or clears its piece at the head; playing, it only plays.
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

  // Clicking a cell sets or clears it, sounding a hit it sets.
  const toggleStep = (row: number, at: number) => {
    const piece = stepRows[row];
    if (!piece || !stepKit) return;
    if (!stepHits.has(`${row}:${at}`)) {
      deviceEngine.unlock();
      deviceEngine.hit(stepKit, piece, KEY_VELOCITY);
    }
    setSteps((current) => toggleHit(current, piece, at, KEY_VELOCITY));
  };

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

  // A new resolution keeps the head on the same beat.
  const setStepResolution = (index: number) => {
    const perBeat = STEP_RESOLUTIONS[index];
    const beat = stepHeadRef.current / stepPattern.perBeat;
    setSteps((current) => ({ ...current, perBeat }));
    setStepCursor(Math.round(beat * perBeat));
  };

  // Stopping leaves the head where the loop got to.
  const stopSteps = () => {
    const at = stepPlayer.position();
    stepPlayer.stop();
    setStepRecording(false);
    if (at !== null) setStepCursor(at);
  };

  const value: SequencerValue = {
    stepKit,
    stepRows,
    stepCount,
    stepPerBeat: stepPattern.perBeat,
    stepsPerBar,
    stepHead,
    stepHits,
    stepsRunning,
    recordingSteps,
    stepRecording,
    stepPlayer,
    stepHeadRef,
    getStepHead,
    setStepRecording,
    setStepCursor,
    tapStep,
    toggleStep,
    moveStepHead,
    setStepResolution,
    stopSteps,
  };

  return (
    <SequencerContext.Provider value={value}>
      {children}
    </SequencerContext.Provider>
  );
}

export function useSequencer() {
  const context = useContext(SequencerContext);
  if (!context) throw new Error("Wrap the Device in a SequencerProvider");
  return context;
}
