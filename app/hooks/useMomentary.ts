import { useCallback, useEffect, useRef, useState } from "react";

// A value that shows for `ms` after the last show(), e.g. a footer notice or
// the level overlay while a knob turns.
export function useMomentary<T>(ms: number) {
  const [value, setValue] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const show = useCallback(
    (next: T) => {
      clearTimeout(timer.current);
      setValue(next);
      timer.current = setTimeout(() => setValue(null), ms);
    },
    [ms],
  );

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setValue(null);
  }, []);

  return [value, show, hide] as const;
}
