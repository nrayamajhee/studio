import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  AudioLines,
  AudioWaveform,
  Circle,
  Grid3x3,
  LayoutGrid,
  Metronome,
  Play,
  RotateCcw,
  Save,
  Square,
  WavesHorizontal,
} from "lucide-react";
import { PATCH_BY_ID } from "../../lib/physical/patches";
import {
  formatParam,
  stepToValue,
  valueToStep,
} from "../../lib/physical/patches/format";
import { cn } from "../../lib/utils";
import { Key, Knob, Pad } from "../design-system-v2";
import {
  DEVICE_MODULES,
  KNOB_STEPS,
  deviceEngine,
  engineName,
  findPreset,
  isKit,
  keyPiece,
  presetValues,
  type DevicePreset,
  type ModuleId,
  type ModuleKnob,
} from "./deviceEngine";
import {
  DeviceScreen,
  PARAMS_PER_PAGE,
  ScreenSeek,
  ScreenSelection,
  TILES_PER_PAGE,
  type ScreenOverlay,
  type ScreenReadout,
  type ScreenView,
} from "./DeviceScreen";
import { AdsrIcon, DRUM_PIECES } from "./instrumentIcons";
import { ICON_CHOICES, PresetIcon } from "./presetIcons";
import {
  allPresets,
  bindPad,
  clearEdits,
  presetEdits,
  setEdit,
  savePreset,
  updatePreset,
  usePresetLibrary,
} from "./presetStore";
import { useTransport } from "./useTransport";
import styles from "./SynthDevice.module.css";

export interface SynthDeviceProps {
  className?: string;
}

const INITIAL_PRESET = "piano";
const INITIAL_VOLUME_STEP = 8;
const NOTICE_MS = 1800;
const OVERLAY_MS = 1200;
const MODULE_IDS: readonly ModuleId[] = ["adsr", "lfo", "fx"];

type ModuleSteps = Readonly<Record<ModuleId, readonly number[]>>;

const INITIAL_MODULE_STEPS = Object.fromEntries(
  MODULE_IDS.map((id) => [
    id,
    DEVICE_MODULES[id].knobs.map(({ spec, steps }) =>
      valueToStep(spec, spec.default, steps),
    ),
  ]),
) as unknown as ModuleSteps;

const MODULES_OFF: Readonly<Record<ModuleId, boolean>> = {
  adsr: false,
  lfo: false,
  fx: false,
};

const knobValue = ({ spec, steps, floor }: ModuleKnob, step: number) =>
  step === 0 && floor !== undefined ? floor : stepToValue(spec, step, steps);

const knobDisplay = (knob: ModuleKnob, step: number) =>
  knob.options?.[step] ?? formatParam(knob.spec, knobValue(knob, step));

// Off restores the engine's defaults for the module's params, which leave the
// modelled sound untouched; the knob settings are kept for switching back on.
function applyModule(id: ModuleId, on: boolean, steps: readonly number[]) {
  const { knobs } = DEVICE_MODULES[id];
  deviceEngine.setMasterParams(
    knobs.map(({ spec }) => spec.id),
    on
      ? Object.fromEntries(
          knobs.map((knob, i) => [knob.spec.id, knobValue(knob, steps[i])]),
        )
      : null,
  );
}

// Most used first: triads, then sevenths, then colours.
const CHORDS = [
  { name: "Major", label: "Maj", intervals: [0, 4, 7] },
  { name: "Minor", label: "Min", intervals: [0, 3, 7] },
  { name: "Dominant 7", label: "Dom7", intervals: [0, 4, 7, 10] },
  { name: "Minor 7", label: "Min7", intervals: [0, 3, 7, 10] },
  { name: "Major 7", label: "Maj7", intervals: [0, 4, 7, 11] },
  { name: "Power", label: "Power", intervals: [0, 7, 12] },
];

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
const F3_MIDI = 53;
const WHITE_KEYS = [0, 2, 4, 6, 7, 9, 11, 12, 14, 16, 18, 19, 21, 23];
const BLACK_KEYS = [1, 3, 5, 8, 10, 13, 15, 17, 20, 22];

// Indexed by keybed semitone (F3 = 0). The piano takes the top two rows like
// a real keyboard: white keys F3–E5 along Tab Q W E R T Y U I O P [ ] \, and
// each black key on the number key between its neighbours (1 2 3 5 6 8 9 0 =
// and Backspace).
const HOTKEYS: readonly string[] = [
  "Tab",
  "1",
  "Q",
  "2",
  "W",
  "3",
  "E",
  "R",
  "5",
  "T",
  "6",
  "Y",
  "U",
  "8",
  "I",
  "9",
  "O",
  "0",
  "P",
  "[",
  "=",
  "]",
  "⌫",
  "\\",
];

const KEY_CODES: Record<string, string> = {
  ",": "Comma",
  ".": "Period",
  "/": "Slash",
  ";": "Semicolon",
  "'": "Quote",
  "-": "Minus",
  "=": "Equal",
  "[": "BracketLeft",
  "]": "BracketRight",
  "\\": "Backslash",
  "←": "ArrowLeft",
  "→": "ArrowRight",
  Tab: "Tab",
  Space: "Space",
  "⌫": "Backspace",
};

