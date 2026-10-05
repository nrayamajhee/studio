import { Pad } from "../../design-system";
import { CHORD_PALETTE } from "../chords";
import styles from "../SynthDevice.module.css";
import { useDevice } from "../../../providers/DeviceProvider";
import { usePerformance } from "../../../providers/PerformanceProvider";
import { useView } from "../../../providers/ViewProvider";
import { useHotkeyBadges } from "./useHotkeyBadges";

export function ChordBank() {
  const { view } = useView();
  const { chordIndex, activeChord, macroChords } = usePerformance();
  const { pressChordPad } = useDevice();
  const { hotkeyProps } = useHotkeyBadges();

  return (
    <div className={styles.bank} role="group" aria-label="Chord macros">
      {macroChords.map(({ id, name, label }, index) => (
        <Pad
          key={`${index}-${id}`}
          label={
            view === "chords"
              ? `Set chord ${index + 1} to ${CHORD_PALETTE[chordIndex]?.name ?? ""}`
              : `${name} chord`
          }
          accent="var(--synth-blue)"
          pressed={activeChord === index}
          {...hotkeyProps({ kind: "chord", index })}
          onPress={() => pressChordPad(index)}
        >
          {label}
        </Pad>
      ))}
    </div>
  );
}
