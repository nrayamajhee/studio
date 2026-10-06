import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowRight, Plus } from "lucide-react";
import { fn } from "storybook/test";
import { Button } from "./Button";

const meta = {
  title: "Design System/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The base button: solid, outline or ghost, in a tone and size, with optional leading and trailing icons and a loading state.",
      },
    },
  },
  args: {
    children: "Button",
    variant: "solid",
    tone: "primary",
    size: "md",
    onClick: fn(),
  },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["solid", "outline", "ghost"],
    },
    tone: {
      control: "select",
      options: [
        "primary",
        "info",
        "blue",
        "accent",
        "warning",
        "error",
        "success",
        "secondary",
      ],
    },
    size: { control: "inline-radio", options: ["xs", "sm", "md", "lg"] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Outline: Story = {
  args: { variant: "outline" },
};

export const WithIcons: Story = {
  args: { leadingIcon: <Plus />, trailingIcon: <ArrowRight /> },
};

export const Loading: Story = {
  args: { isLoading: true },
};

export const Disabled: Story = {
  args: { disabled: true },
};
