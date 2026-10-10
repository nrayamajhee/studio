import { useEffect, useState, type ReactNode } from "react";
import { PATCH_BY_ID } from "../lib/physical/patches";
import { MODULES, paramModules } from "../lib/physical/patches/params";
import type { ParamSpec } from "../lib/physical/patches/types";
import {
  formatParam,
  stepToValue,
  valueToStep,
} from "../lib/physical/patches/format";
import {
  KNOB_STEPS,
  deviceEngine,
  findPreset,
  isKit,
  presetValues,
  type DevicePreset,
} from "../components/home/deviceEngine";
import { clampOctave } from "../components/home/deviceMath";
import {
  allPresets,
  clearAllEdits,
  clearEdits,
  presetEdits,
  setEdit,
  usePresetLibrary,
} from "../components/home/presetStore";
import { createStrictContext } from "./createStrictContext";

const INITIAL_PRESET = "piano";

// An instrument's params a module at a time, in module order: each page's
// name, the params on it and where they start in the flat list.
function paramPages(params: readonly ParamSpec[]) {
  let start = 0;
  return paramModules(params).map((module) => {
    const page = { ...module, start };
    start += module.specs.length;
    return page;
  });
}

// A param's name away from its page: its label, led by its module where
// another module has the same one (the filter's Resonance, the body's).
const paramName = (specs: readonly ParamSpec[], spec: ParamSpec) =>
  specs.some((other) => other !== spec && other.label === spec.label)
    ? `${MODULES.find(({ id }) => id === spec.section)?.label} ${spec.label}`
    : spec.label;

function useSoundValue() {
  const library = usePresetLibrary();
  const presets = allPresets(library);
  const [preset, setPreset] = useState(() => findPreset(INITIAL_PRESET));
  const [paramIndex, setParamIndex] = useState(0);
  const [octave, setOctave] = useState(0);

  useEffect(() => {
    const initial = findPreset(INITIAL_PRESET);
    deviceEngine.loadPreset(initial, presetEdits(initial.id));
  }, []);

  // The preset's own values plus any edits made since it was picked.
  const edits = library.edits[preset.id];
  const values = { ...presetValues(preset), ...edits };
  const pages = paramPages(PATCH_BY_ID[preset.target].params);
  const specs = pages.flatMap((page) => page.specs);
  const selected = specs[Math.min(paramIndex, specs.length - 1)];
  // The page always follows the selected param.
  const paramPage = pages.reduce(
    (at, page, i) => (page.start <= paramIndex ? i : at),
    0,
  );
  const selectedValue = values[selected.id] ?? selected.default;
  // A param with named choices (the oscillator's wave) steps through them.
  const valueSteps = selected.options?.length ?? KNOB_STEPS;

  // Keeps the selected param when the next instrument has it too, and the
  // octave shift as far as the next one's range allows.
  const selectPreset = (next: DevicePreset) => {
    deviceEngine.unlock();
    deviceEngine.loadPreset(next, library.edits[next.id]);
    setPreset(next);
    setOctave((current) => clampOctave(current, next));
    const nextSpecs = paramPages(PATCH_BY_ID[next.target].params).flatMap(
      (page) => page.specs,
    );
    setParamIndex(
      Math.max(
        0,
        nextSpecs.findIndex(({ id }) => id === selected.id),
      ),
    );
  };

  return {
    library,
    presets,
    preset,
    edits,
    values,
    specs,
    selected,
    selectedName: paramName(specs, selected),
    selectedValue,
    selectedDisplay: formatParam(selected, selectedValue),
    valueSteps,
    paramIndex,
    paramPage,
    // The pages' names, one per module.
    pageNames: pages.map((page) => page.label),
    // The params on the page showing.
    pageSpecs: pages[paramPage].specs,
    pageStart: pages[paramPage].start,
    octave,
    octaveLabel: `OCT ${octave > 0 ? "+" : octave < 0 ? "−" : "±"}${Math.abs(octave)}`,
    // The kit the sequencer plays, while one is picked.
    stepKit: isKit(preset.target) ? preset.target : null,
    selectPreset,
    // Saving bakes the edits into the saved preset, so the one it came from
    // goes back to its own values.
    adoptPreset: (saved: DevicePreset) => {
      deviceEngine.loadPreset(saved);
      setPreset(saved);
    },
    // Shift and the arrows step through every preset, round and round.
    stepPreset: (direction: 1 | -1) => {
      const index = presets.findIndex(({ id }) => id === preset.id) + direction;
      selectPreset(presets[(index + presets.length) % presets.length]);
    },
    shiftOctave: (direction: 1 | -1) =>
      setOctave((current) => clampOctave(current + direction, preset)),
    selectParam: setParamIndex,
    // Turning to a module's page selects its first param.
    showParamPage: (page: number) =>
      setParamIndex(pages[Math.max(0, Math.min(page, pages.length - 1))].start),
    // Turning back to the preset's own step restores its exact value and
    // drops the edit.
    setSelectedValue: (step: number) => {
      const own = presetValues(preset)[selected.id];
      const original = step === valueToStep(selected, own, valueSteps);
      const value = original ? own : stepToValue(selected, step, valueSteps);
      deviceEngine.setValue(selected.id, value);
      setEdit(preset.id, selected.id, original ? null : value);
    },
    revertSound: () => {
      clearEdits(preset.id);
      deviceEngine.loadPreset(preset);
    },
    revertAllSounds: () => {
      clearAllEdits();
      deviceEngine.loadPreset(preset);
    },
  };
}

export type SoundValue = ReturnType<typeof useSoundValue>;

const [SoundContext, useSound] =
  createStrictContext<SoundValue>("SoundProvider");
export { useSound };

// The instrument playing: its preset, edited params and octave shift.
export function SoundProvider({ children }: { children: ReactNode }) {
  return <SoundContext value={useSoundValue()}>{children}</SoundContext>;
}
