import type { Meta, StoryObj } from "@storybook/react-vite";
import { PATCH_BY_ID } from "../../lib/physical/patches";
import { SynthGraph } from "./SynthGraph";
import { previewPage } from "./synthGraphs";

const meta = {
  title: "Home/Synth Graph",
  component: SynthGraph,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A Synth page's graph of what its knobs do, drawn from the instrument's patch and values: lines stretched over the screen keeping their pixel widths, labels in screen type laid over them.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="flex h-[130px] w-[565px] bg-screen p-[8px]">
        <Story />
      </div>
    ),
  ],
  args: {
    scene: previewPage(PATCH_BY_ID.guitar, "exciter").scene,
    label: "Exciter: what its knobs do on the Acoustic guitar",
  },
  argTypes: {
    scene: { control: false },
  },
} satisfies Meta<typeof SynthGraph>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Chain: Story = {
  args: {
    scene: previewPage(PATCH_BY_ID.flute, "chain").scene,
    label: "Chain: the signal chain on the Flute",
  },
};
