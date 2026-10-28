import type { KnobSlot } from "../../../types/bindings";
import type { MidiMapping, PadControl } from "./midi";

// A controller the Device maps on its own, by the name its input goes by.
export type MidiPreset = {
  name: string;
  port: string;
  mappings: readonly MidiMapping[];
};

const cc = (number: number, target: MidiMapping["target"]): MidiMapping => ({
  source: { type: "cc", channel: 1, number },
  target,
});
const knob = (number: number, slot: KnobSlot) =>
  cc(number, { kind: "knob", slot });
const pad = (number: number, control: PadControl) =>
  cc(number, { kind: "pad", control });
const tool = (
  number: number,
  name: Extract<PadControl, { kind: "tool" }>["tool"],
) => pad(number, { kind: "tool", tool: name });

export const MIDI_PRESETS: readonly MidiPreset[] = [
  {
    name: "OP-1",
    port: "OP-1 Midi Device",
    // The four encoders turn the knobs of their colour, orange the red one,
    // and the buttons press every pad but Chord 1 and Instrument 6.
    mappings: [
      knob(1, "blue"),
      knob(2, "green"),
      knob(3, "chalk"),
      knob(4, "red"),
      tool(5, "instruments"),
      tool(6, "metronome"),
      tool(7, "roll"),
      tool(8, "drumGrid"),
      tool(9, "tapes"),
      tool(10, "tracks"),
      tool(11, "synth"),
      tool(12, "adsr"),
      tool(13, "lfo"),
      tool(14, "fx"),
      pad(15, { kind: "pick", direction: -1 }),
      pad(16, { kind: "pick", direction: 1 }),
      tool(17, "clip"),
      pad(21, { kind: "chord", index: 1 }),
      pad(22, { kind: "chord", index: 2 }),
      pad(23, { kind: "chord", index: 3 }),
      pad(24, { kind: "chord", index: 4 }),
      pad(25, { kind: "chord", index: 5 }),
      tool(26, "playStyle"),
      tool(38, "record"),
      tool(39, "play"),
      tool(40, "stop"),
      pad(41, { kind: "step", direction: -1 }),
      pad(42, { kind: "step", direction: 1 }),
      pad(43, { kind: "shift" }),
      tool(48, "save"),
      tool(49, "delete"),
      pad(50, { kind: "instrument", index: 0 }),
      pad(51, { kind: "instrument", index: 1 }),
      pad(52, { kind: "instrument", index: 2 }),
      // The sustain pedal's CC: mapped, it presses the pad instead.
      pad(64, { kind: "instrument", index: 3 }),
      pad(65, { kind: "instrument", index: 4 }),
      tool(66, "mute"),
      tool(67, "chords"),
    ],
  },
];
