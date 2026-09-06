import React, { useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "../design-system/Dialog";
import { Button } from "../design-system/Button";
import {
  saveCustomPreset,
  PRESET_ICONS,
  PRESET_COLORS,
  renderPresetIcon,
  getPresetColor,
  type CustomPreset,
} from "../../lib/customPresets";
import { synth } from "../../lib/synth";
import { cn } from "../../lib/utils";
import { Plus, Check, Sparkles } from "lucide-react";

export interface SaveSynthDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved?: (preset: CustomPreset) => void;
}

export const SaveSynthDialog: React.FC<SaveSynthDialogProps> = ({
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onSaved,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange : setInternalOpen;

  const [name, setName] = useState("");
  const [selectedIconId, setSelectedIconId] = useState("waves");
  const [selectedColorId, setSelectedColorId] = useState("cyan");
  const [error, setError] = useState<string | null>(null);

  const activeColor = getPresetColor(selectedColorId);

  const handleOpen = () => {
    setName("");
    setSelectedIconId("waves");
    setSelectedColorId("cyan");
    setError(null);
    setOpen?.(true);
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a preset name");
      return;
    }

    const newPreset = saveCustomPreset({
      name: trimmed,
      icon: selectedIconId,
      color: selectedColorId,
      params: synth.getParams(),
    });

    synth.playNote("C4", undefined, 0.4);

    if (onSaved) {
      onSaved(newPreset);
    }

    setOpen?.(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild onClick={handleOpen}>
          {trigger}
        </DialogTrigger>
      ) : (
        <DialogTrigger asChild onClick={handleOpen}>
          <Button
            variant="solid"
            tone="secondary"
            size="sm"
            className="flex items-center gap-1.5 text-xs font-mono"
          >
            <Plus className="w-3.5 h-3.5" />
            Save Synth
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-w-md p-5 sm:p-6">
        <form onSubmit={handleSave} className="space-y-4">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle>Save Synth Preset</DialogTitle>
                <DialogDescription>
                  Save your current synth sound into a quick-access preset button.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Live Preview Card */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-stone-100 dark:bg-[#07090e] border border-stone-200 dark:border-[#1f2533]">
            <div className="flex flex-col">
              <span className="text-[11px] font-mono text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                Preset Preview
              </span>
              <span className="text-xs text-stone-700 dark:text-stone-300">
                How it will appear above presets:
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Unselected preview */}
              <div
                className={cn(
                  "w-13 h-13 flex flex-col items-center justify-center p-1 rounded-lg border select-none",
                  "bg-stone-100/80 dark:bg-[#0d1017] text-stone-600 dark:text-stone-400 border-stone-200/80 dark:border-[#1a202c]",
                )}
                title="Unselected state"
              >
                <div className={activeColor.text}>
                  {renderPresetIcon(selectedIconId, "w-4 h-4")}
                </div>
                <span className="text-[8.5px] font-mono leading-none tracking-tight truncate max-w-full mt-1 text-center font-medium">
                  {name.trim() || "Preset"}
                </span>
              </div>

              {/* Selected preview */}
              <div
                className={cn(
                  "w-13 h-13 flex flex-col items-center justify-center p-1 rounded-lg border select-none",
                  activeColor.selected,
                )}
                title="Selected state"
              >
                <div className="text-white">
                  {renderPresetIcon(selectedIconId, "w-4 h-4 text-white")}
                </div>
                <span className="text-[8.5px] font-mono leading-none tracking-tight truncate max-w-full mt-1 text-center font-bold text-white">
                  {name.trim() || "Preset"}
                </span>
              </div>
            </div>
          </div>

          {/* Name input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label
                htmlFor="synth-preset-name"
                className="text-xs font-semibold text-stone-800 dark:text-stone-200"
              >
                Preset Name
              </label>
              <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400">
                {name.length}/14
              </span>
            </div>
            <input
              id="synth-preset-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value.slice(0, 14));
                if (error) setError(null);
              }}
              placeholder="e.g. Warm Pad, Cosmic Lead"
              className={cn(
                "w-full px-3 py-2 text-sm rounded-lg border bg-stone-50 dark:bg-[#0a0d14] text-stone-900 dark:text-stone-100 focus:outline-none transition-all",
                error
                  ? "border-red-500 focus:ring-2 focus:ring-red-400"
                  : "border-stone-300 dark:border-stone-700 focus:ring-2 focus:ring-primary focus:border-primary",
              )}
            />
            {error && <p className="text-[11px] text-red-500 mt-0.5">{error}</p>}
          </div>

          {/* Icon Picker */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 block">
              Select Icon
            </span>
            <div className="grid grid-cols-5 gap-1.5 p-2 rounded-xl bg-stone-50 dark:bg-[#0a0d14] border border-stone-200 dark:border-stone-800 max-h-36 overflow-y-auto">
              {PRESET_ICONS.map((item) => {
                const isSelected = selectedIconId === item.id;
                return (
                  <Button
                    key={item.id}
                    type="button"
                    variant={isSelected ? "solid" : "outline"}
                    tone={isSelected ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setSelectedIconId(item.id)}
                    title={item.name}
                    aria-label={item.name}
                    className={cn(
                      "flex flex-col items-center justify-center p-2 h-auto rounded-lg border transition-all cursor-pointer",
                      isSelected
                        ? "shadow-sm ring-1 ring-primary"
                        : "bg-white dark:bg-[#121622] hover:bg-stone-200/60 dark:hover:bg-[#1b2234] border-stone-200 dark:border-[#232a3b] text-stone-700 dark:text-stone-300",
                    )}
                  >
                    {renderPresetIcon(item.id, "w-4 h-4")}
                    <span className="text-[8px] font-mono truncate max-w-full mt-1">
                      {item.name.split(" ")[0]}
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Color Accent Picker */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 block">
              Accent Color
            </span>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-stone-50 dark:bg-[#0a0d14] border border-stone-200 dark:border-stone-800 overflow-x-auto">
              {PRESET_COLORS.map((c) => {
                const isSelected = selectedColorId === c.id;
                return (
                  <Button
                    key={c.id}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedColorId(c.id)}
                    title={c.name}
                    aria-label={`Select ${c.name} color`}
                    className={cn(
                      "w-6 h-6 p-0 rounded-full flex items-center justify-center transition-all cursor-pointer flex-shrink-0 min-w-0 border-0",
                      c.swatch,
                      isSelected
                        ? "ring-2 ring-offset-2 ring-stone-900 dark:ring-white scale-110"
                        : "opacity-80 hover:opacity-100 hover:scale-105",
                    )}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                  </Button>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="ghost"
                tone="secondary"
                size="sm"
                type="button"
                onClick={() => setOpen?.(false)}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="solid"
              tone="primary"
              size="sm"
              type="submit"
              disabled={!name.trim()}
              className="flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Save Preset
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
