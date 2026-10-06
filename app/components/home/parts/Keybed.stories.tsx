import type { Meta, StoryObj } from "@storybook/react-vite";
import { withDevice } from "../storybook/withDevice";
import { Keybed } from "./Keybed";

const meta = {
  title: "Home/Parts/Keybed",
  component: Keybed,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Two octaves of piano keys from F3, played with the mouse or the home-row keys, and shifted by the octave arrows. With a drum kit, each key shows the piece it plays.",
      },
    },
  },
  decorators: [withDevice],
} satisfies Meta<typeof Keybed>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
