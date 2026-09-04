import type { Meta, StoryObj } from "@storybook/react-vite";
import { PianoPlayer } from "./PianoPlayer";

const meta: Meta<typeof PianoPlayer> = {
  title: "Components/PianoPlayer",
  component: PianoPlayer,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  argTypes: {
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
type Story = StoryObj<typeof PianoPlayer>;

export const Default: Story = {
  args: {
    isRecording: false,
    activeNotes: [],
  },
};

export const RecordingActive: Story = {
  args: {
    isRecording: true,
    activeNotes: ["C4", "E4", "G4"],
  },
};
