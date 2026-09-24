import type { Meta, StoryObj } from "@storybook/react-vite";
import { useArgs } from "storybook/preview-api";
import { fn } from "storybook/test";
import { Knob, type KnobProps } from "./Knob";

const meta = {
  title: "Design System V2/Knob",
  component: Knob,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { label: "Volume", value: 65, onChange: fn() },
  argTypes: {
    value: { control: { type: "range", min: 0, max: 100, step: 1 } },
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs<KnobProps>();
    return (
      <Knob
        {...args}
        onChange={(value) => {
          updateArgs({ value });
          args.onChange(value);
        }}
      />
    );
  },
} satisfies Meta<typeof Knob>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
