import type { Meta, StoryObj } from "@storybook/react-vite";
import { useArgs } from "storybook/preview-api";
import { fn } from "storybook/test";
import { Knob, type KnobProps } from "./Knob";

const meta = {
  title: "Design System V2/Knob",
  component: Knob,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    label: "Waveform",
    step: 0,
    steps: 4,
    color: "#1d1d1f",
    markColor: "#ffffff",
    onChange: fn(),
  },
  argTypes: {
    step: { control: { type: "range", min: 0, max: 3, step: 1 } },
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs<KnobProps>();
    return (
      <Knob
        {...args}
        onChange={(step) => {
          updateArgs({ step });
          args.onChange?.(step);
        }}
      />
    );
  },
} satisfies Meta<typeof Knob>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Light: Story = {
  args: { label: "Volume", color: "#f4f3ef", markColor: "#141413" },
};
