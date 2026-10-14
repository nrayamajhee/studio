import { ArrowBigUp } from "lucide-react";
import { useDeviceHotkey } from "../../../hooks/useDeviceHotkey";
import { useBindings } from "../../../providers/ModeProvider";
import { usePerformance } from "../../../providers/PerformanceProvider";
import { useShift } from "../../../providers/ShiftProvider";
import { useView } from "../../../providers/ViewProvider";
import type { Tool } from "../input/keymap";
import { DevicePad } from "./DevicePad";

const RED = "var(--color-synth-red)";

// Every pad, three rows of twelve in reading order:
//   Play  Stop  Record Save   Albums Params ADSR LFO FX Chords Style Tempo
//   Clip  Mute  ↑      Delete Tracks Roll   preset 1–3      chord 1–3
//   Shift ←     ↓      →      Instr. Grid   preset 4–6      chord 4–6
// Play, Stop and Record act on whatever the mode plays: the piano roll, the
// drum grid or the mix. The presets are three instruments over three kits.
export function PadButtons() {
  const { pads, presetPad, chordPad } = useBindings();
  const { shift, latched, toggleLatch } = useShift();
  const { macroChords, chord, dropChord } = usePerformance();
  const { leaveRevert } = useView();

  // Holding any chord key drops a latched chord, so it doesn't come back
  // when the key is let go; the key for the latched chord just stops it
  // rather than playing it.
  useDeviceHotkey(({ control, down, ignore }) => {
    if (control.kind !== "chord" || !down) return;
    leaveRevert();
    if (chord !== null) dropChord();
    if (chord === control.index) ignore();
  });

  const tool = (name: Tool, accent?: string) => (
    <DevicePad
      binding={pads[name]}
      control={{ kind: "tool", tool: name }}
      accent={accent}
    />
  );
  const preset = (index: number) => (
    <DevicePad
      binding={presetPad(index)}
      control={{ kind: "preset", index }}
      accent={RED}
    />
  );
  const chordPads = (from: number) =>
    macroChords.slice(from, from + 3).map(({ id }, offset) => {
      const index = from + offset;
      return (
        <DevicePad
          key={`${index}-${id}`}
          binding={chordPad(index)}
          control={{ kind: "chord", index }}
          accent="var(--color-synth-blue)"
          pressOnKey={false}
        />
      );
    });

  return (
    <div
      className="grid grid-cols-[repeat(12,68px)] gap-inset"
      role="group"
      aria-label="Pads"
      data-focus-group="pads"
      data-focus-order="rows"
    >
      {tool("play")}
      {tool("stop", RED)}
      {tool("record", RED)}
      <DevicePad
        binding={pads.save}
        command={{ code: "KeyS", legend: "S" }}
        accent={RED}
      />
      {tool("album", RED)}
      {tool("params", RED)}
      {tool("adsr", RED)}
      {tool("lfo", RED)}
      {tool("fx", RED)}
      {tool("chords", RED)}
      {tool("style", RED)}
      {tool("metronome", "var(--color-synth-green)")}

      {tool("clip", RED)}
      {tool("mute", RED)}
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
      {tool("tracks", RED)}
      {tool("take", RED)}
      {preset(0)}
      {preset(1)}
      {preset(2)}
      {chordPads(0)}

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
      {tool("synth", RED)}
      {tool("steps", RED)}
      {preset(3)}
      {preset(4)}
      {preset(5)}
      {chordPads(3)}
    </div>
  );
}
