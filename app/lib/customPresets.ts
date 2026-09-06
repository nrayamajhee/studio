import React from "react";
import { synth, type SynthParams } from "./synth";
import {
  Piano,
  Guitar,
  Zap,
  Drum,
  Wind,
  Volume2,
  Waves,
  Sparkles,
  Flame,
  Disc,
  Radio,
  Sliders,
  Music,
  Bell,
  Activity,
  AudioLines,
  CloudRain,
  Sun,
  Heart,
  Cpu,
} from "lucide-react";

export interface CustomPreset {
  id: string;
  name: string;
  icon: string;
  color: string;
  params: SynthParams;
  createdAt: number;
}

export interface PresetIconOption {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface PresetColorOption {
  id: string;
  name: string;
  bg: string;
  text: string;
  hover: string;
  selected: string;
  border: string;
  swatch: string;
}

export const PRESET_ICONS: PresetIconOption[] = [
  { id: "waves", name: "Synth Waves", icon: Waves },
  { id: "sparkles", name: "Sparkles", icon: Sparkles },
  { id: "zap", name: "Lead / Zap", icon: Zap },
  { id: "piano", name: "Keyboard", icon: Piano },
  { id: "guitar", name: "Pluck / Guitar", icon: Guitar },
  { id: "drum", name: "Beat / Perc", icon: Drum },
  { id: "flame", name: "Drive / Fire", icon: Flame },
  { id: "wind", name: "Air / Wind", icon: Wind },
  { id: "volume2", name: "Brass / Horn", icon: Volume2 },
  { id: "audiolines", name: "Strings", icon: AudioLines },
  { id: "bell", name: "Bell / Chime", icon: Bell },
  { id: "activity", name: "Pulse / Arp", icon: Activity },
  { id: "music", name: "Melody", icon: Music },
  { id: "disc", name: "Vinyl / Disc", icon: Disc },
  { id: "radio", name: "Retro / Lo-Fi", icon: Radio },
  { id: "sliders", name: "Mod / Shape", icon: Sliders },
  { id: "cloudrain", name: "Atmosphere", icon: CloudRain },
  { id: "sun", name: "Bright / Shine", icon: Sun },
  { id: "heart", name: "Warm / Soul", icon: Heart },
  { id: "cpu", name: "8-Bit / Chip", icon: Cpu },
];

export const PRESET_COLORS: PresetColorOption[] = [
  {
    id: "cyan",
    name: "Cyan",
    bg: "bg-cyan-600",
    text: "text-cyan-600 dark:text-cyan-400",
    hover: "hover:bg-cyan-50/80 dark:hover:bg-cyan-950/40 hover:border-cyan-300 dark:hover:border-cyan-800",
    selected: "bg-cyan-600 text-white border-cyan-400 shadow-sm shadow-cyan-500/30 ring-1 ring-cyan-400 font-bold",
    border: "border-cyan-500",
    swatch: "bg-cyan-500",
  },
  {
    id: "indigo",
    name: "Indigo",
    bg: "bg-indigo-600",
    text: "text-indigo-600 dark:text-indigo-400",
    hover: "hover:bg-indigo-50/80 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-800",
    selected: "bg-indigo-600 text-white border-indigo-400 shadow-sm shadow-indigo-500/30 ring-1 ring-indigo-400 font-bold",
    border: "border-indigo-500",
    swatch: "bg-indigo-500",
  },
  {
    id: "purple",
    name: "Purple",
    bg: "bg-purple-600",
    text: "text-purple-600 dark:text-purple-400",
    hover: "hover:bg-purple-50/80 dark:hover:bg-purple-950/40 hover:border-purple-300 dark:hover:border-purple-800",
    selected: "bg-purple-600 text-white border-purple-400 shadow-sm shadow-purple-500/30 ring-1 ring-purple-400 font-bold",
    border: "border-purple-500",
    swatch: "bg-purple-500",
  },
  {
    id: "emerald",
    name: "Emerald",
    bg: "bg-emerald-600",
    text: "text-emerald-600 dark:text-emerald-400",
    hover: "hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 hover:border-emerald-300 dark:hover:border-emerald-800",
    selected: "bg-emerald-600 text-white border-emerald-400 shadow-sm shadow-emerald-500/30 ring-1 ring-emerald-400 font-bold",
    border: "border-emerald-500",
    swatch: "bg-emerald-500",
  },
  {
    id: "amber",
    name: "Amber",
    bg: "bg-amber-600",
    text: "text-amber-600 dark:text-amber-400",
    hover: "hover:bg-amber-50/80 dark:hover:bg-amber-950/40 hover:border-amber-300 dark:hover:border-amber-800",
    selected: "bg-amber-600 text-white border-amber-400 shadow-sm shadow-amber-500/30 ring-1 ring-amber-400 font-bold",
    border: "border-amber-500",
    swatch: "bg-amber-500",
  },
  {
    id: "rose",
    name: "Rose",
    bg: "bg-rose-600",
    text: "text-rose-600 dark:text-rose-400",
    hover: "hover:bg-rose-50/80 dark:hover:bg-rose-950/40 hover:border-rose-300 dark:hover:border-rose-800",
    selected: "bg-rose-600 text-white border-rose-400 shadow-sm shadow-rose-500/30 ring-1 ring-rose-400 font-bold",
    border: "border-rose-500",
    swatch: "bg-rose-500",
  },
  {
    id: "blue",
    name: "Blue",
    bg: "bg-blue-600",
    text: "text-blue-600 dark:text-blue-400",
    hover: "hover:bg-blue-50/80 dark:hover:bg-blue-950/40 hover:border-blue-300 dark:hover:border-blue-800",
    selected: "bg-blue-600 text-white border-blue-400 shadow-sm shadow-blue-500/30 ring-1 ring-blue-400 font-bold",
    border: "border-blue-500",
    swatch: "bg-blue-500",
  },
  {
    id: "orange",
    name: "Orange",
    bg: "bg-orange-600",
    text: "text-orange-600 dark:text-orange-400",
    hover: "hover:bg-orange-50/80 dark:hover:bg-orange-950/40 hover:border-orange-300 dark:hover:border-orange-800",
    selected: "bg-orange-600 text-white border-orange-400 shadow-sm shadow-orange-500/30 ring-1 ring-orange-400 font-bold",
    border: "border-orange-500",
    swatch: "bg-orange-500",
  },
];

const STORAGE_KEY = "studio_custom_presets";
const listeners: Set<(presets: CustomPreset[]) => void> = new Set();

export function getPresetIcon(iconId: string): React.ComponentType<{ className?: string }> {
  const match = PRESET_ICONS.find((item) => item.id === iconId);
  return match ? match.icon : Waves;
}

export function renderPresetIcon(
  iconId: string,
  className?: string,
): React.ReactElement {
  const match = PRESET_ICONS.find((item) => item.id === iconId);
  const IconComponent = match ? match.icon : Waves;
  return React.createElement(IconComponent, { className });
}

export function getPresetColor(colorId: string): PresetColorOption {
  const match = PRESET_COLORS.find((item) => item.id === colorId);
  return match || PRESET_COLORS[0];
}

export function loadCustomPresets(): CustomPreset[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: CustomPreset[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    parsed.forEach((preset) => {
      synth.registerPreset(preset.id, preset.params);
    });
    return parsed;
  } catch {
    return [];
  }
}

export function saveCustomPreset(data: {
  name: string;
  icon: string;
  color?: string;
  params?: SynthParams;
}): CustomPreset {
  const customPresets = loadCustomPresets();
  const id = `custom_${Date.now()}`;
  const color = data.color || "cyan";
  const params: SynthParams = data.params
    ? { ...data.params, name: data.name }
    : { ...synth.getParams(), name: data.name };

  const newPreset: CustomPreset = {
    id,
    name: data.name.trim(),
    icon: data.icon,
    color,
    params,
    createdAt: Date.now(),
  };

  const updated = [newPreset, ...customPresets];

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }

  synth.registerPreset(newPreset.id, newPreset.params);
  notifyListeners(updated);
  return newPreset;
}

export function deleteCustomPreset(id: string): void {
  const customPresets = loadCustomPresets();
  const updated = customPresets.filter((p) => p.id !== id);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }

  synth.unregisterPreset(id);
  notifyListeners(updated);
}

export function subscribeCustomPresets(
  listener: (presets: CustomPreset[]) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(presets: CustomPreset[]): void {
  listeners.forEach((listener) => {
    try {
      listener(presets);
    } catch {
      // Ignore callback errors
    }
  });
}
