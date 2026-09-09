import type { Meta, StoryObj } from "@storybook/react-vite";
import { SynthControls } from "./SynthControls";

const meta: Meta<typeof SynthControls> = {
  title: "Instrument/SynthControls",
  component: SynthControls,
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="h-[275px] w-full max-w-[1200px]">
        <Story />
      </div>
    ),
  ],
  tags: ["autodocs"],
  argTypes: {
    selectedPreset: {
      control: "select",
      options: [
        "electric_guitar",
        "acoustic_guitar",
        "classical_guitar",
        "ukelele",
        "base_guitar",
        "electronic_pino",
        "grand_piano",
        "drum_set",
        "drum_808",
        "flute",
        "saxophone",
      ],
      description: "Active preset identifier",
    },
    orientation: {
      control: "radio",
      options: ["horizontal", "vertical"],
      description: "Layout orientation of synthesis steps",
    },
  },
};

export default meta;
type Story = StoryObj<typeof SynthControls>;

export const Default: Story = {
  args: {
    selectedPreset: "grand_piano",
  },
};

export const Vertical: Story = {
  decorators: [
    (Story) => (
      <div className="h-[500px] w-72">
        <Story />
      </div>
    ),
  ],
  args: {
    selectedPreset: "grand_piano",
    orientation: "vertical",
  },
};

export const ElectricGuitarPreset: Story = {
  args: {
    selectedPreset: "electric_guitar",
  },
};

export const BassPreset: Story = {
  args: {
    selectedPreset: "base_guitar",
  },
};

