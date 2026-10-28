import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Key } from "./Key";

const meta = {
  title: "Design System/Key",
  component: Key,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A piano key, white or black, held while pressed by pointer or keyboard. It shows its note (or a drum piece) and its hotkey, and lights while it sounds.",
      },
    },
  },
  args: {
    label: "C 4",
    variant: "white",
    note: "C4",
    hotkey: "F",
    lit: false,
    onPress: fn(),
    onRelease: fn(),
  },
  argTypes: {
    variant: { control: "inline-radio", options: ["white", "black"] },
  },
} satisfies Meta<typeof Key>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Black: Story = {
  args: { label: "C sharp 4", variant: "black", note: "C♯", hotkey: "T" },
};

export const Lit: Story = {
  args: { lit: true },
};
