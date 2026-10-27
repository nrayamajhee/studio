import { useFeedback } from "../../../providers/FeedbackProvider";
import { useBindings } from "../../../providers/ModeProvider";
import type { KnobSlot } from "../../../types/bindings";
import { Knob } from "../../design-system";
import { useMidiListener } from "../input/midi";

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

// One of the Device's knobs, doing what the current mode binds it to. A
// MIDI knob mapped to it sets it across its whole range.
export function DeviceKnob({ slot }: DeviceKnobProps) {
  const { label, valueLabel, step, steps, onChange, fine } =
    useBindings().knobs[slot];
  const { isBusy } = useFeedback();

  useMidiListener((event) => {
    if (event.kind !== "knob" || event.slot !== slot || isBusy()) return;
    const next = event.value * (steps - 1);
    const to = fine ? next : Math.round(next);
    if (to !== step) onChange(to);
  });

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
