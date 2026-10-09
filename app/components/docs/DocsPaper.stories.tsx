import type { Meta, StoryObj } from "@storybook/react-vite";
import { DocsPaper } from "./DocsPaper";
import { withDocs } from "./storybook/withDocs";

const meta = {
  title: "Docs/Paper",
  component: DocsPaper,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A sheet of grained paper that each doc, and the sidebar, is read on.",
      },
    },
  },
  decorators: [withDocs],
  args: {
    className: "max-w-xl",
    children: (
      <p className="leading-[1.7]">
        The Device doesn’t play samples. Every note is a small physics
        simulation: an exciter drives a resonator, and the resonator’s own
        feedback loop makes the pitch and tone.
      </p>
    ),
  },
} satisfies Meta<typeof DocsPaper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSource: Story = {
  args: { source: "docs/project/synth-engine.md" },
};
