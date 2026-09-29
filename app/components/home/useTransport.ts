import { useEffect, useRef, useState } from "react";
import { synth } from "../../lib/synth";

export type TransportMode = "tape" | "sequencer";
export type TransportState = "stopped" | "playing" | "recording";

interface NoteEvent {
  at: number;
  note: string;
  on: boolean;
}

interface Take {
  events: NoteEvent[];
  length: number;
  loop: boolean;
}

interface Session {
  start: number;
  events: NoteEvent[];
  open: Set<string>;
}

export const TEMPO_BPM = 120;
const BEAT_MS = 60_000 / TEMPO_BPM;
const STEP_MS = BEAT_MS / 4;
const BAR_MS = BEAT_MS * 4;

function toSequence(events: NoteEvent[], elapsed: number): Take {
  const length = Math.max(1, Math.ceil(elapsed / BAR_MS)) * BAR_MS;
  const snap = (ms: number) => Math.round(ms / STEP_MS) * STEP_MS;
  const starts = new Map<string, number>();
  const sequence = events.map((event) => {
    if (event.on) {
      const at = snap(event.at) % length;
      starts.set(event.note, at);
      return { ...event, at };
    }
    const start = starts.get(event.note) ?? 0;
    return {
      ...event,
      at: Math.min(length, Math.max(start + STEP_MS, snap(event.at))),
    };
  });
  return {
    events: sequence.sort((a, b) => a.at - b.at),
    length,
    loop: true,
  };
}

export function useTransport() {
  const [state, setState] = useState<TransportState>("stopped");
  const [mode, setMode] = useState<TransportMode>("tape");
  const [metronome, setMetronome] = useState(false);
  const [take, setTake] = useState<Take | null>(null);
  const session = useRef<Session | null>(null);

  useEffect(() => {
    if (!metronome) return;
    let beat = 0;
    const tick = () => synth.playMetronomeTick(beat++ % 4 === 0);
    tick();
    const id = setInterval(tick, BEAT_MS);
    return () => clearInterval(id);
  }, [metronome, state]);

  useEffect(() => {
    if (state !== "playing" || !take) return;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const voices = new Set<string>();
    const after = (ms: number, callback: () => void) => {
      const id = setTimeout(() => {
        timers.delete(id);
        callback();
      }, ms);
      timers.add(id);
    };
    const run = () => {
      for (const { at, note, on } of take.events) {
        after(at, () => {
          const voice = `take-${note}`;
          if (on) {
            synth.playNote(note, undefined, undefined, 0.8, undefined, voice);
            voices.add(voice);
          } else {
            synth.stopNote(voice);
            voices.delete(voice);
          }
        });
      }
      after(take.length, take.loop ? run : () => setState("stopped"));
    };
    run();
    return () => {
      timers.forEach(clearTimeout);
      voices.forEach((voice) => synth.stopNote(voice));
    };
  }, [state, take]);

  const finishRecording = () => {
    const current = session.current;
    if (!current) return null;
    session.current = null;
    const elapsed = performance.now() - current.start;
    const events = [
      ...current.events,
      ...[...current.open].map((note) => ({ at: elapsed, note, on: false })),
    ];
    if (events.length === 0) return null;
    const recorded =
      mode === "sequencer"
        ? toSequence(events, elapsed)
        : { events, length: elapsed, loop: false };
    setTake(recorded);
    return recorded;
  };

  const record = () => {
    if (session.current) {
      finishRecording();
      setState("stopped");
      return;
    }
    session.current = { start: performance.now(), events: [], open: new Set() };
    setState("recording");
  };

  const play = () => {
    const recorded = finishRecording() ?? take;
    setState(recorded ? "playing" : "stopped");
  };

  const stop = () => {
    finishRecording();
    setState("stopped");
  };

  const capture = (note: string, on: boolean) => {
    const current = session.current;
    if (!current) return;
    current.events.push({ at: performance.now() - current.start, note, on });
    if (on) current.open.add(note);
    else current.open.delete(note);
  };

  return {
    state,
    mode,
    setMode,
    metronome,
    toggleMetronome: () => setMetronome((on) => !on),
    record,
    play,
    stop,
    capture,
  };
}
