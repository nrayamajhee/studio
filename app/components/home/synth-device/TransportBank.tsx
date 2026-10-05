import { Circle, FileMusic, Pause, Play, Plus, Pointer, Save, Square } from "lucide-react";
import { Pad } from "../../design-system";
import styles from "../SynthDevice.module.css";
import { useDevice } from "../../../providers/DeviceProvider";
import { usePerformance } from "../../../providers/PerformanceProvider";
import { useSequencer } from "../../../providers/SequencerProvider";
import { useTransportContext } from "../../../providers/TransportProvider";
import { useView } from "../../../providers/ViewProvider";
import { useHotkeyBadges } from "./useHotkeyBadges";

export function TransportBank() {
  const { view } = useView();
  const transport = useTransportContext();
  const { recordingSteps } = useSequencer();
  const { tapMode } = usePerformance();
  const { mixView, playing, recordArmed, midiSave, command, pressPlay, pressRecord, pressStop, pressSave } =
    useDevice();
  const { toolHotkey } = useHotkeyBadges();

  return (
    <div className={styles.bank} role="group" aria-label="Transport">
      <Pad
        label={
          mixView
            ? mixViewLabel(playing)
            : view === "steps"
              ? playing
                ? "Stop the steps"
                : "Play the steps"
              : transport.state === "recording"
                ? "Stop recording"
                : recordArmed
                  ? "Start recording"
                  : playing
                    ? "Pause"
                    : "Play"
        }
        {...toolHotkey("play")}
        onPress={pressPlay}
      >
        {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
      </Pad>
      <Pad
        label={
          view === "steps"
            ? recordingSteps
              ? "Stop recording steps"
              : "Record steps"
            : transport.state === "recording"
              ? "Stop recording"
              : recordArmed
                ? "Disarm recording"
                : "Arm recording"
        }
        accent="var(--synth-red)"
        lit={
          transport.state === "recording" || recordArmed || recordingSteps
        }
        {...toolHotkey("record")}
        onPress={pressRecord}
      >
        <Circle fill="currentColor" />
      </Pad>
      <Pad
        label={view === "tracks" ? "Stop and rewind" : "Stop"}
        accent="var(--synth-red)"
        {...toolHotkey("stop")}
        onPress={pressStop}
      >
        <Square fill="currentColor" />
      </Pad>
      <Pad
        label={
          midiSave
            ? "Save the tracks as MIDI"
            : view === "revert"
              ? "Save"
              : view === "tempo"
                ? tapMode
                  ? "Stop tap tempo"
                  : "Tap tempo"
                : view === "tracks"
                  ? "Save the mix"
                  : view === "album"
                    ? "New song"
                    : view === "roll"
                      ? "Save tape as a track"
                      : view === "steps"
                        ? "Save steps as a track"
                        : "Save preset"
        }
        accent="var(--synth-red)"
        lit={tapMode}
        hotkey={`${command}${midiSave ? "⇧" : ""}S`}
        onPress={() => pressSave()}
      >
        {midiSave ? (
          <FileMusic />
        ) : view === "album" ? (
          <Plus />
        ) : view === "tempo" ? (
          <Pointer />
        ) : (
          <Save />
        )}
      </Pad>
    </div>
  );
}

// Play on the tracks view reads as pause/play of the tracks.
const mixViewLabel = (playing: boolean) =>
  playing ? "Pause tracks" : "Play tracks";
