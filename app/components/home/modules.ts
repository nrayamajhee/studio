import { MASTER_PARAMS } from "../../lib/physical/patches";
import {
  formatParam,
  stepToValue,
  valueToStep,
} from "../../lib/physical/patches/format";
import {
  DEVICE_MODULES,
  deviceEngine,
  type DeviceSound,
  type ModuleId,
  type ModuleKnob,
} from "./deviceEngine";

export const MODULE_IDS: readonly ModuleId[] = ["adsr", "lfo", "fx"];

// The ADSR, LFO and FX as the take or a track has them: each on or off, and
// its knobs' steps, which are kept while it is off.
export interface ModuleSettings {
  on: Readonly<Record<ModuleId, boolean>>;
  steps: Readonly<Record<ModuleId, readonly number[]>>;
}

export const INITIAL_MODULES: ModuleSettings = {
  on: { adsr: false, lfo: false, fx: false },
  steps: Object.fromEntries(
    MODULE_IDS.map((id) => [
      id,
      DEVICE_MODULES[id].knobs.map(({ spec, steps }) =>
        valueToStep(spec, spec.default, steps),
      ),
    ]),
  ) as unknown as Record<ModuleId, readonly number[]>,
};

export const knobValue = ({ spec, steps, floor }: ModuleKnob, step: number) =>
  step === 0 && floor !== undefined ? floor : stepToValue(spec, step, steps);

export const knobDisplay = (knob: ModuleKnob, step: number) =>
  knob.options?.[step] ?? formatParam(knob.spec, knobValue(knob, step));

// The engine's own default for a master param: what leaves the sound alone.
const engineDefault = (id: string) =>
  MASTER_PARAMS.find((param) => param.id === id)?.default ?? 0;

// Every module param's value: the knobs' while the module is on, and the
// engine's default, which leaves the sound alone, while it is off.
export function moduleValues({ on, steps }: ModuleSettings) {
  const values: Record<string, number> = {};
  for (const id of MODULE_IDS)
    DEVICE_MODULES[id].knobs.forEach((knob, i) => {
      values[knob.spec.id] = on[id]
        ? knobValue(knob, steps[id][i])
        : engineDefault(knob.spec.id);
    });
  return values;
}

// Plays the live sound through `modules`.
export function applyModules(modules: ModuleSettings) {
  const values = moduleValues(modules);
  deviceEngine.setMasterParams(Object.keys(values), values);
}

// `sound` rendered through `modules` in place of the ones it was saved with.
export function withModules(
  sound: DeviceSound,
  modules: ModuleSettings,
): DeviceSound {
  return {
    ...sound,
    overrides: {
      ...sound.overrides,
      master: { ...sound.overrides.master, ...moduleValues(modules) },
    },
  };
}

// The settings a track saved before it kept its own had baked into its
// sound: a module is on if any of its params is off the engine's default.
export function modulesOf(sound: DeviceSound): ModuleSettings {
  const master = sound.overrides.master ?? {};
  const on = { ...INITIAL_MODULES.on };
  const steps = { ...INITIAL_MODULES.steps };
  for (const id of MODULE_IDS) {
    const { knobs } = DEVICE_MODULES[id];
    on[id] = knobs.some(
      ({ spec }) =>
        master[spec.id] !== undefined &&
        Math.abs(master[spec.id] - engineDefault(spec.id)) > 1e-9,
    );
    if (!on[id]) continue;
    steps[id] = knobs.map((knob, i) => {
      const value = master[knob.spec.id];
      if (value === undefined) return INITIAL_MODULES.steps[id][i];
      if (knob.floor !== undefined && value === knob.floor) return 0;
      return valueToStep(knob.spec, value, knob.steps);
    });
  }
  return { on, steps };
}

const isStepList = (value: unknown, length: number) =>
  Array.isArray(value) &&
  value.length === length &&
  value.every((step) => Number.isInteger(step));

export const isModules = (value: unknown): value is ModuleSettings => {
  const modules = value as ModuleSettings;
  return MODULE_IDS.every(
    (id) =>
      typeof modules?.on?.[id] === "boolean" &&
      isStepList(modules.steps?.[id], DEVICE_MODULES[id].knobs.length),
  );
};
