import { useEffect, useRef, useState } from "react";

// A value that shows for `ms` after the last show(), e.g. a footer notice or
// the level overlay while a knob turns.
export function useMomentary<T>(ms: number) {
  const [value, setValue] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const show = (next: T) => {
    clearTimeout(timer.current);
    setValue(next);
    timer.current = setTimeout(() => setValue(null), ms);
  };

  const hide = () => {
    clearTimeout(timer.current);
    setValue(null);
  };

  return [value, show, hide] as const;
}
