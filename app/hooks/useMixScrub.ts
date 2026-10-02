import { useCallback, useEffect, useRef } from "react";
import { deviceEngine } from "../components/home/deviceEngine";

type Scrubber = NonNullable<ReturnType<typeof deviceEngine.scrubber>>;

// Moves this far apart (ms) are separate drags: the speed is taken over at
// most this long, so a single knob detent plays its stretch audibly.
const GAP_MS = 250;

// Scrubbing the tracks plays the whole mix like a take: it is rendered once,
// with the sound each track was saved with, the first time it is scrubbed
// after `key` changes, then played at the drag's speed (see Scrubber).
export function useMixScrub(
  key: string,
  getMix: () => Promise<AudioBuffer | null>,
) {
  const rendered = useRef<{ key: string; scrubber: Scrubber | null } | null>(
    null,
  );
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
    if (rendered.current?.key !== key) {
      rendered.current?.scrubber?.stop();
      const entry: { key: string; scrubber: Scrubber | null } = {
        key,
        scrubber: null,
      };
      rendered.current = entry;
      deviceEngine.unlock();
      void getMix().then((buffer) => {
        if (buffer && rendered.current === entry)
          entry.scrubber = deviceEngine.scrubber(buffer);
      });
    }
    const now = performance.now();
    const elapsed = Math.min(GAP_MS, now - lastMove.current);
    lastMove.current = now;
    rendered.current.scrubber?.move(
      from / 1000,
      to / 1000,
      (to - from) / elapsed,
    );
  };

  const stop = useCallback(() => rendered.current?.scrubber?.stop(), []);

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
