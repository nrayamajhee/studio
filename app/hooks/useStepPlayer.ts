import { useCallback, useEffect, useRef, useState } from "react";
import type { KitId } from "../lib/physical";
import { deviceEngine } from "../components/home/deviceEngine";
import type { Meter } from "../components/home/noteRecorder";
import {
  hitsAt,
  patternSteps,
  type StepPattern,
} from "../components/home/stepPattern";

// Hits are scheduled this far ahead on the audio clock, topped up every
// TICK_MS, so a busy page never makes them late; the first step waits LEAD
// for its hits to arrive.
const LOOKAHEAD = 0.12;
const TICK_MS = 25;
const LEAD = 0.05;

export interface StepSource {
  pattern: StepPattern;
  kit: KitId;
  meter: Meter;
  bpm: number;
}

interface Scheduled {
  // The pattern's step, and its count since the loop started.
  step: number;
  count: number;
  time: number;
}

interface Run {
  timer: ReturnType<typeof setInterval>;
  next: number;
  nextTime: number;
  recent: Scheduled[];
  // Hits a tap already played, so the loop skips them once: `piece@count`.
  played: Set<string>;
}

// Plays the drum sequencer's pattern round in a loop, each hit on the audio
// clock. `source` is read on every top-up, so edits, the tempo and the length
// take effect on the steps not yet scheduled.
export function useStepPlayer(source: () => StepSource) {
  const [running, setRunning] = useState(false);
  const run = useRef<Run | null>(null);
  const read = useRef(source);
  useEffect(() => {
    read.current = source;
  });

  const topUp = useCallback(() => {
    const current = run.current;
    if (!current) return;
    const { pattern, kit, meter, bpm } = read.current();
    const steps = patternSteps(pattern, meter);
    const stepTime = 60 / bpm / pattern.perBeat;
    const now = deviceEngine.now();
    // After a stall (a hidden tab) carry on from now rather than catch up.
    if (current.nextTime < now) current.nextTime = now + LEAD;
    while (current.nextTime < now + LOOKAHEAD) {
      const step = current.next % steps;
      for (const hit of hitsAt(pattern, step)) {
        if (current.played.delete(`${hit.piece}@${current.next}`)) continue;
        deviceEngine.hit(kit, hit.piece, hit.velocity, current.nextTime);
      }
      current.recent.push({
        step,
        count: current.next,
        time: current.nextTime,
      });
      current.next++;
      current.nextTime += stepTime;
    }
    current.recent = current.recent.filter(({ time }) => time > now - 1);
  }, []);

  const stop = useCallback(() => {
    if (run.current) clearInterval(run.current.timer);
    run.current = null;
    setRunning(false);
  }, []);

  // Starts the loop at `step`.
  const start = useCallback(
    (step: number) => {
      stop();
      deviceEngine.unlock();
      run.current = {
        timer: setInterval(topUp, TICK_MS),
        next: step,
        nextTime: deviceEngine.now() + LEAD,
        recent: [],
        played: new Set(),
      };
      setRunning(true);
      topUp();
    },
    [stop, topUp],
  );

  useEffect(() => stop, [stop]);

  // The step being heard now, or null while stopped.
  const position = useCallback(() => {
    const current = run.current;
    if (!current) return null;
    const heard = deviceEngine.now() - deviceEngine.latency();
    let at: Scheduled | undefined;
    for (const scheduled of current.recent)
      if (scheduled.time <= heard) at = scheduled;
    return at?.step ?? current.recent[0]?.step ?? null;
  }, []);

  // The step nearest a tap made now, as heard: a tap a little early lands on
  // the coming step, which then doesn't play it again.
  const nearest = (piece: string) => {
    const current = run.current;
    if (!current) return null;
    const { pattern, meter } = read.current();
    const tapped = deviceEngine.now() - deviceEngine.latency();
    const candidates = [
      ...current.recent,
      {
        step: current.next % patternSteps(pattern, meter),
        count: current.next,
        time: current.nextTime,
      },
    ];
    let best = candidates[0];
    for (const candidate of candidates)
      if (Math.abs(candidate.time - tapped) < Math.abs(best.time - tapped))
        best = candidate;
    if (best.count >= current.next)
      current.played.add(`${piece}@${best.count}`);
    return best.step;
  };

  return { running, start, stop, position, nearest };
}
