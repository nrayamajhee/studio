import type { Meta, StoryObj } from "@storybook/react-vite";
import { Key } from "./Key";

const meta = {
  title: "Design System V2/Key",
  component: Key,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { note: "C4", hotkey: "A", variant: "white", isPressed: false },
  argTypes: {
    variant: { control: "radio", options: ["white", "black"] },
  },
  decorators: [
    (Story) => (
      <div className="h-60 w-14">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Key>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Black: Story = {
  args: { note: "C#4", hotkey: "W", variant: "black" },
};

export const Pressed: Story = {
  args: { isPressed: true },
};
