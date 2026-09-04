import React from "react";
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
} from "lucide-react";

export interface PresetSelectorProps {
  className?: string;
  selectedPreset?: string;
  onPresetChange?: (presetKey: string) => void;
}

interface PresetMeta {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PRESET_METAS: Record<string, PresetMeta> = {
  electric_guitar: {
    name: "Electric Guitar",
    icon: Guitar,
  },
  acoustic_guitar: {
    name: "Acoustic Guitar",
    icon: Guitar,
  },
  classical_guitar: {
    name: "Classical Guitar",
    icon: Music,
  },
  ukelele: {
    name: "Ukulele",
    icon: Music,
  },
  base_guitar: {
    name: "Bass Guitar",
    icon: Zap,
  },
  electronic_pino: {
    name: "Electronic Piano",
    icon: Piano,
  },
  grand_piano: {
    name: "Grand Piano",
    icon: Piano,
  },
  drum_set: {
    name: "Drum Set",
    icon: Drum,
  },
  drum_808: {
    name: "808 Drum",
    icon: Disc,
  },
  flute: {
    name: "Flute",
    icon: Wind,
  },
  saxophone: {
    name: "Saxophone",
    icon: Volume2,
  },
};

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  className,
  selectedPreset = "grand_piano",
  onPresetChange,
}) => {
  const handleSelect = (key: string) => {
    synth.loadPreset(key);
    synth.playNote("C4", undefined, 0.35);
    if (onPresetChange) {
      onPresetChange(key);
    }
  };

  return (
    <Card
      elevation="mid"
      className={cn(
        "flex flex-col h-full w-full bg-[#0a0c10] border border-[#1f2533] rounded-xl p-2 shadow-lg text-stone-200 select-none overflow-hidden",
        className,
      )}
    >
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
        {Object.entries(SYNTH_PRESETS).map(([key, preset]) => {
          const meta = PRESET_METAS[key] || {
            name: preset.name,
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
