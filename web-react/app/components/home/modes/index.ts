import type { ScreenView } from "../DeviceScreen";
import type { Bindings, Mode } from "../../../types/bindings";
import type { Device } from "../../../types/device";
import { tapesMode } from "./tapes";
import { baseBindings } from "./base";
import { beatsMode } from "./beats";
import { playStyleMode } from "./playStyle";
import { chordsMode } from "./chords";
import { moduleMode } from "./module";
import { instrumentsMode } from "./instruments";
import { progressionsMode } from "./progressions";
import { revertMode } from "./revert";
import { saveMode } from "./save";
import { scopeMode } from "./scope";
import { drumGridMode } from "./drumGrid";
import { synthMode } from "./synth";
import { rollMode } from "./roll";
import { tempoMode } from "./tempo";
import { tracksMode } from "./tracks";

// Each view is a mode of the same hardware: what it rebinds of the knobs,
// pads and screen.
const MODES: Readonly<Record<ScreenView, Mode>> = {
  scope: scopeMode,
  synth: synthMode,
  save: saveMode,
  instruments: instrumentsMode,
  chords: chordsMode,
  playStyle: playStyleMode,
  progressions: progressionsMode,
  beats: beatsMode,
  tapes: tapesMode,
  revert: revertMode,
  adsr: moduleMode("adsr"),
  lfo: moduleMode("lfo"),
  fx: moduleMode("fx"),
  tempo: tempoMode,
  roll: rollMode,
  drumGrid: drumGridMode,
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
    instrumentPad: mode.instrumentPad ?? base.instrumentPad,
    chordPad: mode.chordPad ?? base.chordPad,
    screen: { ...base.screen, ...mode.screen },
    keyPress: mode.keyPress,
    previewSound: mode.previewSound,
  };
}
