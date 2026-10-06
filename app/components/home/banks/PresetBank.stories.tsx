import type { Meta, StoryObj } from "@storybook/react-vite";
import { withDevice } from "../storybook/withDevice";
import { PresetBank } from "./PresetBank";

const meta = {
  title: "Home/Banks/Preset Bank",
  component: PresetBank,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The preset library and the synth parameters, then six preset pads, each with a Shift alternate. The library binds presets to the pads, and the save view saves to them.",
      },
    },
  },
  decorators: [withDevice],
} satisfies Meta<typeof PresetBank>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Library: Story = {
  parameters: {
    device: { view: "presets" },
    docs: {
      description: {
        story:
          "In the library, pressing a pad twice binds the highlighted preset to it.",
      },
    },
  },
};
