import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeToggle } from "./ThemeToggle";

const meta = {
  title: "Page/Theme Toggle",
  component: ThemeToggle,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The frosted light/dark switch pinned to a page's top-right corner; it remembers the choice in `localStorage`.",
      },
      story: { inline: false, iframeHeight: 120 },
    },
  },
} satisfies Meta<typeof ThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
