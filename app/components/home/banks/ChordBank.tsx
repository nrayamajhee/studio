import { useDeviceHotkey } from "../../../hooks/useDeviceHotkey";
import { useBindings } from "../../../providers/ModeProvider";
import { usePerformance } from "../../../providers/PerformanceProvider";
import { useView } from "../../../providers/ViewProvider";
import { Bank } from "../layout/DeviceLayout";
import { DevicePad } from "../parts/DevicePad";

const RED = "var(--color-synth-red)";

// The chord palette and chord style, then six chord pads: a click latches a
// chord, and its key holds it while down, so the keys play it in the chord
// style.
export function ChordBank() {
  const { pads, chordPad } = useBindings();
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

  return (
    <Bank label="Chords">
      <DevicePad
        binding={pads.chords}
        control={{ kind: "tool", tool: "chords" }}
        accent={RED}
      />
      <DevicePad
        binding={pads.style}
        control={{ kind: "tool", tool: "style" }}
        accent={RED}
      />
      {macroChords.map(({ id }, index) => (
        <DevicePad
          key={`${index}-${id}`}
          binding={chordPad(index)}
          control={{ kind: "chord", index }}
          accent="var(--color-synth-blue)"
          pressOnKey={false}
        />
      ))}
    </Bank>
  );
}
