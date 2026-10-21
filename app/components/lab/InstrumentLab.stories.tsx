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
          "A dev tool for auditioning and tuning the physical-modeling instruments, with a generated parameter panel and diagnostic sweeps run through the real worklet. Play with the mouse or `A W S E D F T G Y H U J K` (`Z`/`X` the octave, hold Space to sustain), and **Copy patch JSON** to move tuned values into `patches/*.ts`.",
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
        "jazzStickDrums",
        "drums808",
        "drums909",
        "accordion",
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
