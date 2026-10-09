import { ScreenHint, ScreenValue } from "../DeviceScreen";
import { PROGRESSIONS, previewHome, progressionTake } from "../progressions";
import {
  arrowPads,
  idleKnob,
  previewPads,
  savePad,
  shelfAt,
  shelfKnobs,
  shelfPager,
  shelfStep,
  shelvesOf,
} from "./base";
import type { Mode } from "../../../types/bindings";

const SHELVES = shelvesOf(PROGRESSIONS, ({ group }) => group);

// Chord progressions (Shift + Piano roll), by kind: the red knob (or ← →)
// picks a kind and the blue one a progression. A tile tapped, or Play, plays
// it on the preview tape; Play again pauses it. Save waits for the home note:
// the next key played sets it, and the progression goes onto the tape, a
// chord a bar at the tempo. Save again lets it go; a tile double-clicked
// waits for its home note as Save would.
export const progressionsMode: Mode = (device, base) => {
  const { browse, performance, feedback, lanes, transport, preview } = device;
  const { progressionIndex } = browse;
  const chosen = PROGRESSIONS[progressionIndex];
  const { shelf, at } = shelfAt(SHELVES, progressionIndex);
  const waiting = performance.homeFor !== null;
  const taped = (lanes.lanes[0]?.take.notes.length ?? 0) > 0;
  // The progression as it would go onto the tape, in the play style and at
  // the tempo, on the keys' instrument.
  const audition = (index: number) => {
    const progression = PROGRESSIONS[index];
    preview.play(
      progression.id,
      progressionTake(
        progression,
        previewHome(progression),
        transport.timing,
        performance.chordStyle,
      ),
    );
  };
  // Picking another progression while one waits makes it the one that goes
  // onto the tape.
  const select = (index: number) => {
    browse.setProgressionIndex(index);
    if (waiting) performance.awaitHome(PROGRESSIONS[index]);
  };
  // A tile tapped plays, or pauses, as Play does.
  const tap = (index: number) => {
    select(index);
    if (preview.playing && preview.cued === PROGRESSIONS[index].id)
      preview.pause();
    else audition(index);
  };
  const arm = (index: number) => {
    preview.stop();
    browse.setProgressionIndex(index);
    performance.awaitHome(PROGRESSIONS[index]);
    feedback.showPrompt("Play the home note");
  };

  return {
    knobs: {
      green: idleKnob(base.knobs.green),
      ...shelfKnobs(SHELVES, progressionIndex, chosen.name, select),
    },
    pads: {
      save: {
        ...savePad(device, {
          label: waiting ? "Cancel" : `Put ${chosen.name} on the tape`,
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
      ...previewPads(device, chosen.name, () => audition(progressionIndex)),
      ...arrowPads(
        device,
        ["Previous kind", "Next kind"],
        shelfStep(SHELVES, at, select),
      ),
    },
    screen: {
      title: "Progressions",
      unsaved: false,
      pager: shelfPager(SHELVES, at, select),
      footer: [
        <ScreenValue key="chosen">{chosen.name}</ScreenValue>,
        <ScreenHint key="hint">
          {waiting
            ? taped
              ? "Play the home note (replaces the tape)"
              : "Play the home note"
            : "Save, then play the home note"}
        </ScreenHint>,
      ],
      tiles: PROGRESSIONS.slice(shelf.start, shelf.start + shelf.count).map(
        ({ id, name, numerals }) => ({
          id,
          label: name,
          icon: <span>{numerals}</span>,
        }),
      ),
      selected: progressionIndex - shelf.start,
      selectedBy: "blue",
      onSelect: (index) => tap(shelf.start + index),
      onActivate: (index) => arm(shelf.start + index),
    },
  };
};
