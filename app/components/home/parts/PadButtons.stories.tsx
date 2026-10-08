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
          "Every pad, three rows of twelve: transport and the arrows at the left, the views along the top, then the piano roll and drum grid, the instruments and the synth parameters beside six instrument pads (instruments over kits) and six chords. Shift picks an instrument pad's alternate and swaps it to the front.",
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
          "In the library, pressing an instrument pad twice binds the highlighted instrument to it.",
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
