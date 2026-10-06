import type { Meta, StoryObj } from "@storybook/react-vite";
import { withDevice } from "../storybook/withDevice";
import { Display } from "./Display";

const meta = {
  title: "Home/Parts/Display",
  component: Display,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The screen as the current mode fills it, with notices, prompts and level overlays on top.",
      },
    },
  },
  decorators: [withDevice],
  args: { className: "w-[621px] mt-0" },
} satisfies Meta<typeof Display>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Tracks: Story = {
  parameters: {
    device: { view: "tracks" },
    docs: {
      description: {
        story: "The tracks: the tape and the song's tracks on a timeline.",
      },
    },
  },
};

export const Revert: Story = {
  parameters: {
    device: { view: "revert" },
    docs: {
      description: { story: "Revert: what can be put back, a tile each." },
    },
  },
};
