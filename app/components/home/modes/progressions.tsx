import { ScreenHint, ScreenValue } from "../DeviceScreen";
import {
  PROGRESSIONS,
  previewHome,
  previewTempo,
  progressionTake,
  type Progression,
} from "../progressions";
import { swingOn, swungTake } from "../swing";
import {
  arrowPads,
  favoritesPicker,
  idleKnob,
  previewPads,
  savePad,
  shelfAt,
  shelfKnobs,
  shelfPager,
  shelfStep,
} from "./base";
import type { Mode } from "../../../types/bindings";

// Chord progressions (Shift + Piano roll), by kind, after the favorites: the
// red knob (or ← →) picks a page and the blue one a progression. A tile
// tapped, or Play, plays it on the preview tape in its own key; Play again
// pauses it. A key played plays it from that note instead, from the top each
// time. Save waits for the home note: the next key played sets it, and the
// progression goes onto the tape, a chord a bar at the tempo. Save again lets
// it go; a tile double-clicked waits for its home note as Save would. Mute
// stars it.
export const progressionsMode: Mode = (device, base) => {
  const { browse, performance, feedback, lanes, transport, preview } = device;
  const waiting = performance.homeFor !== null;
  // Picking another progression while one waits makes it the one that goes
  // onto the tape.
  const {
    listed,
    shelves,
    index: progressionIndex,
    chosen,
    select,
    mute,
    star,
  } = favoritesPicker(device, {
    kind: "progressions",
    items: PROGRESSIONS,
    categoryOf: ({ group }) => group,
    index: browse.progressionIndex,
    setIndex: browse.setProgressionIndex,
    onPick: (progression) => {
      if (waiting) performance.awaitHome(progression);
    },
  });
  const { shelf, at } = shelfAt(shelves, progressionIndex);
  const taped = (lanes.lanes[0]?.take.notes.length ?? 0) > 0;
  // The progression as it would go onto the tape, in the play style and at
  // the tempo, on the keys' instrument.
  // Previews run a little faster than the tape (see previewTempo), swung as
  // the take plays; Save loads the take at the tape's own tempo.
  const previewTiming = {
    ...transport.timing,
    bpm: previewTempo(transport.timing.bpm),
  };
  const previewOf = (progression: Progression, note: number) =>
    swungTake(
      progressionTake(progression, note, previewTiming, performance.playStyle),
      swingOn(transport.swing),
    );
  const audition = (index: number) => {
    const progression = listed[index];
    preview.play(
      progression.id,
      previewOf(progression, previewHome(progression)),
    );
  };
  // The progression from `note` as its home, from the top, as a preview of
  // its own (Play and the tiles keep to its key).
  const auditionFrom = (note: number) =>
    preview.play(
      `${chosen.id}:from-key`,
      previewOf(chosen, note),
      undefined,
      true,
    );
  // A tile tapped plays, or pauses, as Play does.
  const tap = (index: number) => {
    select(index);
    if (preview.playing && preview.cued === listed[index].id) preview.pause();
    else audition(index);
  };
  const arm = (index: number) => {
    preview.stop();
    browse.setProgressionIndex(index);
    performance.awaitHome(listed[index]);
    feedback.showPrompt("Play the home note");
  };

  return {
    knobs: {
      green: idleKnob(base.knobs.green),
      ...shelfKnobs(shelves, progressionIndex, chosen.name, select),
    },
    pads: {
      save: {
        ...savePad(device, {
          label: waiting ? "Cancel" : `Load ${chosen.name} as the take`,
          onPress: () => {
            if (waiting) {
              performance.awaitHome(null);
              return;
            }
            arm(progressionIndex);
          },
        }),
        lit: waiting,
      },
      mute,
      ...previewPads(device, chosen.name, () => audition(progressionIndex)),
      ...arrowPads(
        device,
        ["Previous kind", "Next kind"],
        shelfStep(shelves, at, select),
      ),
    },
    screen: {
      title: "Progressions",
      unsaved: false,
      pager: shelfPager(shelves, at, select),
      footer: [
        <ScreenValue key="chosen">{chosen.name}</ScreenValue>,
        <ScreenHint key="hint">
          {waiting
            ? taped
              ? "Play the home note (replaces the take)"
              : "Play the home note"
            : "A note plays it from there · Save to load"}
        </ScreenHint>,
      ],
      tiles: listed
        .slice(shelf.start, shelf.start + shelf.count)
        .map((progression) => ({
          id: progression.id,
          label: progression.name,
          icon: <span>{progression.numerals}</span>,
          badge: star(progression),
        })),
      selected: progressionIndex - shelf.start,
      selectedBy: "blue",
      onSelect: (index) => tap(shelf.start + index),
      onActivate: (index) => arm(shelf.start + index),
    },
    // While Save waits, the key sets the home note as it always did.
    keyPress: (note) => {
      if (waiting) return false;
      auditionFrom(note);
      return true;
    },
  };
};
