import { CHORD_PALETTE, chordGroup } from "../chords";
import { setChordMacro } from "../chordStore";
import { ScreenHint, ScreenValue } from "../DeviceScreen";
import {
  arrowPads,
  idleKnob,
  shelfAt,
  shelfKnobs,
  shelfPager,
  shelfStep,
  shelvesOf,
} from "./base";
import type { Mode } from "../../../types/bindings";

const SHELVES = shelvesOf(CHORD_PALETTE, chordGroup);

// The chord palette, by kind: the red knob (or ← →) picks a kind and the blue
// one a chord in it, and pressing a chord pad twice sets it to that chord and
// closes the palette.
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
    pads: arrowPads(
      device,
      ["Previous kind", "Next kind"],
      shelfStep(SHELVES, at, browse.setChordIndex),
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
        device.views.setView("scope");
      },
    }),
    screen: {
      title: "Chords",
      unsaved: false,
      pager: shelfPager(SHELVES, at, browse.setChordIndex),
      footer: [
        <ScreenValue key="chosen">{chosen?.name ?? ""}</ScreenValue>,
        <ScreenHint key="hint">Press a chord pad twice to set</ScreenHint>,
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