const keyCode = (hotkey: string) =>
  KEY_CODES[hotkey] ??
  (/^\d$/.test(hotkey) ? `Digit${hotkey}` : `Key${hotkey}`);

const HOTKEY_SEMITONES = new Map(
  HOTKEYS.map((hotkey, semitone) => [keyCode(hotkey), semitone]),
);

// The pads' two rows sit on the home and bottom rows, lined up from the right
// edge: chords on L ; ' / , . /, presets on H J K / B N M, Record, Stop,
// Metronome, Synth, ADSR / Save, LFO, FX on A S D F G / X C V. Space plays,
// and the arrows and Shift press their own pads.
const PRESET_HOTKEYS = ["H", "J", "K", "B", "N", "M"];
const CHORD_HOTKEYS = ["L", ";", "'", ",", ".", "/"];

type ToolPad =
  "record" | "play" | "stop" | "metronome" | "synth" | "save" | ModuleId;

const TOOL_HOTKEYS: Readonly<Record<ToolPad, string>> = {
  record: "A",
  play: "Space",
  stop: "S",
  metronome: "D",
  synth: "F",
  adsr: "G",
  save: "X",
  lfo: "C",
  fx: "V",
};

// Tab plays F3, so ` (and Shift + `) steps focus through the page's controls
// in its place, and Return presses the focused one (Space always plays). Esc or
// any press on the Device ends it.
const FOCUSABLE =
  "a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]";

// Document order doesn't match the layout everywhere: the pads sit in 3×2
// banks, and the keybed lists its white keys before its black ones. Controls inside a [data-focus-group] are visited together,
// where the group's first one is, in reading order: "rows" goes row by row,
// "columns" left to right (so each black key falls between its neighbours).
function readingOrder(controls: HTMLElement[]) {
  const groups = new Map<string, HTMLElement[]>();
  const groupOf = (element: HTMLElement) =>
    element.closest<HTMLElement>("[data-focus-group]");
  for (const element of controls) {
    const group = groupOf(element);
    if (!group) continue;
    const name = group.dataset.focusGroup ?? "";
    groups.set(name, [...(groups.get(name) ?? []), element]);
  }
  for (const members of groups.values()) {
    const columns = groupOf(members[0])?.dataset.focusOrder === "columns";
    members.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const dx = ra.left + ra.width / 2 - (rb.left + rb.width / 2);
      const dy = ra.top - rb.top;
      return columns || Math.abs(dy) <= 4 ? dx : dy;
    });
  }
  const order: HTMLElement[] = [];
  const placed = new Set<string>();
  for (const element of controls) {
    const name = groupOf(element)?.dataset.focusGroup;
    if (name === undefined) order.push(element);
    else if (!placed.has(name)) {
      placed.add(name);
      order.push(...(groups.get(name) ?? []));
    }
  }
  return order;
}

function moveFocus(direction: 1 | -1) {
  const controls = readingOrder(
    [...document.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (element) => element.tabIndex >= 0 && element.getClientRects().length > 0,
    ),
  );
  if (controls.length === 0) return;
  const current = controls.indexOf(document.activeElement as HTMLElement);
  const next =
    current < 0
      ? direction > 0
        ? 0
        : controls.length - 1
      : (current + direction + controls.length) % controls.length;
  // focusVisible isn't in TypeScript's DOM types yet.
  controls[next].focus({ focusVisible: true } as FocusOptions);
}

const keyboardFocus = () =>
  document.activeElement instanceof HTMLElement &&
  document.activeElement !== document.body &&
  document.activeElement.matches(FOCUSABLE);

type PadAction =
  | { kind: "preset"; index: number }
  | { kind: "chord"; index: number }
  | { kind: "step"; direction: -1 | 1 }
  | { kind: "tool"; pad: ToolPad };

const PAD_HOTKEYS = new Map<string, PadAction>([
  ...PRESET_HOTKEYS.map(
    (hotkey, index) =>
      [keyCode(hotkey), { kind: "preset", index }] as [string, PadAction],
  ),
  ...CHORD_HOTKEYS.map(
    (hotkey, index) =>
      [keyCode(hotkey), { kind: "chord", index }] as [string, PadAction],
  ),
  [keyCode("←"), { kind: "step", direction: -1 }],
  [keyCode("→"), { kind: "step", direction: 1 }],
  ...(Object.entries(TOOL_HOTKEYS) as [ToolPad, string][]).map(
    ([pad, hotkey]) =>
      [keyCode(hotkey), { kind: "tool", pad }] as [string, PadAction],
  ),
]);

const octaveOf = (midi: number) => Math.floor(midi / 12) - 1;

const noteName = (midi: number) => `${NOTE_NAMES[midi % 12]}${octaveOf(midi)}`;

