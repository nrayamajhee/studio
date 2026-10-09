import { DEVICE_PRESETS, presetCategory } from "../deviceEngine";
import { ScreenHint, ScreenValue } from "../DeviceScreen";
import { PresetIcon } from "../presetIcons";
import { bindPad, deletePreset } from "../presetStore";
import {
  arrowPads,
  deletePad,
  idleKnob,
  padName,
  padPreset,
  shelfAt,
  shelfPager,
  shelfStep,
  shelfKnobs,
  shelvesOf,
} from "./base";
import type { Mode } from "../../../types/bindings";

// The preset library, by model: the red knob (or ← →) picks a model and the
// blue one a preset it plays, and pressing a pad twice binds it there and
// closes the library. Delete removes a highlighted saved preset; built-in
// ones can't be deleted.
export const presetsMode: Mode = (device, base) => {
  const { sound, browse, feedback, shift } = device;
  const { presets } = sound;
  const { presetIndex } = browse;
  const chosen = presets[presetIndex];
  const trash = chosen?.user ? chosen : null;
  const shelves = shelvesOf(presets, presetCategory);
  const { shelf, at } = shelfAt(shelves, presetIndex);

  return {
    knobs: {
      green: idleKnob(base.knobs.green),
      ...shelfKnobs(
        shelves,
        presetIndex,
        chosen?.name ?? "",
        browse.setPresetIndex,
      ),
    },
    pads: {
      // Deleting the preset playing falls back to its built-in.
      delete: deletePad(
        device,
        trash
          ? {
              label: `Delete ${trash.name}`,
              key: `delete:${trash.id}`,
              prompt: `Press again to delete ${trash.name}`,
              run: () => {
                deletePreset(trash.id);
                feedback.showNotice(`Deleted ${trash.name}`);
                browse.setPresetIndex((index) =>
                  Math.max(0, Math.min(index, presets.length - 2)),
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
      ...arrowPads(
        device,
        ["Previous model", "Next model"],
        shelfStep(shelves, at, browse.setPresetIndex),
      ),
    },
    presetPad: (pad) => ({
      ...base.presetPad(pad),
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
        device.views.setView("scope");
      },
    }),
    screen: {
      title: "Instruments",
      unsaved: false,
      pager: shelfPager(shelves, at, browse.setPresetIndex),
      footer: [
        <ScreenValue key="chosen">{chosen?.name ?? ""}</ScreenValue>,
        <ScreenHint key="hint">Press a pad twice to bind</ScreenHint>,
      ],
      tiles: presets
        .slice(shelf.start, shelf.start + shelf.count)
        .map((candidate) => {
          const bound = [
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
            badge: bound.length > 0 ? bound.join(" ") : undefined,
          };
        }),
      selected: presetIndex - shelf.start,
      selectedBy: "blue",
      onSelect: (index) => browse.setPresetIndex(shelf.start + index),
    },
  };
};
