import { useRef, type CSSProperties } from "react";
import { tv } from "../../../lib/utils";
import { useDeviceHotkey } from "../../../hooks/useDeviceHotkey";
import { useFeedback } from "../../../providers/FeedbackProvider";
import { useBindings } from "../../../providers/ModeProvider";
import { usePerformance } from "../../../providers/PerformanceProvider";
import { useShift } from "../../../providers/ShiftProvider";
import { useSound } from "../../../providers/SoundProvider";
import { Key } from "../../design-system";
import type { KitId } from "../../../lib/physical";
import { isKit, keyPiece } from "../deviceEngine";
import {
  BLACK_KEYS,
  F3_MIDI,
  WHITE_KEYS,
  engravedNote,
  spokenNote,
} from "../deviceMath";
import { GM_DRUMS } from "../exportMix";
import { hotkeyLabel, shiftedNote } from "../input/keymap";
import { useMidiListener } from "../input/midi";
import { DRUM_PIECES } from "../instrumentIcons";

// A recess cut into the bottom edge, like a laptop's lid notch: rounded at
// the top and running out through the bezel, as wide as the twelve pads
// above. Fourteen white keys 4px apart fill its 915px inside an inset
// gutter, and the keys take the depth the well gains from the bezel. Each
// black key centres on the 4px gap before white key --slot.
const keybed = tv({
  slots: {
    well: "-mb-bezel flex justify-center rounded-t-[18px] bg-keybed px-inset pb-inset shadow-keybed [--black-key-height:150px] [--black-key-width:37px] [--key-pitch:calc(var(--white-key-width)_+_4px)] [--white-key-height:247px] [--white-key-width:calc((915px_-_13_*_4px)_/_14)]",
    keys: "relative h-[247px] w-[915px]",
    slot: "absolute top-0",
  },
  variants: {
    variant: {
      white: { slot: "left-[calc(var(--slot)_*_var(--key-pitch))]" },
      black: {
        slot: "left-[calc(var(--slot)_*_var(--key-pitch)_-_2px_-_var(--black-key-width)_/_2)]",
      },
    },
  },
});

const { well, keys: keysRow } = keybed();

// The keybed note a kit strikes General MIDI drum key `note` on: the key of
// the kit's piece for it, if the kit has one, else the note as played.
const drumKey = (kit: KitId, note: number) => {
  const at = Array.from({ length: 12 }, (_, step) => F3_MIDI + step).find(
    (key) => GM_DRUMS[keyPiece(kit, key)] === note,
  );
  return at ?? note;
};

// The piano keys, F3 to E5 shifted by the octave buttons. A kit shows the
// drum each key plays instead of a note name. A MIDI keyboard plays them
// too, its notes as they are, past either end as well.
export function Keybed() {
  const { shift } = useShift();
  const { isBusy, showPrompt } = useFeedback();
  const { octave, preset } = useSound();
  const { litNotes, chord, pressKey, releaseKey } = usePerformance();
  const { keyPress } = useBindings();
  // A key's note as it sounds; the view may take the key for a job of its
  // own instead of playing it.
  const noteOf = (semitone: number) => F3_MIDI + semitone + 12 * octave;
  // The note each held piano key started, by its unshifted semitone.
  const keyNotes = useRef(new Map<number, number>());

  // With Shift the home row's last keys play past B4; a key lets go of
  // whichever note it started, even if Shift is let go first.
  useDeviceHotkey(({ control, down, held }) => {
    if (control.kind !== "note") return;
    if (down) {
      const semitone = shift ? shiftedNote(control.semitone) : control.semitone;
      keyNotes.current.set(control.semitone, semitone);
      if (keyPress?.(noteOf(semitone))) return;
      pressKey(semitone, held.chord ?? chord);
      return;
    }
    releaseKey(keyNotes.current.get(control.semitone) ?? control.semitone);
    keyNotes.current.delete(control.semitone);
  });

  // The keybed semitone each MIDI key started, by the key.
  const midiNotes = useRef(new Map<string, number>());
  useMidiListener((event) => {
    if (event.kind !== "note") return;
    if (!event.down) {
      const semitone = midiNotes.current.get(event.id);
      midiNotes.current.delete(event.id);
      if (semitone !== undefined) releaseKey(semitone);
      return;
    }
    if (isBusy()) return;
    // Until the page is clicked, the browser keeps the sound off, and the
    // notes would pile up to play all at once.
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
      showPrompt("Click the page to hear MIDI");
      return;
    }
    const note =
      event.drums && isKit(preset.target)
        ? drumKey(preset.target, event.note)
        : event.note;
    if (keyPress?.(note)) return;
    const semitone = note - noteOf(0);
    midiNotes.current.set(event.id, semitone);
    pressKey(semitone, undefined, event.velocity);
  });

  const renderKey = (semitone: number, slot: number, black: boolean) => {
    const midi = noteOf(semitone);
    const piece = isKit(preset.target)
      ? DRUM_PIECES[keyPiece(preset.target, midi)]
      : null;
    const variant = black ? "black" : "white";
    return (
      <Key
        key={semitone}
        variant={variant}
        label={piece ? `${piece.name} (${spokenNote(midi)})` : spokenNote(midi)}
        note={
          piece ? piece.Icon ? <piece.Icon /> : piece.name : engravedNote(midi)
        }
        hotkey={hotkeyLabel({ kind: "note", semitone })}
        lit={litNotes.has(semitone)}
        className={keybed({ variant }).slot()}
        style={{ "--slot": slot } as CSSProperties}
        onPress={() => {
          if (!keyPress?.(midi)) pressKey(semitone);
        }}
        onRelease={() => releaseKey(semitone)}
      />
    );
  };

  return (
    <div className={well()}>
      <div
        className={keysRow()}
        role="group"
        aria-label="Piano keys"
        data-focus-group="keys"
        data-focus-order="columns"
      >
        {WHITE_KEYS.map((semitone, slot) => renderKey(semitone, slot, false))}
        {BLACK_KEYS.map((semitone) =>
          renderKey(semitone, WHITE_KEYS.indexOf(semitone - 1) + 1, true),
        )}
      </div>
    </div>
  );
}
