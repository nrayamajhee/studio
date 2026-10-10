import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { PATCH_BY_ID } from "../../lib/physical/patches";
import { formatParam } from "../../lib/physical/patches/format";
import { paramModules } from "../../lib/physical/patches/params";
import { DEVICE_PRESETS } from "./deviceEngine";
import { DeviceScreen, ScreenHint, ScreenValue } from "./DeviceScreen";
import { DEFAULT_TIMING } from "./noteRecorder";
import { DRUM_PIECES } from "./instrumentIcons";
import { ICON_CHOICES, PresetIcon } from "./presetIcons";

// The piano's Exciter page, one module of its params.
const pianoModules = paramModules(PATCH_BY_ID.piano.params);
const pianoParams = pianoModules[0].specs.map((spec) => ({
  id: spec.id,
  label: spec.label,
  value: formatParam(spec, spec.default),
  selected: spec.id === "exciter.hardness",
}));

const meta = {
  title: "Home/Screen",
  component: DeviceScreen,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The screen, presentational only: a status line, the view's body (scope, params, tiles, roll, steps, tracks or module graphs), a footer or badges, and an overlay for levels and prompts. The title leads the status line, or the footer where a pager or a left status takes its place.",
      },
    },
  },
  args: {
    view: "scope",
    title: "Grand piano",
    statusLeft: "OCT ±0",
    status: "Level 80%",
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
  args: {
    view: "synth",
    status: "",
    params: pianoParams,
    pager: {
      pages: pianoModules.map(({ label }) => label),
      at: 0,
      color: "red",
      onPick: fn(),
    },
  },
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
    timing: { ...DEFAULT_TIMING, bpm: 120 },
    status: "Tape · 4/4",
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

// A bar of a rock beat on the drum kit, the head on beat two.
const kitPieces = ["closedHat", "kick", "snare"] as const;
export const Steps: Story = {
  args: {
    view: "steps",
    title: "Drum kit",
    status: "1.2.1 · 1 bar 1/16",
    footer: ["", "Keys set hits at the head"],
    stepRows: kitPieces.map((piece) => {
      const { name, Icon } = DRUM_PIECES[piece];
      return { id: piece, label: name, icon: Icon && <Icon /> };
    }),
    stepCount: 16,
    stepsPerBeat: 4,
    stepsPerBar: 16,
    stepHits: new Set([
      ...[0, 2, 4, 6, 8, 10, 12, 14].map((step) => `0:${step}`),
      "1:0",
      "1:8",
      "1:10",
      "2:4",
      "2:12",
    ]),
    getStepHead: () => 4,
  },
};

// An arpeggio looping every two bars, and a held chord played once, muted.
export const Tracks: Story = {
  args: {
    view: "tracks",
    title: "Tracks",
    status: "Track 1/2",
    footer: ["Starts bar 1", "←→ slide · \\ mute · ⇧\\ solo"],
    selected: 0,
    trackSpan: 16,
    tracks: [
      {
        id: "arpeggio",
        name: "Picked guitar",
        detail: "Picked guitar",
        color: "#f2884b",
        start: 0,
        clip: {
          length: 8,
          offset: 0,
          repeats: 2,
          looped: false,
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
        name: "Fingerstyle electric",
        detail: "Fingerstyle electric",
        color: "#2f7de1",
        start: 4,
        clip: {
          length: 6,
          offset: 0,
          repeats: 1,
          looped: false,
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
    title: "Instruments",
    pager: {
      pages: ["Struck & plucked", "Bowed", "Blown"],
      at: 0,
      color: "red",
      onPick: fn(),
    },
    footer: [
      <ScreenValue key="chosen">Grand piano</ScreenValue>,
      <ScreenHint key="hint">Press a pad twice to bind</ScreenHint>,
    ],
    selected: 0,
    tiles: DEVICE_PRESETS.map((preset, i) => ({
      id: preset.id,
      label: preset.name,
      icon: <PresetIcon icon={preset.icon} />,
      badge: String(i + 1),
    })),
  },
};
