import { hotkeyLabel, type Control, type Tool } from "../input/keymap";
import { useHotkeys } from "../../../providers/HotkeyProvider";
import { usePerformance } from "../../../providers/PerformanceProvider";

// A pad's keycap badge, pressed in while its key is held.
export function useHotkeyBadges() {
  const keys = useHotkeys();
  const { shift } = usePerformance();

  const hotkeyProps = (control: Control) => ({
    hotkey: hotkeyLabel(control),
    held: keys.isHeld(control),
  });

  const toolHotkey = (tool: Tool) => hotkeyProps({ kind: "tool", tool });

  // A pad Shift changes shows its key with ⇧ while Shift is held.
  const shiftHotkey = (control: Control, shifted = shift) => {
    const props = hotkeyProps(control);
    return shifted && props.hotkey
      ? { ...props, hotkey: `⇧${props.hotkey}` }
      : props;
  };

  return { hotkeyProps, toolHotkey, shiftHotkey };
}