const spokenNote = (midi: number) =>
  `${NOTE_NAMES[midi % 12].replace("#", " sharp")} ${octaveOf(midi)}`;

const engravedNote = (midi: number) => {
  const name = NOTE_NAMES[midi % 12].replace("#", "♯");
  return name === "C" ? `C${octaveOf(midi)}` : name;
};

const iconLabel = (icon: string) =>
  icon.charAt(0).toUpperCase() + icon.slice(1);

// Moves an item index to the same slot on the next or previous page, wrapping.
const turnPage = (
  index: number,
  direction: 1 | -1,
  perPage: number,
  count: number,
) => {
  const pages = Math.ceil(count / perPage);
  const page = (Math.floor(index / perPage) + direction + pages) % pages;
  return Math.min(page * perPage + (index % perPage), count - 1);
};

function useFlash(ms: number) {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const flash = useCallback(() => {
    clearTimeout(timer.current);
    setOn(true);
    timer.current = setTimeout(() => setOn(false), ms);
  }, [ms]);

  return [on, flash] as const;
}

// A value that shows for `ms` after the last show(), e.g. a footer notice or
// the level overlay while a knob turns.
function useMomentary<T>(ms: number) {
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

  return [value, show] as const;
}

interface HeldKey {
  semitones: number[];
  midis: number[];
}

