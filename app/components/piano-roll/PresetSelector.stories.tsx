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
        "electronic_pino",
        "rhodes_piano",
        "lofi_keys",
        "organ",
        "drum_set",
        "drum_808",
        "trap_kit",
        "electronic_drums",
        "acoustic_percussion",
        "vintage_synth",
        "acid_bass",
        "pluck_synth",
        "electric_guitar",
        "acoustic_guitar",
        "classical_guitar",
        "ukelele",
        "base_guitar",
        "strings_ensemble",
        "marimba",
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

export const TrapKitSelected: Story = {
  args: {
    selectedPreset: "trap_kit",
  },
  decorators: [
    (Story) => (
      <div className="w-56 h-[400px]">
        <Story />
      </div>
    ),
  ],
};

export const VintageSynthSelected: Story = {
  args: {
    selectedPreset: "vintage_synth",
  },
  decorators: [
    (Story) => (
      <div className="w-56 h-[400px]">
        <Story />
      </div>
    ),
  ],
};
