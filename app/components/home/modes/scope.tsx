import { deviceEngine, KNOB_STEPS } from "../deviceEngine";
import { ScreenLevel } from "../DeviceScreen";
import { paramKnob, selection, soundName } from "./base";
import type { Mode } from "../../../types/bindings";

// The main screen: the live scope. The green knob picks a param and the
// blue one sets it; the red knob is the synth's level.
export const scopeMode: Mode = (device) => {
  const { sound, output } = device;
  return {
    knobs: {
      green: paramKnob(device),
      red: {
        label: "Level",
        valueLabel: `${output.levelStep * 10}%`,
        step: output.levelStep,
        steps: KNOB_STEPS,
        onChange: output.setLevel,
      },
    },
    screen: {
      statusLeft: sound.octaveLabel,
      status: <ScreenLevel>Level {output.levelStep * 10}%</ScreenLevel>,
      footer: [soundName(device), selection(device)],
      getAnalyser: deviceEngine.getAnalyser,
    },
  };
};
