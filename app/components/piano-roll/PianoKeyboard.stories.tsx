import type { Meta, StoryObj } from "@storybook/react-vite";
import { PianoKeyboard } from "./PianoKeyboard";

const meta: Meta<typeof PianoKeyboard> = {
  title: "Instrument/PianoKeyboard",
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
    octaves: 1,
    startOctave: 4,
    showMiniMap: true,
    showHotkeys: true,
    showLabels: "c-only",
    includeEndC: true,
    playAudio: true,
  },
};

export const MultiOctave: Story = {
  args: {
    octaves: 2,
    startOctave: 4,
    showMiniMap: true,
    showHotkeys: true,
  },
};

export const Recording: Story = {
  args: {
    octaves: 1,
    startOctave: 4,
    isRecording: true,
    activeNotes: ["C4", "E4", "G4"],
    showMiniMap: true,
    showHotkeys: true,
  },
};

export const Vertical: Story = {
  args: {
    octaves: 1,
    startOctave: 4,
    orientation: "vertical",
  },
};