export function SynthDevice({ className }: SynthDeviceProps) {
  const library = usePresetLibrary();
  const presets = allPresets(library);
  const [preset, setPreset] = useState(() => findPreset(INITIAL_PRESET));
  const [paramIndex, setParamIndex] = useState(0);
  const [volumeStep, setVolumeStep] = useState(INITIAL_VOLUME_STEP);
  const [moduleSteps, setModuleSteps] = useState(INITIAL_MODULE_STEPS);
  const [moduleOn, setModuleOn] = useState(MODULES_OFF);
  const [idleSeek, setIdleSeek] = useState(0);
  const [view, setView] = useState<ScreenView>("scope");
  const [paramPage, setParamPage] = useState(0);
  const [iconIndex, setIconIndex] = useState(0);
  const [presetIndex, setPresetIndex] = useState(0);
  const [octave, setOctave] = useState(0);
  const [shiftLatched, setShiftLatched] = useState(false);
  const [shiftHeld, setShiftHeld] = useState(false);
  const [chord, setChord] = useState<number | null>(null);
  // Like Shift: a click latches a chord, its hotkey plays it while held.
  const [heldChord, setHeldChord] = useState<number | null>(null);
  const activeChord = heldChord ?? chord;
  // Pads whose keyboard hotkey is down, by key code.
  const [heldPads, setHeldPads] = useState<ReadonlySet<string>>(new Set());
  const [litNotes, setLitNotes] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const [stopLit, flashStop] = useFlash(140);
  const [overlay, showOverlay] = useMomentary<ScreenOverlay>(OVERLAY_MS);
  const [notice, showNotice] = useMomentary<string>(NOTICE_MS);
  const held = useRef(new Map<number, HeldKey>());
  const transport = useTransport();
  const shift = shiftLatched || shiftHeld;
  // The preset's own values plus any edits made since it was picked.
  const edits = library.edits[preset.id];
  const values = { ...presetValues(preset), ...edits };
  const specs = PATCH_BY_ID[preset.target].params;
  const selected = specs[Math.min(paramIndex, specs.length - 1)];
  const selectedValue = values[selected.id] ?? selected.default;

  useEffect(() => {
    const initial = findPreset(INITIAL_PRESET);
    deviceEngine.loadPreset(initial, presetEdits(initial.id));
    deviceEngine.setVolume(INITIAL_VOLUME_STEP / (KNOB_STEPS - 1));
    for (const id of MODULE_IDS)
      applyModule(id, false, INITIAL_MODULE_STEPS[id]);
  }, []);

  useEffect(() => {
    const heldKeys = held.current;
    const releaseAll = () => {
      setShiftHeld(false);
      if (heldKeys.size === 0) return;
      heldKeys.clear();
      deviceEngine.allNotesOff();
      setLitNotes(new Set());
    };
    const releaseWhenHidden = () => {
      if (document.hidden) releaseAll();
    };
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", releaseWhenHidden);
    return () => {
      releaseAll();
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", releaseWhenHidden);
    };
  }, []);

  const syncLitNotes = () =>
    setLitNotes(
      new Set([...held.current.values()].flatMap(({ semitones }) => semitones)),
    );

  const pressKey = (root: number) => {
    if (held.current.has(root)) return;
    deviceEngine.unlock();
    const intervals =
      activeChord === null ? [0] : CHORDS[activeChord].intervals;
    const semitones = intervals.map((interval) => root + interval);
    const midis = semitones.map((semitone) => {
      const midi = F3_MIDI + semitone + 12 * octave;
      deviceEngine.noteOn(midi, 0.8);
      transport.capture(noteName(midi), true);
      return midi;
    });
    held.current.set(root, { semitones, midis });
    syncLitNotes();
  };

  const releaseKey = (root: number) => {
    const entry = held.current.get(root);
    if (!entry) return;
    held.current.delete(root);
    for (const midi of entry.midis) {
      deviceEngine.noteOff(midi);
      transport.capture(noteName(midi), false);
    }
    syncLitNotes();
  };

  // When the chord changes under held keys (a chord hotkey lifted, a latched
  // chord toggled), each key keeps its root sounding and swaps the notes
  // around it: lifting a chord leaves just the held notes. Kits play one-shot
  // hits, so they are left alone.
  const onChordChange = useEffectEvent((next: number | null) => {
    if (held.current.size === 0 || isKit(preset.target)) return;
    const intervals = next === null ? [0] : CHORDS[next].intervals;
    for (const [root, entry] of held.current) {
      const rootMidi = entry.midis[0];
      const semitones = intervals.map((interval) => root + interval);
      const midis = intervals.map((interval) => rootMidi + interval);
      for (const midi of entry.midis) {
        if (midis.includes(midi)) continue;
        deviceEngine.noteOff(midi);
        transport.capture(noteName(midi), false);
      }
      for (const midi of midis) {
        if (entry.midis.includes(midi)) continue;
        deviceEngine.noteOn(midi, 0.8);
        transport.capture(noteName(midi), true);
      }
      held.current.set(root, { semitones, midis });
    }
    syncLitNotes();
  });

  useEffect(() => onChordChange(activeChord), [activeChord]);

  // Keeps the selected param when the next instrument has it too.
  const selectPreset = (next: DevicePreset) => {
    deviceEngine.unlock();
    deviceEngine.loadPreset(next, library.edits[next.id]);
    deviceEngine.preview();
    setPreset(next);
    const index = Math.max(
      0,
      PATCH_BY_ID[next.target].params.findIndex(({ id }) => id === selected.id),
    );
    setParamIndex(index);
    setParamPage(Math.floor(index / PARAMS_PER_PAGE));
  };

  const step = (direction: 1 | -1) => {
    if (view === "synth") {
      const count = Math.ceil(specs.length / PARAMS_PER_PAGE);
      showParamPage(turnPage(paramPage, direction, 1, count));
    } else if (view === "save") {
      setIconIndex((index) =>
        turnPage(index, direction, TILES_PER_PAGE.save, ICON_CHOICES.length),
      );
    } else if (view === "presets") {
      setPresetIndex((index) =>
        turnPage(index, direction, TILES_PER_PAGE.presets, presets.length),
      );
    } else if (shift) {
      const index = presets.findIndex(({ id }) => id === preset.id) + direction;
      selectPreset(presets[(index + presets.length) % presets.length]);
    } else {
      setOctave((current) => Math.min(2, Math.max(-2, current + direction)));
    }
  };

  const padBindings = shift ? library.shiftButtons : library.buttons;

  const pressPlay = () => {
    deviceEngine.unlock();
    transport.play();
  };

  const pressStop = () => {
    transport.stop();
    flashStop();
  };

  const pressMetronome = () => {
    deviceEngine.unlock();
    transport.toggleMetronome();
  };

  const pressTool = (pad: ToolPad) => {
    if (pad === "record") pressRecord();
    else if (pad === "play") pressPlay();
    else if (pad === "stop") pressStop();
    else if (pad === "metronome") pressMetronome();
    else if (pad === "synth") pressSynth();
    else if (pad === "save") pressSave();
    else pressModule(pad);
  };

  const toolHotkey = (pad: ToolPad) => ({
    hotkey: TOOL_HOTKEYS[pad],
    held: heldPads.has(keyCode(TOOL_HOTKEYS[pad])),
  });

  const toggleChord = (index: number) =>
    setChord((current) => (current === index ? null : index));

  // With Shift a pad plays, binds or saves to its alternate.
  const padName = (pad: number) => `${shift ? "Shift pad" : "Pad"} ${pad + 1}`;

  const pressPresetPad = (pad: number) => {
    if (view === "presets") {
      const chosen = presets[presetIndex];
      bindPad(pad, chosen.id, shift);
      showNotice(`${padName(pad)} → ${chosen.name}`);
      return;
    }
    if (view === "save") {
      saveToPad(pad);
      return;
    }
    const bound = presets.find(({ id }) => id === padBindings[pad]);
    if (bound) selectPreset(bound);
  };

  const pressSynth = () => {
    if (view === "presets") {
      setView("scope");
    } else if (shift) {
      // Opening the library releases a latched Shift, so a pad press binds
      // the pad itself unless Shift is pressed again for its alternate.
      setShiftLatched(false);
      setPresetIndex(
        Math.max(
          0,
          presets.findIndex(({ id }) => id === preset.id),
        ),
      );
      setView("presets");
    } else {
      setParamPage(Math.floor(paramIndex / PARAMS_PER_PAGE));
      setView((current) => (current === "synth" ? "scope" : "synth"));
    }
  };

  // Shift + Record switches between tape and sequencer takes instead.
  const pressRecord = () => {
    if (shift) {
      transport.setMode(transport.mode === "sequencer" ? "tape" : "sequencer");
      return;
    }
    transport.record();
  };

  // Shift + Save resets the preset instead.
  const pressSave = () => {
    if (shift) {
      pressReset();
      return;
    }
    if (view === "synth") {
      setIconIndex(Math.max(0, ICON_CHOICES.indexOf(preset.icon)));
      setView("save");
      return;
    }
    if (view !== "save") return;
    const saved = savePreset(preset, values, ICON_CHOICES[iconIndex]);
    clearEdits(preset.id);
    finishSave(saved, `Saved ${saved.name}`);
  };

  // Saving onto the pad that already holds this saved preset overwrites it;
  // anything else becomes a new preset bound to that pad.
  const saveToPad = (pad: number) => {
    const icon = ICON_CHOICES[iconIndex];
    const saved =
      preset.user && padBindings[pad] === preset.id
        ? updatePreset(preset, values, icon)
        : savePreset(preset, values, icon);
    bindPad(pad, saved.id, shift);
    clearEdits(preset.id);
    finishSave(saved, `Saved ${saved.name} to ${padName(pad).toLowerCase()}`);
  };

  // Saving bakes the edits into the saved preset, so the one it came from goes
  // back to its own values.
  const finishSave = (saved: DevicePreset, message: string) => {
    deviceEngine.loadPreset(saved);
    setPreset(saved);
    setView("scope");
    showNotice(message);
  };

  // The red knob picks a param, the blue one sets its value; the footer shows
  // both in their knob colours.
  const selectParam = (index: number) => {
    setParamIndex(index);
    setParamPage(Math.floor(index / PARAMS_PER_PAGE));
  };

  // Turning a page selects its first (top-left) param.
  const showParamPage = (page: number) => {
    setParamPage(page);
    setParamIndex(page * PARAMS_PER_PAGE);
  };

  // Turning back to the preset's own step restores its exact value and drops
  // the edit.
  const setSelectedValue = (step: number) => {
    const own = presetValues(preset)[selected.id];
    const original = step === valueToStep(selected, own, KNOB_STEPS);
    const value = original ? own : stepToValue(selected, step, KNOB_STEPS);
    deviceEngine.setValue(selected.id, value);
    setEdit(preset.id, selected.id, original ? null : value);
  };

  const pressReset = () => {
    if (!edits) {
      showNotice("No changes to reset");
      return;
    }
    clearEdits(preset.id);
    deviceEngine.loadPreset(preset);
    showNotice(`Reset ${preset.name}`);
  };

  // Turning a module's knob switches the module on so the change is audible.
  const setModuleStep = (id: ModuleId, index: number, step: number) => {
    const next = moduleSteps[id].map((value, i) =>
      i === index ? step : value,
    );
    setModuleSteps((current) => ({ ...current, [id]: next }));
    setModuleOn((current) => ({ ...current, [id]: true }));
    applyModule(id, true, next);
  };

  // A module pad opens its view; with Shift it switches the module on or off
  // without leaving the current view.
  const pressModule = (id: ModuleId) => {
    if (shift) {
      const on = !moduleOn[id];
      setModuleOn((current) => ({ ...current, [id]: on }));
      applyModule(id, on, moduleSteps[id]);
      return;
    }
    setView((current) => (current === id ? "scope" : id));
  };

  const setVolume = (step: number) => {
    setVolumeStep(step);
    deviceEngine.setVolume(step / (KNOB_STEPS - 1));
    showOverlay({
      label: "Volume",
      value: step / (KNOB_STEPS - 1),
      display: `${step * 10}%`,
    });
  };

  // In a module's view the four knobs set its params, in knob order.
  const renderModuleKnob = (
    id: ModuleId,
    index: number,
    color: string,
    markColor?: string,
  ) => {
    const knob = DEVICE_MODULES[id].knobs[index];
    const step = moduleSteps[id][index];
    return (
      <Knob
        label={knob.spec.label}
        valueLabel={knobDisplay(knob, step)}
        step={step}
        steps={knob.steps}
        color={color}
        markColor={markColor}
        onChange={(next) => setModuleStep(id, index, next)}
      />
    );
  };

  const renderModulePad = (id: ModuleId, icon: React.ReactNode) => {
    const module = DEVICE_MODULES[id];
    return (
      <Pad
        label={
          shift
            ? `Turn ${module.label} ${moduleOn[id] ? "off" : "on"}`
            : module.title
        }
        accent="var(--synth-red)"
        lit={view === id}
        {...toolHotkey(id)}
        onPress={() => pressModule(id)}
      >
        {icon}
      </Pad>
    );
  };

  // With a kit selected, keys show the drum they play instead of a note name.
  const renderKey = (semitone: number, slot: number, black: boolean) => {
    const midi = F3_MIDI + semitone + 12 * octave;
    const piece = isKit(preset.target)
      ? DRUM_PIECES[keyPiece(preset.target, midi)]
      : null;
    return (
      <Key
        key={semitone}
        variant={black ? "black" : "white"}
        label={piece ? `${piece.name} (${spokenNote(midi)})` : spokenNote(midi)}
        note={
          piece ? piece.Icon ? <piece.Icon /> : piece.name : engravedNote(midi)
        }
        hotkey={HOTKEYS[semitone]}
        lit={litNotes.has(semitone)}
        className={cn(styles.slot, black ? styles.blackSlot : styles.whiteSlot)}
        style={{ "--slot": slot } as CSSProperties}
        onPress={() => pressKey(semitone)}
        onRelease={() => releaseKey(semitone)}
      />
    );
  };

  const onHotkey = useEffectEvent((event: KeyboardEvent, down: boolean) => {
    if (
      event.target instanceof Element &&
      event.target.closest("input, textarea, select, [contenteditable]")
    ) {
      return;
    }
    if (event.code === "Backquote") {
      event.preventDefault();
      if (down) moveFocus(event.shiftKey ? -1 : 1);
      return;
    }
    if (event.key === "Escape") {
      if (down && keyboardFocus())
        (document.activeElement as HTMLElement).blur();
      return;
    }
    if (event.code === "Enter" && keyboardFocus()) return;
    // Held Shift works while held; if a click latched it, the key unlatches it.
    if (event.key === "Shift") {
      if (!down) setShiftHeld(false);
      else if (event.repeat) return;
      else if (shiftLatched) setShiftLatched(false);
      else setShiftHeld(true);
      return;
    }
    const action = PAD_HOTKEYS.get(event.code);
    if (action) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      setHeldPads((current) => {
        const next = new Set(current);
        if (down) next.add(event.code);
        else next.delete(event.code);
        return next;
      });
      if (action.kind === "chord") {
        // On a chord a click latched, the hotkey releases the latch instead.
        if (!down) {
          setHeldChord((held) => (held === action.index ? null : held));
        } else if (!event.repeat) {
          if (chord === action.index) setChord(null);
          else setHeldChord(action.index);
        }
        return;
      }
      if (!down || event.repeat) return;
      if (action.kind === "preset") pressPresetPad(action.index);
      else if (action.kind === "step") step(action.direction);
      else pressTool(action.pad);
      return;
    }
    const semitone = HOTKEY_SEMITONES.get(event.code);
    if (semitone === undefined) return;
    if (!down) {
      releaseKey(semitone);
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    if (!event.repeat) pressKey(semitone);
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => onHotkey(event, true);
    const handleKeyUp = (event: KeyboardEvent) => onHotkey(event, false);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const selectedDisplay = formatParam(selected, selectedValue);
  const selection = (
    <ScreenSelection label={selected.label} value={selectedDisplay} />
  );
  const params = specs.map((spec) => ({
    id: spec.id,
    label: spec.label,
    value: formatParam(spec, values[spec.id] ?? spec.default),
    selected: spec === selected,
  }));
  const pages = Math.ceil(params.length / PARAMS_PER_PAGE);
  const paging = view === "synth" || view === "save" || view === "presets";
  const activeModule: ModuleId | null =
    view === "adsr" || view === "lfo" || view === "fx" ? view : null;
  const readouts: ScreenReadout[] = activeModule
    ? DEVICE_MODULES[activeModule].knobs.map((knob, i) => {
        const step = moduleSteps[activeModule][i];
        const value = knobValue(knob, step);
        return {
          label: knob.spec.label,
          display: knobDisplay(knob, step),
          amount:
            knob.spec.id === "adsr.sustain" ? value : step / (knob.steps - 1),
        };
      })
    : [];
  // Synth opens (or, while it is up, closes) the library in this mode.
  const libraryMode = shift || view === "presets";
  const padPresets = padBindings.map(
    (id) => presets.find((candidate) => candidate.id === id) ?? null,
  );

  // The green knob scrolls whatever the screen shows; on the scope it is idle.
  const seek =
    view === "synth"
      ? {
          step: paramPage,
          steps: Math.max(2, pages),
          label: `Page ${paramPage + 1} of ${pages}`,
          set: showParamPage,
        }
      : view === "save"
        ? {
            step: iconIndex,
            steps: ICON_CHOICES.length,
            label: iconLabel(ICON_CHOICES[iconIndex]),
            set: setIconIndex,
          }
        : view === "presets"
          ? {
              step: presetIndex,
              steps: Math.max(2, presets.length),
              label: presets[presetIndex]?.name ?? "",
              set: (index: number) =>
                setPresetIndex(Math.min(index, presets.length - 1)),
            }
          : { step: idleSeek, steps: KNOB_STEPS, label: "", set: setIdleSeek };

  // The engine name, then each module that's on.
  const engine = [
    engineName(preset.target),
    ...MODULE_IDS.filter((id) => moduleOn[id]).map(
      (id) => DEVICE_MODULES[id].label,
    ),
  ].join(" · ");
  const octaveLabel = `OCT ${octave > 0 ? "+" : octave < 0 ? "−" : "±"}${Math.abs(octave)}`;
  const paramPageLabel = (
    <ScreenSeek>
      Params {paramPage + 1}/{pages}
    </ScreenSeek>
  );
  const screen = {
    scope: { status: octaveLabel, footer: [engine, selection] },
    // The highlighted row shows the selection, so the footer shows the page.
    synth: {
      status: octaveLabel,
      footer: [engine, paramPageLabel],
    },
    save: {
      status: (
        <ScreenSeek>
          Icons {Math.floor(iconIndex / TILES_PER_PAGE.save) + 1}/
          {Math.ceil(ICON_CHOICES.length / TILES_PER_PAGE.save)}
        </ScreenSeek>
      ),
      footer: ["Pick an icon", "Press a pad to save"],
    },
    adsr: { status: moduleOn.adsr ? "On" : "Off", footer: ["", ""] },
    lfo: { status: moduleOn.lfo ? "On" : "Off", footer: ["", ""] },
    fx: { status: moduleOn.fx ? "On" : "Off", footer: ["", ""] },
    presets: {
      status: (
        <ScreenSeek>
          Presets {Math.floor(presetIndex / TILES_PER_PAGE.presets) + 1}/
          {Math.max(1, Math.ceil(presets.length / TILES_PER_PAGE.presets))}
        </ScreenSeek>
      ),
      footer: [presets[presetIndex]?.name ?? "", "Press a pad to bind"],
    },
  }[view];

  return (
    <div className={cn(styles.stage, className)}>
      <div className={styles.frame}>
        <div
          className={styles.device}
          role="group"
          aria-label="Synthesizer"
          onPointerUp={() => deviceEngine.unlock()}
        >
          <div className={styles.topRow}>
            <div className={styles.knobColumn}>
              {activeModule ? (
                renderModuleKnob(
                  activeModule,
                  0,
                  "var(--synth-chalk)",
                  "#141413",
                )
              ) : (
                <Knob
                  label="Volume"
                  valueLabel={`${volumeStep * 10}%`}
                  step={volumeStep}
                  steps={KNOB_STEPS}
                  color="var(--synth-chalk)"
                  markColor="#141413"
                  onChange={setVolume}
                />
              )}
              {activeModule ? (
                renderModuleKnob(activeModule, 1, "var(--synth-green)")
              ) : (
                <Knob
                  label="Seek"
                  valueLabel={seek.label || undefined}
                  step={seek.step}
                  steps={seek.steps}
                  color="var(--synth-green)"
                  onChange={seek.set}
                />
              )}
            </div>

            <DeviceScreen
              className={styles.screenSlot}
              view={view}
              overlay={overlay ?? undefined}
              title={
                activeModule
                  ? DEVICE_MODULES[activeModule].label
                  : edits
                    ? `${preset.name} *`
                    : preset.name
              }
              status={screen.status}
              footer={[notice ?? screen.footer[0], screen.footer[1]]}
              getAnalyser={deviceEngine.getAnalyser}
              params={params}
              page={paramPage}
              tiles={
                view === "save"
                  ? ICON_CHOICES.map((icon) => ({
                      id: icon,
                      label: iconLabel(icon),
                      icon: <PresetIcon icon={icon} />,
                    }))
                  : presets.map((candidate) => {
                      const bound = [
                        ...library.buttons.map((id, pad) =>
                          id === candidate.id ? `${pad + 1}` : "",
                        ),
                        ...library.shiftButtons.map((id, pad) =>
                          id === candidate.id ? `⇧${pad + 1}` : "",
                        ),
                      ].filter(Boolean);
                      return {
                        id: candidate.id,
                        label: candidate.name,
                        icon: <PresetIcon icon={candidate.icon} />,
                        badge: bound.length > 0 ? bound.join(" ") : undefined,
                      };
                    })
              }
              selected={view === "save" ? iconIndex : presetIndex}
              onSelect={view === "save" ? setIconIndex : setPresetIndex}
              onSelectParam={selectParam}
              readouts={readouts}
              lfoShape={moduleSteps.lfo[2]}
              lfoRate={knobValue(
                DEVICE_MODULES.lfo.knobs[0],
                moduleSteps.lfo[0],
              )}
            />

            <div className={styles.knobColumn}>
              {activeModule ? (
                renderModuleKnob(activeModule, 2, "var(--synth-red)")
              ) : (
                <Knob
                  label="Parameter"
                  valueLabel={selected.label}
                  step={specs.indexOf(selected)}
                  steps={Math.max(2, specs.length)}
                  color="var(--synth-red)"
                  onChange={(index) =>
                    selectParam(Math.min(index, specs.length - 1))
                  }
                />
              )}
              {activeModule ? (
                renderModuleKnob(activeModule, 3, "var(--synth-blue)")
              ) : (
                <Knob
                  label="Value"
                  valueLabel={`${selected.label} ${selectedDisplay}`}
                  step={valueToStep(selected, selectedValue, KNOB_STEPS)}
                  steps={KNOB_STEPS}
                  color="var(--synth-blue)"
                  onChange={setSelectedValue}
                />
              )}
            </div>
          </div>

          <div
            className={styles.banks}
            data-focus-group="pads"
            data-focus-order="rows"
          >
            <div className={styles.bank} role="group" aria-label="Transport">
              <Pad
                label={shift ? "Sequencer" : "Record"}
                accent={shift ? "var(--synth-green)" : "var(--synth-red)"}
                pressed={shift ? transport.mode === "sequencer" : undefined}
                lit={transport.state === "recording"}
                {...toolHotkey("record")}
                onPress={pressRecord}
              >
                {shift ? <Grid3x3 /> : <Circle fill="currentColor" />}
              </Pad>
              <Pad
                label="Play"
                accent="var(--synth-green)"
                lit={transport.state === "playing"}
                {...toolHotkey("play")}
                onPress={pressPlay}
              >
                <Play fill="currentColor" />
              </Pad>
              <Pad
                label="Stop"
                accent="var(--synth-green)"
                lit={stopLit}
                {...toolHotkey("stop")}
                onPress={pressStop}
              >
                <Square fill="currentColor" />
              </Pad>
              <Pad
                label={
                  paging
                    ? "Previous page"
                    : shift
                      ? "Previous preset"
                      : "Octave down"
                }
                accent="var(--synth-red)"
                hotkey="←"
                held={heldPads.has("ArrowLeft")}
                onPress={() => step(-1)}
              >
                <ArrowLeft />
              </Pad>
              <Pad
                label={
                  paging ? "Next page" : shift ? "Next preset" : "Octave up"
                }
                accent="var(--synth-red)"
                hotkey="→"
                held={heldPads.has("ArrowRight")}
                onPress={() => step(1)}
              >
                <ArrowRight />
              </Pad>
              <Pad
                label="Shift"
                accent="var(--synth-red)"
                pressed={shift}
                held={shiftHeld}
                hotkey="⇧"
                onPress={() => setShiftLatched((on) => !on)}
              >
                <ArrowUp />
              </Pad>
            </div>
            <div className={styles.bank} role="group" aria-label="Tools">
              <Pad
                label="Metronome"
                accent="var(--synth-green)"
                pressed={transport.metronome}
                {...toolHotkey("metronome")}
                onPress={pressMetronome}
              >
                <Metronome />
              </Pad>
              <Pad
                label={libraryMode ? "Preset library" : "Synth parameters"}
                accent="var(--synth-red)"
                lit={view === "synth" || view === "presets"}
                {...toolHotkey("synth")}
                onPress={pressSynth}
              >
                {libraryMode ? <LayoutGrid /> : <AudioWaveform />}
              </Pad>
              {renderModulePad("adsr", <AdsrIcon />)}
              <Pad
                label={shift ? "Reset preset" : "Save preset"}
                accent="var(--synth-red)"
                {...toolHotkey("save")}
                onPress={pressSave}
              >
                {shift ? <RotateCcw /> : <Save />}
              </Pad>
              {renderModulePad("lfo", <WavesHorizontal />)}
              {renderModulePad("fx", <AudioLines />)}
            </div>
            <div className={styles.bank} role="group" aria-label="Presets">
              {padPresets.map((padPreset, pad) => {
                const name = padPreset?.name ?? "empty";
                return (
                  <Pad
                    key={pad}
                    label={
                      view === "presets"
                        ? `Bind to ${padName(pad).toLowerCase()} (${name})`
                        : view === "save"
                          ? `Save to ${padName(pad).toLowerCase()} (${name})`
                          : (padPreset?.name ?? `Empty preset pad ${pad + 1}`)
                    }
                    accent="var(--synth-red)"
                    hotkey={PRESET_HOTKEYS[pad]}
                    held={heldPads.has(keyCode(PRESET_HOTKEYS[pad]))}
                    onPress={() => pressPresetPad(pad)}
                  >
                    {padPreset && <PresetIcon icon={padPreset.icon} />}
                  </Pad>
                );
              })}
            </div>
            <div className={styles.bank} role="group" aria-label="Chord macros">
              {CHORDS.map(({ name, label }, index) => (
                <Pad
                  key={name}
                  label={`${name} chord`}
                  accent="var(--synth-blue)"
                  pressed={activeChord === index}
                  hotkey={CHORD_HOTKEYS[index]}
                  held={heldChord === index}
                  onPress={() => toggleChord(index)}
                >
                  {label}
                </Pad>
              ))}
            </div>
          </div>
          <div className={styles.keybed}>
            <div
              className={styles.keys}
              role="group"
              aria-label="Piano keys"
              data-focus-group="keys"
              data-focus-order="columns"
            >
              {WHITE_KEYS.map((semitone, slot) =>
                renderKey(semitone, slot, false),
              )}
              {BLACK_KEYS.map((semitone) =>
                renderKey(semitone, WHITE_KEYS.indexOf(semitone - 1) + 1, true),
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
