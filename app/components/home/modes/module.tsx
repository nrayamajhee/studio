import { DEVICE_MODULES, type ModuleId } from "../deviceEngine";
import { knobDisplay, knobValue } from "../modules";
import { mixPads } from "./base";
import type { KnobBinding, Mode } from "../../../types/bindings";

// The ADSR, LFO or FX of the focused lane: the four knobs set its params, in
// knob order, switching it on. On a track's, Play plays the tracks, so each
// turn of a knob is heard on the track itself.
export const moduleMode =
  (id: ModuleId): Mode =>
  (device) => {
    const { lanes, mix } = device;
    const { modules, modulesOwner, setModuleStep } = lanes;
    const module = DEVICE_MODULES[id];
    const knob = (index: number): KnobBinding => {
      const spec = module.knobs[index];
      const step = modules.steps[id][index];
      return {
        label: spec.spec.label,
        valueLabel: knobDisplay(spec, step),
        step,
        steps: spec.steps,
        onChange: (next) => setModuleStep(id, index, next),
      };
    };
    return {
      knobs: { chalk: knob(0), green: knob(1), red: knob(2), blue: knob(3) },
      pads: mix.mixView ? mixPads(device) : {},
      screen: {
        title: `${module.label} · ${modulesOwner}`,
        unsaved: false,
        readouts: module.knobs.map((spec, i) => {
          const step = modules.steps[id][i];
          return {
            label: spec.spec.label,
            display: knobDisplay(spec, step),
            amount:
              spec.spec.id === "adsr.sustain"
                ? knobValue(spec, step)
                : step / (spec.steps - 1),
          };
        }),
        lfoShape: modules.steps.lfo[2],
        lfoRate: knobValue(DEVICE_MODULES.lfo.knobs[0], modules.steps.lfo[0]),
        // On/off, centred along the bottom.
        badge: { label: module.label, on: modules.on[id] },
      },
    };
  };
