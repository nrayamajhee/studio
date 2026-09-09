import React, { useState, useEffect } from "react";
import { synth } from "../../lib/synth";
import { cn } from "../../lib/utils";
import { Button } from "../design-system/Button";
import { Caption } from "../design-system/Typography";
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
  variant?: "column" | "grid";
  showSaveButton?: boolean;
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
  variant = "column",
  showSaveButton = true,
}) => {
  const isGrid = variant === "grid";
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
        "flex flex-col w-full select-none",
        !isGrid ? "h-full max-w-[72px] overflow-hidden" : "",
        className,
      )}
    >
      <div
        className={cn(
          isGrid
            ? "grid grid-cols-3 gap-1.5 auto-rows-max overflow-y-auto pr-0.5 custom-scrollbar"
            : "flex-1 min-h-0 overflow-y-auto space-y-1 flex flex-col items-center no-scrollbar pr-0.5",
        )}
      >
        {showSaveButton && (
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
                className={cn(
                  "w-full flex flex-col items-center justify-center rounded-lg transition-all border-2 border-dashed border-stone-300 dark:border-stone-700 hover:border-primary dark:hover:border-primary/80 bg-stone-50/50 dark:bg-stone-900/30 hover:bg-stone-100/80 dark:hover:bg-stone-800/50 text-stone-500 dark:text-stone-400 hover:text-primary dark:hover:text-primary select-none cursor-pointer group",
                  isGrid
                    ? "py-1.5 px-1 h-auto min-h-[40px]"
                    : "aspect-square max-h-10 sm:max-h-11 h-auto p-0.5",
                )}
              >
                <div className="transition-transform group-hover:scale-110 text-stone-500 dark:text-stone-400 group-hover:text-primary">
                  <Plus className="w-3.5 h-3.5" />
                </div>
                <Caption asChild>
                  <span
                    className={cn(
                      "text-[8.5px] font-mono leading-none tracking-tight truncate max-w-full text-center font-medium",
                      isGrid ? "mt-1" : "mt-0.5",
                    )}
                  >
                    Save
                  </span>
                </Caption>
              </Button>
            }
          />
        )}

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
                  "w-full flex flex-col items-center justify-center rounded-lg transition-all border select-none cursor-pointer group",
                  isGrid
                    ? "py-1.5 px-1 h-auto min-h-[40px]"
                    : "aspect-square max-h-10 sm:max-h-11 h-auto p-0.5",
                  isSelected
                    ? colorTheme.selected
                    : cn(
                        "bg-stone-100/80 dark:bg-stone-900 text-stone-600 dark:text-stone-400 border-stone-200/80 dark:border-stone-800",
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
                  {renderPresetIcon(cp.icon, "w-3.5 h-3.5")}
                </div>
                <Caption asChild>
                  <span
                    className={cn(
                      "text-[8.5px] font-mono leading-none tracking-tight truncate max-w-full text-center font-medium",
                      isGrid ? "mt-1" : "mt-0.5",
                      isSelected ? "text-white font-bold" : "",
                    )}
                  >
                    {cp.name}
                  </span>
                </Caption>
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
                "w-full flex flex-col items-center justify-center rounded-lg transition-all border select-none cursor-pointer group",
                isGrid
                  ? "py-1.5 px-1 h-auto min-h-[40px]"
                  : "aspect-square max-h-10 sm:max-h-11 h-auto p-0.5",
                isSelected
                  ? inst.color.selected
                  : cn(
                      "bg-stone-100/80 dark:bg-stone-900 text-stone-600 dark:text-stone-400 border-stone-200/80 dark:border-stone-800",
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
                <IconComp className="w-3.5 h-3.5" />
              </div>
              <Caption asChild>
                <span
                  className={cn(
                    "text-[8.5px] font-mono leading-none tracking-tight truncate max-w-full text-center font-medium",
                    isGrid ? "mt-1" : "mt-0.5",
                    isSelected ? "text-white font-bold" : "",
                  )}
                >
                  {inst.name}
                </span>
              </Caption>
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default PresetSelector;
