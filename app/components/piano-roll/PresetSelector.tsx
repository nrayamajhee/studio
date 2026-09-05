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
  color: {
    text: string;
    hover: string;
    selected: string;
  };
}

const INSTRUMENTS: InstrumentDef[] = [
  {
    key: "grand_piano",
    name: "Piano",
    aliases: ["piano"],
    icon: Piano,
    color: {
      text: "text-indigo-600 dark:text-indigo-400",
      hover: "hover:bg-indigo-50/80 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-800",
      selected: "bg-indigo-600 text-white border-indigo-400 shadow-sm shadow-indigo-500/30 ring-1 ring-indigo-400 font-bold",
    },
  },
  {
    key: "acoustic_guitar",
    name: "Guitar",
    aliases: ["guitar", "electric_guitar", "classical_guitar"],
    icon: Guitar,
    color: {
      text: "text-amber-600 dark:text-amber-400",
      hover: "hover:bg-amber-50/80 dark:hover:bg-amber-950/40 hover:border-amber-300 dark:hover:border-amber-800",
      selected: "bg-amber-600 text-white border-amber-400 shadow-sm shadow-amber-500/30 ring-1 ring-amber-400 font-bold",
    },
  },
  {
    key: "base_guitar",
    name: "Bass",
    aliases: ["bass"],
    icon: Zap,
    color: {
      text: "text-emerald-600 dark:text-emerald-400",
      hover: "hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 hover:border-emerald-300 dark:hover:border-emerald-800",
      selected: "bg-emerald-600 text-white border-emerald-400 shadow-sm shadow-emerald-500/30 ring-1 ring-emerald-400 font-bold",
    },
  },
  {
    key: "drum_set",
    name: "Drums",
    aliases: ["drums", "drum_808", "trap_kit", "electronic_drums", "acoustic_percussion"],
    icon: Drum,
    color: {
      text: "text-rose-600 dark:text-rose-400",
      hover: "hover:bg-rose-50/80 dark:hover:bg-rose-950/40 hover:border-rose-300 dark:hover:border-rose-800",
      selected: "bg-rose-600 text-white border-rose-400 shadow-sm shadow-rose-500/30 ring-1 ring-rose-400 font-bold",
    },
  },
  {
    key: "flute",
    name: "Flute",
    icon: Wind,
    color: {
      text: "text-cyan-600 dark:text-cyan-400",
      hover: "hover:bg-cyan-50/80 dark:hover:bg-cyan-950/40 hover:border-cyan-300 dark:hover:border-cyan-800",
      selected: "bg-cyan-600 text-white border-cyan-400 shadow-sm shadow-cyan-500/30 ring-1 ring-cyan-400 font-bold",
    },
  },
  {
    key: "saxophone",
    name: "Sax",
    icon: Volume2,
    color: {
      text: "text-purple-600 dark:text-purple-400",
      hover: "hover:bg-purple-50/80 dark:hover:bg-purple-950/40 hover:border-purple-300 dark:hover:border-purple-800",
      selected: "bg-purple-600 text-white border-purple-400 shadow-sm shadow-purple-500/30 ring-1 ring-purple-400 font-bold",
    },
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
        "flex flex-col h-full w-full bg-white dark:bg-[#07090e] border border-stone-200 dark:border-[#1f2533] rounded-xl p-1 shadow-sm dark:shadow-lg text-stone-800 dark:text-stone-200 select-none overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center justify-between px-0.5 pb-1 mb-1 border-b border-stone-200 dark:border-[#1a202c] flex-shrink-0">
        <span className="text-[8px] font-mono tracking-wider text-stone-500 dark:text-stone-400 uppercase font-bold truncate">
          Inst
        </span>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            title="Collapse instruments panel"
            aria-label="Collapse instruments panel"
            className="p-0.5 rounded text-stone-400 hover:text-stone-800 dark:text-stone-500 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-[#161c28] transition-colors cursor-pointer"
          >
            <PanelLeftClose className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-0.5 no-scrollbar flex flex-col items-center">
        {INSTRUMENTS.map((inst) => {
          const IconComp = inst.icon;
          const isSelected =
            selectedPreset === inst.key ||
            (inst.aliases && inst.aliases.includes(selectedPreset));

          return (
            <button
              key={inst.key}
              type="button"
              onClick={() => handleSelect(inst.key)}
              aria-pressed={isSelected}
              title={inst.name}
              className={cn(
                "w-full aspect-square max-h-12 sm:max-h-13 flex flex-col items-center justify-center p-1 rounded-lg transition-all border select-none cursor-pointer group",
                isSelected
                  ? inst.color.selected
                  : cn(
                      "bg-stone-100/80 dark:bg-[#0d1017] text-stone-600 dark:text-stone-400 border-stone-200/80 dark:border-[#1a202c]",
                      inst.color.hover,
                      "hover:text-stone-950 dark:hover:text-white hover:border-stone-300 dark:hover:border-stone-700",
                    ),
              )}
            >
              <div
                className={cn(
                  "transition-transform group-hover:scale-110",
                  isSelected ? "text-white" : inst.color.text,
                )}
              >
                <IconComp className="w-4 h-4" />
              </div>
              <span
                className={cn(
                  "text-[8.5px] font-mono leading-none tracking-tight truncate max-w-full mt-1 text-center font-medium",
                  isSelected ? "text-white font-bold" : "",
                )}
              >
                {inst.name}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
};

export default PresetSelector;
