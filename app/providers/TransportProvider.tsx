import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  type ReactNode,
} from "react";
import { METERS } from "../components/home/noteRecorder";
import {
  openedSong,
  setSongTiming,
  type Song,
} from "../components/home/sessionStore";
import { useTransport } from "../hooks/useTransport";

type Transport = ReturnType<typeof useTransport>;

interface TransportValue extends Transport {
  // Opens a song's tempo and time signature on the transport.
  applySongTiming: (next: Song) => void;
}

const TransportContext = createContext<TransportValue | null>(null);

export function TransportProvider({ children }: { children: ReactNode }) {
  const transport = useTransport();

  // Each song keeps its tempo and time signature: changing them is kept with
  // the song open.
  const songTiming = useRef({
    bpm: transport.bpm,
    meter: transport.meterIndex,
  });
  useEffect(() => {
    const { bpm, meterIndex } = transport;
    const last = songTiming.current;
    if (last.bpm === bpm && last.meter === meterIndex) return;
    songTiming.current = { bpm, meter: meterIndex };
    setSongTiming(bpm, METERS[meterIndex]);
  }, [transport]);

  const applySongTiming = (next: Song) => {
    transport.setBpm(next.bpm);
    transport.setMeter(
      Math.max(
        0,
        METERS.findIndex(
          ({ beats, unit }) =>
            beats === next.meter.beats && unit === next.meter.unit,
        ),
      ),
    );
  };

  const applyOpenedSong = useEffectEvent(() => {
    const opened = openedSong();
    if (opened) applySongTiming(opened);
  });
  useEffect(() => applyOpenedSong(), []);

  const value: TransportValue = { ...transport, applySongTiming };
  return (
    <TransportContext.Provider value={value}>
      {children}
    </TransportContext.Provider>
  );
}

export function useTransportContext() {
  const context = useContext(TransportContext);
  if (!context) throw new Error("Wrap the Device in a TransportProvider");
  return context;
}
