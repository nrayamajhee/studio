import type { Meta, StoryObj } from "@storybook/react-vite";
import { InstrumentLab } from "./InstrumentLab";

const meta = {
  title: "Lab/Instrument Lab",
  component: InstrumentLab,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { initialInstrument: "piano" },
  argTypes: {
    initialInstrument: {
      control: "select",
      options: [
        "piano",
        "guitar",
        "bass",
        "uprightBass",
        "violin",
        "saxophone",
        "flute",
        "drums",
        "drums808",
      ],
    },
  },
} satisfies Meta<typeof InstrumentLab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Drums: Story = {
  args: { initialInstrument: "drums" },
};
