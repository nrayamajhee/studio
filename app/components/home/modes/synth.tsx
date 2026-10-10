import { PATCH_BY_ID } from "../../../lib/physical/patches";
import {
  formatParam,
  toUnit,
  valueToStep,
} from "../../../lib/physical/patches/format";
import type { ParamSpec } from "../../../lib/physical/patches/types";
import { engineName } from "../deviceEngine";
import type { ScreenReadout } from "../DeviceScreen";
import { ICON_CHOICES } from "../presetIcons";
import { KNOB_TONES, graphNote, pageScene, type Tone } from "../synthGraphs";
import { CHAIN_STOPS, noteName, type KnobSlots } from "../synthPages";
import { arrowPads, idleKnob, savePad } from "./base";
import type { KnobBinding, KnobSlot, Mode } from "../../../types/bindings";

const SLOTS: readonly KnobSlot[] = ["chalk", "green", "red", "blue"];

const EMPTY: ScreenReadout = { label: "", display: "", amount: 0 };

// The synth's params a page at a time: an overview of the signal chain, then
// a page per module (exciter, resonator, filter, body, output, then the
// envelope and LFO that move them), each a graph of what its knobs do over
// their readings. The four knobs set the page's params, in the colours the
// graph draws them in; held Shift, its extras. ← → turn the pages (with
// Shift, they step the instrument as anywhere else). Save picks an icon to
// save the sound as a preset.
export const synthMode: Mode = (device, base) => {
  const { sound, views, browse, shift } = device;
  const { pages, pageIndex, page, values } = sound;
  const patch = PATCH_BY_ID[sound.preset.target];
  const valueOf = (spec: ParamSpec) => values[spec.id] ?? spec.default;
  const hasShift = page.shift.some(Boolean);
  const layer: KnobSlots = shift && hasShift ? page.shift : page.main;
  const toneOf = (id: string): Tone => {
    const main = page.main.findIndex((spec) => spec?.id === id);
    if (main >= 0) return KNOB_TONES[main];
    const extra = page.shift.findIndex((spec) => spec?.id === id);
    return extra >= 0 ? KNOB_TONES[extra] : "dim";
  };
  const note = graphNote(patch);
  const chain = page.id === "chain";
  const stops = CHAIN_STOPS.filter((stop) =>
    pages.some(({ id }) => id === stop),
  );
  const pickedPage = pages.find(({ id }) => id === sound.chainPick);
  const open = (index: number) => sound.showPage(index);

  const readout = (spec: ParamSpec | null): ScreenReadout =>
    spec
      ? {
          label: spec.label,
          display: formatParam(spec, valueOf(spec)),
          amount: toUnit(spec, valueOf(spec)),
        }
      : EMPTY;
  const knob = (slot: number): KnobBinding => {
    const spec = layer[slot];
    if (!spec) return idleKnob(base.knobs[SLOTS[slot]]);
    const steps = sound.stepsOf(spec);
    return {
      label: spec.label,
      valueLabel: formatParam(spec, valueOf(spec)),
      step: valueToStep(spec, valueOf(spec), steps),
      steps,
      onChange: (step) => sound.setParamStep(spec, step),
    };
  };
  const pickKnob: KnobBinding = {
    label: "Block",
    valueLabel: pickedPage?.label,
    step: Math.max(0, (stops as readonly string[]).indexOf(sound.chainPick)),
    steps: Math.max(2, stops.length),
    onChange: (step) =>
      sound.pickBlock(stops[Math.min(step, stops.length - 1)]),
  };
  const extras = (shift ? page.main : page.shift).filter(
    (spec): spec is ParamSpec => spec !== null,
  );
  const hint = chain
    ? "green picks · → opens"
    : hasShift
      ? `${shift ? "" : "⇧ "}${extras
          .map((spec) => `${spec.label} ${formatParam(spec, valueOf(spec))}`)
          .join(" · ")}`
      : "";

  return {
    knobs: chain
      ? {
          chalk: idleKnob(base.knobs.chalk),
          green: pickKnob,
          red: idleKnob(base.knobs.red),
          blue: idleKnob(base.knobs.blue),
        }
      : {
          chalk: knob(0),
          green: knob(1),
          red: knob(2),
          blue: knob(3),
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
      ...(shift
        ? {}
        : arrowPads(
            device,
            chain
              ? ["Previous page", `Open ${pickedPage?.label ?? "the block"}`]
              : ["Previous page", "Next page"],
            (direction) =>
              chain && direction > 0
                ? open(pages.findIndex(({ id }) => id === sound.chainPick))
                : open(pageIndex + direction),
          )),
    },
    screen: {
      pager: {
        pages: pages.map(({ label }) => label),
        at: pageIndex,
        color: "ink",
        onPick: open,
      },
      footer: [noteName(note), hint],
      readouts: (chain ? (pickedPage?.main ?? []) : layer).map(readout),
      synthScene: pageScene(
        page,
        { patch, values, note, toneOf },
        pages,
        sound.chainPick,
        engineName(sound.preset.target),
      ),
      synthLabel: `${page.label}: ${chain ? "the signal chain" : "what its knobs do"} on the ${patch.name}`,
    },
  };
};
