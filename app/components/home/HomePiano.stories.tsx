import type { Meta, StoryObj } from "@storybook/react-vite";
import { HomePiano } from "./HomePiano";

const meta = {
  title: "Home/Device",
  component: HomePiano,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    startOctave: 4,
    playAudio: true,
    className: "w-[min(640px,85vw)]",
  },
  argTypes: {
    startOctave: { control: { type: "number", min: 1, max: 7 } },
  },
} satisfies Meta<typeof HomePiano>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
