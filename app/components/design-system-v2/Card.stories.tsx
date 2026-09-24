import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card } from "./Card";

const meta = {
  title: "Design System V2/Card",
  component: Card,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    variant: "glass",
    elevation: "low",
    children:
      "A translucent surface with a 2px border, blur, and subtle shadow.",
  },
  argTypes: {
    variant: { control: "select", options: ["solid", "glass"] },
    elevation: { control: "select", options: ["low", "mid", "high"] },
    children: { control: "text" },
  },
  decorators: [
    (Story) => (
      <div className="home-background grid min-h-64 place-items-center rounded-xl p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Solid: Story = {
  args: { variant: "solid" },
};
