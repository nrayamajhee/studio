import type { Meta, StoryObj } from "@storybook/react-vite";
import { withDevice } from "../storybook/withDevice";
import { PadButtons } from "./PadButtons";

const meta = {
  title: "Home/Parts/Pad Buttons",
  component: PadButtons,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Every pad, three rows of twelve: transport and the arrows at the left, the views along the top, then the library, piano roll, chord palette and drum grid beside six presets (instruments over kits) and six chords. Shift picks a preset pad's alternate and swaps it to the front.",
      },
    },
  },
  decorators: [withDevice],
} satisfies Meta<typeof PadButtons>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Library: Story = {
  parameters: {
    device: { view: "presets" },
    docs: {
      description: {
        story:
          "In the library, pressing a preset pad twice binds the highlighted preset to it.",
      },
    },
  },
};

export const Tempo: Story = {
  parameters: {
    device: { view: "tempo" },
    docs: {
      description: {
        story:
          "In the tempo view, ← and → set the tempo and ↓ switches tap tempo.",
      },
    },
  },
};
