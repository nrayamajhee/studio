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
        "grand_piano",
        "acoustic_guitar",
        "base_guitar",
        "drum_set",
        "flute",
        "saxophone",
      ],
      description: "Active instrument preset identifier",
    },
  },
};

export default meta;
type Story = StoryObj<typeof PresetSelector>;

export const Default: Story = {
  args: {
    selectedPreset: "grand_piano",
    onCollapse: () => {},
  },
  decorators: [
    (Story) => (
      <div className="w-18 h-[280px]">
        <Story />
      </div>
    ),
  ],
};

export const GuitarSelected: Story = {
  args: {
    selectedPreset: "acoustic_guitar",
  },
  decorators: [
    (Story) => (
      <div className="w-18 h-[280px]">
        <Story />
      </div>
    ),
  ],
};

export const DrumsSelected: Story = {
  args: {
    selectedPreset: "drum_set",
  },
  decorators: [
    (Story) => (
      <div className="w-18 h-[280px]">
        <Story />
      </div>
    ),
  ],
};
