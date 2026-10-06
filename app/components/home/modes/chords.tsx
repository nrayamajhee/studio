import { CHORD_PALETTE } from "../chords";
import { setChordMacro } from "../chordStore";
import { turnPage } from "../deviceMath";
import { ScreenSeek, TILES_PER_PAGE } from "../DeviceScreen";
import { arrowPads, seekKnob } from "./base";
import type { Mode } from "../../../types/bindings";

// The chord palette: the green knob highlights a chord, and pressing a chord
// pad twice sets it to that chord.
export const chordsMode: Mode = (device, base) => {
  const { browse, feedback } = device;
  const perPage = TILES_PER_PAGE.chords;
  const { chordIndex } = browse;
  const chosen = CHORD_PALETTE[chordIndex];
  return {
    knobs: {
      green: seekKnob(
        chosen?.name ?? "",
        chordIndex,
        Math.max(2, CHORD_PALETTE.length),
        (index) =>
          browse.setChordIndex(Math.min(index, CHORD_PALETTE.length - 1)),
      ),
    },
    pads: arrowPads(device, ["Previous page", "Next page"], (direction) =>
      browse.setChordIndex((index) =>
        turnPage(index, direction, perPage, CHORD_PALETTE.length),
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
        <ScreenSeek>
          Chords {Math.floor(chordIndex / perPage) + 1}/
          {Math.max(1, Math.ceil(CHORD_PALETTE.length / perPage))}
        </ScreenSeek>
      ),
      footer: [chosen?.name ?? "", "Press a chord pad twice to set"],
      tiles: CHORD_PALETTE.map((chord) => ({
        id: chord.id,
        label: chord.name,
        icon: <span>{chord.label}</span>,
      })),
      selected: chordIndex,
      onSelect: browse.setChordIndex,
    },
  };
};
