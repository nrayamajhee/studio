import type { Meta, StoryObj } from "@storybook/react";
import { MidiControl } from "./MidiControl";
import { Card } from "../design-system/Card";
import { Caption } from "../design-system/Typography";

const meta: Meta<typeof MidiControl> = {
  title: "Instrument/MidiControl",
  component: MidiControl,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof MidiControl>;

export const Default: Story = {
  args: {},
};

export const InHeaderContext: Story = {
  render: () => (
    <Card elevation="low" className="flex flex-row items-center gap-3 p-3 bg-white dark:bg-surface-dark rounded-xl border border-stone-200 dark:border-stone-800 shadow-sm">
      <Caption className="text-xs font-mono font-bold text-stone-500 uppercase">
        Studio Transport
      </Caption>
      <div className="h-4 w-px bg-stone-300 dark:bg-stone-700" />
      <MidiControl />
    </Card>
  ),
};
