import { DEVICE_PRESETS } from "../deviceEngine";
import { turnPage } from "../deviceMath";
import { ScreenSeek, TILES_PER_PAGE } from "../DeviceScreen";
import { PresetIcon } from "../presetIcons";
import { bindPad, deletePreset } from "../presetStore";
import { arrowPads, deletePad, padName, padPreset, seekKnob } from "./base";
import type { Mode } from "../../../types/bindings";

// The preset library: the green knob highlights a preset, and pressing a pad
// twice binds it there. Delete removes a highlighted saved preset; built-in
// ones can't be deleted.
export const presetsMode: Mode = (device, base) => {
  const { sound, browse, feedback, shift } = device;
  const { presets } = sound;
  const perPage = TILES_PER_PAGE.presets;
  const { presetIndex } = browse;
  const chosen = presets[presetIndex];
  const trash = chosen?.user ? chosen : null;

  return {
    knobs: {
      green: seekKnob(
        chosen?.name ?? "",
        presetIndex,
        Math.max(2, presets.length),
        (index) => browse.setPresetIndex(Math.min(index, presets.length - 1)),
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
      ...arrowPads(device, ["Previous page", "Next page"], (direction) =>
        browse.setPresetIndex((index) =>
          turnPage(index, direction, perPage, presets.length),
        ),
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
      },
    }),
    screen: {
      status: (
        <ScreenSeek>
          Presets {Math.floor(presetIndex / perPage) + 1}/
          {Math.max(1, Math.ceil(presets.length / perPage))}
        </ScreenSeek>
      ),
      footer: [chosen?.name ?? "", "Press a pad twice to bind"],
      tiles: presets.map((candidate) => {
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
      selected: presetIndex,
      onSelect: browse.setPresetIndex,
    },
  };
};
