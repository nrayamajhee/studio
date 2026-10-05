import type { CSSProperties } from "react";
import { isKit, keyPiece, type DevicePreset } from "../deviceEngine";
import { Key } from "../../design-system";
import { cn } from "../../../lib/utils";
import { DRUM_PIECES } from "../instrumentIcons";
import { hotkeyLabel } from "../input/keymap";
import {
  BLACK_KEYS,
  F3_MIDI,
  WHITE_KEYS,
  engravedNote,
  spokenNote,
} from "../input/keybed";
import { usePerformance } from "../../../providers/PerformanceProvider";
import { useSound } from "../../../providers/SoundProvider";
import styles from "../SynthDevice.module.css";

// With a kit selected, keys show the drum they play instead of a note name.
function renderKey(
  semitone: number,
  slot: number,
  black: boolean,
  octave: number,
  presetTarget: DevicePreset["target"],
  litNotes: ReadonlySet<number>,
  pressKey: (semitone: number) => void,
  releaseKey: (semitone: number) => void,
) {
  const midi = F3_MIDI + semitone + 12 * octave;
  const piece = isKit(presetTarget)
    ? DRUM_PIECES[keyPiece(presetTarget, midi)]
    : null;
  return (
    <Key
      key={semitone}
      variant={black ? "black" : "white"}
      label={piece ? `${piece.name} (${spokenNote(midi)})` : spokenNote(midi)}
      note={
        piece ? piece.Icon ? <piece.Icon /> : piece.name : engravedNote(midi)
      }
      hotkey={hotkeyLabel({ kind: "note", semitone })}
      lit={litNotes.has(semitone)}
      className={cn(styles.slot, black ? styles.blackSlot : styles.whiteSlot)}
      style={{ "--slot": slot } as CSSProperties}
      onPress={() => pressKey(semitone)}
      onRelease={() => releaseKey(semitone)}
    />
  );
}

export function Keybed() {
  const { preset } = useSound();
  const { octave, litNotes, pressKey, releaseKey } = usePerformance();
  return (
    <div className={styles.keybed}>
      <div
        className={styles.keys}
        role="group"
        aria-label="Piano keys"
        data-focus-group="keys"
        data-focus-order="columns"
      >
        {WHITE_KEYS.map((semitone, slot) =>
          renderKey(
            semitone,
            slot,
            false,
            octave,
            preset.target,
            litNotes,
            pressKey,
            releaseKey,
          ),
        )}
        {BLACK_KEYS.map((semitone) =>
          renderKey(
            semitone,
            WHITE_KEYS.indexOf(semitone - 1) + 1,
            true,
            octave,
            preset.target,
            litNotes,
            pressKey,
            releaseKey,
          ),
        )}
      </div>
    </div>
  );
}
