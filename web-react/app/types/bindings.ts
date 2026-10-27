import type { ReactNode } from "react";
import type {
  DeviceScreenProps,
  ScreenBadge,
} from "../components/home/DeviceScreen";
import type { DevicePreset } from "../components/home/deviceEngine";
import type { Tool } from "../components/home/input/keymap";
import type { Device } from "./device";

export type KnobSlot = "chalk" | "green" | "red" | "blue";

export type KnobBinding = {
  label: string;
  valueLabel?: string;
  step: number;
  steps: number;
  onChange: (step: number) => void;
  fine?: boolean;
};

// The pads a mode can rebind: every tool, and the four arrows.
export type PadSlot = Tool | "left" | "right" | "up" | "down";

export type PadBinding = {
  label: string;
  icon: ReactNode;
  // `shifted` is Shift as a ⌘ shortcut saw it, for Save and Delete.
  onPress: (shifted?: boolean) => void;
  lit?: boolean;
  indicator?: boolean;
  pressed?: boolean;
  // Its keycap shows ⇧: what the pad does now is its Shift job.
  shiftLegend?: boolean;
};

export type ScreenBinding = Omit<
  DeviceScreenProps,
  "view" | "overlay" | "badges" | "className"
> & {
  // On/off or a hint, along the bottom in place of the footer.
  badge?: ScreenBadge | null;
};

// What every control does in a mode: the knobs, the pads and the screen.
export type Bindings = {
  knobs: Record<KnobSlot, KnobBinding>;
  pads: Record<PadSlot, PadBinding>;
  instrumentPad: (pad: number) => PadBinding;
  chordPad: (index: number) => PadBinding;
  screen: ScreenBinding;
  // A key played, by the note it sounds, before it plays: true when the mode
  // takes it for a job of its own, so it doesn't sound.
  keyPress?: (note: number) => boolean;
  // A sound the view plays for now without picking it (the instrument being
  // browsed): the keys and whatever plays sound on it until the view closes.
  previewSound?: DevicePreset;
};

// A mode rebinds only what it changes from the base bindings.
export type ModeBindings = {
  knobs?: Partial<Record<KnobSlot, KnobBinding>>;
  pads?: Partial<Record<PadSlot, PadBinding>>;
  instrumentPad?: (pad: number) => PadBinding;
  chordPad?: (index: number) => PadBinding;
  screen?: Partial<ScreenBinding>;
  keyPress?: (note: number) => boolean;
  previewSound?: DevicePreset;
};

export type Mode = (device: Device, base: Bindings) => ModeBindings;
