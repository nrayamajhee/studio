import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { PATCH_BY_ID } from "../lib/physical/patches";
import {
  formatParam,
  stepToValue,
  valueToStep,
} from "../lib/physical/patches/format";
import type { ParamSpec } from "../lib/physical/patches/types";
import { PARAMS_PER_PAGE } from "../components/home/DeviceScreen";
import {
  KNOB_STEPS,
  deviceEngine,
  findPreset,
  presetValues,
  type DevicePreset,
} from "../components/home/deviceEngine";
import {
  allPresets,
  setEdit,
  usePresetLibrary,
  type PresetEdits,
  type PresetLibrary,
} from "../components/home/presetStore";

export const INITIAL_PRESET = "piano";

export interface ScreenParamRow {
  id: string;
  label: string;
  value: string;
  selected: boolean;
}

interface SoundValue {
  library: PresetLibrary;
  presets: readonly DevicePreset[];
  preset: DevicePreset;
  edits: PresetEdits | undefined;
  values: Record<string, number>;
  specs: readonly ParamSpec[];
  selected: ParamSpec;
  selectedValue: number;
  valueSteps: number;
  params: readonly ScreenParamRow[];
  pages: number;
  paramIndex: number;
  paramPage: number;
  iconIndex: number;
  presetIndex: number;
  revertIndex: number;
  setPreset: Dispatch<SetStateAction<DevicePreset>>;
  setParamIndex: Dispatch<SetStateAction<number>>;
  setParamPage: Dispatch<SetStateAction<number>>;
  setIconIndex: Dispatch<SetStateAction<number>>;
  setPresetIndex: Dispatch<SetStateAction<number>>;
  setRevertIndex: Dispatch<SetStateAction<number>>;
  selectParam: (index: number) => void;
  showParamPage: (page: number) => void;
  setSelectedValue: (step: number) => void;
}

const SoundContext = createContext<SoundValue | null>(null);

export function SoundProvider({ children }: { children: ReactNode }) {
  const library = usePresetLibrary();
  const presets = allPresets(library);
  const [preset, setPreset] = useState(() => findPreset(INITIAL_PRESET));
  const [paramIndex, setParamIndex] = useState(0);
  const [paramPage, setParamPage] = useState(0);
  const [iconIndex, setIconIndex] = useState(0);
  const [presetIndex, setPresetIndex] = useState(0);
  const [revertIndex, setRevertIndex] = useState(0);

  // The preset's own values plus any edits made since it was picked.
  const edits = library.edits[preset.id];
  const values = { ...presetValues(preset), ...edits };
  const specs = PATCH_BY_ID[preset.target].params;
  const selected = specs[Math.min(paramIndex, specs.length - 1)];
  const selectedValue = values[selected.id] ?? selected.default;
  // A param with named choices (the oscillator's wave) steps through them.
  const valueSteps = selected.options?.length ?? KNOB_STEPS;

  const params: ScreenParamRow[] = specs.map((spec) => ({
    id: spec.id,
    label: spec.label,
    value: formatParam(spec, values[spec.id] ?? spec.default),
    selected: spec === selected,
  }));
  const pages = Math.ceil(params.length / PARAMS_PER_PAGE);

  // The green knob picks a param on the scope, the red one on the synth page.
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
    const original = step === valueToStep(selected, own, valueSteps);
    const value = original ? own : stepToValue(selected, step, valueSteps);
    deviceEngine.setValue(selected.id, value);
    setEdit(preset.id, selected.id, original ? null : value);
  };

  const value: SoundValue = {
    library,
    presets,
    preset,
    edits,
    values,
    specs,
    selected,
    selectedValue,
    valueSteps,
    params,
    pages,
    paramIndex,
    paramPage,
    iconIndex,
    presetIndex,
    revertIndex,
    setPreset,
    setParamIndex,
    setParamPage,
    setIconIndex,
    setPresetIndex,
    setRevertIndex,
    selectParam,
    showParamPage,
    setSelectedValue,
  };

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound() {
  const context = useContext(SoundContext);
  if (!context) throw new Error("Wrap the Device in a SoundProvider");
  return context;
}
