import type { Meta, StoryObj } from "@storybook/react-vite";
import { StepLengthControl } from "./StepLengthControl";

const meta: Meta<typeof StepLengthControl> = {
  title: "Instrument/StepLengthControl",
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
    timeSignature: {
      control: { type: "select" },
      options: ["4/4", "3/4", "triplet"],
      description: "Musical meter / time signature",
    },
    onTotalStepsChange: { action: "totalStepsChanged" },
    onTimeSignatureChange: { action: "timeSignatureChanged" },
  },
};

export default meta;
type Story = StoryObj<typeof StepLengthControl>;

export const Default: Story = {
  args: {
    totalSteps: 16,
    timeSignature: "4/4",
  },
};

export const ThreeFourWaltz: Story = {
  args: {
    totalSteps: 12,
    timeSignature: "3/4",
  },
};

export const Triplets: Story = {
  args: {
    totalSteps: 12,
    timeSignature: "triplet",
  },
};

export const CompoundMeter24Steps: Story = {
  args: {
    totalSteps: 24,
    timeSignature: "triplet",
  },
};

export const ShortPattern8Steps: Story = {
  args: {
    totalSteps: 8,
    timeSignature: "4/4",
  },
};
