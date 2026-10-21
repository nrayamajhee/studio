import {
  DEVICE_PRESETS,
  presetPages,
  type PresetPaging,
} from "../deviceEngine";
import { ScreenHint, ScreenValue } from "../DeviceScreen";
import { PresetIcon } from "../presetIcons";
import { bindPad, deletePreset } from "../presetStore";
import {
  arrowPads,
  deletePad,
  favoritesPicker,
  listFavorites,
  padName,
  padPreset,
  shelfAt,
  shelfPager,
  shelfStep,
  shelfKnobs,
} from "./base";
import type { Mode } from "../../../types/bindings";

// The preset library, by model or (the green knob) by band, after the
// favorites and before the saved presets: the red knob (or ← →) picks a page
// and the blue one a preset on it, which the keys and anything playing sound
// on while the library is open, without picking it. Pressing a pad twice
// binds it there, the library staying open for the next. Mute stars the
// preset; Delete removes a highlighted saved preset; built-in ones can't be
// deleted.
export const instrumentsMode: Mode = (device, base) => {
  const { sound, browse, feedback, shift } = device;
  const paging = presetPages(sound.presets, browse.presetPaging);
  const byBand = browse.presetPaging === "band";
  const {
    listed,
    shelves,
    index: presetIndex,
    chosen,
    select,
    forget,
    mute,
    star,
  } = favoritesPicker(device, {
    kind: "instruments",
    items: paging.items,
    categoryOf: paging.categoryOf,
    index: browse.presetIndex,
    setIndex: browse.setPresetIndex,
  });
  const trash = chosen.user ? chosen : null;
  const { shelf, at } = shelfAt(shelves, presetIndex);
  // Repaging keeps the pick: where it was among the favorites, or else on
  // its page in the new order.
  const repage = (next: PresetPaging) => {
    if (next === browse.presetPaging) return;
    const { items, categoryOf } = presetPages(sound.presets, next);
    const relisted = listFavorites(
      items,
      categoryOf,
      browse.favorites.instruments,
    );
    const on = (page: string) =>
      relisted.findIndex(
        (candidate) => candidate.id === chosen.id && candidate.page === page,
      );
    const same = on(chosen.page);
    browse.setPresetPaging(next);
    browse.setPresetIndex(
      Math.max(0, same >= 0 ? same : on(categoryOf(chosen))),
    );
  };

  return {
    knobs: {
      green: {
        label: "Pages",
        valueLabel: byBand ? "By band" : "By model",
        step: byBand ? 1 : 0,
        steps: 2,
        onChange: (step) => repage(step > 0 ? "band" : "model"),
      },
      ...shelfKnobs(shelves, presetIndex, chosen.name, select),
    },
    pads: {
      // Deleting the preset playing falls back to its built-in. The pick
      // stays where it was, on the one after.
      delete: deletePad(
        device,
        trash
          ? {
              label: `Delete ${trash.name}`,
              key: `delete:${trash.id}`,
              prompt: `Press again to delete ${trash.name}`,
              run: () => {
                forget(trash.id);
                deletePreset(trash.id);
                feedback.showNotice(`Deleted ${trash.name}`);
                const before = listed
                  .slice(0, presetIndex)
                  .filter(({ id }) => id === trash.id).length;
                const left = listed.filter(({ id }) => id !== trash.id);
                browse.setPresetIndex(
                  Math.max(0, Math.min(presetIndex - before, left.length - 1)),
                );
                if (sound.preset.id === trash.id)
                  sound.selectPreset(
                    DEVICE_PRESETS.find(
                      ({ target }) => target === trash.target,
                    ) ?? DEVICE_PRESETS[0],
                  );
              },
            }
          : undefined,
      ),
      mute,
      ...arrowPads(
        device,
        byBand
          ? ["Previous band", "Next band"]
          : ["Previous model", "Next model"],
        shelfStep(shelves, at, select),
      ),
    },
    instrumentPad: (pad) => ({
      ...base.instrumentPad(pad),
      label: `Bind to ${padName(device, pad).toLowerCase()} (${padPreset(device, pad)?.name ?? "empty"})`,
      onPress: () => {
        if (
          !feedback.confirm(
            `bind:${pad}`,
            `Press again to bind to ${padName(device, pad).toLowerCase()}`,
          )
        )
          return;
        bindPad(pad, chosen.id, shift);
        feedback.showNotice(`${padName(device, pad)} → ${chosen.name}`);
      },
    }),
    previewSound: chosen,
    screen: {
      title: "Instruments",
      unsaved: false,
      pager: shelfPager(shelves, at, select),
      footer: [
        <ScreenValue key="chosen">{chosen.name}</ScreenValue>,
        <ScreenHint key="hint">Press a pad twice to bind</ScreenHint>,
      ],
      tiles: listed
        .slice(shelf.start, shelf.start + shelf.count)
        .map((candidate) => {
          const badges = [
            star(candidate),
            ...sound.library.buttons.map((id, pad) =>
              id === candidate.id ? `${pad + 1}` : "",
            ),
            ...sound.library.shiftButtons.map((id, pad) =>
              id === candidate.id ? `⇧${pad + 1}` : "",
            ),
          ].filter(Boolean);
          return {
            id: candidate.id,
            label: candidate.name,
            icon: <PresetIcon icon={candidate.icon} />,
            badge: badges.length > 0 ? badges.join(" ") : undefined,
          };
        }),
      selected: presetIndex - shelf.start,
      selectedBy: "blue",
      onSelect: (index) => select(shelf.start + index),
    },
  };
};
