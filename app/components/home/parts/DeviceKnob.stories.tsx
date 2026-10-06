import type { Meta, StoryObj } from "@storybook/react-vite";
import { withDevice } from "../storybook/withDevice";
import { DeviceKnob } from "./DeviceKnob";

const meta = {
  title: "Home/Parts/Device Knob",
  component: DeviceKnob,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "One of the four knobs (white, green, red or blue), doing whatever the current mode binds it to.",
      },
    },
  },
  decorators: [withDevice],
  args: { slot: "chalk" },
  argTypes: {
    slot: {
      control: "inline-radio",
      options: ["chalk", "green", "red", "blue"],
    },
  },
} satisfies Meta<typeof DeviceKnob>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Tracks: Story = {
  args: { slot: "green" },
  parameters: {
    device: { view: "tracks" },
    docs: {
      description: { story: "On the tracks, the green knob seeks the mix." },
    },
  },
};
