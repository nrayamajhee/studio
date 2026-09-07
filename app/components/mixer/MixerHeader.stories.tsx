import type { Meta, StoryObj } from "@storybook/react";
import { MemoryRouter } from "react-router";
import { MixerHeader } from "./MixerHeader";

const meta = {
  title: "Mixer/MixerHeader",
  component: MixerHeader,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  args: {
    onPlayToggle: () => {},
    onStop: () => {},
    onLoopToggle: () => {},
    onBpmChange: () => {},
  },
  argTypes: {
    isPlaying: { control: "boolean" },
    isLooping: { control: "boolean" },
    bpm: { control: { type: "range", min: 40, max: 240, step: 1 } },
    currentStep: { control: { type: "number", min: 0, max: 64 } },
    totalStepsPerBar: { control: "number" },
    onPlayToggle: { action: "playToggled" },
    onStop: { action: "stopped" },
    onLoopToggle: { action: "loopToggled" },
    onBpmChange: { action: "bpmChanged" },
  },
} satisfies Meta<typeof MixerHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    isPlaying: false,
    isLooping: true,
    bpm: 72,
    currentStep: 0,
    totalStepsPerBar: 16,
  },
};

export const Playing: Story = {
  args: {
    isPlaying: true,
    isLooping: true,
    bpm: 120,
    currentStep: 8,
    totalStepsPerBar: 16,
  },
};

export const SteppedPosition: Story = {
  args: {
    isPlaying: false,
    isLooping: false,
    bpm: 90,
    currentStep: 24,
    totalStepsPerBar: 16,
  },
};
