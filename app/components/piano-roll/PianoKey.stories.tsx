import type { Meta, StoryObj } from "@storybook/react-vite";
import { PianoKey } from "./PianoKey";

const meta: Meta<typeof PianoKey> = {
  title: "Components/PianoKey",
  component: PianoKey,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "radio",
      options: ["white", "black"],
      description: "Key style (natural white key or accidental black key)",
    },
    note: {
      control: "text",
      description: "Note pitch name (e.g. C4, C#4)",
    },
    hotkey: {
      control: "text",
      description: "Keyboard shortcut letter",
    },
    isActive: {
      control: "boolean",
      description: "Whether the key is currently active or triggered",
    },
    isC: {
      control: "boolean",
      description: "Whether the key is a root C key",
    },
    showHotkey: {
      control: "boolean",
      description: "Show hotkey badge on the key",
    },
    showLabel: {
      control: "boolean",
      description: "Show note name label",
    },
    orientation: {
      control: "radio",
      options: ["horizontal", "vertical"],
      description: "Key layout direction",
    },
    disabled: {
      control: "boolean",
      description: "Disable key clicks",
    },
  },
};

export default meta;
type Story = StoryObj<typeof PianoKey>;

export const Default: Story = {
  args: {
    variant: "white",
    note: "C4",
    isC: true,
    showLabel: true,
    showHotkey: true,
    hotkey: "A",
    orientation: "horizontal",
  },
};

export const BlackKey: Story = {
  args: {
    variant: "black",
    note: "C#4",
    showLabel: true,
    showHotkey: true,
    hotkey: "W",
    orientation: "horizontal",
  },
};

export const WhiteKeyActive: Story = {
  args: {
    variant: "white",
    note: "E4",
    isActive: true,
    showLabel: true,
    orientation: "horizontal",
  },
};

export const BlackKeyActive: Story = {
  args: {
    variant: "black",
    note: "F#4",
    isActive: true,
    showLabel: true,
    orientation: "horizontal",
  },
};

export const WithHotkey: Story = {
  args: {
    variant: "white",
    note: "A4",
    hotkey: "H",
    showHotkey: true,
    showLabel: true,
    orientation: "horizontal",
  },
};

export const VerticalWhiteKey: Story = {
  args: {
    variant: "white",
    note: "C4",
    isC: true,
    showLabel: true,
    orientation: "vertical",
  },
};

export const VerticalBlackKey: Story = {
  args: {
    variant: "black",
    note: "C#4",
    showLabel: true,
    orientation: "vertical",
  },
};
