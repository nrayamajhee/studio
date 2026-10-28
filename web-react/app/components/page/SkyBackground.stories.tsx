import type { Meta, StoryObj } from "@storybook/react-vite";
import { SkyBackground } from "./SkyBackground";

const meta = {
  title: "Page/Sky Background",
  component: SkyBackground,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The sky behind the home page and the docs: a sunset with a drifting glow, cross-fading to blue hour in dark mode. Fixed to the viewport.",
      },
      story: { inline: false, iframeHeight: 360 },
    },
  },
} satisfies Meta<typeof SkyBackground>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
