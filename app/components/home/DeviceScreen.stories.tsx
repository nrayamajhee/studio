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
    className: "w-[944px]",
  },
  argTypes: {
    view: {
      control: "inline-radio",
      options: ["scope", "synth", "save", "presets", "adsr"],
    },
    getAnalyser: { control: false },
    params: { control: false },
    tiles: { control: false },
    readouts: { control: false },
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
    status: "On",
    footer: ["", ""],
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
    status: "On",
    footer: ["", ""],
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
    status: "On",
    footer: ["", ""],
    readouts: [
      { label: "Drive", display: "30%", amount: 0.3 },
      { label: "Chorus", display: "50%", amount: 0.5 },
      { label: "Delay", display: "20%", amount: 0.2 },
      { label: "Reverb", display: "35%", amount: 0.5 },
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
