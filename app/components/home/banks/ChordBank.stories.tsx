import type { Meta, StoryObj } from "@storybook/react-vite";
import { withDevice } from "../storybook/withDevice";
import { ChordBank } from "./ChordBank";

const meta = {
  title: "Home/Banks/Chord Bank",
  component: ChordBank,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The chord palette and chord style, then six chord pads. Click a chord pad to latch it, or hold its key; the keys then play that chord in the chord style.",
      },
    },
  },
  decorators: [withDevice],
} satisfies Meta<typeof ChordBank>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
