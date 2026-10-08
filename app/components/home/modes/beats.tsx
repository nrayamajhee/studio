import { DEVICE_PRESETS } from "../deviceEngine";
import { ScreenValue } from "../DeviceScreen";
import { beatPattern, DRUM_BEATS } from "../drumBeats";
import { METERS, meterLabel } from "../noteRecorder";
import { setSteps } from "../sessionStore";
import {
  arrowPads,
  idleKnob,
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
// style and the blue one a beat. Save loads it into the drum grid on the kit
// that suits it and in its time signature, and opens the grid to play or
// keep it; so does a tile double-clicked.
export const beatsMode: Mode = (device, base) => {
  const { browse, sound, transport, views, feedback } = device;
  const { beatIndex, setBeatIndex } = browse;
  const chosen = DRUM_BEATS[beatIndex];
  const { shelf, at } = shelfAt(SHELVES, beatIndex);
  const load = (index: number) => {
    const beat = DRUM_BEATS[index];
    setBeatIndex(index);
    const kit = kitPreset(beat.kit);
    if (sound.preset.id !== kit.id) sound.selectPreset(kit);
    setSteps(beatPattern(beat));
    const meter = METERS.findIndex(
      ({ beats, unit }) =>
        beats === beat.meter.beats && unit === beat.meter.unit,
    );
    if (meter >= 0) transport.setMeter(meter);
    views.setView("steps");
    feedback.showNotice(`${beat.name} in the drum grid`);
  };

  return {
    knobs: {
      green: idleKnob(base.knobs.green),
      ...shelfKnobs(SHELVES, beatIndex, chosen.name, setBeatIndex),
    },
    pads: {
      save: savePad(device, {
        label: `Load ${chosen.name} into the drum grid`,
        onPress: () => load(beatIndex),
      }),
      ...arrowPads(
        device,
        ["Previous style", "Next style"],
        shelfStep(SHELVES, at, setBeatIndex),
      ),
    },
    screen: {
      title: "Beats",
      unsaved: false,
      pager: shelfPager(SHELVES, at, setBeatIndex),
      footer: [
        <span key="chosen">
          <ScreenValue>{chosen.name}</ScreenValue> on the{" "}
          {kitPreset(chosen.kit).name}
        </span>,
        "Save to load it into the drum grid",
      ],
      tiles: DRUM_BEATS.slice(shelf.start, shelf.start + shelf.count).map(
        (beat) => ({
          id: beat.id,
          label: beat.name,
          icon: <span>{meterLabel(beat.meter)}</span>,
        }),
      ),
      selected: beatIndex - shelf.start,
      selectedBy: "blue",
      onSelect: (index) => setBeatIndex(shelf.start + index),
      onActivate: (index) => load(shelf.start + index),
    },
  };
};
