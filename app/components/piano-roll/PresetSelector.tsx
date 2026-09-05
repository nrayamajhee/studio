import React, { useState } from "react";
import { synth, SYNTH_PRESETS } from "../../lib/synth";
import { Button } from "../design-system/Button";
import { Card } from "../design-system/Card";
import { cn } from "../../lib/utils";
import {
  Piano,
  Guitar,
  Zap,
  Drum,
  Disc,
  Wind,
  Volume2,
  Music,
  Sparkles,
  Radio,
  Layers,
  Activity,
  Flame,
} from "lucide-react";

export interface PresetSelectorProps {
  className?: string;
  selectedPreset?: string;
  onPresetChange?: (presetKey: string) => void;
}

export type PresetCategory = "all" | "keys" | "drums" | "synths" | "strings" | "acoustic";

interface PresetMeta {
  name: string;
  category: PresetCategory;
  icon: React.ComponentType<{ className?: string }>;
}

const PRESET_METAS: Record<string, PresetMeta> = {
  grand_piano: {
    name: "Grand Piano",
    category: "keys",
    icon: Piano,
  },
  electronic_pino: {
    name: "Electronic Piano",
    category: "keys",
    icon: Piano,
  },
  rhodes_piano: {
    name: "Rhodes Electric Tines",
    category: "keys",
    icon: Sparkles,
  },
  lofi_keys: {
    name: "Lo-Fi Wobbly Keys",
    category: "keys",
    icon: Radio,
  },
  organ: {
    name: "Drawbar Organ",
    category: "keys",
    icon: Layers,
  },
  drum_set: {
    name: "Drum Set",
    category: "drums",
    icon: Drum,
  },
  drum_808: {
    name: "808 Drum",
    category: "drums",
    icon: Disc,
  },
  trap_kit: {
    name: "Trap 808 & Hats",
    category: "drums",
    icon: Flame,
  },
  electronic_drums: {
    name: "Electronic Drums",
    category: "drums",
    icon: Activity,
  },
  acoustic_percussion: {
    name: "Acoustic Percussion",
    category: "drums",
    icon: Drum,
  },
  vintage_synth: {
    name: "Vintage Poly Synth",
    category: "synths",
    icon: Sparkles,
  },
  acid_bass: {
    name: "Acid 303 Bass",
    category: "synths",
    icon: Zap,
  },
  pluck_synth: {
    name: "Digital Pluck",
    category: "synths",
    icon: Music,
  },
  electric_guitar: {
    name: "Electric Guitar",
    category: "strings",
    icon: Guitar,
  },
  acoustic_guitar: {
    name: "Acoustic Guitar",
    category: "strings",
    icon: Guitar,
  },
  classical_guitar: {
    name: "Classical Guitar",
    category: "strings",
    icon: Music,
  },
  ukelele: {
    name: "Ukulele",
    category: "strings",
    icon: Music,
  },
  base_guitar: {
    name: "Bass Guitar",
    category: "strings",
    icon: Zap,
  },
  strings_ensemble: {
    name: "Strings Ensemble",
    category: "acoustic",
    icon: Layers,
  },
  marimba: {
    name: "Marimba / Mallet",
    category: "acoustic",
    icon: Music,
  },
  flute: {
    name: "Flute",
    category: "acoustic",
    icon: Wind,
  },
  saxophone: {
    name: "Saxophone",
    category: "acoustic",
    icon: Volume2,
  },
};

const CATEGORIES: { key: PresetCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "keys", label: "Keys" },
  { key: "drums", label: "Drums" },
  { key: "synths", label: "Synths" },
  { key: "strings", label: "Strings" },
  { key: "acoustic", label: "Acoustic" },
];

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  className,
  selectedPreset = "grand_piano",
  onPresetChange,
}) => {
  const [activeCategory, setActiveCategory] = useState<PresetCategory>("all");

  const handleSelect = (key: string) => {
    synth.loadPreset(key);
    synth.playNote("C4", undefined, 0.35);
    if (onPresetChange) {
      onPresetChange(key);
    }
  };

  const filteredPresets = Object.entries(SYNTH_PRESETS).filter(([key]) => {
    if (activeCategory === "all") return true;
    const meta = PRESET_METAS[key];
    return meta?.category === activeCategory;
  });

  return (
    <Card
      elevation="mid"
      className={cn(
        "flex flex-col h-full w-full bg-[#0a0c10] border border-[#1f2533] rounded-xl p-2 shadow-lg text-stone-200 select-none overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center gap-1 pb-1.5 mb-1.5 border-b border-[#1f2533] overflow-x-auto flex-shrink-0 no-scrollbar">
        {CATEGORIES.map((cat) => (
          <Button
            key={cat.key}
            variant="solid"
            tone={activeCategory === cat.key ? "accent" : "secondary"}
            size="sm"
            onClick={() => setActiveCategory(cat.key)}
            className={cn(
              "px-2 py-0.5 h-6 text-[10px] font-medium rounded-md whitespace-nowrap transition-colors border",
              activeCategory === cat.key
                ? "bg-[#d4a359] text-stone-950 border-[#f1c784] font-bold"
                : "bg-[#12151c] text-stone-400 border-[#1f2533] hover:text-stone-200",
            )}
          >
            {cat.label}
          </Button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
        {filteredPresets.map(([key, preset]) => {
          const meta = PRESET_METAS[key] || {
            name: preset.name,
            category: "keys",
            icon: Piano,
          };
          const IconComp = meta.icon;
          const isSelected = selectedPreset === key;

          return (
            <Button
              key={key}
              variant="solid"
              tone={isSelected ? "accent" : "secondary"}
              size="sm"
              align="left"
              fullWidth
              onClick={() => handleSelect(key)}
              aria-pressed={isSelected}
              leadingIcon={
                <div
                  className={cn(
                    "p-1 rounded flex items-center justify-center flex-shrink-0",
                    isSelected
                      ? "bg-black/15 text-stone-950"
                      : "bg-stone-800/80 text-[#d4a359]",
                  )}
                >
                  <IconComp className="w-3.5 h-3.5 fill-current" />
                </div>
              }
              title={meta.name}
              className={cn(
                "w-full h-9 px-2.5 justify-start text-left rounded-lg transition-all border",
                isSelected
                  ? "bg-[#d4a359] text-stone-950 border-[#f1c784] shadow-md shadow-[#d4a359]/20 font-bold ring-1 ring-[#f1c784]"
                  : "bg-[#12151c] text-stone-300 border-[#1f2533] hover:bg-[#1a202c] hover:text-white",
              )}
            />
          );
        })}
      </div>
    </Card>
  );
};

export default PresetSelector;
