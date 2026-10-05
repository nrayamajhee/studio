import {
  Album,
  AudioLines,
  ChartNoAxesGantt,
  Grid3x3,
  Metronome,
  WavesHorizontal,
} from "lucide-react";
import { Pad } from "../../design-system";
import { AdsrIcon, RollIcon } from "../instrumentIcons";
import styles from "../SynthDevice.module.css";
import { useDevice } from "../../../providers/DeviceProvider";
import { usePerformance } from "../../../providers/PerformanceProvider";
import { useTransportContext } from "../../../providers/TransportProvider";
import { useView } from "../../../providers/ViewProvider";
import { ModulePad } from "./ModulePad";
import { useHotkeyBadges } from "./useHotkeyBadges";

export function ViewsBank() {
  const { view } = useView();
  const transport = useTransportContext();
  const { shift } = usePerformance();
  const { recordMode, pressTracks, pressTake, pressMetronome } = useDevice();
  const { toolHotkey, shiftHotkey } = useHotkeyBadges();

  return (
    <div className={styles.bank} role="group" aria-label="Views">
      <Pad
        label={view === "album" ? "Close album" : "Album"}
        accent="var(--synth-red)"
        lit={view === "album"}
        {...toolHotkey("album")}
        onPress={() => pressTracks(true)}
      >
        <Album />
      </Pad>
      <Pad
        label={view === "tracks" ? "Close tracks" : "Tracks"}
        accent="var(--synth-red)"
        lit={view === "tracks"}
        {...toolHotkey("tracks")}
        onPress={() => pressTracks(false)}
      >
        <ChartNoAxesGantt />
      </Pad>
      <Pad
        label={view === "roll" ? "Close tape" : "Tape (record mode)"}
        accent="var(--synth-red)"
        lit={recordMode}
        {...toolHotkey("take")}
        onPress={() => pressTake(false)}
      >
        <RollIcon />
      </Pad>
      <Pad
        label={
          view === "steps" ? "Close drum sequencer" : "Drum sequencer"
        }
        accent="var(--synth-red)"
        lit={view === "steps"}
        {...toolHotkey("steps")}
        onPress={() => pressTake(true)}
      >
        <Grid3x3 />
      </Pad>
      <ModulePad id="adsr" icon={<AdsrIcon />} />
      <ModulePad id="lfo" icon={<WavesHorizontal />} />
      <ModulePad id="fx" icon={<AudioLines />} />
      <Pad
        label={
          shift
            ? `Turn metronome ${transport.metronome ? "off" : "on"}`
            : `Tempo (metronome ${transport.metronome ? "on" : "off"})`
        }
        accent="var(--synth-green)"
        lit={view === "tempo"}
        indicator={transport.metronome}
        {...shiftHotkey({ kind: "tool", tool: "metronome" })}
        onPress={() => pressMetronome()}
      >
        <Metronome />
      </Pad>
    </div>
  );
}
