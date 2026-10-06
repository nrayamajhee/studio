import { useBindings } from "../../../providers/ModeProvider";
import { Bank } from "../layout/DeviceLayout";
import { DevicePad } from "../parts/DevicePad";
import { PRESET_PADS } from "../presetStore";

const RED = "var(--color-synth-red)";

// The preset library and the synth parameters, then six preset pads, each
// with a preset and (with Shift) an alternate. A pad with nothing bound to
// it stays blank.
export function PresetBank() {
  const { pads, presetPad } = useBindings();
  return (
    <Bank label="Presets">
      <DevicePad
        binding={pads.synth}
        control={{ kind: "tool", tool: "synth" }}
        accent={RED}
      />
      <DevicePad
        binding={pads.params}
        control={{ kind: "tool", tool: "params" }}
        accent={RED}
      />
      {Array.from({ length: PRESET_PADS }, (_, pad) => (
        <DevicePad
          key={pad}
          binding={presetPad(pad)}
          control={{ kind: "preset", index: pad }}
          accent={RED}
        />
      ))}
    </Bank>
  );
}
