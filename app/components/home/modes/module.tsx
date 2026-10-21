import { isTake } from "../../../providers/LanesProvider";
import { DEVICE_MODULES, type ModuleId } from "../deviceEngine";
import { INITIAL_MODULES, knobDisplay, knobValue } from "../modules";
import { deletePad } from "./base";
import type { KnobBinding, Mode } from "../../../types/bindings";

// The ADSR, LFO or FX of the focused lane: the four knobs set its params, in
// knob order, switching it on. With a track picked, Shift + Delete puts it
// back as it starts, off.
export const moduleMode =
  (id: ModuleId): Mode =>
  (device) => {
    const { lanes, feedback } = device;
    const { modules, modulesOwner, setModuleStep, setModules } = lanes;
    const module = DEVICE_MODULES[id];
    const track = isTake(lanes.focusedLane) ? null : lanes.focusedLane;
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
      pads: {
        delete: deletePad(
          device,
          undefined,
          track
            ? {
                label: `Reset ${track.name}'s ${module.label}`,
                key: `reset:${track.id}:${id}`,
                prompt: `Press again to reset ${track.name}'s ${module.label}`,
                run: () => {
                  setModules({
                    on: { ...modules.on, [id]: false },
                    steps: {
                      ...modules.steps,
                      [id]: INITIAL_MODULES.steps[id],
                    },
                  });
                  feedback.showNotice(`Reset ${track.name}'s ${module.label}`);
                },
              }
            : undefined,
        ),
      },
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
