import type { Meta, StoryObj } from "@storybook/react";
import { TrackRow } from "./TrackRow";
import { DEFAULT_TRACKS } from "../../lib/studioStorage";

const meta = {
  title: "Mixer/TrackRow",
  component: TrackRow,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  args: {
    onSelect: () => {},
    onUpdate: () => {},
    onDelete: () => {},
    onOpenInstrument: () => {},
  },
  argTypes: {
    isActive: { control: "boolean" },
    measureWidth: { control: { type: "range", min: 80, max: 200, step: 10 } },
    totalMeasures: { control: { type: "number", min: 4, max: 32 } },
    onSelect: { action: "selected" },
    onUpdate: { action: "updated" },
    onDelete: { action: "deleted" },
    onOpenInstrument: { action: "openInstrument" },
  },
} satisfies Meta<typeof TrackRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    track: DEFAULT_TRACKS[1],
    index: 1,
    isActive: true,
    measureWidth: 140,
    totalMeasures: 16,
  },
  render: (args) => (
    <div className="w-[800px] bg-stone-900 rounded overflow-hidden">
      <TrackRow {...args} />
    </div>
  ),
};

export const DrumTrack: Story = {
  args: {
    track: DEFAULT_TRACKS[0],
    index: 0,
    isActive: false,
    measureWidth: 140,
    totalMeasures: 16,
  },
  render: (args) => (
    <div className="w-[800px] bg-stone-900 rounded overflow-hidden">
      <TrackRow {...args} />
    </div>
  ),
};

export const Muted: Story = {
  args: {
    track: {
      ...DEFAULT_TRACKS[1],
      isMuted: true,
    },
    index: 1,
    isActive: false,
    measureWidth: 140,
    totalMeasures: 16,
  },
  render: (args) => (
    <div className="w-[800px] bg-stone-900 rounded overflow-hidden">
      <TrackRow {...args} />
    </div>
  ),
};

export const Solo: Story = {
  args: {
    track: {
      ...DEFAULT_TRACKS[0],
      isSolo: true,
    },
    index: 0,
    isActive: true,
    measureWidth: 140,
    totalMeasures: 16,
  },
  render: (args) => (
    <div className="w-[800px] bg-stone-900 rounded overflow-hidden">
      <TrackRow {...args} />
    </div>
  ),
};
