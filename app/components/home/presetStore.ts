import { useSyncExternalStore } from "react";
import { PATCH_BY_ID } from "../../lib/physical/patches";
import { DEVICE_PRESETS, type DevicePreset } from "./deviceEngine";

// Saved presets (`instruments`) and which preset each of the six preset
// pads plays (`buttons`) and plays with Shift held (`shiftButtons`), "" for
// none, persisted in localStorage.
export type PresetEdits = Readonly<Record<string, number>>;

export interface PresetLibrary {
  instruments: readonly DevicePreset[];
  buttons: readonly string[];
  shiftButtons: readonly string[];
  // Param changes made to each preset since it was picked, by preset id, kept
  // apart from the preset itself so Reset can drop them.
  edits: Readonly<Record<string, PresetEdits>>;
}

const STORAGE_KEY = "studio.instruments";
const PRESET_PADS = 6;

// What the pads play at first, and with Shift a relative from the same family.
// Every built-in preset stays in the library to bind to any pad.
const DEFAULT_PADS = [
  "piano",
  "guitar",
  "uprightBass",
  "flute",
  "saxophone",
  "drums",
];
const DEFAULT_SHIFT_PADS = [
  "harp",
  "electricGuitar",
  "bass",
  "violin",
  "trumpet",
  "drums808",
];

const padList = (ids: readonly string[]) =>
  Array.from({ length: PRESET_PADS }, (_, pad) => ids[pad] ?? "");

const DEFAULT_LIBRARY: PresetLibrary = {
  instruments: [],
  edits: {},
  buttons: padList(DEFAULT_PADS),
  shiftButtons: padList(DEFAULT_SHIFT_PADS),
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
    const pads = (field: "buttons" | "shiftButtons") =>
      DEFAULT_LIBRARY[field].map((fallback, i) => {
        const id = stored?.[field]?.[i];
        return typeof id === "string" && known.has(id) ? id : fallback;
      });
    // Only finite values for params the preset's instrument has.
    const edits: Record<string, PresetEdits> = {};
    for (const preset of [...DEVICE_PRESETS, ...instruments]) {
      const raw: unknown = stored?.edits?.[preset.id];
      if (!raw || typeof raw !== "object") continue;
      const params = new Set(
        PATCH_BY_ID[preset.target].params.map((spec) => spec.id),
      );
      const clean = Object.fromEntries(
        Object.entries(raw).filter(
          ([id, value]) =>
            params.has(id) &&
            typeof value === "number" &&
            Number.isFinite(value),
        ),
      );
      if (Object.keys(clean).length > 0) edits[preset.id] = clean;
    }
    return {
      instruments,
      buttons: pads("buttons"),
      shiftButtons: pads("shiftButtons"),
      edits,
    };
  } catch {
    return DEFAULT_LIBRARY;
  }
}

function update(change: (current: PresetLibrary) => PresetLibrary) {
  library = change(library ?? read());
  // Pads still on their default preset are stored as null, so they follow
  // later changes to the defaults.
  const stored = (field: "buttons" | "shiftButtons") =>
    library![field].map((id, i) =>
      id === DEFAULT_LIBRARY[field][i] ? null : id,
    );
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...library,
        buttons: stored("buttons"),
        shiftButtons: stored("shiftButtons"),
      }),
    );
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

const without = <T>(record: Readonly<Record<string, T>>, key: string) =>
  Object.fromEntries(Object.entries(record).filter(([id]) => id !== key));

// The current edits of a preset, outside React (e.g. on first load).
export const presetEdits = (presetId: string): PresetEdits | undefined =>
  getSnapshot().edits[presetId];

// Records one param change, or with null drops it (back to the preset's own
// value).
export function setEdit(
  presetId: string,
  paramId: string,
  value: number | null,
) {
  update((lib) => {
    const rest = without(lib.edits[presetId] ?? {}, paramId);
    const next = value === null ? rest : { ...rest, [paramId]: value };
    const others = without(lib.edits, presetId);
    return {
      ...lib,
      edits:
        Object.keys(next).length > 0 ? { ...others, [presetId]: next } : others,
    };
  });
}

export function clearEdits(presetId: string) {
  update((lib) => ({ ...lib, edits: without(lib.edits, presetId) }));
}

// Binds a preset to a pad, or with shift to the pad's Shift alternate.
export function bindPad(pad: number, presetId: string, shift = false) {
  const field = shift ? "shiftButtons" : "buttons";
  update((lib) => ({
    ...lib,
    [field]: lib[field].map((id, i) => (i === pad ? presetId : id)),
  }));
}
