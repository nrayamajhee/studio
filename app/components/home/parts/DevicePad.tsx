import { useControlPress } from "../../../hooks/useDeviceHotkey";
import { useFeedback } from "../../../providers/FeedbackProvider";
import {
  useCommandKey,
  useCommandLegend,
  useHotkeys,
} from "../../../providers/HotkeyProvider";
import { useShift } from "../../../providers/ShiftProvider";
import type { PadBinding } from "../../../types/bindings";
import { Pad } from "../../design-system";
import { hotkeyLabel, type Control } from "../input/keymap";

export type DevicePadProps = {
  // What the pad does in the current mode.
  binding: PadBinding;
  // The key that presses it, shown on its keycap and pressed in while held.
  control?: Control;
  // A ⌘ shortcut too (KeyboardEvent.code, and its keycap letter, shown when
  // the pad has no key of its own).
  command?: { code: string; legend: string };
  accent?: string;
  // Its key presses it, as a click does; off where the key does something
  // else (a chord key holds its chord).
  pressOnKey?: boolean;
  // Held down from outside, e.g. a latched Shift.
  held?: boolean;
};

// A pad on the Device: it does what its binding says, from a click, its
// hotkey or its ⌘ shortcut, and shows the key that presses it.
export function DevicePad({
  binding,
  control,
  command,
  accent,
  pressOnKey = true,
  held,
}: DevicePadProps) {
  const keys = useHotkeys();
  const { shift } = useShift();
  const { isBusy } = useFeedback();
  const commandLegend = useCommandLegend();
  const shiftMark = binding.shiftLegend ? "⇧" : "";
  const label = control ? hotkeyLabel(control) : "";
  const hotkey = label
    ? `${shiftMark}${label}`
    : command && `${commandLegend}${shiftMark}${command.legend}`;

  useControlPress(pressOnKey ? control : undefined, () => binding.onPress());
  useCommandKey(command?.code, (shifted) => {
    if (!isBusy()) binding.onPress(shifted || shift);
  });

  return (
    <Pad
      label={binding.label}
      accent={accent}
      lit={binding.lit}
      pressed={binding.pressed}
      indicator={binding.indicator}
      hotkey={hotkey}
      held={held ?? (control ? keys.isHeld(control) : undefined)}
      onPress={() => binding.onPress()}
    >
      {binding.icon}
    </Pad>
  );
}
