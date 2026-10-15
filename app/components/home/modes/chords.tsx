import { CHORD_PALETTE, chordGroup } from "../chords";
import { setPadChord } from "../chordStore";
import { ScreenHint, ScreenValue } from "../DeviceScreen";
import {
  arrowPads,
  favoritesPicker,
  idleKnob,
  shelfAt,
  shelfKnobs,
  shelfPager,
  shelfStep,
} from "./base";
import type { Mode } from "../../../types/bindings";

// The chord palette, by kind, after the favorites: the red knob (or ← →)
// picks a page and the blue one a chord on it, and pressing a chord pad twice
// sets it to that chord and closes the palette. Mute stars the chord.
export const chordsMode: Mode = (device, base) => {
  const { browse, feedback } = device;
  const {
    listed,
    shelves,
    index: chordIndex,
    chosen,
    select,
    mute,
    star,
  } = favoritesPicker(device, {
    kind: "chords",
    items: CHORD_PALETTE,
    categoryOf: chordGroup,
    index: browse.chordIndex,
    setIndex: browse.setChordIndex,
  });
  const { shelf, at } = shelfAt(shelves, chordIndex);
  return {
    knobs: {
      green: idleKnob(base.knobs.green),
      ...shelfKnobs(shelves, chordIndex, chosen.name, select),
    },
    pads: {
      mute,
      ...arrowPads(
        device,
        ["Previous kind", "Next kind"],
        shelfStep(shelves, at, select),
      ),
    },
    chordPad: (index) => ({
      ...base.chordPad(index),
      label: `Set chord ${index + 1} to ${chosen.name}`,
      onPress: () => {
        if (
          !feedback.confirm(
            `chord:${index}`,
            `Press again to set chord ${index + 1} to ${chosen.name}`,
          )
        )
          return;
        setPadChord(index, chosen.id);
        feedback.showNotice(`Chord ${index + 1} → ${chosen.name}`);
        device.views.setView("scope");
      },
    }),
    screen: {
      title: "Chords",
      unsaved: false,
      pager: shelfPager(shelves, at, select),
      footer: [
        <ScreenValue key="chosen">{chosen.name}</ScreenValue>,
        <ScreenHint key="hint">Press a chord pad twice to set</ScreenHint>,
      ],
      tiles: listed
        .slice(shelf.start, shelf.start + shelf.count)
        .map((chord) => ({
          id: chord.id,
          label: chord.name,
          icon: <span>{chord.label}</span>,
          badge: star(chord),
        })),
      selected: chordIndex - shelf.start,
      selectedBy: "blue",
      onSelect: (index) => select(shelf.start + index),
    },
  };
};
