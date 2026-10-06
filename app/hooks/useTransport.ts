import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { deviceEngine } from "../components/home/deviceEngine";
import { setTake, useSession } from "../components/home/sessionStore";
import {
  DEFAULT_TIMING,
  MAX_TAKE_MS,
  METERS,
  NoteRecorder,
  SUBDIVISIONS,
  beatMs,
  timeline,
  type PlayedNote,
  type Take,
  type Timing,
} from "../components/home/noteRecorder";

export type TransportState = "stopped" | "playing" | "recording";

// What the screen's piano roll draws: the notes on the take's timeline, where
// `now` is on it, and what the transport is doing.
export type RollFrame = {
  now: number;
  notes: readonly PlayedNote[];
  state: TransportState;
};

// The roll's source, kept in a ref so it can be read every animation frame:
// the recording, the playback, or (idle) the whole take. A sequence's playback
// holds its last and next loops too, shifted by a loop, so notes keep
// scrolling across the seam.
type Display =
  | { kind: "recording"; recorder: NoteRecorder }
  | { kind: "playing"; start: number; notes: readonly PlayedNote[] }
  | { kind: "idle" };

export const MIN_BPM = 40;
export const MAX_BPM = 240;
const DEFAULT_METER = METERS.indexOf(DEFAULT_TIMING.meter);
const DEFAULT_GRID = SUBDIVISIONS.indexOf(DEFAULT_TIMING.perBeat);
// Tap tempo is first set this long after the first tap, then follows each
// tap until the window closes and tap mode ends.
const TAP_SET_MS = 1000;
const TAP_WINDOW_MS = 4000;
// The tempo follows the latest gaps, so changing pace mid-window moves it.
const TAPS_AVERAGED = 4;
// Notes starting this close together (a chord) are one tap.
const CHORD_MS = 40;

export const clampBpm = (bpm: number) =>
  Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));

// The beat from the gaps between taps: the median gap, averaged with the gaps
// near it so one late tap doesn't skew it, folded by octaves into range.
// Null with fewer than two taps.
export function tempoFromTaps(taps: readonly number[]) {
  if (taps.length < 2) return null;
  const gaps = taps
    .slice(1)
    .map((at, i) => at - taps[i])
    .sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  const near = gaps.filter((gap) => Math.abs(gap - median) <= 0.25 * median);
  let bpm = 60_000 / (near.reduce((sum, gap) => sum + gap, 0) / near.length);
  while (bpm < MIN_BPM) bpm *= 2;
  while (bpm > MAX_BPM) bpm /= 2;
  return clampBpm(bpm);
}

