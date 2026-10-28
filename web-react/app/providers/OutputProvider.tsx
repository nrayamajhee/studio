import { useEffect, useState, type ReactNode } from "react";
import { KNOB_STEPS, deviceEngine } from "../components/home/deviceEngine";
import { createStrictContext } from "./createStrictContext";
import { useFeedback } from "./FeedbackProvider";

// The system volume starts full, and the synth's level where the volume used
// to be, so the Device sounds as it did.
export const INITIAL_VOLUME_STEP = 10;
export const INITIAL_LEVEL_STEP = 8;

const amount = (step: number) => step / (KNOB_STEPS - 1);

function useOutputValue() {
  const { showOverlay } = useFeedback();
  const [volumeStep, setVolumeStep] = useState(INITIAL_VOLUME_STEP);
  const [levelStep, setLevelStep] = useState(INITIAL_LEVEL_STEP);

  useEffect(() => {
    deviceEngine.setVolume(amount(INITIAL_VOLUME_STEP));
    deviceEngine.setLevel(amount(INITIAL_LEVEL_STEP));
  }, []);

  const showLevel = (label: string, step: number) =>
    showOverlay({ label, value: amount(step), display: `${step * 10}%` });

  return {
    volumeStep,
    levelStep,
    setVolume: (step: number) => {
      setVolumeStep(step);
      deviceEngine.setVolume(amount(step));
      showLevel("Volume", step);
    },
    // The synth's level before the clipper.
    setLevel: (step: number) => {
      setLevelStep(step);
      deviceEngine.setLevel(amount(step));
      showLevel("Level", step);
    },
    resetLevels: () => {
      setLevelStep(INITIAL_LEVEL_STEP);
      deviceEngine.setLevel(amount(INITIAL_LEVEL_STEP));
      setVolumeStep(INITIAL_VOLUME_STEP);
      deviceEngine.setVolume(amount(INITIAL_VOLUME_STEP));
    },
  };
}

export type OutputValue = ReturnType<typeof useOutputValue>;

const [OutputContext, useOutput] =
  createStrictContext<OutputValue>("OutputProvider");
export { useOutput };

// The system volume (the white knob) and the synth's level (the red one).
export function OutputProvider({ children }: { children: ReactNode }) {
  return <OutputContext value={useOutputValue()}>{children}</OutputContext>;
}
