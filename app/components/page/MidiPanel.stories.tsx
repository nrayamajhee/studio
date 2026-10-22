import type { Meta, StoryObj } from "@storybook/react-vite";
import { useArgs } from "storybook/preview-api";
import { fn } from "storybook/test";
import { MidiPanel, type MidiPanelProps } from "./MidiPanel";

const meta = {
  title: "Page/MIDI Panel",
  component: MidiPanel,
  tags: ["autodocs"],
  args: { open: true, onOpenChange: fn() },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A dark see-through panel setting up MIDI: turning it on, the input and channel the keys play from, their octave, velocity, sustain pedal and drums, and mapping a controller's knobs and pads to the Device's by clicking one and moving the control. The button beside the theme toggle opens and closes it on the home page.",
      },
      story: { inline: false, iframeHeight: 620 },
    },
  },
} satisfies Meta<typeof MidiPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render(args) {
    const [, updateArgs] = useArgs<MidiPanelProps>();
    return (
      <MidiPanel
        {...args}
        onOpenChange={(open) => {
          updateArgs({ open });
          args.onOpenChange(open);
        }}
      />
    );
  },
};
