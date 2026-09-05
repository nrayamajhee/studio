import type { Meta, StoryObj } from "@storybook/react-vite";
import { PianoRoll } from "./PianoRoll";

const meta: Meta<typeof PianoRoll> = {
  title: "Components/PianoRoll",
  component: PianoRoll,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  argTypes: {
    className: {
      control: "text",
      description: "Additional CSS classes",
    },
  },
};

export default meta;
type Story = StoryObj<typeof PianoRoll>;

export const Default: Story = {
  args: {
    totalSteps: 16,
  },
};

export const StepCount8: Story = {
  args: {
    totalSteps: 8,
  },
};

export const StepCount32: Story = {
  args: {
    totalSteps: 32,
  },
};