export function useTransport() {
  const [state, setState] = useState<TransportState>("stopped");
  const [metronome, setMetronome] = useState(false);
  const [bpm, setBpmState] = useState(DEFAULT_TIMING.bpm);
  const [meterIndex, setMeterIndex] = useState(DEFAULT_METER);
  const [gridIndex, setGridIndex] = useState(DEFAULT_GRID);
  const timing: Timing = {
    bpm,
    meter: METERS[meterIndex],
    perBeat: SUBDIVISIONS[gridIndex],
  };
  // The beat in the bar the metronome last clicked.
  const [beat, setBeat] = useState(0);
  // The take outlives a reload (see sessionStore).
  const { take } = useSession();
  // Counts takes, so a rendered take can tell when it is stale.
  const [takeId, setTakeId] = useState(0);
  const takeRef = useRef(take);
  useEffect(() => {
    takeRef.current = take;
  }, [take]);
  const display = useRef<Display>({ kind: "idle" });
  // Where the next playback starts on the take (ms).
  const playFrom = useRef(0);
  const session = useRef<NoteRecorder | null>(null);
  // The timing the metronome, playback and roll read between renders.
  const timingRef = useRef(timing);
  const [tapping, setTapping] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const taps = useRef<number[]>([]);
  const tapTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const tapWindow = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(
    () => () => {
      clearTimeout(tapTimer.current);
      clearTimeout(tapWindow.current);
    },
    [],
  );

  // Each click schedules the next from the current tempo, so a tempo change
  // takes effect on the next beat without restarting the bar. The first beat
  // of each bar is accented.
  useEffect(() => {
    if (!metronome) return;
    let count = 0;
    let next = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const now = performance.now();
      const { beats } = timingRef.current.meter;
      deviceEngine.metronomeTick(count % beats === 0);
      setBeat(count % beats);
      count++;
      // After a stall (a hidden tab) carry on from now rather than catch up.
      next = Math.max(next, now) + beatMs(timingRef.current);
      timer = setTimeout(tick, next - performance.now());
    };
    timer = setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }, [metronome, state]);

  const setBpm = (next: number) => {
    const tempo = clampBpm(next);
    timingRef.current = { ...timingRef.current, bpm: tempo };
    setBpmState(tempo);
  };

  const setMeter = (index: number) => {
    timingRef.current = { ...timingRef.current, meter: METERS[index] };
    setMeterIndex(index);
  };

  const setGrid = (index: number) => {
    timingRef.current = { ...timingRef.current, perBeat: SUBDIVISIONS[index] };
    setGridIndex(index);
  };

  // Tap mode stops the metronome so its clicks don't pull the taps off.
  const startTapping = () => {
    stopTapping();
    setMetronome(false);
    setTapping(true);
  };

  const stopTapping = () => {
    clearTimeout(tapTimer.current);
    clearTimeout(tapWindow.current);
    taps.current = [];
    setTapCount(0);
    setTapping(false);
  };

  const applyTaps = () => {
    const tempo = tempoFromTaps(taps.current.slice(-(TAPS_AVERAGED + 1)));
    if (tempo !== null) setBpm(tempo);
  };

  // A played note in tap mode. A second after the first tap the taps so far
  // set the tempo, and each tap after that resets it, until four seconds after
  // the first, when tap mode ends.
  const tapNote = () => {
    if (!tapping) return;
    const now = performance.now();
    const first = taps.current[0];
    const last = taps.current.at(-1);
    if (last !== undefined && now - last < CHORD_MS) return;
    taps.current.push(now);
    setTapCount(taps.current.length);
    if (first === undefined) {
      tapTimer.current = setTimeout(applyTaps, TAP_SET_MS);
      tapWindow.current = setTimeout(() => {
        applyTaps();
        stopTapping();
      }, TAP_WINDOW_MS);
    } else if (now - first >= TAP_SET_MS) {
      applyTaps();
    }
  };

  useEffect(() => {
    if (state !== "playing" || !take) return;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const voices = new Map<number, number>();
    const after = (ms: number, callback: () => void) => {
      const id = setTimeout(() => {
        timers.delete(id);
        callback();
      }, ms);
      timers.add(id);
    };
    const sound = (
      note: number,
      velocity: number,
      start: number,
      duration: number,
    ) => {
      after(start, () => {
        deviceEngine.noteOn(note, velocity);
        voices.set(note, (voices.get(note) ?? 0) + 1);
      });
      after(start + duration, () => {
        const count = voices.get(note) ?? 0;
        if (count === 0) return;
        deviceEngine.noteOff(note);
        voices.set(note, count - 1);
      });
    };
    let previous: readonly PlayedNote[] = [];
    // The first pass starts where Play was pressed; loops start from the top.
    let from = playFrom.current;
    const run = () => {
      const startedAt = performance.now();
      const { length: span, notes } = timeline(take, timingRef.current);
      const loops = timingRef.current.perBeat > 0;
      const offset = Math.min(from, span);
      from = 0;
      for (const { note, velocity, start, duration } of notes) {
        const end = start + duration;
        if (end <= offset) continue;
        // A note already sounding at the start point picks up from there.
        const at = Math.max(start, offset);
        sound(note, velocity, at - offset, end - at);
      }
      display.current = {
        kind: "playing",
        start: startedAt - offset,
        notes: [
          ...previous,
          ...notes,
          ...(loops
            ? notes.map((note) => ({ ...note, start: note.start + span }))
            : []),
        ],
      };
      if (!loops) {
        after(span - offset, () => setState("stopped"));
        return;
      }
      previous = notes.map((note) => ({ ...note, start: note.start - span }));
      after(span - offset, run);
    };
    run();
    return () => {
      if (display.current.kind === "playing")
        display.current = { kind: "idle" };
      timers.forEach(clearTimeout);
      voices.forEach((count, midi) => {
        for (let i = 0; i < count; i++) deviceEngine.noteOff(midi);
      });
    };
  }, [state, take]);

  const finishRecording = () => {
    const recorder = session.current;
    if (!recorder) return null;
    session.current = null;
    // A take ends at the hour, even if the timer that ends it fires late.
    const now = Math.min(performance.now(), recorder.origin + MAX_TAKE_MS);
    const length = now - recorder.origin;
    const notes = recorder.take(now).filter(({ start }) => start < length);
    display.current = { kind: "idle" };
    if (notes.length === 0) return null;
    const recorded: Take = { notes, length, bpm };
    takeRef.current = recorded;
    setTake(recorded);
    setTakeId((id) => id + 1);
    return recorded;
  };

  // Starts a take, returning when it starts (performance.now ms), or ends one.
  const record = () => {
    if (session.current) {
      finishRecording();
      setState("stopped");
      return null;
    }
    session.current = new NoteRecorder();
    display.current = { kind: "recording", recorder: session.current };
    setState("recording");
    return session.current.origin;
  };

  // Plays the take from `from` (ms). While recording, the new take is thrown
  // away and the one before it plays.
  const play = (from = 0) => {
    if (session.current) {
      session.current = null;
      display.current = { kind: "idle" };
    }
    playFrom.current = Math.max(0, from);
    setState(take ? "playing" : "stopped");
  };

  // The take to keep, ending a recording first.
  const keepTake = () => {
    if (!session.current) return takeRef.current;
    const recorded = finishRecording();
    setState("stopped");
    return recorded;
  };

  const stop = () => {
    finishRecording();
    setState("stopped");
  };

  // A take records for an hour at most, then ends itself.
  const endTake = useEffectEvent(stop);
  useEffect(() => {
    if (state !== "recording") return;
    const timer = setTimeout(endTake, MAX_TAKE_MS);
    return () => clearTimeout(timer);
  }, [state]);

  // A played note, while recording. Velocity is 0–1.
  const capture = (note: number, on: boolean, velocity = 0) => {
    const recorder = session.current;
    if (!recorder) return;
    if (on) recorder.noteOn(note, velocity);
    else recorder.noteOff(note);
  };

  // Stable, and reads only refs, for the roll's animation loop.
  const roll = useCallback((): RollFrame => {
    const shown = display.current;
    const now = performance.now();
    if (shown.kind === "recording")
      return {
        now: now - shown.recorder.origin,
        notes: shown.recorder.take(now),
        state: "recording",
      };
    if (shown.kind === "playing")
      return { now: now - shown.start, notes: shown.notes, state: "playing" };
    const { length, notes } = timeline(takeRef.current, timingRef.current);
    return { now: length, notes, state: "stopped" };
  }, []);

  return {
    state,
    hasTake: take !== null,
    takeId,
    takeLength: timeline(take, timing).length,
    roll,
    metronome,
    toggleMetronome: () => setMetronome((on) => !on),
    bpm,
    setBpm,
    timing,
    meterIndex,
    setMeter,
    gridIndex,
    setGrid,
    tapping,
    tapCount,
    startTapping,
    stopTapping,
    tapNote,
    // Only while the metronome runs.
    beat: metronome ? beat : null,
    record,
    keepTake,
    play,
    stop,
    capture,
  };
}
