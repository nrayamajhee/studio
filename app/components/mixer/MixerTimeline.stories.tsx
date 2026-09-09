import type { Meta, StoryObj } from "@storybook/react";
import { MixerTimeline } from "./MixerTimeline";
import { DEFAULT_TRACKS } from "../../lib/studioStorage";

const meta = {
  title: "Mixer/MixerTimeline",
  component: MixerTimeline,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  args: {
    onSelectTrack: () => {},
    onUpdateTrack: () => {},
    onDeleteTrack: () => {},
    onOpenInstrument: () => {},
    onAddTrackClick: () => {},
    onSeekStep: () => {},
  },
  argTypes: {
    currentStep: { control: { type: "number", min: 0, max: 64 } },
    totalStepsPerBar: { control: "number" },
    isPlaying: { control: "boolean" },
    onSelectTrack: { action: "trackSelected" },
    onUpdateTrack: { action: "trackUpdated" },
    onDeleteTrack: { action: "trackDeleted" },
    onOpenInstrument: { action: "openInstrument" },
    onAddTrackClick: { action: "addTrackClicked" },
    onSeekStep: { action: "stepSeeked" },
  },
} satisfies Meta<typeof MixerTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    tracks: DEFAULT_TRACKS,
    activeTrackId: "track-2",
    currentStep: 0,
    totalStepsPerBar: 16,
    isPlaying: false,
  },
  render: (args) => (
    <div className="h-[400px] w-full bg-surface-dark flex flex-col">
      <MixerTimeline {...args} />
    </div>
  ),
};

export const PlayingWithPlayhead: Story = {
  args: {
    tracks: DEFAULT_TRACKS,
    activeTrackId: "track-1",
    currentStep: 20,
    totalStepsPerBar: 16,
    isPlaying: true,
  },
  render: (args) => (
    <div className="h-[400px] w-full bg-surface-dark flex flex-col">
      <MixerTimeline {...args} />
    </div>
  ),
};
