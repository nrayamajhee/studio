import type { ScreenView } from "../DeviceScreen";
import type { Bindings, Mode } from "../../../types/bindings";
import type { Device } from "../../../types/device";
import { albumMode } from "./album";
import { baseBindings } from "./base";
import { beatsMode } from "./beats";
import { chordStyleMode } from "./chordStyle";
import { chordsMode } from "./chords";
import { moduleMode } from "./module";
import { presetsMode } from "./presets";
import { progressionsMode } from "./progressions";
import { revertMode } from "./revert";
import { saveMode } from "./save";
import { scopeMode } from "./scope";
import { stepsMode } from "./steps";
import { synthMode } from "./synth";
import { tapeMode } from "./tape";
import { tempoMode } from "./tempo";
import { tracksMode } from "./tracks";

// Each view is a mode of the same hardware: what it rebinds of the knobs,
// pads and screen.
const MODES: Readonly<Record<ScreenView, Mode>> = {
  scope: scopeMode,
  synth: synthMode,
  save: saveMode,
  presets: presetsMode,
  chords: chordsMode,
  chordStyle: chordStyleMode,
  progressions: progressionsMode,
  beats: beatsMode,
  album: albumMode,
  revert: revertMode,
  adsr: moduleMode("adsr"),
  lfo: moduleMode("lfo"),
  fx: moduleMode("fx"),
  tempo: tempoMode,
  roll: tapeMode,
  steps: stepsMode,
  tracks: tracksMode,
};

// What every control does now: the base bindings, with the current view's
// mode over them.
export function resolveBindings(device: Device): Bindings {
  const base = baseBindings(device);
  const mode = MODES[device.view](device, base);
  return {
    knobs: { ...base.knobs, ...mode.knobs },
    pads: { ...base.pads, ...mode.pads },
    presetPad: mode.presetPad ?? base.presetPad,
    chordPad: mode.chordPad ?? base.chordPad,
    screen: { ...base.screen, ...mode.screen },
  };
}
