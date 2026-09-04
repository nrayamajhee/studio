import type { Meta, StoryObj } from "@storybook/react-vite";
import { SynthControls } from "./SynthControls";

const meta: Meta<typeof SynthControls> = {
  title: "Components/SynthControls",
  component: SynthControls,
  parameters: {
    layout: "padded",
  },
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
  },
};

export default meta;
type Story = StoryObj<typeof SynthControls>;

export const Default: Story = {
  args: {
    selectedPreset: "grand_piano",
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
