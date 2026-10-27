import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { MidiButton } from "./MidiPanel";
import { ThemeToggle } from "./ThemeToggle";

const meta = {
  title: "Page/Theme Toggle",
  component: ThemeToggle,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The frosted light/dark switch pinned to a page's top-right corner; it remembers the choice in `localStorage`. Other frosted buttons, like the home page's MIDI button, sit to its left.",
      },
      story: { inline: false, iframeHeight: 120 },
    },
  },
} satisfies Meta<typeof ThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// The home page puts the MIDI panel's button to its left.
export const WithMidiButton: Story = {
  args: {
    children: <MidiButton open={false} onOpenChange={fn()} />,
  },
};
