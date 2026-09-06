import type { Meta, StoryObj } from "@storybook/react-vite";
import { OctaveJumpControl } from "./OctaveJumpControl";

const meta: Meta<typeof OctaveJumpControl> = {
  title: "Components/PianoRoll/OctaveJumpControl",
  component: OctaveJumpControl,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    octave: {
      control: { type: "number", min: 0, max: 8 },
      description: "Current active octave",
    },
    onOctaveChange: { action: "octaveChanged" },
  },
};

export default meta;
type Story = StoryObj<typeof OctaveJumpControl>;

export const Default: Story = {
  args: {
    octave: 4,
    presetKey: "grand_piano",
  },
};

export const BassPreset: Story = {
  args: {
    octave: 2,
    presetKey: "synth_bass",
  },
};

export const CustomOctaves: Story = {
  args: {
    octave: 5,
    presetOctaves: [3, 4, 5, 6],
  },
};
