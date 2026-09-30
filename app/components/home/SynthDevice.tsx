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
  AudioWaveform,
  Circle,
  Grid3x3,
  LayoutGrid,
  Metronome,
  Play,
  RotateCcw,
  Save,
  Square,
} from "lucide-react";
import { PATCH_BY_ID } from "../../lib/physical/patches";
import {
  formatParam,
  stepToValue,
  toUnit,
  valueToStep,
} from "../../lib/physical/patches/format";
import type { ParamSpec } from "../../lib/physical/patches/types";
import { cn } from "../../lib/utils";
import { Key, Knob, Pad } from "../design-system-v2";
import {
  ENVELOPE_PARAMS,
  KNOB_STEPS,
  deviceEngine,
  engineName,
  findPreset,
  isKit,
  keyPiece,
  presetValues,
  type DevicePreset,
} from "./deviceEngine";
import {
  DeviceScreen,
  PARAMS_PER_PAGE,
  ScreenSeek,
  ScreenSelection,
  TILES_PER_PAGE,
  type ScreenEnvelopeStage,
  type ScreenOverlay,
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
const INITIAL_ENVELOPE_STEPS = ENVELOPE_PARAMS.map((spec) =>
  valueToStep(spec, spec.default, KNOB_STEPS),
);

const envelopeValues = (steps: readonly number[]) =>
  Object.fromEntries(
    ENVELOPE_PARAMS.map((spec, i) => [
      spec.id,
      stepToValue(spec, steps[i], KNOB_STEPS),
    ]),
  );

// Off restores the engine's defaults, which leave the modelled sound
// untouched; the knob settings are kept for when it's switched back on.
function applyEnvelope(on: boolean, steps: readonly number[]) {
  deviceEngine.setEnvelope(on ? envelopeValues(steps) : null);
}

const envelopeDisplay = (spec: ParamSpec, value: number, step: number) =>
  spec.id === "adsr.attack" && step === 0 ? "0 ms" : formatParam(spec, value);

// Most used first: triads, then sevenths, then colours.
const CHORDS = [
  { name: "Major", label: "Maj", intervals: [0, 4, 7] },
  { name: "Minor", label: "Min", intervals: [0, 3, 7] },
  { name: "Dominant 7", label: "Dom7", intervals: [0, 4, 7, 10] },
  { name: "Minor 7", label: "Min7", intervals: [0, 3, 7, 10] },
  { name: "Major 7", label: "Maj7", intervals: [0, 4, 7, 11] },
  { name: "Power", label: "Power", intervals: [0, 7, 12] },
  { name: "Suspended 4", label: "Sus4", intervals: [0, 5, 7] },
  { name: "Suspended 2", label: "Sus2", intervals: [0, 2, 7] },
  { name: "Add 9", label: "Add9", intervals: [0, 4, 7, 14] },
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

// Indexed by keybed semitone (F3 = 0). White keys sit on one row and every black
// key on the row above, between its neighbours: F3–B3 on Q W E R (black keys
// 2 3 4), then C4–E5 along Z X C V B N M , . / (black keys S D G H J L ;). K is
// left out because B|C has no black key.
const HOTKEYS = [
  "Q",
  "2",
  "W",
  "3",
  "E",
  "4",
  "R",
  "Z",
  "S",
  "X",
  "D",
  "C",
  "V",
  "G",
  "B",
  "H",
  "N",
  "J",
  "M",
  ",",
  "L",
  ".",
  ";",
  "/",
];

const KEY_CODES: Record<string, string> = {
  ",": "Comma",
  ".": "Period",
  "/": "Slash",
  ";": "Semicolon",
};

const keyCode = (hotkey: string) =>
  KEY_CODES[hotkey] ??
  (/^\d$/.test(hotkey) ? `Digit${hotkey}` : `Key${hotkey}`);

const HOTKEY_SEMITONES = new Map(
  HOTKEYS.map((hotkey, semitone) => [keyCode(hotkey), semitone]),
);

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
  const [envelopeSteps, setEnvelopeSteps] = useState(INITIAL_ENVELOPE_STEPS);
  const [adsrOn, setAdsrOn] = useState(false);
  const [idleSeek, setIdleSeek] = useState(0);
  const [view, setView] = useState<ScreenView>("scope");
  const [paramPage, setParamPage] = useState(0);
  const [iconIndex, setIconIndex] = useState(0);
  const [presetIndex, setPresetIndex] = useState(0);
  const [octave, setOctave] = useState(0);
  const [shiftLatched, setShiftLatched] = useState(false);
  const [shiftHeld, setShiftHeld] = useState(false);
  const [chord, setChord] = useState<number | null>(null);
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
    deviceEngine.setEnvelope(null);
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
    const intervals = chord === null ? [0] : CHORDS[chord].intervals;
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

  const onHotkey = useEffectEvent((event: KeyboardEvent, down: boolean) => {
    if (
      event.target instanceof Element &&
      event.target.closest("input, textarea, select, [contenteditable]")
    ) {
      return;
    }
    // Held Shift works while held; if a click latched it, the key unlatches it.
    if (event.key === "Shift") {
      if (!down) setShiftHeld(false);
      else if (event.repeat) return;
      else if (shiftLatched) setShiftLatched(false);
      else setShiftHeld(true);
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

  const pressPresetPad = (pad: number) => {
    if (view === "presets") {
      const chosen = presets[presetIndex];
      bindPad(pad, chosen.id);
      showNotice(`Pad ${pad + 1} → ${chosen.name}`);
      return;
    }
    if (view === "save") {
      saveToPad(pad);
      return;
    }
    const bound = presets.find(({ id }) => id === library.buttons[pad]);
    if (bound) selectPreset(bound);
  };

  const pressSynth = () => {
    if (view === "presets") {
      setView("scope");
    } else if (shift) {
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

  const pressSave = () => {
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
      preset.user && library.buttons[pad] === preset.id
        ? updatePreset(preset, values, icon)
        : savePreset(preset, values, icon);
    bindPad(pad, saved.id);
    clearEdits(preset.id);
    finishSave(saved, `Saved ${saved.name} to pad ${pad + 1}`);
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

  // Turning an ADSR knob switches the envelope on so the change is audible.
  const setEnvelopeStep = (index: number, step: number) => {
    const next = envelopeSteps.map((value, i) => (i === index ? step : value));
    setEnvelopeSteps(next);
    setAdsrOn(true);
    applyEnvelope(true, next);
  };

  // Shift + ADSR switches the envelope on or off without leaving the view.
  const pressAdsr = () => {
    if (shift) {
      setAdsrOn(!adsrOn);
      applyEnvelope(!adsrOn, envelopeSteps);
      return;
    }
    setView((current) => (current === "adsr" ? "scope" : "adsr"));
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

  // In ADSR mode the four knobs set A, D, S and R, in knob order.
  const renderEnvelopeKnob = (
    index: number,
    color: string,
    markColor?: string,
  ) => {
    const spec = ENVELOPE_PARAMS[index];
    const step = envelopeSteps[index];
    return (
      <Knob
        label={spec.label}
        valueLabel={envelopeDisplay(
          spec,
          stepToValue(spec, step, KNOB_STEPS),
          step,
        )}
        step={step}
        steps={KNOB_STEPS}
        color={color}
        markColor={markColor}
        onChange={(next) => setEnvelopeStep(index, next)}
      />
    );
  };

  // With a kit selected, keys show the drum they play instead of a note name.
  const renderBlankPads = (first: number, count: number) =>
    Array.from({ length: count }, (_, index) => (
      <Pad
        key={`blank-${first + index}`}
        label={`Unassigned pad ${first + index}`}
      />
    ));

  const renderKey = (semitone: number, slot: number, black: boolean) => {
    const midi = F3_MIDI + semitone + 12 * octave;
    const piece = isKit(preset.target) ? DRUM_PIECES[keyPiece(midi)] : null;
    return (
      <Key
        key={semitone}
        variant={black ? "black" : "white"}
        label={piece ? `${piece.name} (${spokenNote(midi)})` : spokenNote(midi)}
        note={piece ? <piece.Icon /> : engravedNote(midi)}
        hotkey={HOTKEYS[semitone]}
        lit={litNotes.has(semitone)}
        className={cn(styles.slot, black ? styles.blackSlot : styles.whiteSlot)}
        style={{ "--slot": slot } as CSSProperties}
        onPress={() => pressKey(semitone)}
        onRelease={() => releaseKey(semitone)}
      />
    );
  };

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
  const adsr = view === "adsr";
  const envelope: ScreenEnvelopeStage[] = ENVELOPE_PARAMS.map((spec, i) => {
    const value = stepToValue(spec, envelopeSteps[i], KNOB_STEPS);
    return {
      label: spec.label,
      display: envelopeDisplay(spec, value, envelopeSteps[i]),
      amount: spec.id === "adsr.sustain" ? value : toUnit(spec, value),
    };
  });
  // Synth opens (or, while it is up, closes) the library in this mode.
  const libraryMode = shift || view === "presets";
  const padPresets = library.buttons.map(
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

  const engine = adsrOn
    ? `${engineName(preset.target)} · ADSR`
    : engineName(preset.target);
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
    adsr: {
      status: adsrOn ? "On" : "Off",
      footer: ["", ""],
    },
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
            <div className={styles.padStack}>{renderBlankPads(7, 3)}</div>
            <div className={styles.knobColumn}>
              {adsr ? (
                renderEnvelopeKnob(0, "var(--synth-chalk)", "#141413")
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
              {adsr ? (
                renderEnvelopeKnob(1, "var(--synth-green)")
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
              title={adsr ? "ADSR" : edits ? `${preset.name} *` : preset.name}
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
                      const bound = library.buttons
                        .map((id, pad) => (id === candidate.id ? pad + 1 : 0))
                        .filter(Boolean);
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
              envelope={envelope}
            />

            <div className={styles.knobColumn}>
              {adsr ? (
                renderEnvelopeKnob(2, "var(--synth-red)")
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
              {adsr ? (
                renderEnvelopeKnob(3, "var(--synth-blue)")
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
            <div className={styles.padStack}>{renderBlankPads(10, 3)}</div>
          </div>

          <div className={styles.row}>
            <div className={styles.side}>
              <div
                className={styles.toolGroup}
                role="group"
                aria-label="Synth tools"
              >
                <Pad
                  label={libraryMode ? "Preset library" : "Synth parameters"}
                  accent="var(--synth-red)"
                  lit={view === "synth" || view === "presets"}
                  onPress={pressSynth}
                >
                  {libraryMode ? <LayoutGrid /> : <AudioWaveform />}
                </Pad>
                <Pad
                  label={
                    shift
                      ? adsrOn
                        ? "Turn ADSR off"
                        : "Turn ADSR on"
                      : "ADSR envelope"
                  }
                  accent="var(--synth-red)"
                  lit={adsr}
                  onPress={pressAdsr}
                >
                  <AdsrIcon />
                </Pad>
                <Pad
                  label="Metronome"
                  accent="var(--synth-green)"
                  pressed={transport.metronome}
                  onPress={() => {
                    deviceEngine.unlock();
                    transport.toggleMetronome();
                  }}
                >
                  <Metronome />
                </Pad>
              </div>
              <div className={styles.pads} role="group" aria-label="Controls">
                <Pad
                  label="Record"
                  accent="var(--synth-red)"
                  lit={transport.state === "recording"}
                  onPress={transport.record}
                >
                  <Circle fill="currentColor" />
                </Pad>
                <Pad
                  label="Play"
                  accent="var(--synth-green)"
                  lit={transport.state === "playing"}
                  onPress={() => {
                    deviceEngine.unlock();
                    transport.play();
                  }}
                >
                  <Play fill="currentColor" />
                </Pad>
                <Pad
                  label="Stop"
                  accent="var(--synth-green)"
                  lit={stopLit}
                  onPress={() => {
                    transport.stop();
                    flashStop();
                  }}
                >
                  <Square fill="currentColor" />
                </Pad>
                <Pad
                  label="Sequencer"
                  accent="var(--synth-green)"
                  pressed={transport.mode === "sequencer"}
                  onPress={() =>
                    transport.setMode(
                      transport.mode === "sequencer" ? "tape" : "sequencer",
                    )
                  }
                >
                  <Grid3x3 />
                </Pad>
                {renderBlankPads(2, 2)}
                <Pad
                  label={
                    paging
                      ? "Previous page"
                      : shift
                        ? "Previous preset"
                        : "Octave down"
                  }
                  accent="var(--synth-red)"
                  onPress={() => step(-1)}
                >
                  <ArrowLeft />
                </Pad>
                <Pad
                  label={
                    paging ? "Next page" : shift ? "Next preset" : "Octave up"
                  }
                  accent="var(--synth-red)"
                  onPress={() => step(1)}
                >
                  <ArrowRight />
                </Pad>
                <Pad
                  label="Shift"
                  accent="var(--synth-red)"
                  pressed={shift}
                  held={shiftHeld}
                  onPress={() => setShiftLatched((on) => !on)}
                >
                  <ArrowUp />
                </Pad>
              </div>
            </div>

            <div className={styles.middle}>
              <div className={styles.toolbar}>
                <div
                  className={styles.toolGroup}
                  role="group"
                  aria-label="Presets"
                >
                  {padPresets.map((padPreset, pad) => {
                    const name = padPreset?.name ?? "empty";
                    return (
                      <Pad
                        key={pad}
                        label={
                          view === "presets"
                            ? `Bind to pad ${pad + 1} (${name})`
                            : view === "save"
                              ? `Save to pad ${pad + 1} (${name})`
                              : (padPreset?.name ??
                                `Empty preset pad ${pad + 1}`)
                        }
                        accent="var(--synth-red)"
                        onPress={() => pressPresetPad(pad)}
                      >
                        {padPreset && <PresetIcon icon={padPreset.icon} />}
                      </Pad>
                    );
                  })}
                </div>
                <div
                  className={styles.toolGroup}
                  role="group"
                  aria-label="Preset tools"
                >
                  <Pad
                    label="Save preset"
                    accent="var(--synth-red)"
                    onPress={pressSave}
                  >
                    <Save />
                  </Pad>
                  <Pad
                    label="Reset preset"
                    accent="var(--synth-red)"
                    onPress={pressReset}
                  >
                    <RotateCcw />
                  </Pad>
                </div>
                {renderBlankPads(1, 1)}
              </div>

              <div className={styles.keybed}>
                <div
                  className={styles.keys}
                  role="group"
                  aria-label="Piano keys"
                >
                  {WHITE_KEYS.map((semitone, slot) =>
                    renderKey(semitone, slot, false),
                  )}
                  {BLACK_KEYS.map((semitone) =>
                    renderKey(
                      semitone,
                      WHITE_KEYS.indexOf(semitone - 1) + 1,
                      true,
                    ),
                  )}
                </div>
              </div>
            </div>

            <div className={styles.side}>
              <div className={styles.toolGroup}>{renderBlankPads(4, 3)}</div>
              <div
                className={styles.pads}
                role="group"
                aria-label="Chord macros"
              >
                {CHORDS.map(({ name, label }, index) => (
                  <Pad
                    key={name}
                    label={`${name} chord`}
                    accent="var(--synth-blue)"
                    pressed={chord === index}
                    onPress={() =>
                      setChord((current) => (current === index ? null : index))
                    }
                  >
                    {label}
                  </Pad>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
