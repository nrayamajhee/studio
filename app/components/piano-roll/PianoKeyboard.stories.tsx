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
    octaves: {
      control: { type: "number", min: 1, max: 7, step: 1 },
      description: "Number of octaves to render",
    },
    startOctave: {
      control: { type: "number", min: 0, max: 8, step: 1 },
      description: "Starting octave index",
    },
    showLabels: {
      control: "radio",
      options: ["c-only", "all", "none"],
      description: "Note label visibility on keys",
    },
    orientation: {
      control: "radio",
      options: ["horizontal", "vertical"],
      description: "Keyboard layout direction",
    },
    includeEndC: {
      control: "boolean",
      description: "Include terminating high C key at the end of the keyboard",
    },
    playAudio: {
      control: "boolean",
      description: "Play synthetic audio preview on key interaction",
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
    octaves: 2,
    startOctave: 4,
    showLabels: "c-only",
    orientation: "horizontal",
    includeEndC: true,
    playAudio: true,
  },
};

export const SingleOctave: Story = {
  args: {
    octaves: 1,
    startOctave: 4,
  },
};

export const ThreeOctaves: Story = {
  args: {
    octaves: 3,
    startOctave: 3,
  },
};

export const WithActiveChords: Story = {
  args: {
    octaves: 2,
    startOctave: 4,
    activeNotes: ["C4", "E4", "G4", "B4"],
  },
};

export const AllLabels: Story = {
  args: {
    octaves: 1,
    startOctave: 4,
    showLabels: "all",
  },
};

export const VerticalOrientation: Story = {
  args: {
    octaves: 1,
    startOctave: 4,
    orientation: "vertical",
  },
};
