import React, { useState, useEffect, useCallback, useMemo } from "react";
import { synth } from "../../lib/synth";
import { Button } from "../design-system/Button";
import { Card } from "../design-system/Card";
import { cn } from "../../lib/utils";
import { Radio, Layers } from "lucide-react";

export interface DrumPadProps {
  className?: string;
  selectedPreset?: string;
  isRecording?: boolean;
  onRecordNote?: (noteName: string) => void;
  activeNotes?: string[];
}

interface PadConfig {
  id: number;
  label: string;
  note: string;
  key: string;
  colorTone: string;
}

const DRUM_KIT_PRESETS = new Set([
  "drum_set",
  "drum_808",
  "trap_kit",
  "electronic_drums",
  "acoustic_percussion",
]);

const KEY_MAPPINGS = [
  ["1", "2", "3", "4"],
  ["q", "w", "e", "r"],
  ["a", "s", "d", "f"],
  ["z", "x", "c", "v"],
];

function getKitPads(presetKey: string, bank: number): PadConfig[] {
  if (presetKey === "drum_808") {
    const bankANotes = [
      { label: "808 Sub", note: "C1", colorTone: "rose" },
      { label: "808 Punch", note: "D1", colorTone: "rose" },
      { label: "Low Tom", note: "E1", colorTone: "amber" },
      { label: "Mid Tom", note: "F1", colorTone: "amber" },
      { label: "808 Snr", note: "G1", colorTone: "cyan" },
      { label: "808 Clap", note: "A1", colorTone: "cyan" },
      { label: "Rimshot", note: "B1", colorTone: "emerald" },
      { label: "Cowbell", note: "C2", colorTone: "amber" },
      { label: "Cl Hat", note: "D2", colorTone: "yellow" },
      { label: "Op Hat", note: "E2", colorTone: "yellow" },
      { label: "Pedal Hat", note: "F2", colorTone: "yellow" },
      { label: "Crash", note: "G2", colorTone: "violet" },
      { label: "808 Conga", note: "A2", colorTone: "emerald" },
      { label: "Claves", note: "B2", colorTone: "emerald" },
      { label: "Zap FX", note: "C3", colorTone: "sky" },
      { label: "Sub Drop", note: "D3", colorTone: "rose" },
    ];
    const bankBNotes = [
      { label: "808 Sub C0", note: "C0", colorTone: "rose" },
      { label: "808 Low D0", note: "D0", colorTone: "rose" },
      { label: "808 Low F0", note: "F0", colorTone: "rose" },
      { label: "808 Low G0", note: "G0", colorTone: "rose" },
      { label: "Hi Snr", note: "G2", colorTone: "cyan" },
      { label: "Snap Clap", note: "A2", colorTone: "cyan" },
      { label: "Wood Rim", note: "B2", colorTone: "emerald" },
      { label: "Hi Bell", note: "C3", colorTone: "amber" },
      { label: "Roll Hat", note: "D3", colorTone: "yellow" },
      { label: "Fast Hat", note: "E3", colorTone: "yellow" },
      { label: "Open Swell", note: "F3", colorTone: "yellow" },
      { label: "Ride", note: "G3", colorTone: "violet" },
      { label: "Hi Conga", note: "A3", colorTone: "emerald" },
      { label: "Shaker", note: "B3", colorTone: "emerald" },
      { label: "Laser", note: "C4", colorTone: "sky" },
      { label: "Glide 808", note: "D4", colorTone: "rose" },
    ];

    const chosen = bank === 0 ? bankANotes : bankBNotes;
    return chosen.map((item, idx) => {
      const row = Math.floor(idx / 4);
      const col = idx % 4;
      return {
        id: idx,
        label: item.label,
        note: item.note,
        key: KEY_MAPPINGS[row][col],
        colorTone: item.colorTone,
      };
    });
  }

  if (presetKey === "trap_kit") {
    const bankANotes = [
      { label: "Sub 808", note: "C1", colorTone: "rose" },
      { label: "Hard Kick", note: "D1", colorTone: "rose" },
      { label: "Crisp Snr", note: "E1", colorTone: "cyan" },
      { label: "Trap Clap", note: "F1", colorTone: "cyan" },
      { label: "Tight Hat", note: "G1", colorTone: "yellow" },
      { label: "Roll Hat", note: "A1", colorTone: "yellow" },
      { label: "Open Hat", note: "B1", colorTone: "yellow" },
      { label: "Rim Click", note: "C2", colorTone: "emerald" },
      { label: "Chant", note: "D2", colorTone: "violet" },
      { label: "Perc Clack", note: "E2", colorTone: "emerald" },
      { label: "Tri Hit", note: "F2", colorTone: "amber" },
      { label: "Laser Zap", note: "G2", colorTone: "sky" },
      { label: "Low 808 G", note: "A2", colorTone: "rose" },
      { label: "Low 808 A", note: "B2", colorTone: "rose" },
      { label: "Sub Rise", note: "C3", colorTone: "violet" },
      { label: "Crash Big", note: "D3", colorTone: "violet" },
    ];
    return bankANotes.map((item, idx) => {
      const row = Math.floor(idx / 4);
      const col = idx % 4;
      return {
        id: idx,
        label: item.label,
        note: item.note,
        key: KEY_MAPPINGS[row][col],
        colorTone: item.colorTone,
      };
    });
  }

  if (presetKey === "electronic_drums") {
    const bankANotes = [
      { label: "80s Kick", note: "C1", colorTone: "sky" },
      { label: "Gated Snr", note: "D1", colorTone: "cyan" },
      { label: "Synth Clp", note: "E1", colorTone: "cyan" },
      { label: "Laser Tom", note: "F1", colorTone: "violet" },
      { label: "El Hat Cl", note: "G1", colorTone: "yellow" },
      { label: "El Hat Op", note: "A1", colorTone: "yellow" },
      { label: "Electro T1", note: "B1", colorTone: "violet" },
      { label: "Electro T2", note: "C2", colorTone: "violet" },
      { label: "Synth Rim", note: "D2", colorTone: "emerald" },
      { label: "Cowbell El", note: "E2", colorTone: "amber" },
      { label: "Zap SFX", note: "F2", colorTone: "sky" },
      { label: "Bit Hit", note: "G2", colorTone: "rose" },
      { label: "Crash Synth", note: "A2", colorTone: "violet" },
      { label: "Sub Sweep", note: "B2", colorTone: "rose" },
      { label: "Noise Shot", note: "C3", colorTone: "emerald" },
      { label: "Stab FX", note: "D3", colorTone: "amber" },
    ];
    return bankANotes.map((item, idx) => {
      const row = Math.floor(idx / 4);
      const col = idx % 4;
      return {
        id: idx,
        label: item.label,
        note: item.note,
        key: KEY_MAPPINGS[row][col],
        colorTone: item.colorTone,
      };
    });
  }

  if (presetKey === "acoustic_percussion") {
    const bankANotes = [
      { label: "Bongo Low", note: "C2", colorTone: "amber" },
      { label: "Bongo Hi", note: "D2", colorTone: "amber" },
      { label: "Conga Low", note: "E2", colorTone: "amber" },
      { label: "Conga Slap", note: "F2", colorTone: "amber" },
      { label: "Timbale Lo", note: "G2", colorTone: "emerald" },
      { label: "Timbale Hi", note: "A2", colorTone: "emerald" },
      { label: "Woodblock", note: "B2", colorTone: "emerald" },
      { label: "Shaker", note: "C3", colorTone: "yellow" },
      { label: "Cowbell", note: "D3", colorTone: "amber" },
      { label: "Guiro Tap", note: "E3", colorTone: "cyan" },
      { label: "Agogo Low", note: "F3", colorTone: "cyan" },
      { label: "Agogo Hi", note: "G3", colorTone: "cyan" },
      { label: "Tambourine", note: "A3", colorTone: "yellow" },
      { label: "Claves", note: "B3", colorTone: "emerald" },
      { label: "Triangle", note: "C4", colorTone: "sky" },
      { label: "Cabasa", note: "D4", colorTone: "yellow" },
    ];
    return bankANotes.map((item, idx) => {
      const row = Math.floor(idx / 4);
      const col = idx % 4;
      return {
        id: idx,
        label: item.label,
        note: item.note,
        key: KEY_MAPPINGS[row][col],
        colorTone: item.colorTone,
      };
    });
  }

  if (presetKey === "drum_set") {
    const bankANotes = [
      { label: "Kick Drum", note: "C1", colorTone: "rose" },
      { label: "Snare Ctr", note: "D1", colorTone: "cyan" },
      { label: "Side Stick", note: "E1", colorTone: "emerald" },
      { label: "Snare Rim", note: "F1", colorTone: "cyan" },
      { label: "Closed Hat", note: "G1", colorTone: "yellow" },
      { label: "Pedal Hat", note: "A1", colorTone: "yellow" },
      { label: "Open Hat", note: "B1", colorTone: "yellow" },
      { label: "Low Tom", note: "C2", colorTone: "amber" },
      { label: "Mid Tom", note: "D2", colorTone: "amber" },
      { label: "High Tom", note: "E2", colorTone: "amber" },
      { label: "Crash 1", note: "F2", colorTone: "violet" },
      { label: "Ride Ctr", note: "G2", colorTone: "violet" },
      { label: "Ride Bell", note: "A2", colorTone: "violet" },
      { label: "Crash 2", note: "B2", colorTone: "violet" },
      { label: "Splash", note: "C3", colorTone: "sky" },
      { label: "Cowbell", note: "D3", colorTone: "amber" },
    ];
    return bankANotes.map((item, idx) => {
      const row = Math.floor(idx / 4);
      const col = idx % 4;
      return {
        id: idx,
        label: item.label,
        note: item.note,
        key: KEY_MAPPINGS[row][col],
        colorTone: item.colorTone,
      };
    });
  }

  const baseOctave = bank === 0 ? 3 : 4;
  const melodicNotes = [
    { label: `C${baseOctave} (Root)`, note: `C${baseOctave}`, colorTone: "amber" },
    { label: `D${baseOctave} (2nd)`, note: `D${baseOctave}`, colorTone: "sky" },
    { label: `E${baseOctave} (3rd)`, note: `E${baseOctave}`, colorTone: "sky" },
    { label: `F${baseOctave} (4th)`, note: `F${baseOctave}`, colorTone: "sky" },
    { label: `G${baseOctave} (5th)`, note: `G${baseOctave}`, colorTone: "amber" },
    { label: `A${baseOctave} (6th)`, note: `A${baseOctave}`, colorTone: "sky" },
    { label: `B${baseOctave} (7th)`, note: `B${baseOctave}`, colorTone: "sky" },
    { label: `C${baseOctave + 1} (Oct)`, note: `C${baseOctave + 1}`, colorTone: "amber" },
    { label: `D${baseOctave + 1}`, note: `D${baseOctave + 1}`, colorTone: "sky" },
    { label: `E${baseOctave + 1}`, note: `E${baseOctave + 1}`, colorTone: "sky" },
    { label: `F${baseOctave + 1}`, note: `F${baseOctave + 1}`, colorTone: "sky" },
    { label: `G${baseOctave + 1}`, note: `G${baseOctave + 1}`, colorTone: "amber" },
    { label: `A${baseOctave + 1}`, note: `A${baseOctave + 1}`, colorTone: "sky" },
    { label: `B${baseOctave + 1}`, note: `B${baseOctave + 1}`, colorTone: "sky" },
    { label: `C${baseOctave + 2}`, note: `C${baseOctave + 2}`, colorTone: "amber" },
    { label: `E${baseOctave + 2}`, note: `E${baseOctave + 2}`, colorTone: "amber" },
  ];

  return melodicNotes.map((item, idx) => {
    const row = Math.floor(idx / 4);
    const col = idx % 4;
    return {
      id: idx,
      label: item.label,
      note: item.note,
      key: KEY_MAPPINGS[row][col],
      colorTone: item.colorTone,
    };
  });
}

