import type { Meta, StoryObj } from "@storybook/react-vite";
import { withDevice } from "../storybook/withDevice";
import { ViewBank } from "./ViewBank";

const meta = {
  title: "Home/Banks/View Bank",
  component: ViewBank,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Opens the album, tracks, tape, drum sequencer, ADSR, LFO, FX and tempo views. With Shift, the module and tempo pads switch the module or the click on and off.",
      },
    },
  },
  decorators: [withDevice],
} satisfies Meta<typeof ViewBank>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Tracks: Story = {
  parameters: {
    device: { view: "tracks" },
    docs: {
      description: {
        story:
          "On the tracks: their pad is lit, and pressing it again closes them.",
      },
    },
  },
};
