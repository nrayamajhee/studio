import type { Meta, StoryObj } from "@storybook/react-vite";
import { withDevice } from "../storybook/withDevice";
import { ControlBank } from "./ControlBank";

const meta = {
  title: "Home/Banks/Control Bank",
  component: ControlBank,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Four columns over three rows: Play, Record, Stop and Save; Mute, Clip, ↑ and Delete (Revert with Shift); Shift and the arrows. Play, Record and Stop act on whatever the view plays: the tape, the drum sequencer or the mix.",
      },
    },
  },
  decorators: [withDevice],
} satisfies Meta<typeof ControlBank>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

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

export const Revert: Story = {
  parameters: {
    device: { view: "revert" },
    docs: {
      description: {
        story: "In Revert, Delete puts back the picked tile on a second press.",
      },
    },
  },
};
