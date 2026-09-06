import type { Meta, StoryObj } from "@storybook/react-vite";
import { StepLengthControl } from "./StepLengthControl";

const meta: Meta<typeof StepLengthControl> = {
  title: "Components/PianoRoll/StepLengthControl",
  component: StepLengthControl,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    totalSteps: {
      control: { type: "number", min: 4, max: 64 },
      description: "Total step count in pattern",
    },
    onTotalStepsChange: { action: "totalStepsChanged" },
  },
};

export default meta;
type Story = StoryObj<typeof StepLengthControl>;

export const Default: Story = {
  args: {
    totalSteps: 16,
  },
};

export const CompoundMeter24Steps: Story = {
  args: {
    totalSteps: 24,
  },
};

export const ShortPattern8Steps: Story = {
  args: {
    totalSteps: 8,
  },
};
