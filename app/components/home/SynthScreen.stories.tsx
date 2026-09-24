import type { Meta, StoryObj } from "@storybook/react-vite";
import { SYNTH_PRESETS } from "../../lib/synth";
import { SynthScreen } from "./SynthScreen";
import { SYNTH_SECTIONS } from "./synthSections";

const meta = {
  title: "Home/Synth Screen",
  component: SynthScreen,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    params: SYNTH_PRESETS.grand_piano,
    section: SYNTH_SECTIONS[1],
    sectionIndex: 1,
    sectionCount: SYNTH_SECTIONS.length,
    className: "w-[min(480px,85vw)]",
  },
  argTypes: {
    section: { control: false },
    analyser: { control: false },
  },
} satisfies Meta<typeof SynthScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Scope: Story = {
  args: { showScope: true },
};
