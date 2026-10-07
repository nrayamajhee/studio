import { CHORD_PALETTE, chordGroup } from "../chords";
import { setChordMacro } from "../chordStore";
import { ScreenLevel, ScreenValue } from "../DeviceScreen";
import { arrowPads, idleKnob, shelfAt, shelfKnobs, shelvesOf } from "./base";
import type { Mode } from "../../../types/bindings";

const SHELVES = shelvesOf(CHORD_PALETTE, chordGroup);

// The chord palette, by kind: the red knob (or ← →) picks a kind and the blue
// one a chord in it, and pressing a chord pad twice sets it to that chord.
export const chordsMode: Mode = (device, base) => {
  const { browse, feedback } = device;
  const { chordIndex } = browse;
  const chosen = CHORD_PALETTE[chordIndex];
  const { shelf, at } = shelfAt(SHELVES, chordIndex);
  return {
    knobs: {
      green: idleKnob(base.knobs.green),
      ...shelfKnobs(
        SHELVES,
        chordIndex,
        chosen?.name ?? "",
        browse.setChordIndex,
      ),
    },
    pads: arrowPads(device, ["Previous kind", "Next kind"], (direction) =>
      browse.setChordIndex(
        SHELVES[Math.max(0, Math.min(SHELVES.length - 1, at + direction))]
          .start,
      ),
    ),
    chordPad: (index) => ({
      ...base.chordPad(index),
      label: `Set chord ${index + 1} to ${chosen?.name ?? ""}`,
      onPress: () => {
        if (
          !feedback.confirm(
            `chord:${index}`,
            `Press again to set chord ${index + 1} to ${chosen.name}`,
          )
        )
          return;
        setChordMacro(index, chosen.id);
        feedback.showNotice(`Chord ${index + 1} → ${chosen.name}`);
      },
    }),
    screen: {
      title: "Chords",
      status: (
        <ScreenLevel>
          {shelf.name} {at + 1}/{SHELVES.length}
        </ScreenLevel>
      ),
      footer: [
        <ScreenValue key="chosen">{chosen?.name ?? ""}</ScreenValue>,
        "Press a chord pad twice to set",
      ],
      tiles: CHORD_PALETTE.slice(shelf.start, shelf.start + shelf.count).map(
        (chord) => ({
          id: chord.id,
          label: chord.name,
          icon: <span>{chord.label}</span>,
        }),
      ),
      selected: chordIndex - shelf.start,
      selectedBy: "blue",
      onSelect: (index) => browse.setChordIndex(shelf.start + index),
    },
  };
};
