import type { Meta, StoryObj } from "@storybook/react-vite";
import { Pad } from "./Pad";

const meta = {
  title: "Design System V2/Pad",
  component: Pad,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { note: "C2", hotkey: "1", isPressed: false },
  decorators: [
    (Story) => (
      <div className="w-20">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Pad>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Pressed: Story = {
  args: { isPressed: true },
};
