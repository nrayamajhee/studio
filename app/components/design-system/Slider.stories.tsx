import type { Meta, StoryObj } from "@storybook/react-vite";
import { useArgs } from "storybook/preview-api";
import { fn } from "storybook/test";
import { Slider, type SliderProps } from "./Slider";

const meta = {
  title: "Design System/Slider",
  component: Slider,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    label: "Volume",
    valueDisplay: "50",
    min: 0,
    max: 100,
    step: 1,
    value: 50,
    onChange: fn(),
  },
  argTypes: {
    tone: {
      control: "select",
      options: ["primary", "info", "blue", "accent", "secondary"],
    },
    size: { control: "inline-radio", options: ["xs", "sm", "md", "lg"] },
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs<SliderProps>();
    return (
      <div className="w-64">
        <Slider
          {...args}
          onChange={(value, event) => {
            updateArgs({ value, valueDisplay: String(Math.round(value)) });
            args.onChange?.(value, event);
          }}
        />
      </div>
    );
  },
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Tones: Story = {
  render: () => (
    <div className="flex w-64 flex-col gap-4">
      {(
        ["primary", "info", "blue", "accent", "secondary"] as const
      ).map((tone) => (
        <Slider
          key={tone}
          label={tone}
          tone={tone}
          value={50}
          onChange={() => {}}
        />
      ))}
    </div>
  ),
};
