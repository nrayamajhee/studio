import { ArrowBigUp } from "lucide-react";
import { useBindings } from "../../../providers/ModeProvider";
import { useShift } from "../../../providers/ShiftProvider";
import { Bank } from "../layout/DeviceLayout";
import { DevicePad } from "../parts/DevicePad";

const RED = "var(--color-synth-red)";

// Four columns over three rows: Play, Record, Stop and Save (⌘S); Mute,
// Clip, ↑ and Delete (⌘⌫ too; with Shift, Revert); Shift and the arrows.
// Play, Record and Stop act on whatever the view plays: the tape, the drum
// sequencer or the mix.
export function ControlBank() {
  const { pads } = useBindings();
  const { shift, latched, toggleLatch } = useShift();
  return (
    <Bank label="Controls" layout="block">
      <DevicePad binding={pads.play} control={{ kind: "tool", tool: "play" }} />
      <DevicePad
        binding={pads.record}
        control={{ kind: "tool", tool: "record" }}
        accent={RED}
      />
      <DevicePad
        binding={pads.stop}
        control={{ kind: "tool", tool: "stop" }}
        accent={RED}
      />
      <DevicePad
        binding={pads.save}
        command={{ code: "KeyS", legend: "S" }}
        accent={RED}
      />
      <DevicePad
        binding={pads.mute}
        control={{ kind: "tool", tool: "mute" }}
        accent={RED}
      />
      <DevicePad
        binding={pads.clip}
        control={{ kind: "tool", tool: "clip" }}
        accent={RED}
      />
      <DevicePad
        binding={pads.up}
        control={{ kind: "pick", direction: -1 }}
        accent={RED}
      />
      <DevicePad
        binding={pads.delete}
        control={{ kind: "tool", tool: "delete" }}
        command={{ code: "Backspace", legend: "⌫" }}
        accent={RED}
      />
      {/* No colour: a modifier, not a state. Latched, it stays pressed in,
          as it looks while its key is held. */}
      <DevicePad
        binding={{
          label: latched ? "Shift (latched)" : "Shift",
          icon: <ArrowBigUp />,
          onPress: toggleLatch,
        }}
        control={{ kind: "shift" }}
        pressOnKey={false}
        held={shift}
      />
      <DevicePad
        binding={pads.left}
        control={{ kind: "step", direction: -1 }}
        accent={RED}
      />
      <DevicePad
        binding={pads.down}
        control={{ kind: "pick", direction: 1 }}
        accent={RED}
      />
      <DevicePad
        binding={pads.right}
        control={{ kind: "step", direction: 1 }}
        accent={RED}
      />
    </Bank>
  );
}
