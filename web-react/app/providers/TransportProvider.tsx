import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { meterIndexOf } from "../components/home/deviceMath";
import { METERS } from "../components/home/noteRecorder";
import { STRAIGHT } from "../components/home/swing";
import {
  openedTape,
  setTapeTiming,
  type Tape,
} from "../components/home/sessionStore";
import { useTransport } from "../hooks/useTransport";
import { createStrictContext } from "./createStrictContext";
import { useView } from "./ViewProvider";

function useTransportValue() {
  const transport = useTransport();
  const { view } = useView();
  // Where the stopped roll is scrolled to (the time on its keys line); null
  // is the start of the take.
  const [rollPosition, setRollPosition] = useState<number | null>(null);

  // Each tape keeps its tempo, time signature and swing: opening one sets
  // them, and changing them is kept with the tape open.
  const { bpm, meterIndex, swing, setBpm, setMeter, setSwing } = transport;
  const tapeTiming = useRef({ bpm, meter: meterIndex, swing });
  useEffect(() => {
    const last = tapeTiming.current;
    if (last.bpm === bpm && last.meter === meterIndex && last.swing === swing)
      return;
    tapeTiming.current = { bpm, meter: meterIndex, swing };
    setTapeTiming(bpm, METERS[meterIndex], swing);
  }, [bpm, meterIndex, swing]);
  const applyTapeTiming = (tape: Tape) => {
    setBpm(tape.bpm);
    setMeter(meterIndexOf(tape.meter));
    setSwing(tape.swing ?? STRAIGHT);
  };
  const applyOpenedTape = useEffectEvent(() => {
    const opened = openedTape();
    if (opened) applyTapeTiming(opened);
  });
  useEffect(() => applyOpenedTape(), []);

  // Holds the take where it is, so Play resumes there.
  const pause = () => {
    setRollPosition(transport.roll().now);
    transport.stop();
  };

  return {
    ...transport,
    recording: transport.state === "recording",
    playing: transport.state === "playing",
    barBeats: transport.timing.meter.beats,
    tapMode: transport.tapping && view === "tempo",
    applyTapeTiming,
    rollPosition,
    setRollPosition,
    pause,
    // One thing plays at a time: the tracks or the drum grid starting pauses
    // the take, which otherwise plays on in other views.
    pauseTake: () => {
      if (transport.state === "playing") pause();
    },
  };
}

export type TransportValue = ReturnType<typeof useTransportValue>;

const [TransportContext, useDeviceTransport] =
  createStrictContext<TransportValue>("TransportProvider");
export { useDeviceTransport };

// The tape deck: tempo, metronome, recording and playing the take, kept in
// step with the open tape's timing.
export function TransportProvider({ children }: { children: ReactNode }) {
  return (
    <TransportContext value={useTransportValue()}>{children}</TransportContext>
  );
}
