import { useCallback, useEffect, useRef } from "react";
import { deviceEngine } from "./deviceEngine";
import type { PlayedNote } from "./noteRecorder";

type Scrubber = NonNullable<ReturnType<typeof deviceEngine.scrubber>>;

// Moves this far apart (ms) are separate drags: the speed is taken over at
// most this long, so a single knob detent plays its stretch audibly.
const GAP_MS = 250;

// Scrubbing the stopped roll plays the take at the drag's speed (see
// Scrubber). The take is rendered once, with the current sound, the first
// time it is scrubbed after `key` (the take and everything that shapes its
// sound) changes; moves while it renders are silent.
export function useScrub(
  key: string,
  getTake: () => { notes: readonly PlayedNote[]; length: number },
) {
  const rendered = useRef<{ key: string; scrubber: Scrubber | null } | null>(
    null,
  );
  const lastMove = useRef(0);
  // Where the last scroll left the take (ms), ahead of the render it
  // schedules, so quick wheel moves add up. Older than a drag's gap, the
  // roll's own position wins.
  const cursor = useRef(0);

  useEffect(
    () => () => {
      rendered.current?.scrubber?.stop();
    },
    [],
  );

  // The drag moved the take from `from` to `to` (ms).
  const play = (from: number, to: number) => {
    if (rendered.current?.key !== key) {
      rendered.current?.scrubber?.stop();
      const entry: { key: string; scrubber: Scrubber | null } = {
        key,
        scrubber: null,
      };
      rendered.current = entry;
      deviceEngine.unlock();
      const { notes, length } = getTake();
      void deviceEngine.render(notes, length).then((buffer) => {
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

  // Scrolls to `to` from where the roll is (`at`, unless a scroll is still
  // landing).
  const scrollTo = (to: number, at: number) => {
    const start = from(at);
    cursor.current = to;
    play(start, to);
  };

  // Scrolls by `ms` within [low, high]; returns where it lands.
  const scrollBy = (ms: number, at: number, low: number, high: number) => {
    const to = Math.min(high, Math.max(low, from(at) + ms));
    scrollTo(to, at);
    return to;
  };

  return { scrollTo, scrollBy, stop };
}
