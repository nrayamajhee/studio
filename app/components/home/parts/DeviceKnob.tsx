import { useBindings } from "../../../providers/ModeProvider";
import type { KnobSlot } from "../../../types/bindings";
import { Knob } from "../../design-system";

const COLORS: Readonly<Record<KnobSlot, string>> = {
  chalk: "var(--color-synth-chalk)",
  green: "var(--color-synth-green)",
  red: "var(--color-synth-red)",
  blue: "var(--color-synth-blue)",
};

export type DeviceKnobProps = {
  // Which of the four knobs: white and green on the left, red and blue on
  // the right. The screen shows what each sets in its colour.
  slot: KnobSlot;
};

// One of the Device's knobs, doing what the current mode binds it to.
export function DeviceKnob({ slot }: DeviceKnobProps) {
  const { label, valueLabel, step, steps, onChange, fine } =
    useBindings().knobs[slot];
  return (
    <Knob
      label={label}
      valueLabel={valueLabel}
      step={step}
      steps={steps}
      color={COLORS[slot]}
      markColor={slot === "chalk" ? "#141413" : undefined}
      fine={fine}
      onChange={onChange}
    />
  );
}
