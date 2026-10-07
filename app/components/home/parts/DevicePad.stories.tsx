import type { Meta, StoryObj } from "@storybook/react-vite";
import { Circle, Play, Save } from "lucide-react";
import { fn } from "storybook/test";
import { withDevice } from "../storybook/withDevice";
import { DevicePad } from "./DevicePad";

const meta = {
  title: "Home/Parts/Device Pad",
  component: DevicePad,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A pad wired to the keyboard. Its binding sets the label, icon, state and action, and its hotkey or ⌘ shortcut presses it like a click.",
      },
    },
  },
  decorators: [withDevice],
  args: {
    binding: {
      label: "Play",
      icon: <Play fill="currentColor" />,
      onPress: fn(),
    },
    control: { kind: "tool", tool: "play" },
  },
  argTypes: {
    accent: { control: "color" },
    binding: { control: false },
    control: { control: false },
    command: { control: false },
  },
} satisfies Meta<typeof DevicePad>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Lit: Story = {
  args: {
    binding: {
      label: "Arm recording",
      icon: <Circle fill="currentColor" />,
      lit: true,
      onPress: fn(),
    },
    accent: "var(--color-synth-red)",
  },
};

export const CommandKey: Story = {
  args: {
    binding: { label: "Save instrument", icon: <Save />, onPress: fn() },
    control: undefined,
    command: { code: "KeyS", legend: "S" },
  },
  parameters: {
    docs: {
      description: { story: "No key of its own: ⌘S (Ctrl S) presses it." },
    },
  },
};
