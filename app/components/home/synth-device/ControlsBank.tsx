import { ArrowBigUp, ArrowDown, ArrowLeft, ArrowRight, Music4 } from "lucide-react";
import { Pad } from "../../design-system";
import { ChordStyleIcon } from "../instrumentIcons";
import styles from "../SynthDevice.module.css";
import { useDevice } from "../../../providers/DeviceProvider";
import { usePerformance } from "../../../providers/PerformanceProvider";
import { useView } from "../../../providers/ViewProvider";
import { useHotkeyBadges } from "./useHotkeyBadges";

export function ControlsBank() {
  const { view } = useView();
  const { shift, shiftLatched, setShiftLatched, chordStyle } = usePerformance();
  const { step, pickRow, pressTool } = useDevice();
  const { hotkeyProps, toolHotkey, shiftHotkey } = useHotkeyBadges();

  const paging =
    view === "synth" ||
    view === "save" ||
    view === "presets" ||
    view === "chords";

  return (
    <div className={styles.bank} role="group" aria-label="Controls">
      <Pad
        label={shiftLatched ? "Shift (latched)" : "Shift"}
        {...hotkeyProps({ kind: "shift" })}
        held={shift}
        onPress={() => setShiftLatched((on) => !on)}
      >
        <ArrowBigUp />
      </Pad>
      <Pad
        label={
          paging
            ? "Previous page"
            : view === "tempo"
              ? "Slower"
              : view === "steps"
                ? "Previous step"
                : view === "chordStyle"
                  ? "Previous chord style"
                  : view === "album"
                    ? "Previous song"
                    : view === "tracks"
                      ? shift
                        ? "Repeat track less"
                        : "Slide track earlier"
                      : shift
                        ? "Previous preset"
                        : "Octave down"
        }
        accent="var(--synth-red)"
        {...shiftHotkey({ kind: "step", direction: -1 })}
        onPress={() => step(-1)}
      >
        <ArrowLeft />
      </Pad>
      <Pad
        label={
          view === "tracks"
            ? "Next track"
            : view === "roll"
              ? "Down a semitone"
              : "Down"
        }
        accent="var(--synth-red)"
        {...hotkeyProps({ kind: "pick", direction: 1 })}
        onPress={() => pickRow(1)}
      >
        <ArrowDown />
      </Pad>
      <Pad
        label={
          paging
            ? "Next page"
            : view === "tempo"
              ? "Faster"
              : view === "steps"
                ? "Next step"
                : view === "chordStyle"
                  ? "Next chord style"
                  : view === "album"
                    ? "Next song"
                    : view === "tracks"
                      ? shift
                        ? "Repeat track more"
                        : "Slide track later"
                      : shift
                        ? "Next preset"
                        : "Octave up"
        }
        accent="var(--synth-red)"
        {...shiftHotkey({ kind: "step", direction: 1 })}
        onPress={() => step(1)}
      >
        <ArrowRight />
      </Pad>
      <Pad
        label={
          view === "chords" ? "Close chord palette" : "Chord palette"
        }
        accent="var(--synth-red)"
        lit={view === "chords"}
        {...toolHotkey("chords")}
        onPress={() => pressTool("chords")}
      >
        <Music4 />
      </Pad>
      <Pad
        label={
          view === "chordStyle" ? "Close chord style" : "Chord style"
        }
        accent="var(--synth-red)"
        lit={view === "chordStyle"}
        {...toolHotkey("style")}
        onPress={() => pressTool("style")}
      >
        <ChordStyleIcon pattern={chordStyle.id} />
      </Pad>
    </div>
  );
}
