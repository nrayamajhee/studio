import { useState, type ReactNode } from "react";
import { useDeviceHotkey } from "../hooks/useDeviceHotkey";
import { createStrictContext } from "./createStrictContext";
import { useHotkeys } from "./HotkeyProvider";

function useShiftValue() {
  const keys = useHotkeys();
  // Shift latches on a click; its hotkey holds it while down.
  const [latched, setLatched] = useState(false);

  // On a Shift a click latched, the key releases the latch instead of
  // holding it.
  useDeviceHotkey(({ control, down, ignore }) => {
    if (control.kind !== "shift" || !down || !latched) return;
    setLatched(false);
    ignore();
  });

  return {
    shift: latched || keys.shift,
    latched,
    toggleLatch: () => setLatched((on) => !on),
    release: () => setLatched(false),
  };
}

export type ShiftValue = ReturnType<typeof useShiftValue>;

const [ShiftContext, useShift] =
  createStrictContext<ShiftValue>("ShiftProvider");
export { useShift };

// Shift: held on its key, or latched by a click until it is used.
export function ShiftProvider({ children }: { children: ReactNode }) {
  return <ShiftContext value={useShiftValue()}>{children}</ShiftContext>;
}
