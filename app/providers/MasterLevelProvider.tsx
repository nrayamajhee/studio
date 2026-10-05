import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { KNOB_STEPS, deviceEngine } from "../components/home/deviceEngine";
import { useFeedback } from "./FeedbackProvider";

// The system volume starts full, and the synth's level where the volume used
// to be, so the Device sounds as it did.
export const INITIAL_VOLUME_STEP = 10;
export const INITIAL_LEVEL_STEP = 8;

interface MasterLevelValue {
  volumeStep: number;
  levelStep: number;
  idleSeek: number;
  setVolume: (step: number) => void;
  setLevel: (step: number) => void;
  setVolumeStep: Dispatch<SetStateAction<number>>;
  setLevelStep: Dispatch<SetStateAction<number>>;
  setIdleSeek: Dispatch<SetStateAction<number>>;
}

const MasterLevelContext = createContext<MasterLevelValue | null>(null);

export function MasterLevelProvider({ children }: { children: ReactNode }) {
  const { showOverlay } = useFeedback();
  const [volumeStep, setVolumeStep] = useState(INITIAL_VOLUME_STEP);
  const [levelStep, setLevelStep] = useState(INITIAL_LEVEL_STEP);
  const [idleSeek, setIdleSeek] = useState(0);

  const setVolume = (step: number) => {
    setVolumeStep(step);
    deviceEngine.setVolume(step / (KNOB_STEPS - 1));
    showOverlay({
      label: "Volume",
      value: step / (KNOB_STEPS - 1),
      display: `${step * 10}%`,
    });
  };

  const setLevel = (step: number) => {
    setLevelStep(step);
    deviceEngine.setLevel(step / (KNOB_STEPS - 1));
    showOverlay({
      label: "Level",
      value: step / (KNOB_STEPS - 1),
      display: `${step * 10}%`,
    });
  };

  const value: MasterLevelValue = {
    volumeStep,
    levelStep,
    idleSeek,
    setVolume,
    setLevel,
    setVolumeStep,
    setLevelStep,
    setIdleSeek,
  };

  return (
    <MasterLevelContext.Provider value={value}>
      {children}
    </MasterLevelContext.Provider>
  );
}

export function useMasterLevel() {
  const context = useContext(MasterLevelContext);
  if (!context) throw new Error("Wrap the Device in a MasterLevelProvider");
  return context;
}
