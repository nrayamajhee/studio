import type { Meta, StoryObj } from "@storybook/react-vite";
import { PresetSelector } from "./PresetSelector";
import { Card } from "../design-system/Card";

const meta: Meta<typeof PresetSelector> = {
  title: "Instrument/PresetSelector",
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

export const GridMode: Story = {
  args: {
    selectedPreset: "grand_piano",
    variant: "grid",
  },
  decorators: [
    (Story) => (
      <Card elevation="low" className="w-64 p-3 bg-stone-50 dark:bg-surface-dark border border-stone-200 dark:border-stone-800 rounded-lg">
        <Story />
      </Card>
    ),
  ],
};
