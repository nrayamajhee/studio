import type { Meta, StoryObj } from "@storybook/react-vite";
import { DebugOverlay } from "./DebugOverlay";

const meta = {
  title: "Page/Debug Overlay",
  component: DebugOverlay,
  tags: ["autodocs"],
  args: { defaultOpen: true },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A dark see-through panel listing everything in `localStorage`, a part a row, with the picked part's JSON pretty-printed and kept live; `/` opens and closes it on the home page in development.",
      },
      story: { inline: false, iframeHeight: 560 },
    },
  },
} satisfies Meta<typeof DebugOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
