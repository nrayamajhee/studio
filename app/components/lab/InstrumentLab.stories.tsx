import type { Meta, StoryObj } from "@storybook/react-vite";
import { InstrumentLab } from "./InstrumentLab";

const meta = {
  title: "Lab/Instrument Lab",
  component: InstrumentLab,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A dev tool for auditioning and tuning the physical-modeling instruments, with a generated parameter panel and diagnostic sweeps run through the real worklet.",
      },
    },
  },
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
        "rockDrums",
        "jazzDrums",
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
