import type { Meta, StoryObj } from "@storybook/react-vite";
import { DrumPad } from "./DrumPad";

const meta: Meta<typeof DrumPad> = {
  title: "Components/DrumPad",
  component: DrumPad,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    selectedPreset: {
      control: "select",
      options: [
        "drum_set",
        "drum_808",
        "trap_kit",
        "electronic_drums",
        "acoustic_percussion",
        "grand_piano",
        "vintage_synth",
      ],
      description: "Active instrument or kit profile",
    },
    isRecording: {
      control: "boolean",
      description: "Recording mode state",
    },
    activeNotes: {
      control: "object",
      description: "Array of actively illuminated note names",
    },
  },
};

export default meta;
type Story = StoryObj<typeof DrumPad>;

export const Default: Story = {
  args: {
    selectedPreset: "drum_set",
    isRecording: false,
    activeNotes: [],
  },
  decorators: [
    (Story) => (
      <div className="w-[380px] h-[340px]">
        <Story />
      </div>
    ),
  ],
};

export const Drum808: Story = {
  args: {
    selectedPreset: "drum_808",
    isRecording: false,
    activeNotes: ["C1", "G1"],
  },
  decorators: [
    (Story) => (
      <div className="w-[380px] h-[340px]">
        <Story />
      </div>
    ),
  ],
};

export const MelodicMatrix: Story = {
  args: {
    selectedPreset: "grand_piano",
    isRecording: false,
    activeNotes: ["C3", "G3"],
  },
  decorators: [
    (Story) => (
      <div className="w-[380px] h-[340px]">
        <Story />
      </div>
    ),
  ],
};

export const RecordingActive: Story = {
  args: {
    selectedPreset: "trap_kit",
    isRecording: true,
    activeNotes: ["D1"],
  },
  decorators: [
    (Story) => (
      <div className="w-[380px] h-[340px]">
        <Story />
      </div>
    ),
  ],
};
