import type { Meta, StoryObj } from "@storybook/react";
import { TrackClip } from "./TrackClip";
import { DEFAULT_TRACKS } from "../../lib/studioStorage";

const meta = {
  title: "Mixer/TrackClip",
  component: TrackClip,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    measureWidth: {
      control: { type: "range", min: 80, max: 240, step: 10 },
    },
    isSelected: {
      control: "boolean",
    },
    onClipCountChange: { action: "clipCountChanged" },
    onOpenInstrument: { action: "openInstrument" },
  },
} satisfies Meta<typeof TrackClip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    track: DEFAULT_TRACKS[1],
    measureWidth: 140,
    isSelected: false,
  },
  render: (args) => (
    <div className="w-[600px] h-24 bg-stone-900 p-2 rounded flex items-center">
      <TrackClip {...args} />
    </div>
  ),
};

export const DrumClipRepeating: Story = {
  args: {
    track: {
      ...DEFAULT_TRACKS[0],
      clipCount: 4,
    },
    measureWidth: 120,
    isSelected: false,
  },
  render: (args) => (
    <div className="w-[600px] h-24 bg-stone-900 p-2 rounded flex items-center overflow-x-auto">
      <TrackClip {...args} />
    </div>
  ),
};

export const SelectedClip: Story = {
  args: {
    track: DEFAULT_TRACKS[1],
    measureWidth: 140,
    isSelected: true,
  },
  render: (args) => (
    <div className="w-[600px] h-24 bg-stone-900 p-2 rounded flex items-center">
      <TrackClip {...args} />
    </div>
  ),
};
