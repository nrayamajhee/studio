import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { meterIndexOf } from "../components/home/deviceMath";
import { METERS } from "../components/home/noteRecorder";
import {
  openedSong,
  setSongTiming,
  type Song,
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

  // Each song keeps its tempo and time signature: opening one sets them, and
  // changing them is kept with the song open.
  const { bpm, meterIndex, setBpm, setMeter } = transport;
  const songTiming = useRef({ bpm, meter: meterIndex });
  useEffect(() => {
    const last = songTiming.current;
    if (last.bpm === bpm && last.meter === meterIndex) return;
    songTiming.current = { bpm, meter: meterIndex };
    setSongTiming(bpm, METERS[meterIndex]);
  }, [bpm, meterIndex]);
  const applySongTiming = (song: Song) => {
    setBpm(song.bpm);
    setMeter(meterIndexOf(song.meter));
  };
  const applyOpenedSong = useEffectEvent(() => {
    const opened = openedSong();
    if (opened) applySongTiming(opened);
  });
  useEffect(() => applyOpenedSong(), []);

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
    applySongTiming,
    rollPosition,
    setRollPosition,
    pause,
    // One thing plays at a time: the tracks or the sequencer starting pauses
    // the tape, which otherwise plays on in other views.
    pauseTape: () => {
      if (transport.state === "playing") pause();
    },
  };
}

export type TransportValue = ReturnType<typeof useTransportValue>;

const [TransportContext, useDeviceTransport] =
  createStrictContext<TransportValue>("TransportProvider");
export { useDeviceTransport };

// The tape deck: tempo, metronome, recording and playing the take, kept in
// step with the open song's timing.
export function TransportProvider({ children }: { children: ReactNode }) {
  return (
    <TransportContext value={useTransportValue()}>{children}</TransportContext>
  );
}
