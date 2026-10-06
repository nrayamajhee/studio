import { useState, type ReactNode } from "react";
import { resolveBindings } from "../components/home/modes";
import type { Bindings } from "../types/bindings";
import type { Device } from "../types/device";
import { createStrictContext } from "./createStrictContext";
import { useFeedback } from "./FeedbackProvider";
import { useLanes } from "./LanesProvider";
import { useMix } from "./MixProvider";
import { useOutput } from "./OutputProvider";
import { usePerformance } from "./PerformanceProvider";
import { useShift } from "./ShiftProvider";
import { useSound } from "./SoundProvider";
import { useSteps } from "./StepsProvider";
import { useTape } from "./TapeProvider";
import { useTracks } from "./TracksProvider";
import { useDeviceTransport } from "./TransportProvider";
import { useView } from "./ViewProvider";

function useModeValue(): Bindings {
  const views = useView();
  const latch = useShift();
  const [iconIndex, setIconIndex] = useState(0);
  const [presetIndex, setPresetIndex] = useState(0);
  const [chordIndex, setChordIndex] = useState(0);
  const [revertIndex, setRevertIndex] = useState(0);
  const [idleSeek, setIdleSeek] = useState(0);
  const device: Device = {
    view: views.view,
    shift: latch.shift,
    views,
    latch,
    feedback: useFeedback(),
    output: useOutput(),
    transport: useDeviceTransport(),
    sound: useSound(),
    performance: usePerformance(),
    lanes: useLanes(),
    steps: useSteps(),
    tracks: useTracks(),
    mix: useMix(),
    tape: useTape(),
    browse: {
      iconIndex,
      setIconIndex,
      presetIndex,
      setPresetIndex,
      chordIndex,
      setChordIndex,
      revertIndex,
      setRevertIndex,
      idleSeek,
      setIdleSeek,
    },
  };
  return resolveBindings(device);
}

const [ModeContext, useBindings] =
  createStrictContext<Bindings>("ModeProvider");
export { useBindings };

// What each knob, pad and the screen does in the current view (see
// components/home/modes).
export function ModeProvider({ children }: { children: ReactNode }) {
  return <ModeContext value={useModeValue()}>{children}</ModeContext>;
}
