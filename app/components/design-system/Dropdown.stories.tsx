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
    label: "Waveform Option",
    options: sampleOptions,
    defaultValue: "triangle",
    tone: "primary",
    size: "sm",
  },
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
};

export const AccentTone: Story = {
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

export const Disabled: Story = {
  args: {
    label: "Disabled Dropdown",
    options: sampleOptions,
    defaultValue: "sine",
    disabled: true,
  },
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
};
