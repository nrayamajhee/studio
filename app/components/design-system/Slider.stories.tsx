import type { Meta, StoryObj } from "@storybook/react-vite";
import { Slider } from "./Slider";

const meta: Meta<typeof Slider> = {
  title: "Design System/Slider",
  component: Slider,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    label: {
      control: "text",
      description: "Descriptive label for the slider",
    },
    valueDisplay: {
      control: "text",
      description: "Current value formatted string or number",
    },
    min: {
      control: "number",
      description: "Minimum value",
    },
    max: {
      control: "number",
      description: "Maximum value",
    },
    step: {
      control: "number",
      description: "Step increment",
    },
    tone: {
      control: "radio",
      options: ["accent", "primary", "secondary"],
      description: "Color tone for the track fill and focus ring",
    },
    size: {
      control: "radio",
      options: ["sm", "md", "lg"],
      description: "Thickness of the slider track",
    },
    disabled: {
      control: "boolean",
      description: "Disabled state",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Slider>;

export const Default: Story = {
  args: {
    label: "Cutoff Frequency",
    valueDisplay: "900 Hz",
    min: 80,
    max: 12000,
    step: 20,
    defaultValue: 900,
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
    label: "Exciter Amount",
    valueDisplay: "75%",
    min: 0,
    max: 100,
    defaultValue: 75,
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
    label: "Tube Drive",
    valueDisplay: "0%",
    defaultValue: 0,
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
