import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  deviceEngine,
  type DeviceSound,
} from "../components/home/deviceEngine";
import type { Take } from "../components/home/noteRecorder";

// Notes are sent this far ahead on the audio clock, topped up every TICK_MS
// as the drum sequencer's hits are, so stopping leaves nothing queued past
// it; the first waits LEAD for its notes to arrive.
const LOOKAHEAD = 0.12;
const TICK_MS = 25;
const LEAD = 0.05;

export type PreviewSound = Pick<DeviceSound, "target" | "octave">;

// A note struck (with its velocity) or let go (null), in seconds from the
// take's start.
type Cue = { at: number; note: number; velocity: number | null };

type Run = {
  timer: ReturnType<typeof setInterval>;
  sound: PreviewSound;
  cues: readonly Cue[];
  next: number;
  // Where on the take it starts (s), and where the take's top falls on the
  // audio clock.
  from: number;
  origin: number;
  // Notes struck and not yet let go: when on the audio clock, and how hard.
  sounding: { note: number; time: number; velocity: number }[];
};

// The take's notes from `from` (s): one already sounding there is struck
// again on it. A note let go and struck at the same moment is let go first,
// so it speaks again.
const cuesOf = ({ notes }: Take, from: number): Cue[] =>
  notes
    .flatMap(({ note, start, duration, velocity }) => {
      const end = (start + duration) / 1000;
      if (end <= from) return [];
      return [
        { at: Math.max(start / 1000, from), note, velocity },
        { at: end, note, velocity: null },
      ];
    })
    .sort(
      (a, b) =>
        a.at - b.at ||
        Number(b.velocity === null) - Number(a.velocity === null),
    );

// The hidden tape: plays a take once through on any instrument, on the audio
// clock, without touching the tape, the tracks or the instrument picked.
// Stopping says where it got to, so it can pick up there.
export function usePreviewTape() {
  const [playing, setPlaying] = useState(false);
  const run = useRef<Run | null>(null);

  const topUp = () => {
    const current = run.current;
    if (!current) return;
    const now = deviceEngine.now();
    // Until the engine runs, timed notes would all land at once: the take
    // waits for it.
    if (!deviceEngine.ready()) {
      current.origin = now + LEAD - current.from;
      return;
    }
    // After a stall (a hidden tab) carry on from now rather than catch up.
    const due = current.cues[current.next];
    if (due && current.origin + due.at < now)
      current.origin = now + LEAD - due.at;
    while (current.next < current.cues.length) {
      const { at, note, velocity } = current.cues[current.next];
      const time = current.origin + at;
      if (time >= now + LOOKAHEAD) return;
      deviceEngine.noteAt(current.sound, note, velocity, time);
      if (velocity !== null) current.sounding.push({ note, time, velocity });
      else {
        const held = current.sounding.findIndex((one) => one.note === note);
        if (held >= 0) current.sounding.splice(held, 1);
      }
      current.next++;
    }
    clearInterval(current.timer);
    run.current = null;
    setPlaying(false);
  };

  // Lets go of what it struck, returning where on the take it was (s), or
  // null if it wasn't playing. A note struck ahead of now is let go as it is
  // struck, after it in the engine's queue, so nothing is left held.
  const stop = () => {
    const current = run.current;
    if (!current) return null;
    run.current = null;
    clearInterval(current.timer);
    const now = deviceEngine.now();
    for (const { note, time } of current.sounding)
      deviceEngine.noteAt(current.sound, note, null, Math.max(time, now));
    setPlaying(false);
    return Math.max(current.from, now - current.origin);
  };

  // Carries on on another instrument: what is sounding is let go on the old
  // one and struck again on the new, from now (or as it is struck, if that
  // is still to come).
  const setSound = (sound: PreviewSound) => {
    const current = run.current;
    if (!current) return;
    const now = deviceEngine.now();
    for (const held of current.sounding) {
      held.time = Math.max(held.time, now);
      deviceEngine.noteAt(current.sound, held.note, null, held.time);
      deviceEngine.noteAt(sound, held.note, held.velocity, held.time);
    }
    current.sound = sound;
  };

  // Plays `take` on `sound` from `from` (s) to its end.
  const play = (take: Take, sound: PreviewSound, from = 0) => {
    stop();
    deviceEngine.unlock();
    run.current = {
      timer: setInterval(topUp, TICK_MS),
      sound,
      cues: cuesOf(take, from),
      next: 0,
      from,
      origin: deviceEngine.now() + LEAD - from,
      sounding: [],
    };
    setPlaying(true);
    topUp();
  };

  const stopOnUnmount = useEffectEvent(stop);
  useEffect(
    () => () => {
      stopOnUnmount();
    },
    [],
  );

  return { playing, play, stop, setSound };
}
