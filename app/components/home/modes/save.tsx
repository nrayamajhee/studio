import type { DevicePreset } from "../deviceEngine";
import { iconLabel, turnPage } from "../deviceMath";
import { ScreenSeek, TILES_PER_PAGE } from "../DeviceScreen";
import { ICON_CHOICES, PresetIcon } from "../presetIcons";
import { bindPad, clearEdits, savePreset, updatePreset } from "../presetStore";
import {
  arrowPads,
  padName,
  padPreset,
  savePad,
  seekKnob,
  soundName,
} from "./base";
import type { Mode } from "../../../types/bindings";
import type { Device } from "../../../types/device";

// Saving bakes the edits into the saved preset, so the one it came from goes
// back to its own values.
const finishSave = (device: Device, saved: DevicePreset, message: string) => {
  device.sound.adoptPreset(saved);
  device.views.setView("scope");
  device.feedback.showNotice(message);
};

// Saving onto the pad that already holds this saved preset overwrites it;
// anything else becomes a new preset bound to that pad.
const saveToPad = (device: Device, pad: number) => {
  const { sound, shift, browse } = device;
  const { preset, values } = sound;
  const icon = ICON_CHOICES[browse.iconIndex];
  const bound = (shift ? sound.library.shiftButtons : sound.library.buttons)[
    pad
  ];
  const saved =
    preset.user && bound === preset.id
      ? updatePreset(preset, values, icon, soundName(device))
      : savePreset(preset, values, icon, soundName(device));
  bindPad(pad, saved.id, shift);
  clearEdits(preset.id);
  finishSave(
    device,
    saved,
    `Saved ${saved.name} to ${padName(device, pad).toLowerCase()}`,
  );
};

// The icon picker Save opens from the synth parameters: the green knob picks
// an icon, then Save keeps the sound as a new preset, or a pad saves it
// there.
export const saveMode: Mode = (device, base) => {
  const { sound, browse } = device;
  const perPage = TILES_PER_PAGE.save;
  const { iconIndex } = browse;
  return {
    knobs: {
      green: seekKnob(
        iconLabel(ICON_CHOICES[iconIndex]),
        iconIndex,
        ICON_CHOICES.length,
        browse.setIconIndex,
      ),
    },
    pads: {
      save: savePad(device, {
        label: "Save preset",
        onPress: () => {
          const saved = savePreset(
            sound.preset,
            sound.values,
            ICON_CHOICES[iconIndex],
            soundName(device),
          );
          clearEdits(sound.preset.id);
          finishSave(device, saved, `Saved ${saved.name}`);
        },
      }),
      ...arrowPads(device, ["Previous page", "Next page"], (direction) =>
        browse.setIconIndex((index) =>
          turnPage(index, direction, perPage, ICON_CHOICES.length),
        ),
      ),
    },
    presetPad: (pad) => ({
      ...base.presetPad(pad),
      label: `Save to ${padName(device, pad).toLowerCase()} (${padPreset(device, pad)?.name ?? "empty"})`,
      onPress: () => saveToPad(device, pad),
    }),
    screen: {
      status: (
        <ScreenSeek>
          Icons {Math.floor(iconIndex / perPage) + 1}/
          {Math.ceil(ICON_CHOICES.length / perPage)}
        </ScreenSeek>
      ),
      footer: ["Pick an icon", "Press a pad to save"],
      tiles: ICON_CHOICES.map((icon) => ({
        id: icon,
        label: iconLabel(icon),
        icon: <PresetIcon icon={icon} />,
      })),
      selected: iconIndex,
      onSelect: browse.setIconIndex,
    },
  };
};
