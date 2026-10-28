import type { Meta, StoryObj } from "@storybook/react-vite";
import { Grille } from "./Grille";

const meta = {
  title: "Home/Parts/Grille",
  component: Grille,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A cosmetic speaker grille, drilled into the case on either side of the screen.",
      },
    },
  },
} satisfies Meta<typeof Grille>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
