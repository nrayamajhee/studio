import type { Meta, StoryObj } from "@storybook/react-vite";
import { SaveSynthDialog } from "./SaveSynthDialog";
import { Button } from "../design-system/Button";
import { Plus } from "lucide-react";

const meta: Meta<typeof SaveSynthDialog> = {
  title: "Components/SaveSynthDialog",
  component: SaveSynthDialog,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof SaveSynthDialog>;

export const Default: Story = {
  args: {},
};

export const CustomTrigger: Story = {
  args: {
    trigger: (
      <Button
        variant="solid"
        tone="primary"
        size="sm"
        className="flex items-center gap-1.5"
      >
        <Plus className="w-4 h-4" />
        Save Custom Preset
      </Button>
    ),
  },
};
