import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../design-system/Dialog";
import { Button } from "../design-system/Button";
import { Label, Title, Caption } from "../design-system/Typography";
import { TRACK_COLORS, type Track } from "../../lib/studioStorage";
import { Drum, Piano, Music } from "lucide-react";

export interface AddTrackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTrack: (trackProps: Partial<Track>) => void;
  nextTrackNumber: number;
}

const PRESET_OPTIONS = [
  { id: "grand_piano", name: "Grand Piano", category: "Keys", view: "keys" },
  { id: "electric_piano", name: "Electric Piano", category: "Keys", view: "keys" },
  { id: "drum_set", name: "Studio Drum Kit", category: "Drums", view: "drums" },
  { id: "drum_808", name: "808 Drum Machine", category: "Drums", view: "drums" },
  { id: "trap_kit", name: "Trap Drum Kit", category: "Drums", view: "drums" },
  { id: "analog_synth", name: "Analog Synth", category: "Synth", view: "keys" },
  { id: "warm_pad", name: "Warm Ambient Pad", category: "Synth", view: "keys" },
  { id: "bass_synth", name: "Sub Bass Synth", category: "Bass", view: "keys" },
  { id: "acoustic_guitar", name: "Acoustic Guitar", category: "Strings", view: "keys" },
  { id: "electric_guitar", name: "Electric Guitar", category: "Strings", view: "keys" },
];

export function AddTrackDialog({
  isOpen,
  onClose,
  onAddTrack,
  nextTrackNumber,
}: AddTrackDialogProps) {
  const numStr = nextTrackNumber.toString().padStart(2, "0");
  const [name, setName] = useState(`${numStr} Instrument`);
  const [selectedPreset, setSelectedPreset] = useState("grand_piano");
  const [selectedColor, setSelectedColor] = useState(
    TRACK_COLORS[(nextTrackNumber - 1) % TRACK_COLORS.length],
  );

  const handleSelectPreset = (presetId: string, defaultName: string) => {
    setSelectedPreset(presetId);
    setName(`${numStr} ${defaultName}`);
  };

  const handleConfirm = () => {
    const isDrum = selectedPreset.includes("drum") || selectedPreset.includes("trap");
    onAddTrack({
      name: name.trim() || `${numStr} Instrument`,
      preset: selectedPreset,
      color: selectedColor,
      playerView: isDrum ? "drums" : "keys",
      clipCount: isDrum ? 8 : 4,
      startMeasure: 0,
      volume: 0.8,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Instrument Track</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-xs">
          <div>
            <Label asChild>
              <label
                htmlFor="add-track-name"
                className="block font-bold text-stone-700 dark:text-stone-300 mb-1"
              >
                Track Name
              </label>
            </Label>
            <input
              id="add-track-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-mono rounded bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 focus:outline-none focus:ring-1 focus:ring-primary text-stone-900 dark:text-stone-100"
            />
          </div>

          <div>
            <Label className="block font-bold text-stone-700 dark:text-stone-300 mb-1.5">
              Select Instrument Preset
            </Label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {PRESET_OPTIONS.map((opt) => {
                const isSelected = selectedPreset === opt.id;
                const Icon =
                  opt.category === "Drums"
                    ? Drum
                    : opt.category === "Keys"
                      ? Piano
                      : Music;

                return (
                  <Button
                    key={opt.id}
                    variant={isSelected ? "solid" : "outline"}
                    tone={isSelected ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => handleSelectPreset(opt.id, opt.name)}
                    className="flex items-center justify-start gap-2 p-2 h-auto text-left border"
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <div className="truncate">
                      <Title asChild>
                        <div className="truncate font-semibold text-xs">{opt.name}</div>
                      </Title>
                      <Caption className="text-[10px] opacity-70 font-normal block">
                        {opt.category}
                      </Caption>
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="block font-bold text-stone-700 dark:text-stone-300 mb-1.5">
              Track Color
            </Label>
            <div className="flex items-center gap-2">
              {TRACK_COLORS.map((c) => (
                <Button
                  key={c}
                  variant="outline"
                  tone="secondary"
                  size="sm"
                  rounded
                  iconOnly
                  onClick={() => setSelectedColor(c)}
                  className={`w-6 h-6 rounded-full border transition-transform p-0 ${
                    selectedColor === c
                      ? "scale-110 ring-2 ring-primary ring-offset-2 dark:ring-offset-stone-900 border-white"
                      : "border-transparent opacity-80 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>
          </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
          <Button variant="ghost" tone="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="solid" tone="primary" size="sm" onClick={handleConfirm}>
            Create Track
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);
}
