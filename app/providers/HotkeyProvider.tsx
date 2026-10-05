import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { keyboardFocus, moveFocus } from "../components/home/input/focus";
import {
  KEYMAP,
  controlId,
  type Control,
} from "../components/home/input/keymap";

export interface HeldKeys {
  // Controls whose keys are down, in the order they went down.
  readonly controls: readonly Control[];
  // The chord key pressed most recently that is still down.
  readonly chord: number | null;
  readonly shift: boolean;
}

export interface HotkeyEvent {
  control: Control;
  down: boolean;
  // The keys down at this moment (this one included, on a press), read before
  // React re-renders, so a chord key and a note key pressed together agree.
  held: HeldKeys;
  // Stops this key counting as held until it comes up, e.g. when pressing it
  // releases a latch instead.
  ignore: () => void;
}

type Listener = (event: HotkeyEvent) => void;

interface HotkeyContextValue {
  held: HeldKeys;
  subscribe: (listener: Listener) => () => void;
}

interface Down {
  control: Control;
  ignored: boolean;
}

const NO_KEYS: HeldKeys = { controls: [], chord: null, shift: false };

const HotkeyContext = createContext<HotkeyContextValue | null>(null);

function summarize(keys: ReadonlyMap<string, Down>): HeldKeys {
  const controls = [...keys.values()]
    .filter(({ ignored }) => !ignored)
    .map(({ control }) => control);
  let chord: number | null = null;
  for (const control of controls) {
    if (control.kind === "chord") chord = control.index;
  }
  return {
    controls,
    chord,
    shift: controls.some(({ kind }) => kind === "shift"),
  };
}

const typing = (event: KeyboardEvent) =>
  event.target instanceof Element &&
  event.target.closest("input, textarea, select, [contenteditable]") !== null;

// Binds the Device's keyboard: tracks every mapped key that is down (any
// number at once, by KeyboardEvent.code), publishes them as state for
// rendering, and tells listeners about each press and release as it happens.
export function HotkeyProvider({ children }: { children: ReactNode }) {
  const keys = useRef(new Map<string, Down>());
  const listeners = useRef(new Set<Listener>());
  const [held, setHeld] = useState<HeldKeys>(NO_KEYS);

  const emit = (control: Control, down: boolean, entry: Down) => {
    const event: HotkeyEvent = {
      control,
      down,
      held: summarize(keys.current),
      ignore: () => {
        entry.ignored = true;
      },
    };
    for (const listener of listeners.current) listener(event);
  };

  // Lets go of everything, telling listeners, so no note is left sounding.
  const releaseAll = () => {
    if (keys.current.size === 0) return;
    const down = [...keys.current.values()];
    keys.current.clear();
    for (const entry of down) emit(entry.control, false, entry);
    setHeld(NO_KEYS);
  };

  const onKey = useEffectEvent((event: KeyboardEvent, down: boolean) => {
    if (typing(event)) return;
    if (event.code === "Tab") {
      event.preventDefault();
      if (down) moveFocus(event.shiftKey ? -1 : 1);
      return;
    }
    // Esc lets go of a focused pad first; otherwise it is a hotkey.
    if (event.key === "Escape" && keyboardFocus()) {
      if (down) (document.activeElement as HTMLElement).blur();
      return;
    }
    if (event.code === "Enter" && keyboardFocus()) return;
    // macOS sends no keyups for other keys while ⌘ is held, so let go first.
    if (event.key === "Meta" && down) {
      releaseAll();
      return;
    }
    const control = KEYMAP.get(event.code);
    if (!control) return;
    if (down) {
      // Browser shortcuts (⌘ C, Ctrl Tab…) pass through untouched.
      if (
        control.kind !== "shift" &&
        (event.metaKey || event.ctrlKey || event.altKey)
      )
        return;
      event.preventDefault();
      if (event.repeat || keys.current.has(event.code)) return;
      const entry: Down = { control, ignored: false };
      keys.current.set(event.code, entry);
      emit(control, true, entry);
    } else {
      const entry = keys.current.get(event.code);
      if (!entry) return;
      event.preventDefault();
      keys.current.delete(event.code);
      emit(control, false, entry);
    }
    setHeld(summarize(keys.current));
  });

  const onLeave = useEffectEvent(() => releaseAll());

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => onKey(event, true);
    const keyUp = (event: KeyboardEvent) => onKey(event, false);
    const leave = () => onLeave();
    const hidden = () => {
      if (document.hidden) onLeave();
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", leave);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", leave);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value = useMemo(() => ({ held, subscribe }), [held, subscribe]);
  return (
    <HotkeyContext.Provider value={value}>{children}</HotkeyContext.Provider>
  );
}

function useHotkeyContext() {
  const context = useContext(HotkeyContext);
  if (!context) throw new Error("Wrap the Device in a HotkeyProvider");
  return context;
}

// The keys held right now, for rendering.
export function useHotkeys() {
  const { held } = useHotkeyContext();
  const ids = useMemo(() => new Set(held.controls.map(controlId)), [held]);
  return {
    ...held,
    isHeld: (control: Control) => ids.has(controlId(control)),
  };
}

// Runs the handler on every press and release, as it happens.
export function useHotkeyListener(handler: (event: HotkeyEvent) => void) {
  const { subscribe } = useHotkeyContext();
  const onEvent = useEffectEvent(handler);
  useEffect(() => subscribe((event) => onEvent(event)), [subscribe]);
}
