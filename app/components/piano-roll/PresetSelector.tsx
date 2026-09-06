import React, { useState, useEffect } from "react";
import { synth } from "../../lib/synth";
import { cn } from "../../lib/utils";
import { Button } from "../design-system/Button";
import {
  Piano,
  Guitar,
  Zap,
  Drum,
  Wind,
  Volume2,
  Plus,
  X,
} from "lucide-react";
import {
  loadCustomPresets,
  deleteCustomPreset,
  subscribeCustomPresets,
  renderPresetIcon,
  getPresetColor,
  type CustomPreset,
} from "../../lib/customPresets";
import { SaveSynthDialog } from "./SaveSynthDialog";

export interface PresetSelectorProps {
  className?: string;
  selectedPreset?: string;
  onPresetChange?: (presetKey: string) => void;
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
}) => {
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>(() =>
    loadCustomPresets(),
  );

  useEffect(() => {
    const unsubscribe = subscribeCustomPresets((presets) => {
      setCustomPresets(presets);
    });
    return () => unsubscribe();
  }, []);

  const handleSelect = (key: string) => {
    synth.loadPreset(key);
    synth.playNote("C4", undefined, 0.35);
    if (onPresetChange) {
      onPresetChange(key);
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteCustomPreset(id);
    if (selectedPreset === id) {
      handleSelect("grand_piano");
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full w-full max-w-[72px] select-none overflow-hidden",
        className,
      )}
    >
      {/* Save Synth Button (Above Presets) */}
      <div className="pb-1 mb-1 w-full border-b border-stone-200/80 dark:border-[#1a202c] flex-shrink-0">
        <SaveSynthDialog
          onSaved={(newPreset) => {
            handleSelect(newPreset.id);
          }}
          trigger={
            <Button
              variant="outline"
              tone="secondary"
              size="sm"
              title="Save current synth as preset"
              aria-label="Save current synth as preset"
              className="w-full h-auto flex items-center justify-center gap-1 py-1 px-1 rounded-lg border border-dashed border-stone-300 dark:border-stone-700 hover:border-primary dark:hover:border-primary bg-stone-50 hover:bg-stone-100 dark:bg-[#0d1017] dark:hover:bg-[#161c28] text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white transition-all cursor-pointer group shadow-2xs"
            >
              <Plus className="w-3 h-3 text-stone-500 group-hover:text-primary transition-colors" />
              <span className="text-[9px] font-mono font-semibold uppercase tracking-wider">
                Save
              </span>
            </Button>
          }
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-0.5 no-scrollbar flex flex-col items-center">
        {/* Custom Presets (Saved Synths) */}
        {customPresets.map((cp) => {
          const colorTheme = getPresetColor(cp.color);
          const isSelected = selectedPreset === cp.id;

          return (
            <div key={cp.id} className="relative w-full group/custom">
              <Button
                variant="solid"
                tone="secondary"
                size="sm"
                onClick={() => handleSelect(cp.id)}
                aria-pressed={isSelected}
                title={`Custom: ${cp.name}`}
                className={cn(
                  "w-full aspect-square max-h-12 sm:max-h-13 h-auto flex flex-col items-center justify-center p-1 rounded-lg transition-all border select-none cursor-pointer group",
                  isSelected
                    ? colorTheme.selected
                    : cn(
                        "bg-stone-100/80 dark:bg-[#0d1017] text-stone-600 dark:text-stone-400 border-stone-200/80 dark:border-[#1a202c]",
                        colorTheme.hover,
                        "hover:text-stone-950 dark:hover:text-white hover:border-stone-300 dark:hover:border-stone-700",
                      ),
                )}
              >
                <div
                  className={cn(
                    "transition-transform group-hover:scale-110",
                    isSelected ? "text-white" : colorTheme.text,
                  )}
                >
                  {renderPresetIcon(cp.icon, "w-4 h-4")}
                </div>
                <span
                  className={cn(
                    "text-[8.5px] font-mono leading-none tracking-tight truncate max-w-full mt-1 text-center font-medium",
                    isSelected ? "text-white font-bold" : "",
                  )}
                >
                  {cp.name}
                </span>
              </Button>

              <Button
                variant="ghost"
                tone="secondary"
                size="sm"
                onClick={(e) => handleDelete(cp.id, e)}
                title={`Delete ${cp.name}`}
                aria-label={`Delete ${cp.name}`}
                className="absolute -top-1 -right-1 w-4 h-4 p-0 min-w-0 rounded-full bg-stone-200 dark:bg-stone-800 hover:bg-red-500 hover:text-white text-stone-500 dark:text-stone-400 opacity-0 group-hover/custom:opacity-100 transition-opacity flex items-center justify-center cursor-pointer shadow-xs z-10 border-0"
              >
                <X className="w-2.5 h-2.5" />
              </Button>
            </div>
          );
        })}

        {customPresets.length > 0 && (
          <div className="w-full py-0.5 flex items-center justify-center">
            <div className="w-8 h-px bg-stone-200 dark:bg-stone-800" />
          </div>
        )}

        {/* Built-in Presets */}
        {INSTRUMENTS.map((inst) => {
          const IconComp = inst.icon;
          const isSelected =
            selectedPreset === inst.key ||
            (inst.aliases && inst.aliases.includes(selectedPreset));

          return (
            <Button
              key={inst.key}
              variant="solid"
              tone="secondary"
              size="sm"
              onClick={() => handleSelect(inst.key)}
              aria-pressed={isSelected}
              title={inst.name}
              className={cn(
                "w-full aspect-square max-h-12 sm:max-h-13 h-auto flex flex-col items-center justify-center p-1 rounded-lg transition-all border select-none cursor-pointer group",
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
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default PresetSelector;
