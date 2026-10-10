import { formatParam } from "../../../lib/physical/patches/format";
import { ICON_CHOICES } from "../presetIcons";
import { arrowPads, paramKnob, savePad, soundName } from "./base";
import type { Mode } from "../../../types/bindings";

// The synth parameters, a module at a time: Exciter, Resonator, Body,
// Filter, Envelope, LFO and Output, always in that order and skipping the
// ones the instrument doesn't have. The red knob (or ← →) turns the pages,
// and as on the main screen the green one picks a param and the blue one
// sets it. Save picks an icon to save the sound as a preset.
export const synthMode: Mode = (device) => {
  const { sound, views, browse } = device;
  const { paramPage, pageNames, pageSpecs, pageStart } = sound;
  const pages = pageNames.length;
  const turn = (direction: -1 | 1) =>
    sound.showParamPage(
      Math.min(pages - 1, Math.max(0, paramPage + direction)),
    );
  return {
    knobs: {
      green: paramKnob(device),
      red: {
        label: "Module",
        valueLabel: pageNames[paramPage],
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
      ...arrowPads(device, ["Previous module", "Next module"], turn),
    },
    screen: {
      // The modules in the red of the knob that turns them; the highlighted
      // row shows the selection.
      pager: {
        pages: pageNames,
        at: paramPage,
        color: "red",
        onPick: sound.showParamPage,
      },
      footer: [soundName(device), sound.octaveLabel],
      params: pageSpecs.map((spec) => ({
        id: spec.id,
        label: spec.label,
        value: formatParam(spec, sound.values[spec.id] ?? spec.default),
        selected: spec === sound.selected,
      })),
      onSelectParam: (index) => sound.selectParam(pageStart + index),
    },
  };
};
