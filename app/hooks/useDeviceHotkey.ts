import { controlId, type Control } from "../components/home/input/keymap";
import { useFeedback } from "../providers/FeedbackProvider";
import {
  useHotkeyListener,
  type HotkeyEvent,
} from "../providers/HotkeyProvider";

// A hotkey listener for the Device: while it is busy (saving the mix) no key
// counts, so none is left held when it frees up.
export function useDeviceHotkey(handler: (event: HotkeyEvent) => void) {
  const { isBusy } = useFeedback();
  useHotkeyListener((event) => {
    if (isBusy()) {
      event.ignore();
      return;
    }
    handler(event);
  });
}

// Runs `onPress` when the key for `control` goes down, as a click would.
export function useControlPress(
  control: Control | undefined,
  onPress: () => void,
) {
  const id = control && controlId(control);
  useDeviceHotkey((event) => {
    if (event.down && id === controlId(event.control)) onPress();
  });
}
