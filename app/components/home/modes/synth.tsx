import { formatParam } from "../../../lib/physical/patches/format";
import { ICON_CHOICES } from "../presetIcons";
import { ScreenSeek } from "../DeviceScreen";
import { turnPage } from "../deviceMath";
import { arrowPads, savePad, seekKnob, soundName } from "./base";
import type { Mode } from "../../../types/bindings";

// The synth parameters, a page at a time: the green knob turns the pages,
// the red one picks a param and the blue one sets it. Save picks an icon to
// save the sound as a preset.
export const synthMode: Mode = (device) => {
  const { sound, views, browse } = device;
  const { paramPage, pages } = sound;
  return {
    knobs: {
      green: seekKnob(
        `Page ${paramPage + 1} of ${pages}`,
        paramPage,
        Math.max(2, pages),
        sound.showParamPage,
      ),
    },
    pads: {
      save: savePad(device, {
        label: "Save preset",
        onPress: () => {
          browse.setIconIndex(
            Math.max(0, ICON_CHOICES.indexOf(sound.preset.icon)),
          );
          views.setView("save");
        },
      }),
      ...arrowPads(device, ["Previous page", "Next page"], (direction) =>
        sound.showParamPage(turnPage(paramPage, direction, 1, pages)),
      ),
    },
    screen: {
      status: sound.octaveLabel,
      // The highlighted row shows the selection, so the footer shows the
      // page.
      footer: [
        soundName(device),
        <ScreenSeek key="page">
          Params {paramPage + 1}/{pages}
        </ScreenSeek>,
      ],
      params: sound.specs.map((spec) => ({
        id: spec.id,
        label: spec.label,
        value: formatParam(spec, sound.values[spec.id] ?? spec.default),
        selected: spec === sound.selected,
      })),
      page: paramPage,
      onSelectParam: sound.selectParam,
    },
  };
};
