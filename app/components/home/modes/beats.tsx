import { DEVICE_PRESETS } from "../deviceEngine";
import { ScreenHint, ScreenValue } from "../DeviceScreen";
import { beatPattern, beatPreview, DRUM_BEATS } from "../drumBeats";
import { METERS, meterLabel } from "../noteRecorder";
import { setPattern } from "../sessionStore";
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

const kitPreset = (kit: string) =>
  DEVICE_PRESETS.find(({ target }) => target === kit) ?? DEVICE_PRESETS[0];

// Drum beats (Shift + Drum grid), by style, after the favorites: the red knob
// (or ← →) picks a page and the blue one a beat. Picking a beat puts its kit
// on the keys (the instrument pads keep what they're bound to). A tile
// tapped, or Play, plays it on the preview, on its kit at the tempo; Play
// again pauses it. Save loads it
// into the drum grid on that kit, setting the time signature to its own, and
// opens the grid to play or keep it; so does a tile double-clicked. Mute
// stars it.
export const beatsMode: Mode = (device, base) => {
  const { browse, sound, transport, views, feedback, preview } = device;
  const {
    listed,
    shelves,
    index: beatIndex,
    chosen,
    select,
    mute,
    star,
  } = favoritesPicker(device, {
    kind: "beats",
    items: DRUM_BEATS,
    categoryOf: ({ style }) => style,
    index: browse.beatIndex,
    setIndex: browse.setBeatIndex,
    onPick: (beat) => {
      const kit = kitPreset(beat.kit);
      if (sound.preset.id !== kit.id) sound.selectPreset(kit);
    },
  });
  const { shelf, at } = shelfAt(shelves, beatIndex);
  const audition = (index: number) => {
    const beat = listed[index];
    preview.play(beat.id, beatPreview(beat, transport.bpm), {
      target: beat.kit,
      octave: 0,
    });
  };
  // A tile tapped plays, or pauses, as Play does.
  const tap = (index: number) => {
    select(index);
    if (preview.playing && preview.cued === listed[index].id) preview.pause();
    else audition(index);
  };
  const load = (index: number) => {
    const beat = listed[index];
    browse.setBeatIndex(index);
    const kit = kitPreset(beat.kit);
    if (sound.preset.id !== kit.id) sound.selectPreset(kit);
    setPattern(beatPattern(beat));
    const meter = METERS.findIndex(
      ({ beats, unit }) =>
        beats === beat.meter.beats && unit === beat.meter.unit,
    );
    if (meter >= 0) transport.setMeter(meter);
    views.setView("drumGrid");
    feedback.showNotice(`${beat.name} in the drum grid`);
  };

  return {
    knobs: {
      green: idleKnob(base.knobs.green),
      ...shelfKnobs(shelves, beatIndex, chosen.name, select),
    },
    pads: {
      save: savePad(device, {
        label: `Load ${chosen.name} into the drum grid`,
        onPress: () => load(beatIndex),
      }),
      mute,
      ...previewPads(device, chosen.name, () => audition(beatIndex)),
      ...arrowPads(
        device,
        ["Previous style", "Next style"],
        shelfStep(shelves, at, select),
      ),
    },
    screen: {
      title: "Beats",
      unsaved: false,
      pager: shelfPager(shelves, at, select),
      footer: [
        <span key="chosen">
          <ScreenValue>{chosen.name}</ScreenValue> on the{" "}
          {kitPreset(chosen.kit).name}
        </span>,
        <ScreenHint key="hint">Save to load it into the drum grid</ScreenHint>,
      ],
      tiles: listed
        .slice(shelf.start, shelf.start + shelf.count)
        .map((beat) => ({
          id: beat.id,
          label: beat.name,
          icon: <span>{meterLabel(beat.meter)}</span>,
          badge: star(beat),
        })),
      selected: beatIndex - shelf.start,
      selectedBy: "blue",
      onSelect: (index) => tap(shelf.start + index),
      onActivate: (index) => load(shelf.start + index),
    },
  };
};
