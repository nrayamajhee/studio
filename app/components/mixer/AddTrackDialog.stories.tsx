import type { Meta, StoryObj } from "@storybook/react";
import { AddTrackDialog } from "./AddTrackDialog";

const meta = {
  title: "Mixer/AddTrackDialog",
  component: AddTrackDialog,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    onClose: () => {},
    onAddTrack: () => {},
  },
  argTypes: {
    isOpen: { control: "boolean" },
    nextTrackNumber: { control: { type: "number", min: 1, max: 16 } },
    onClose: { action: "closed" },
    onAddTrack: { action: "trackAdded" },
  },
} satisfies Meta<typeof AddTrackDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    isOpen: true,
    nextTrackNumber: 3,
  },
};

export const Closed: Story = {
  args: {
    isOpen: false,
    nextTrackNumber: 3,
  },
};
