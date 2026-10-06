import { useBindings } from "../../../providers/ModeProvider";
import { Bank } from "../layout/DeviceLayout";
import { DevicePad } from "../parts/DevicePad";

const RED = "var(--color-synth-red)";
const VIEWS = [
  "album",
  "tracks",
  "take",
  "steps",
  "adsr",
  "lfo",
  "fx",
] as const;

// The views: the album, the tracks, the tape and the drum sequencer, the
// ADSR, LFO and FX (Shift switches each on or off) and the tempo (Shift
// starts the click).
export function ViewBank() {
  const { pads } = useBindings();
  return (
    <Bank label="Views">
      {VIEWS.map((tool) => (
        <DevicePad
          key={tool}
          binding={pads[tool]}
          control={{ kind: "tool", tool }}
          accent={RED}
        />
      ))}
      <DevicePad
        binding={pads.metronome}
        control={{ kind: "tool", tool: "metronome" }}
        accent="var(--color-synth-green)"
      />
    </Bank>
  );
}
