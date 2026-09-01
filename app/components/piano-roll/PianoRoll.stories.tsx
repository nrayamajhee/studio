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
  args: {},
};

export const CustomContainer: Story = {
  args: {
    className: "h-[600px] border-primary/40",
  },
};
