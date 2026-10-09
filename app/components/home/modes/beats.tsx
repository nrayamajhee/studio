import { DEVICE_PRESETS } from "../deviceEngine";
import { ScreenHint, ScreenValue } from "../DeviceScreen";
import { beatPattern, beatPreview, DRUM_BEATS } from "../drumBeats";
import { METERS, meterLabel } from "../noteRecorder";
import { setSteps } from "../sessionStore";
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

const kitPreset = (kit: string) =>
  DEVICE_PRESETS.find(({ target }) => target === kit) ?? DEVICE_PRESETS[0];

const SHELVES = shelvesOf(DRUM_BEATS, ({ style }) => style);

// Drum beats (Shift + Drum grid), by style: the red knob (or ← →) picks a
// style and the blue one a beat. A tile tapped, or Play, plays it on the
// preview tape, on its kit at its tempo; Play again pauses it. Save loads it
// into the drum grid on that kit, setting the tempo and time signature to
// its own, and opens the grid to play or keep it; so does a tile
// double-clicked.
export const beatsMode: Mode = (device, base) => {
  const { browse, sound, transport, views, feedback, preview } = device;
  const { beatIndex } = browse;
  const chosen = DRUM_BEATS[beatIndex];
  const { shelf, at } = shelfAt(SHELVES, beatIndex);
  const select = browse.setBeatIndex;
  const audition = (index: number) => {
    const beat = DRUM_BEATS[index];
    preview.play(beat.id, beatPreview(beat), {
      target: beat.kit,
      octave: 0,
    });
  };
  // A tile tapped plays, or pauses, as Play does.
  const tap = (index: number) => {
    select(index);
    if (preview.playing && preview.cued === DRUM_BEATS[index].id)
      preview.pause();
    else audition(index);
  };
  const load = (index: number) => {
    const beat = DRUM_BEATS[index];
    browse.setBeatIndex(index);
    const kit = kitPreset(beat.kit);
    if (sound.preset.id !== kit.id) sound.selectPreset(kit);
    setSteps(beatPattern(beat));
    const meter = METERS.findIndex(
      ({ beats, unit }) =>
        beats === beat.meter.beats && unit === beat.meter.unit,
    );
    if (meter >= 0) transport.setMeter(meter);
    transport.setBpm(beat.bpm);
    views.setView("steps");
    feedback.showNotice(`${beat.name} in the drum grid`);
  };

  return {
    knobs: {
      green: idleKnob(base.knobs.green),
      ...shelfKnobs(SHELVES, beatIndex, chosen.name, select),
    },
    pads: {
      save: savePad(device, {
        label: `Load ${chosen.name} into the drum grid`,
        onPress: () => load(beatIndex),
      }),
      ...previewPads(device, chosen.name, () => audition(beatIndex)),
      ...arrowPads(
        device,
        ["Previous style", "Next style"],
        shelfStep(SHELVES, at, select),
      ),
    },
    screen: {
      title: "Beats",
      unsaved: false,
      pager: shelfPager(SHELVES, at, select),
      footer: [
        <span key="chosen">
          <ScreenValue>{chosen.name}</ScreenValue> on the{" "}
          {kitPreset(chosen.kit).name}
        </span>,
        <ScreenHint key="hint">Save to load it into the drum grid</ScreenHint>,
      ],
      tiles: DRUM_BEATS.slice(shelf.start, shelf.start + shelf.count).map(
        (beat) => ({
          id: beat.id,
          label: beat.name,
          icon: (
            <span>
              {meterLabel(beat.meter)}
              <br />
              {beat.bpm} BPM
            </span>
          ),
        }),
      ),
      selected: beatIndex - shelf.start,
      selectedBy: "blue",
      onSelect: (index) => tap(shelf.start + index),
      onActivate: (index) => load(shelf.start + index),
    },
  };
};
