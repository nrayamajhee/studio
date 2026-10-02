import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { PATCH_BY_ID } from "../../lib/physical/patches";
import { formatParam } from "../../lib/physical/patches/format";
import { DEVICE_PRESETS } from "./deviceEngine";
import { DeviceScreen } from "./DeviceScreen";
import { ICON_CHOICES, PresetIcon } from "./presetIcons";

const pianoParams = PATCH_BY_ID.piano.params.map((spec) => ({
  id: spec.id,
  label: spec.label,
  value: formatParam(spec, spec.default),
  selected: spec.id === "exciter.hardness",
}));

const meta = {
  title: "Home/Screen",
  component: DeviceScreen,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    view: "scope",
    title: "Grand Piano",
    status: "OCT ±0",
    footer: ["Hammer", "Hardness 50%"],
    onSelect: fn(),
    className: "w-[621px]",
  },
  argTypes: {
    view: {
      control: "inline-radio",
      options: [
        "scope",
        "synth",
        "save",
        "presets",
        "adsr",
        "tempo",
        "roll",
        "tracks",
      ],
    },
    getAnalyser: { control: false },
    params: { control: false },
    tiles: { control: false },
    readouts: { control: false },
    badges: { control: false },
    getRoll: { control: false },
    tracks: { control: false },
  },
} satisfies Meta<typeof DeviceScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const VolumeOverlay: Story = {
  args: { overlay: { label: "Volume", value: 0.7, display: "70%" } },
};

export const Synth: Story = {
  args: { view: "synth", status: "Params 1/2", params: pianoParams },
};

export const Envelope: Story = {
  args: {
    view: "adsr",
    title: "ADSR",
    status: "",
    footer: ["", ""],
    badges: [{ label: "ADSR", on: true }],
    readouts: [
      { label: "Attack", display: "0 ms", amount: 0 },
      { label: "Decay", display: "200 ms", amount: 0.5 },
      { label: "Sustain", display: "50%", amount: 0.5 },
      { label: "Release", display: "200 ms", amount: 0.5 },
    ],
  },
};

export const Lfo: Story = {
  args: {
    view: "lfo",
    title: "LFO",
    status: "",
    footer: ["", ""],
    badges: [{ label: "LFO", on: true }],
    lfoShape: 0,
    lfoRate: 5,
    readouts: [
      { label: "Rate", display: "5.0 Hz", amount: 0.7 },
      { label: "Depth", display: "50%", amount: 0.5 },
      { label: "Shape", display: "Sine", amount: 0 },
      { label: "Target", display: "Pitch", amount: 0 },
    ],
  },
};

export const Effects: Story = {
  args: {
    view: "fx",
    title: "FX",
    status: "",
    footer: ["", ""],
    badges: [{ label: "FX", on: false }],
    readouts: [
      { label: "Drive", display: "30%", amount: 0.3 },
      { label: "Chorus", display: "50%", amount: 0.5 },
      { label: "Delay", display: "20%", amount: 0.2 },
      { label: "Reverb", display: "35%", amount: 0.5 },
    ],
  },
};

export const Tempo: Story = {
  args: {
    view: "tempo",
    title: "Tempo",
    status: "",
    footer: ["", ""],
    beat: 0,
    badges: [{ label: "Metronome", on: true }],
  },
};

// A C major arpeggio and its chord, two bars at 120 BPM.
const rollNotes = [60, 64, 67, 72].map((note, i) => ({
  note,
  start: i * 500,
  duration: 400,
  velocity: 0.8,
}));

export const Roll: Story = {
  args: {
    view: "roll",
    status: "Take · Tape",
    footer: ["", ""],
    getRoll: () => ({
      now: 3500,
      notes: [
        ...rollNotes,
        ...[60, 64, 67].map((note) => ({
          note,
          start: 2000,
          duration: 1000,
          velocity: 0.8,
        })),
      ],
      state: "stopped",
    }),
  },
};

// An arpeggio looping every two bars, and a held chord played once, muted.
export const Tracks: Story = {
  args: {
    view: "tracks",
    title: "Tracks",
    status: "Track 1/2",
    footer: ["Starts bar 1", "←→ slide · X mute · ⇧X solo"],
    selected: 0,
    trackSpan: 16,
    tracks: [
      {
        id: "arpeggio",
        name: "Track 1",
        detail: "Grand Piano",
        color: "#f2884b",
        start: 0,
        clip: {
          length: 8,
          loops: true,
          notes: [60, 64, 67, 72, 67, 64, 60, 55].map((note, i) => ({
            note,
            start: i,
            length: 0.5,
          })),
        },
        volume: 0.8,
        muted: false,
        soloed: false,
        audible: true,
      },
      {
        id: "chord",
        name: "Track 2",
        detail: "Violin",
        color: "#2f7de1",
        start: 4,
        clip: {
          length: 6,
          loops: false,
          notes: [53, 57, 60].map((note) => ({ note, start: 0, length: 6 })),
        },
        volume: 0.5,
        muted: true,
        soloed: false,
        audible: false,
      },
    ],
  },
};

export const SaveIconPicker: Story = {
  args: {
    view: "save",
    status: "Icons 1/2",
    footer: ["Pick an icon", "Press a pad to save"],
    selected: 3,
    tiles: ICON_CHOICES.map((icon) => ({
      id: icon,
      label: icon,
      icon: <PresetIcon icon={icon} />,
    })),
  },
};

export const Presets: Story = {
  args: {
    view: "presets",
    status: "Presets",
    footer: ["Highlight a preset", "Press a pad to bind"],
    selected: 0,
    tiles: DEVICE_PRESETS.map((preset, i) => ({
      id: preset.id,
      label: preset.name,
      icon: <PresetIcon icon={preset.icon} />,
      badge: String(i + 1),
    })),
  },
};
