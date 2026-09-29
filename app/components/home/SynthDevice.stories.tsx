import type { Meta, StoryObj } from "@storybook/react-vite";
import { SynthDevice } from "./SynthDevice";

const meta = {
  title: "Home/Device",
  component: SynthDevice,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="home-background h-[640px] rounded-xl p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SynthDevice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
