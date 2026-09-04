import type { Meta, StoryObj } from "@storybook/react-vite";
import { PresetSelector } from "./PresetSelector";

const meta: Meta<typeof PresetSelector> = {
  title: "Components/PresetSelector",
  component: PresetSelector,
  parameters: {
    layout: "centered",
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
type Story = StoryObj<typeof PresetSelector>;

export const Default: Story = {
  args: {
    selectedPreset: "grand_piano",
  },
  decorators: [
    (Story) => (
      <div className="w-56 h-[400px]">
        <Story />
      </div>
    ),
  ],
};

export const ElectricGuitarSelected: Story = {
  args: {
    selectedPreset: "electric_guitar",
  },
  decorators: [
    (Story) => (
      <div className="w-56 h-[400px]">
        <Story />
      </div>
    ),
  ],
};

export const FluteSelected: Story = {
  args: {
    selectedPreset: "flute",
  },
  decorators: [
    (Story) => (
      <div className="w-56 h-[400px]">
        <Story />
      </div>
    ),
  ],
};
