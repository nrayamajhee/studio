import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card } from "./Card";

const meta = {
  title: "Design System/Card",
  component: Card,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    children: "Card content",
    className: "h-32 w-64",
  },
  argTypes: {
    elevation: { control: "inline-radio", options: ["low", "mid", "high"] },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Low: Story = {
  args: { elevation: "low" },
};

export const High: Story = {
  args: { elevation: "high" },
};
