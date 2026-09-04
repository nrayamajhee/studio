import type { Meta, StoryObj } from "@storybook/react-vite";
import { Dropdown } from "./Dropdown";

const sampleOptions = [
  { value: "triangle", label: "Triangle (Grand)" },
  { value: "sawtooth", label: "Sawtooth (Bright)" },
  { value: "square", label: "Square (Hollow)" },
  { value: "sine", label: "Sine (Sub)" },
];

const meta: Meta<typeof Dropdown> = {
  title: "Design System/Dropdown",
  component: Dropdown,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    label: {
      control: "text",
      description: "Label for the dropdown",
    },
    options: {
      control: "object",
      description: "Options array with value and label",
    },
    tone: {
      control: "radio",
      options: ["accent", "primary", "secondary"],
      description: "Visual tone and theme colors",
    },
    size: {
      control: "radio",
      options: ["sm", "md", "lg"],
      description: "Input size",
    },
    disabled: {
      control: "boolean",
      description: "Disabled state",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Dropdown>;

export const Default: Story = {
  args: {
    label: "Osc 1 Waveform",
    options: sampleOptions,
    defaultValue: "triangle",
    tone: "accent",
    size: "sm",
  },
  decorators: [
    (Story) => (
      <div className="w-64 p-4 bg-[#0a0c10] rounded-xl border border-stone-800">
        <Story />
      </div>
    ),
  ],
};

export const PrimaryTone: Story = {
  args: {
    label: "Filter Type",
    options: [
      { value: "lowpass", label: "Lowpass (24dB)" },
      { value: "bandpass", label: "Bandpass (12dB)" },
      { value: "highpass", label: "Highpass (12dB)" },
    ],
    defaultValue: "lowpass",
    tone: "primary",
    size: "md",
  },
  decorators: [
    (Story) => (
      <div className="w-64 p-4 bg-surface-light dark:bg-[#0a0c10] rounded-xl border border-stone-300 dark:border-stone-800">
        <Story />
      </div>
    ),
  ],
};

export const Disabled: Story = {
  args: {
    label: "Osc 2 Waveform",
    options: sampleOptions,
    defaultValue: "sine",
    disabled: true,
  },
  decorators: [
    (Story) => (
      <div className="w-64 p-4 bg-[#0a0c10] rounded-xl border border-stone-800">
        <Story />
      </div>
    ),
  ],
};
