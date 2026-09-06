import type { Meta, StoryObj } from "@storybook/react";
import { MidiControl } from "./MidiControl";

const meta: Meta<typeof MidiControl> = {
  title: "Components/MidiControl",
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
    <div className="flex items-center gap-3 p-3 bg-white dark:bg-[#06080c] rounded-xl border border-stone-200 dark:border-[#1f2533] shadow-sm">
      <span className="text-xs font-mono font-bold text-stone-500 uppercase">
        Studio Transport
      </span>
      <div className="h-4 w-px bg-stone-300 dark:bg-stone-700" />
      <MidiControl />
    </div>
  ),
};
