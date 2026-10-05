import {
  ArrowUp,
  AudioWaveform,
  Headphones,
  LayoutGrid,
  RotateCcw,
  Scissors,
  ScissorsLineDashed,
  Trash2,
  VolumeX,
} from "lucide-react";
import { Pad } from "../../design-system";
import { useSession } from "../sessionStore";
import styles from "../SynthDevice.module.css";
import { useDevice } from "../../../providers/DeviceProvider";
import { useFeedback } from "../../../providers/FeedbackProvider";
import { usePerformance } from "../../../providers/PerformanceProvider";
import { useTracks } from "../../../providers/TracksProvider";
import { useView } from "../../../providers/ViewProvider";
import { useHotkeyBadges } from "./useHotkeyBadges";

export function EditBank() {
  const { view } = useView();
  const { shift } = usePerformance();
  const { track, trackLoop } = useTracks();
  const { songs, song } = useSession();
  const { pending } = useFeedback();
  const { onTracks, trackShift, trash, revertOption, pressMute, pressClip, pressTrash, pressSynth, pickRow } =
    useDevice();
  const { hotkeyProps, toolHotkey, shiftHotkey } = useHotkeyBadges();

  const openSongNow = songs.find(({ id }) => id === song);

  const deleteBase =
    trash?.id ??
    track?.id ??
    (view === "steps"
      ? "steps"
      : view === "album"
        ? openSongNow?.id
        : "");

  return (
    <div className={styles.bank} role="group" aria-label="Edit">
      <Pad
        label={
          onTracks && track
            ? shift
              ? `${track.soloed ? "Unsolo" : "Solo"} ${track.name}`
              : `${track.muted ? "Unmute" : "Mute"} ${track.name}`
            : trackShift
              ? "Solo a track"
              : "Mute a track"
        }
        accent="var(--synth-red)"
        lit={onTracks && Boolean(shift ? track?.soloed : track?.muted)}
        {...shiftHotkey({ kind: "tool", tool: "mute" }, trackShift)}
        onPress={pressMute}
      >
        {trackShift ? <Headphones /> : <VolumeX />}
      </Pad>
      <Pad
        label={
          trackShift
            ? "Trim track to its clip"
            : onTracks && track
              ? `Clip ${trackLoop ? "off" : "on"}`
              : "Clip a track"
        }
        accent="var(--synth-red)"
        lit={onTracks && trackLoop !== null}
        {...shiftHotkey({ kind: "tool", tool: "clip" }, trackShift)}
        onPress={pressClip}
      >
        {trackShift ? <ScissorsLineDashed /> : <Scissors />}
      </Pad>
      <Pad
        label={
          view === "tracks"
            ? "Previous track"
            : view === "roll"
              ? "Up a semitone"
              : "Up"
        }
        accent="var(--synth-red)"
        {...hotkeyProps({ kind: "pick", direction: -1 })}
        onPress={() => pickRow(-1)}
      >
        <ArrowUp />
      </Pad>
      <Pad
        label={
          view === "revert"
            ? shift
              ? "Close revert"
              : `Revert ${revertOption.label.toLowerCase()}`
            : shift
              ? "Revert"
              : trash
                ? `Delete ${trash.name}`
                : view === "tracks" && track
                  ? `Delete ${track.name}`
                  : view === "steps"
                    ? "Clear the steps"
                    : view === "album" && openSongNow
                      ? `Delete ${openSongNow.name}`
                      : "Delete"
        }
        accent="var(--synth-red)"
        lit={view === "revert" || pending === `delete:${deleteBase}`}
        {...shiftHotkey({ kind: "tool", tool: "delete" })}
        onPress={() => pressTrash()}
      >
        {view === "revert" || shift ? <RotateCcw /> : <Trash2 />}
      </Pad>
      <Pad
        label={
          view === "presets"
            ? "Close preset library"
            : "Preset library"
        }
        accent="var(--synth-red)"
        lit={view === "presets"}
        {...toolHotkey("synth")}
        onPress={() => pressSynth(false)}
      >
        <LayoutGrid />
      </Pad>
      <Pad
        label={
          view === "synth"
            ? "Close synth parameters"
            : "Synth parameters"
        }
        accent="var(--synth-red)"
        lit={view === "synth"}
        {...toolHotkey("params")}
        onPress={() => pressSynth(true)}
      >
        <AudioWaveform />
      </Pad>
    </div>
  );
}
