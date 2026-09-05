import React from "react";
import { synth } from "../../lib/synth";
import { Button } from "../design-system/Button";
import { Card } from "../design-system/Card";
import { cn } from "../../lib/utils";
import {
  Piano,
  Guitar,
  Zap,
  Drum,
  Wind,
  Volume2,
  PanelLeftClose,
} from "lucide-react";

export interface PresetSelectorProps {
  className?: string;
  selectedPreset?: string;
  onPresetChange?: (presetKey: string) => void;
  onCollapse?: () => void;
}

interface InstrumentDef {
  key: string;
  name: string;
  aliases?: string[];
  icon: React.ComponentType<{ className?: string }>;
}

const INSTRUMENTS: InstrumentDef[] = [
  {
    key: "grand_piano",
    name: "Grand Piano",
    aliases: ["piano"],
    icon: Piano,
  },
  {
    key: "acoustic_guitar",
    name: "Guitar",
    aliases: ["guitar", "electric_guitar", "classical_guitar"],
    icon: Guitar,
  },
  {
    key: "base_guitar",
    name: "Bass",
    aliases: ["bass"],
    icon: Zap,
  },
  {
    key: "drum_set",
    name: "Drums",
    aliases: ["drums", "drum_808", "trap_kit", "electronic_drums", "acoustic_percussion"],
    icon: Drum,
  },
  {
    key: "flute",
    name: "Flute",
    icon: Wind,
  },
  {
    key: "saxophone",
    name: "Saxophone",
    icon: Volume2,
  },
];

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  className,
  selectedPreset = "grand_piano",
  onPresetChange,
  onCollapse,
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
        "flex flex-col h-full w-full bg-[#07090e] border border-[#1f2533] rounded-xl p-1.5 shadow-lg text-stone-200 select-none overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center justify-between px-1 pb-1 mb-1 border-b border-[#1a202c] flex-shrink-0">
        <span className="text-[9px] font-mono tracking-wider text-stone-500 uppercase font-bold">
          Instruments
        </span>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            title="Collapse instruments panel"
            aria-label="Collapse instruments panel"
            className="p-0.5 rounded text-stone-500 hover:text-[#d4a359] hover:bg-[#161c28] transition-colors cursor-pointer"
          >
            <PanelLeftClose className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-0.5 no-scrollbar">
        {INSTRUMENTS.map((inst) => {
          const IconComp = inst.icon;
          const isSelected =
            selectedPreset === inst.key ||
            (inst.aliases && inst.aliases.includes(selectedPreset));

          return (
            <Button
              key={inst.key}
              variant="solid"
              tone={isSelected ? "accent" : "secondary"}
              size="sm"
              align="left"
              fullWidth
              onClick={() => handleSelect(inst.key)}
              aria-pressed={isSelected}
              leadingIcon={
                <div
                  className={cn(
                    "p-0.5 rounded flex items-center justify-center flex-shrink-0",
                    isSelected
                      ? "text-stone-950"
                      : "text-[#d4a359]",
                  )}
                >
                  <IconComp className="w-3 h-3 fill-current" />
                </div>
              }
              title={inst.name}
              className={cn(
                "w-full h-7 sm:h-8 px-2 justify-start text-left rounded-lg transition-all border text-[10px] sm:text-[11px]",
                isSelected
                  ? "bg-[#d4a359] text-stone-950 border-[#f1c784] shadow-sm font-bold ring-1 ring-[#f1c784]"
                  : "bg-[#0d1017] text-stone-300 border-[#1a202c] hover:bg-[#161c28] hover:text-white",
              )}
            >
              <span className="truncate">{inst.name}</span>
            </Button>
          );
        })}
      </div>
    </Card>
  );
};

export default PresetSelector;
