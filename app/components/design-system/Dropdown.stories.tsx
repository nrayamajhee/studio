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
    variant: {
      control: "select",
      options: ["solid", "outline", "ghost"],
      description: "Button style variant for trigger",
    },
    tone: {
      control: "select",
      options: [
        "secondary",
        "primary",
        "accent",
        "info",
        "blue",
        "warning",
        "error",
        "success",
      ],
      description: "Visual tone and theme colors",
    },
    size: {
      control: "radio",
      options: ["xs", "sm", "md", "lg"],
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
    variant: "solid",
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

export const OutlineVariant: Story = {
  args: {
    label: "Outline Dropdown",
    options: sampleOptions,
    defaultValue: "sawtooth",
    variant: "outline",
    tone: "secondary",
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

export const PrimaryTone: Story = {
  args: {
    label: "Primary Dropdown",
    options: sampleOptions,
    defaultValue: "square",
    variant: "solid",
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
