import type { Meta, StoryObj } from "@storybook/react-vite";
import { PianoKeyboard } from "./PianoKeyboard";

const meta: Meta<typeof PianoKeyboard> = {
  title: "Components/PianoKeyboard",
  component: PianoKeyboard,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    mode: {
      control: "radio",
      options: ["keyboard", "player"],
      description:
        "Display mode: standalone keyboard or interactive DAW player",
    },
    octaves: {
      control: { type: "number", min: 1, max: 7, step: 1 },
      description: "Number of octaves to render in keyboard mode",
    },
    startOctave: {
      control: { type: "number", min: 0, max: 8, step: 1 },
      description: "Starting octave index",
    },
    orientation: {
      control: "radio",
      options: ["horizontal", "vertical"],
      description: "Keyboard layout direction in keyboard mode",
    },
    showLabels: {
      control: "radio",
      options: ["c-only", "all", "none"],
      description: "Note label visibility on keys",
    },
    includeEndC: {
      control: "boolean",
      description: "Include terminating high C key at the end of the keyboard",
    },
    playAudio: {
      control: "boolean",
      description: "Play synthetic audio preview on key interaction",
    },
    isRecording: {
      control: "boolean",
      description: "Recording mode state in player mode",
    },
    disabled: {
      control: "boolean",
      description: "Disable all key interactions",
    },
  },
};

export default meta;
type Story = StoryObj<typeof PianoKeyboard>;

export const Default: Story = {
  args: {
    mode: "keyboard",
    octaves: 2,
    startOctave: 4,
    showLabels: "c-only",
    orientation: "horizontal",
    includeEndC: true,
    playAudio: true,
  },
};

export const Player: Story = {
  args: {
    mode: "player",
  },
};

export const PlayerRecording: Story = {
  args: {
    mode: "player",
    isRecording: true,
    activeNotes: ["C4", "E4", "G4"],
  },
};

export const Vertical: Story = {
  args: {
    mode: "keyboard",
    octaves: 1,
    startOctave: 4,
    orientation: "vertical",
  },
};

export const WithActiveChords: Story = {
  args: {
    mode: "keyboard",
    octaves: 2,
    startOctave: 4,
    activeNotes: ["C4", "E4", "G4", "B4"],
  },
};
