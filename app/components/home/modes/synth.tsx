import { formatParam } from "../../../lib/physical/patches/format";
import { ICON_CHOICES } from "../presetIcons";
import { turnPage } from "../deviceMath";
import { arrowPads, paramKnob, savePad, soundName } from "./base";
import type { Mode } from "../../../types/bindings";

// The synth parameters, a page at a time: the red knob (or ← →) turns the
// pages, and as on the main screen the green one picks a param and the blue
// one sets it. Save picks an icon to save the sound as a preset.
export const synthMode: Mode = (device) => {
  const { sound, views, browse } = device;
  const { paramPage, pages } = sound;
  const turn = (direction: -1 | 1) =>
    sound.showParamPage(turnPage(paramPage, direction, 1, pages));
  return {
    knobs: {
      green: paramKnob(device),
      red: {
        label: "Page",
        valueLabel: `Page ${paramPage + 1} of ${pages}`,
        step: paramPage,
        steps: Math.max(2, pages),
        onChange: (page) => sound.showParamPage(Math.min(page, pages - 1)),
      },
    },
    pads: {
      save: savePad(device, {
        label: "Save instrument",
        onPress: () => {
          browse.setIconIndex(
            Math.max(0, ICON_CHOICES.indexOf(sound.preset.icon)),
          );
          views.setView("save");
        },
      }),
      ...arrowPads(device, ["Previous page", "Next page"], turn),
    },
    screen: {
      // The pages in the red of the knob that turns them; the highlighted
      // row shows the selection.
      pager: {
        pages: Array.from({ length: pages }, (_, i) => `Page ${i + 1}`),
        at: paramPage,
        color: "red",
        onPick: sound.showParamPage,
      },
      footer: [soundName(device), sound.octaveLabel],
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
