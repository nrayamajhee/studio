import React, { useState, useEffect, useRef } from "react";
import {
  midiManager,
  type MidiDeviceInfo,
  type MidiActivityItem,
} from "../../lib/midi";
import { synth } from "../../lib/synth";
import { Button } from "../design-system/Button";
import { Card } from "../design-system/Card";
import { cn } from "../../lib/utils";
import {
  Cable,
  RefreshCw,
  Sliders,
  Drum,
  Piano,
  OctagonAlert,
  Check,
  ChevronDown,
  Activity,
  Info,
} from "lucide-react";

export interface MidiControlProps {
  className?: string;
  onActivityFlash?: () => void;
}

export const MidiControl: React.FC<MidiControlProps> = ({ className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [devices, setDevices] = useState<MidiDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("all");
  const [drumChannel, setDrumChannel] = useState<number>(10);
  const [octaveShift, setOctaveShift] = useState<number>(0);
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [activityLog, setActivityLog] = useState<MidiActivityItem[]>([]);
  const [sustainPedal, setSustainPedal] = useState<boolean>(false);
  const [hasRecentTraffic, setHasRecentTraffic] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const trafficTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsSupported(midiManager.isSupported());
    setSelectedDevice(midiManager.getSelectedInput());
    setDrumChannel(midiManager.getDrumChannel());
    setOctaveShift(midiManager.getOctaveShift());

    // Automatically attempt connection on mount if supported
    if (midiManager.isSupported()) {
      midiManager.requestAccess().then((granted) => {
        setHasAccess(granted);
        if (granted) {
          setDevices(midiManager.getDevices());
        }
      });
    }

    const unsubDevices = midiManager.onDevicesChange((devs) => {
      setDevices(devs);
      setHasAccess(midiManager.isAccessGranted());
    });

    const unsubActivity = midiManager.onActivity((log) => {
      setActivityLog(log.slice(0, 6));
      setHasRecentTraffic(true);
      if (trafficTimeoutRef.current) clearTimeout(trafficTimeoutRef.current);
      trafficTimeoutRef.current = setTimeout(() => {
        setHasRecentTraffic(false);
      }, 150);
    });

    const unsubSustain = midiManager.onSustainChange((isDown) => {
      setSustainPedal(isDown);
    });

    return () => {
      unsubDevices();
      unsubActivity();
      unsubSustain();
      if (trafficTimeoutRef.current) clearTimeout(trafficTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleRequestAccess = async () => {
    const granted = await midiManager.requestAccess();
    setHasAccess(granted);
    if (granted) {
      setDevices(midiManager.getDevices());
    }
  };

  const handleDeviceSelect = (id: string) => {
    setSelectedDevice(id);
    midiManager.setSelectedInput(id);
  };

  const handleDrumChannelSelect = (ch: number) => {
    setDrumChannel(ch);
    midiManager.setDrumChannel(ch);
  };

  const handleOctaveShift = (shift: number) => {
    setOctaveShift(shift);
    midiManager.setOctaveShift(shift);
  };

  const handlePanic = () => {
    midiManager.panic();
    synth.panic();
  };

  const connectedCount = devices.filter((d) => d.state === "connected").length;

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      <Button
        variant="solid"
        tone="secondary"
        size="sm"
        onClick={() => setIsOpen((prev) => !prev)}
        title={
          !isSupported
            ? "Web MIDI is not supported in this browser"
            : connectedCount > 0
              ? `MIDI: ${connectedCount} device${connectedCount > 1 ? "s" : ""} connected`
              : "MIDI: Click to connect MIDI keyboard or drum pads"
        }
        aria-label="Web MIDI Controller settings"
        aria-expanded={isOpen}
        className={cn(
          "flex items-center gap-1.5 px-2 py-0.5 h-7 text-xs font-mono rounded-lg border transition-all cursor-pointer select-none",
          isOpen
            ? "bg-stone-200 dark:bg-[#1a202c] border-stone-400 dark:border-stone-600 text-stone-900 dark:text-white shadow-sm"
            : "bg-white dark:bg-[#0c0f16] hover:bg-stone-100 dark:hover:bg-[#161c28] border-stone-200 dark:border-[#1f2533] text-stone-700 dark:text-stone-300",
        )}
      >
        <div className="relative flex items-center justify-center">
          <Cable
            className={cn(
              "w-3.5 h-3.5 transition-colors",
              connectedCount > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-stone-400 dark:text-stone-500",
            )}
          />
          {hasRecentTraffic && (
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          )}
        </div>

        <span className="font-semibold text-[11px] tracking-tight">MIDI</span>

        {connectedCount > 0 ? (
          <span className="flex items-center gap-1 px-1 py-0.2 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
            {connectedCount}
          </span>
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-stone-300 dark:bg-stone-600" />
        )}

        <ChevronDown
          className={cn(
            "w-3 h-3 text-stone-400 transition-transform duration-150",
            isOpen && "rotate-180",
          )}
        />
      </Button>

      {isOpen && (
        <Card
          elevation="high"
          className="absolute right-0 top-full mt-1.5 z-50 w-80 sm:w-96 p-3 bg-white/95 dark:bg-[#0c0f16]/95 backdrop-blur-md rounded-xl border border-stone-200 dark:border-[#1f2533] shadow-2xl text-stone-900 dark:text-stone-100 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-[#1f2533]">
            <div className="flex items-center gap-2">
              <Cable className="w-4 h-4 text-primary" />
              <div>
                <h4 className="text-xs font-bold leading-tight">
                  Web MIDI Controller
                </h4>
                <p className="text-[10px] text-stone-500 dark:text-stone-400 font-mono">
                  Keyboard & Drum Pads
                </p>
              </div>
            </div>

            <Button
              variant="solid"
              tone="secondary"
              size="sm"
              onClick={handleRequestAccess}
              title="Rescan connected MIDI hardware"
              className="px-2 py-0.5 h-6 text-[10px] rounded bg-stone-100 dark:bg-[#161b26] hover:bg-stone-200 dark:hover:bg-[#202838] border border-stone-200 dark:border-[#1f2533] text-stone-700 dark:text-stone-300"
            >
              <RefreshCw className="w-3 h-3 mr-1 text-stone-500" />
              Scan
            </Button>
          </div>

          {/* Connected Devices List */}
          <div className="py-2.5 border-b border-stone-200 dark:border-[#1f2533] space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-stone-700 dark:text-stone-300">
              <span>Connected Devices</span>
              <span className="text-[10px] font-mono text-stone-500">
                {connectedCount} detected
              </span>
            </div>

            {!isSupported ? (
              <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  Web MIDI is not supported in this browser. Please use Google Chrome, Microsoft Edge, or a Web MIDI-compatible browser.
                </span>
              </div>
            ) : devices.length === 0 ? (
              <div className="p-2 rounded bg-stone-100 dark:bg-[#121620] border border-stone-200 dark:border-[#1f2533] text-[11px] text-stone-600 dark:text-stone-400 space-y-1">
                <p>No MIDI hardware detected.</p>
                <p className="text-[10px] text-stone-500">
                  Connect your USB or Bluetooth MIDI keyboard or drum pads (e.g. Akai MPK Mini, Launchkey, MiniLab) and click Scan.
                </p>
              </div>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => handleDeviceSelect("all")}
                  className={cn(
                    "flex items-center justify-between w-full px-2 py-1 text-left rounded text-xs transition-colors",
                    selectedDevice === "all"
                      ? "bg-primary/10 text-primary font-bold border border-primary/30"
                      : "bg-stone-50 dark:bg-[#121620] hover:bg-stone-100 dark:hover:bg-[#181d2a] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-[#1f2533]",
                  )}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_#10b981]" />
                    All Connected Devices (Omni)
                  </span>
                  {selectedDevice === "all" && <Check className="w-3 h-3" />}
                </button>

                {devices.map((device) => (
                  <button
                    key={device.id}
                    type="button"
                    onClick={() => handleDeviceSelect(device.id)}
                    className={cn(
                      "flex items-center justify-between w-full px-2 py-1 text-left rounded text-xs transition-colors",
                      selectedDevice === device.id
                        ? "bg-primary/10 text-primary font-bold border border-primary/30"
                        : "bg-stone-50 dark:bg-[#121620] hover:bg-stone-100 dark:hover:bg-[#181d2a] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-[#1f2533]",
                    )}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          device.state === "connected"
                            ? "bg-emerald-500 shadow-[0_0_4px_#10b981]"
                            : "bg-stone-400",
                        )}
                      />
                      <span className="truncate">{device.name}</span>
                      <span className="text-[10px] text-stone-400 font-normal">
                        ({device.manufacturer})
                      </span>
                    </div>
                    {selectedDevice === device.id && (
                      <Check className="w-3 h-3 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Configuration: Drum Channel & Octave Shift */}
          <div className="py-2.5 border-b border-stone-200 dark:border-[#1f2533] space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-stone-700 dark:text-stone-300 font-medium">
                <Drum className="w-3.5 h-3.5 text-stone-500" />
                Drum Pads Channel:
              </span>
              <select
                value={drumChannel}
                onChange={(e) =>
                  handleDrumChannelSelect(parseInt(e.target.value, 10))
                }
                className="px-2 py-0.5 text-xs font-mono rounded bg-stone-100 dark:bg-[#161b26] border border-stone-200 dark:border-[#1f2533] text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value={10}>Channel 10 (GM Standard)</option>
                <option value={0}>Omni (All Channels)</option>
                {Array.from({ length: 16 }, (_, i) => i + 1).map((ch) => (
                  <option key={ch} value={ch}>
                    Channel {ch}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-stone-700 dark:text-stone-300 font-medium">
                <Piano className="w-3.5 h-3.5 text-stone-500" />
                Keyboard Octave Shift:
              </span>
              <div className="flex items-center gap-1">
                {[-2, -1, 0, 1, 2].map((shift) => (
                  <button
                    key={shift}
                    type="button"
                    onClick={() => handleOctaveShift(shift)}
                    className={cn(
                      "px-1.5 py-0.5 text-[10px] font-mono rounded border transition-colors",
                      octaveShift === shift
                        ? "bg-primary text-white font-bold border-primary shadow-sm"
                        : "bg-stone-100 dark:bg-[#161b26] border-stone-200 dark:border-[#1f2533] text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#202838]",
                    )}
                  >
                    {shift > 0 ? `+${shift}` : shift}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Live Activity Monitor */}
          <div className="pt-2 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-stone-700 dark:text-stone-300">
              <span className="flex items-center gap-1">
                <Activity className="w-3 h-3 text-stone-400" />
                Live MIDI Activity
              </span>
              <div className="flex items-center gap-2">
                {sustainPedal && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40 animate-pulse">
                    SUSTAIN ON
                  </span>
                )}
                <button
                  type="button"
                  onClick={handlePanic}
                  title="Kill all active notes immediately"
                  className="flex items-center gap-0.5 text-[10px] text-red-600 dark:text-red-400 hover:underline font-mono"
                >
                  <OctagonAlert className="w-2.5 h-2.5" />
                  Panic
                </button>
              </div>
            </div>

            <div className="p-1.5 rounded bg-stone-100 dark:bg-[#06080c] border border-stone-200 dark:border-[#1f2533] min-h-[50px] max-h-24 overflow-y-auto font-mono text-[10px] space-y-0.5 shadow-inner">
              {activityLog.length === 0 ? (
                <span className="text-stone-400 dark:text-stone-600 italic">
                  Press keys or strike drum pads to view live messages...
                </span>
              ) : (
                activityLog.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-center justify-between text-stone-600 dark:text-stone-400 animate-in fade-in duration-75"
                  >
                    <span className="flex items-center gap-1 truncate">
                      <span
                        className={cn(
                          "px-1 rounded text-[8px] font-bold uppercase",
                          act.isDrum
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                            : "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30",
                        )}
                      >
                        {act.isDrum ? "Drum" : "Key"}
                      </span>
                      <span className="text-stone-800 dark:text-stone-200 font-semibold truncate">
                        {act.label}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 flex-shrink-0 text-[9px] opacity-80">
                      <span>{act.value}</span>
                      <span className="text-stone-400">Ch{act.channel}</span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default MidiControl;
