import { useEffect, useState, type ReactNode } from "react";
import { PATCH_BY_ID } from "../lib/physical/patches";
import { moduleLabel, paramModules } from "../lib/physical/patches/params";
import type { ParamSpec, Patch } from "../lib/physical/patches/types";
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
import { synthPages, type SynthPageId } from "../components/home/synthPages";
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

// An instrument's params in module order, as the red knob picks them.
const moduleOrder = ({ params, family }: Patch) =>
  paramModules(params, family).flatMap((module) => module.specs);

// A param with named choices (the oscillator's wave) steps through them.
const stepsOf = (spec: ParamSpec) => spec.options?.length ?? KNOB_STEPS;

// A param's name away from its page: its label, led by its module where
// another module has the same one (the filter's Resonance, the body's).
const paramName = (
  { family }: Patch,
  specs: readonly ParamSpec[],
  spec: ParamSpec,
) =>
  specs.some((other) => other !== spec && other.label === spec.label)
    ? `${moduleLabel(family, spec.section)} ${spec.label}`
    : spec.label;

function useSoundValue() {
  const library = usePresetLibrary();
  const presets = allPresets(library);
  const [preset, setPreset] = useState(() => findPreset(INITIAL_PRESET));
  const [paramIndex, setParamIndex] = useState(0);
  const [octave, setOctave] = useState(0);
  // The Synth screen's page, and the block the overview has picked; kept by
  // module so they carry over to the next instrument when it has them.
  const [pageId, setPageId] = useState<SynthPageId>("chain");
  const [chainPick, setChainPick] = useState<SynthPageId>("exciter");

  useEffect(() => {
    const initial = findPreset(INITIAL_PRESET);
    deviceEngine.loadPreset(initial, presetEdits(initial.id));
  }, []);

  // The preset's own values plus any edits made since it was picked.
  const edits = library.edits[preset.id];
  const values = { ...presetValues(preset), ...edits };
  const patch = PATCH_BY_ID[preset.target];
  const specs = moduleOrder(patch);
  const selected = specs[Math.min(paramIndex, specs.length - 1)];
  const selectedValue = values[selected.id] ?? selected.default;
  const valueSteps = stepsOf(selected);
  const pages = synthPages(patch.params, patch.family);
  const pageIndex = Math.max(
    0,
    pages.findIndex(({ id }) => id === pageId),
  );
  const picked = pages.some(({ id }) => id === chainPick)
    ? chainPick
    : pages[1].id;

  // Turning back to the preset's own step restores its exact value and drops
  // the edit. The param becomes the selected one, so the main screen shows
  // what was last turned.
  const setParamStep = (spec: ParamSpec, step: number) => {
    const steps = stepsOf(spec);
    const own = presetValues(preset)[spec.id];
    const original = step === valueToStep(spec, own, steps);
    const value = original ? own : stepToValue(spec, step, steps);
    deviceEngine.setValue(spec.id, value);
    setEdit(preset.id, spec.id, original ? null : value);
    setParamIndex(Math.max(0, specs.indexOf(spec)));
  };

  // Keeps the selected param when the next instrument has it too, and the
  // octave shift as far as the next one's range allows.
  const selectPreset = (next: DevicePreset) => {
    deviceEngine.unlock();
    deviceEngine.loadPreset(next, library.edits[next.id]);
    setPreset(next);
    setOctave((current) => clampOctave(current, next));
    const nextSpecs = moduleOrder(PATCH_BY_ID[next.target]);
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
    selectedName: paramName(patch, specs, selected),
    selectedValue,
    selectedDisplay: formatParam(selected, selectedValue),
    valueSteps,
    paramIndex,
    // The Synth screen: its pages (the overview, then a module each), the one
    // showing and the block the overview has picked.
    pages,
    pageIndex,
    page: pages[pageIndex],
    chainPick: picked,
    showPage: (index: number) =>
      setPageId(pages[Math.max(0, Math.min(index, pages.length - 1))].id),
    pickBlock: setChainPick,
    stepsOf,
    setParamStep,
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
    setSelectedValue: (step: number) => setParamStep(selected, step),
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