export const DrumPad: React.FC<DrumPadProps> = ({
  className,
  selectedPreset = "drum_set",
  isRecording = false,
  onRecordNote,
  activeNotes = [],
}) => {
  const [bank, setBank] = useState(0);
  const [pressedPads, setPressedPads] = useState<Set<string>>(new Set());

  const isDrumKit = DRUM_KIT_PRESETS.has(selectedPreset);
  const pads = useMemo(() => getKitPads(selectedPreset, bank), [selectedPreset, bank]);

  const activeNotesSet = useMemo(() => new Set(activeNotes), [activeNotes]);

  const keyMap = useMemo(() => {
    const map = new Map<string, PadConfig>();
    for (const pad of pads) {
      map.set(pad.key.toLowerCase(), pad);
    }
    return map;
  }, [pads]);

  const playPad = useCallback(
    (pad: PadConfig) => {
      synth.playNote(pad.note, undefined, 0.35);
      setPressedPads((prev) => new Set(prev).add(pad.note));

      if (isRecording && onRecordNote) {
        onRecordNote(pad.note);
      }
    },
    [isRecording, onRecordNote],
  );

  const releasePad = useCallback((pad: PadConfig) => {
    synth.stopNote(pad.note);
    setPressedPads((prev) => {
      const next = new Set(prev);
      next.delete(pad.note);
      return next;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (
        targetTag === "input" ||
        targetTag === "select" ||
        targetTag === "textarea"
      ) {
        return;
      }

      const pad = keyMap.get(e.key.toLowerCase());
      if (pad) {
        e.preventDefault();
        playPad(pad);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const pad = keyMap.get(e.key.toLowerCase());
      if (pad) {
        e.preventDefault();
        releasePad(pad);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [keyMap, playPad, releasePad]);

  const getPadColorClasses = (pad: PadConfig, isActive: boolean) => {
    if (isActive) {
      return "bg-primary text-white border-primary-light ring-2 ring-primary-light shadow-lg shadow-primary/40 translate-y-0.5";
    }

    switch (pad.colorTone) {
      case "rose":
        return "bg-rose-50 dark:bg-[#181014] text-rose-950 dark:text-rose-200 border-rose-200 dark:border-rose-900/40 hover:bg-rose-100 dark:hover:bg-rose-950/50 hover:border-rose-300 dark:hover:border-rose-700/60";
      case "cyan":
        return "bg-cyan-50 dark:bg-[#0c1619] text-cyan-950 dark:text-cyan-200 border-cyan-200 dark:border-cyan-900/40 hover:bg-cyan-100 dark:hover:bg-cyan-950/50 hover:border-cyan-300 dark:hover:border-cyan-700/60";
      case "yellow":
        return "bg-amber-50 dark:bg-[#17160d] text-amber-950 dark:text-amber-200 border-amber-200 dark:border-amber-900/40 hover:bg-amber-100 dark:hover:bg-amber-950/50 hover:border-amber-300 dark:hover:border-amber-700/60";
      case "emerald":
        return "bg-emerald-50 dark:bg-[#0d1712] text-emerald-950 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 hover:border-emerald-300 dark:hover:border-emerald-700/60";
      case "violet":
        return "bg-purple-50 dark:bg-[#14101a] text-purple-950 dark:text-purple-200 border-purple-200 dark:border-purple-900/40 hover:bg-purple-100 dark:hover:bg-purple-950/50 hover:border-purple-300 dark:hover:border-purple-700/60";
      case "sky":
        return "bg-sky-50 dark:bg-[#0d141a] text-sky-950 dark:text-sky-200 border-sky-200 dark:border-sky-900/40 hover:bg-sky-100 dark:hover:bg-sky-950/50 hover:border-sky-300 dark:hover:border-sky-700/60";
      case "amber":
      default:
        return "bg-amber-50 dark:bg-[#15130d] text-amber-950 dark:text-[#e4be78] border-amber-200 dark:border-[#382d19] hover:bg-amber-100 dark:hover:bg-[#201c13] hover:border-amber-300 dark:hover:border-amber-500/60";
    }
  };

  return (
    <Card
      elevation="mid"
      className={cn(
        "flex flex-col h-full w-full bg-white dark:bg-[#0a0c10] border border-stone-200 dark:border-[#1f2533] rounded-xl overflow-hidden shadow-sm dark:shadow-lg text-stone-900 dark:text-stone-100 p-2.5 gap-2 select-none",
        className,
      )}
    >
      <div className="flex items-center justify-between pb-1 border-b border-stone-200 dark:border-[#1f2533] flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 text-[11px] font-bold tracking-wider text-primary dark:text-primary-light uppercase">
            <Layers className="w-3.5 h-3.5 text-primary dark:text-primary-light" />
            {isDrumKit ? "MPC Drum Kit" : "Pad Matrix"}
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-100 dark:bg-[#161a24] text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-[#232a3b]">
            Bank {bank === 0 ? "A" : "B"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {isRecording && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 animate-pulse bg-red-950/40 px-1.5 py-0.5 rounded border border-red-800/50">
              <Radio className="w-3 h-3" />
              REC
            </span>
          )}

          <div className="flex items-center gap-1">
            <Button
              variant="solid"
              tone={bank === 0 ? "primary" : "secondary"}
              size="sm"
              onClick={() => setBank(0)}
              disabled={bank === 0}
              aria-label="Bank A"
              className={cn(
                "px-2 py-0.5 h-6 text-[10px] rounded border transition-colors",
                bank === 0
                  ? "bg-primary text-white border-primary-light font-bold shadow-sm"
                  : "bg-stone-100 hover:bg-stone-200 dark:bg-[#161a24] dark:hover:bg-[#232a3b] border-stone-200 dark:border-[#232a3b] text-stone-700 dark:text-stone-300",
              )}
            >
              A
            </Button>
            <Button
              variant="solid"
              tone={bank === 1 ? "primary" : "secondary"}
              size="sm"
              onClick={() => setBank(1)}
              disabled={bank === 1}
              aria-label="Bank B"
              className={cn(
                "px-2 py-0.5 h-6 text-[10px] rounded border transition-colors",
                bank === 1
                  ? "bg-primary text-white border-primary-light font-bold shadow-sm"
                  : "bg-stone-100 hover:bg-stone-200 dark:bg-[#161a24] dark:hover:bg-[#232a3b] border-stone-200 dark:border-[#232a3b] text-stone-700 dark:text-stone-300",
              )}
            >
              B
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-4 grid-rows-4 gap-1.5 p-1 bg-stone-100 dark:bg-[#06080c] rounded-lg border border-stone-200 dark:border-[#1f2533] shadow-inner">
        {pads.map((pad) => {
          const isActive =
            pressedPads.has(pad.note) || activeNotesSet.has(pad.note);

          return (
            <Button
              key={pad.id}
              variant="solid"
              tone="secondary"
              size="sm"
              onMouseDown={() => playPad(pad)}
              onMouseUp={() => releasePad(pad)}
              onMouseLeave={() => releasePad(pad)}
              onTouchStart={(e) => {
                e.preventDefault();
                playPad(pad);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                releasePad(pad);
              }}
              aria-label={`${pad.label} pad (${pad.note})`}
              className={cn(
                "relative flex flex-col justify-between items-stretch p-1 sm:p-1.5 rounded-lg border transition-all cursor-pointer select-none text-left h-full w-full",
                getPadColorClasses(pad, isActive),
              )}
            >
              <div className="flex items-center justify-between w-full pointer-events-none">
                <kbd
                  className={cn(
                    "text-[8px] font-mono px-1 py-0.2 rounded uppercase leading-tight font-bold",
                    isActive
                      ? "bg-black/20 text-stone-950"
                      : "bg-stone-200/90 dark:bg-stone-900/80 text-stone-700 dark:text-stone-400 border border-stone-300 dark:border-stone-800",
                  )}
                >
                  {pad.key}
                </kbd>
                <span
                  className={cn(
                    "text-[8px] font-mono leading-tight",
                    isActive ? "text-stone-900 font-bold" : "text-stone-600 dark:text-stone-300 opacity-70",
                  )}
                >
                  {pad.note}
                </span>
              </div>

              <div className="w-full truncate pointer-events-none mt-auto">
                <span
                  className={cn(
                    "block text-[10px] sm:text-[11px] font-medium truncate leading-tight tracking-tight",
                    isActive ? "font-bold text-stone-950" : "",
                  )}
                >
                  {pad.label}
                </span>
              </div>

              <div
                className={cn(
                  "absolute top-1 right-1 w-1.5 h-1.5 rounded-full pointer-events-none transition-colors",
                  isActive
                    ? "bg-stone-950 shadow-[0_0_6px_#fff]"
                    : "bg-stone-300 dark:bg-stone-700/50",
                )}
              />
            </Button>
          );
        })}
      </div>

      <div className="text-[10px] text-stone-500 dark:text-stone-400 text-center flex items-center justify-between pt-1 border-t border-stone-200 dark:border-[#1f2533] flex-shrink-0">
        <span className="truncate">
          Keys: <kbd className="bg-stone-100 dark:bg-[#161a24] text-stone-800 dark:text-stone-300 px-1 py-0.5 rounded border border-stone-300 dark:border-[#232a3b]">1-4</kbd> <kbd className="bg-stone-100 dark:bg-[#161a24] text-stone-800 dark:text-stone-300 px-1 py-0.5 rounded border border-stone-300 dark:border-[#232a3b]">Q-R</kbd> <kbd className="bg-stone-100 dark:bg-[#161a24] text-stone-800 dark:text-stone-300 px-1 py-0.5 rounded border border-stone-300 dark:border-[#232a3b]">A-F</kbd> <kbd className="bg-stone-100 dark:bg-[#161a24] text-stone-800 dark:text-stone-300 px-1 py-0.5 rounded border border-stone-300 dark:border-[#232a3b]">Z-V</kbd>
        </span>
        <span className="text-[9px] text-primary dark:text-primary-light font-mono font-medium">
          4x4 Dynamic
        </span>
      </div>
    </Card>
  );
};

export default DrumPad;
