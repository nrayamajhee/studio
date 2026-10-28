import { useEffect, useRef } from "react";
import { deviceEngine } from "../components/home/deviceEngine";

type Scrubber = NonNullable<ReturnType<typeof deviceEngine.scrubber>>;

// Moves this far apart (ms) are separate drags: the speed is taken over at
// most this long, so a single knob detent plays its stretch audibly.
const GAP_MS = 250;
// How much of the mix (ms) either side of the scrub is built at a time.
const WINDOW_MS = 30_000;

type Window = {
  key: string;
  start: number;
  end: number;
  scrubber: Scrubber | null;
};

// Scrubbing the tracks plays the mix like a take, at the drag's speed (see
// Scrubber). Only a window of it either side of the scrub is built (by
// `getMix`, from `start` to `end` ms), so an hour-long timeline scrubs as
// lightly as a short one; scrubbing past the window, or changing `key`,
// builds the next.
export function useMixScrub(
  key: string,
  getMix: (start: number, end: number) => Promise<AudioBuffer | null>,
) {
  const rendered = useRef<Window | null>(null);
  const lastMove = useRef(0);
  // Where the last scroll left the mix (ms), ahead of the render it schedules,
  // so quick wheel moves add up.
  const cursor = useRef(0);

  useEffect(
    () => () => {
      rendered.current?.scrubber?.stop();
    },
    [],
  );

  // The drag moved the mix from `from` to `to` (ms).
  const play = (from: number, to: number) => {
    let window = rendered.current;
    if (!window || window.key !== key || to < window.start || to > window.end) {
      window?.scrubber?.stop();
      const entry: Window = {
        key,
        start: Math.max(0, to - WINDOW_MS),
        end: to + WINDOW_MS,
        scrubber: null,
      };
      window = entry;
      rendered.current = entry;
      deviceEngine.unlock();
      void getMix(entry.start, entry.end).then((buffer) => {
        if (buffer && rendered.current === entry)
          entry.scrubber = deviceEngine.scrubber(buffer);
      });
    }
    const now = performance.now();
    const elapsed = Math.min(GAP_MS, now - lastMove.current);
    lastMove.current = now;
    window.scrubber?.move(
      (from - window.start) / 1000,
      (to - window.start) / 1000,
      (to - from) / elapsed,
    );
  };

  const stop = () => rendered.current?.scrubber?.stop();

  const from = (at: number) =>
    performance.now() - lastMove.current < GAP_MS ? cursor.current : at;

  // Scrolls to `to` (ms) from where the mix is (`at`, unless a scroll is still
  // landing).
  const scrollTo = (to: number, at: number) => {
    const start = from(at);
    cursor.current = to;
    play(start, to);
  };

  return { scrollTo, stop };
}
