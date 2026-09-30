import { useSyncExternalStore } from "react";
import { PATCH_BY_ID } from "../../lib/physical/patches";
import { DEVICE_PRESETS, type DevicePreset } from "./deviceEngine";

// Saved presets (`instruments`) and which preset each of the eight preset pads
// plays (`buttons`), persisted in localStorage.
export interface PresetLibrary {
  instruments: readonly DevicePreset[];
  buttons: readonly string[];
}

const STORAGE_KEY = "studio.instruments";
const PRESET_PADS = 8;

const DEFAULT_LIBRARY: PresetLibrary = {
  instruments: [],
  buttons: DEVICE_PRESETS.slice(0, PRESET_PADS).map((preset) => preset.id),
};

let library: PresetLibrary | null = null;
const listeners = new Set<() => void>();

const isPreset = (value: unknown): value is DevicePreset => {
  const preset = value as DevicePreset;
  return (
    typeof preset?.id === "string" &&
    typeof preset.name === "string" &&
    typeof preset.icon === "string" &&
    preset.target in PATCH_BY_ID
  );
};

function read(): PresetLibrary {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    const instruments = Array.isArray(stored?.instruments)
      ? (stored.instruments as unknown[]).filter(isPreset)
      : [];
    const known = new Set([
      ...DEVICE_PRESETS.map((preset) => preset.id),
      ...instruments.map((preset) => preset.id),
    ]);
    const buttons = DEFAULT_LIBRARY.buttons.map((fallback, i) => {
      const id = stored?.buttons?.[i];
      return typeof id === "string" && known.has(id) ? id : fallback;
    });
    return { instruments, buttons };
  } catch {
    return DEFAULT_LIBRARY;
  }
}

function update(change: (current: PresetLibrary) => PresetLibrary) {
  library = change(library ?? read());
  // Pads still on their default preset are stored as null, so they follow
  // later changes to the default order.
  const buttons = library.buttons.map((id, i) =>
    id === DEFAULT_LIBRARY.buttons[i] ? null : id,
  );
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...library, buttons }));
  } catch {
    // Storage can be unavailable (private mode); the change still applies.
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => (library ??= read());
const getServerSnapshot = () => DEFAULT_LIBRARY;

export function usePresetLibrary() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export const allPresets = (current: PresetLibrary): readonly DevicePreset[] => [
  ...DEVICE_PRESETS,
  ...current.instruments,
];

// Saves the base preset's instrument with the given param values under the
// next free "<instrument> <n>" name.
export function savePreset(
  base: DevicePreset,
  values: Record<string, number>,
  icon: string,
) {
  const current = library ?? read();
  const family = DEVICE_PRESETS.find((preset) => preset.target === base.target);
  const root = family?.name ?? base.name;
  const taken = allPresets(current).filter(
    (preset) => preset.target === base.target,
  );
  const preset: DevicePreset = {
    ...base,
    id: `user-${Date.now().toString(36)}`,
    name: `${root} ${taken.length + 1}`,
    icon,
    user: true,
    overrides: values,
  };
  update((lib) => ({ ...lib, instruments: [...lib.instruments, preset] }));
  return preset;
}

export function updatePreset(
  preset: DevicePreset,
  values: Record<string, number>,
  icon: string,
) {
  const next: DevicePreset = { ...preset, icon, overrides: values };
  update((lib) => ({
    ...lib,
    instruments: lib.instruments.map((saved) =>
      saved.id === preset.id ? next : saved,
    ),
  }));
  return next;
}

export function bindPad(pad: number, presetId: string) {
  update((lib) => ({
    ...lib,
    buttons: lib.buttons.map((id, i) => (i === pad ? presetId : id)),
  }));
}
