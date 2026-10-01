import type { Meta, StoryObj } from "@storybook/react-vite";
import { Piano } from "lucide-react";
import { fn } from "storybook/test";
import { Pad } from "./Pad";

const meta = {
  title: "Design System V2/Pad",
  component: Pad,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    label: "Piano",
    accent: "#cd5951",
    lit: false,
    onPress: fn(),
    children: <Piano />,
  },
  argTypes: {
    accent: { control: "color" },
    children: { control: false },
  },
} satisfies Meta<typeof Pad>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Lit: Story = {
  args: { lit: true },
};

export const TextLabel: Story = {
  args: { label: "Major 7 chord", accent: "#2f7de1", children: "Maj7" },
};

export const Hotkey: Story = {
  args: { hotkey: "7" },
};
