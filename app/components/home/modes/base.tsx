import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  AudioLines,
  AudioWaveform,
  ChartNoAxesGantt,
  Circle,
  DiscAlbum,
  FileMusic,
  Grid3x3,
  LayoutGrid,
  Metronome,
  Music4,
  Pause,
  Play,
  RotateCcw,
  Save,
  Scissors,
  Square,
  Trash2,
  VolumeX,
  WavesHorizontal,
} from "lucide-react";
import { valueToStep } from "../../../lib/physical/patches/format";
import { isTape } from "../../../providers/LanesProvider";
import {
  DEVICE_MODULES,
  KNOB_STEPS,
  deviceEngine,
  engineName,
  type ModuleId,
} from "../deviceEngine";
import { ScreenSeek, ScreenValue } from "../DeviceScreen";
import { AdsrIcon, ChordStyleIcon, TracksIcon } from "../instrumentIcons";
import { MODULE_IDS } from "../modules";
import { PresetIcon } from "../presetIcons";
import { swapPad } from "../presetStore";
import { trackSource } from "../tracks";
import type {
  Bindings,
  KnobBinding,
  PadBinding,
} from "../../../types/bindings";
import type { Device } from "../../../types/device";

const noop = () => {};

// How the sound is made: the model's exciter, then each module layered over
// it that's on. Saved presets are named after it.
export const soundName = ({ sound, lanes }: Device) =>
  [
    engineName(sound.preset.target),
    ...MODULE_IDS.filter((id) => lanes.modules.on[id]).map(
      (id) => DEVICE_MODULES[id].label,
    ),
  ].join(" · ");

// The param the knobs edit, in the footer: its name in green, as the knob
// that picks it, and its value in blue.
export const selection = ({ sound }: Device) => (
  <>
    <ScreenSeek>{sound.selected.label}</ScreenSeek>{" "}
    <ScreenValue>{sound.selectedDisplay}</ScreenValue>
  </>
);

// With Shift a pad plays, binds or saves to its alternate.
export const padName = ({ shift }: Device, pad: number) =>
  `${shift ? "Shift pad" : "Pad"} ${pad + 1}`;

// The preset a pad plays now, with or without Shift.
export const padPreset = ({ shift, sound }: Device, pad: number) => {
  const id = (shift ? sound.library.shiftButtons : sound.library.buttons)[pad];
  return sound.presets.find((candidate) => candidate.id === id) ?? null;
};

export const paramKnob = ({ sound }: Device): KnobBinding => ({
  label: "Parameter",
  valueLabel: sound.selected.label,
  step: sound.specs.indexOf(sound.selected),
  steps: Math.max(2, sound.specs.length),
  onChange: (index) =>
    sound.selectParam(Math.min(index, sound.specs.length - 1)),
});

// A knob with nothing to set in this view: it stays where it is, so it
// doesn't jump, and turning it does nothing.
export const idleKnob = ({ step, steps }: KnobBinding): KnobBinding => ({
  label: "Not used here",
  step,
  steps,
  onChange: noop,
});

// A list's runs of one category, in order: each one's name, where it starts
// and how many it holds.
export type Shelf = { name: string; start: number; count: number };

export function shelvesOf<T>(
  items: readonly T[],
  categoryOf: (item: T) => string,
): Shelf[] {
  const shelves: Shelf[] = [];
  items.forEach((item, index) => {
    const name = categoryOf(item);
    const last = shelves.at(-1);
    if (last?.name === name) last.count++;
    else shelves.push({ name, start: index, count: 1 });
  });
  return shelves;
}

// The shelf holding `index`, and its place among the shelves.
export function shelfAt(shelves: readonly Shelf[], index: number) {
  const at = Math.max(
    0,
    shelves.findIndex(
      ({ start, count }) => index >= start && index < start + count,
    ),
  );
  return { shelf: shelves[at] ?? { name: "", start: 0, count: 0 }, at };
}

// Browsing a list by category: the red knob steps through the categories,
// landing on each one's first, and the blue one through what is in the
// current one.
export function shelfKnobs(
  shelves: readonly Shelf[],
  index: number,
  name: string,
  select: (index: number) => void,
) {
  const { shelf, at } = shelfAt(shelves, index);
  const red: KnobBinding = {
    label: "Category",
    valueLabel: shelf.name || undefined,
    step: at,
    steps: Math.max(2, shelves.length),
    onChange: (step) =>
      select(shelves[Math.min(step, shelves.length - 1)]?.start ?? 0),
  };
  const blue: KnobBinding = {
    label: "Pick",
    valueLabel: name || undefined,
    step: index - shelf.start,
    steps: Math.max(2, shelf.count),
    onChange: (step) => select(shelf.start + Math.min(step, shelf.count - 1)),
  };
  return { red, blue };
}

// The green knob scrolling whatever the screen lists.
export const seekKnob = (
  valueLabel: string,
  step: number,
  steps: number,
  onChange: (step: number) => void,
): KnobBinding => ({
  label: "Seek",
  valueLabel: valueLabel || undefined,
  step,
  steps,
  onChange,
});

// ← and →: what they step through, shown with ⇧ while Shift is held so
// their Shift job can be found even where they have none.
export const arrowPad = (
  { shift }: Device,
  direction: 1 | -1,
  label: string,
  onPress: () => void,
): PadBinding => ({
  label,
  icon: direction < 0 ? <ArrowLeft /> : <ArrowRight />,
  shiftLegend: shift,
  onPress,
});

export const arrowPads = (
  device: Device,
  [previous, next]: readonly [string, string],
  step: (direction: 1 | -1) => void,
) => ({
  left: arrowPad(device, -1, previous, () => step(-1)),
  right: arrowPad(device, 1, next, () => step(1)),
});

// With Shift, Save keeps the tracks as MIDI from any view but the tape and
// the sequencer, where it always keeps what's on them as a track.
export const savePad = (
  device: Device,
  own: { label: string; icon?: ReactNode; onPress?: () => void },
): PadBinding => ({
  label: device.shift ? "Save the tracks as MIDI" : own.label,
  icon: device.shift ? <FileMusic /> : (own.icon ?? <Save />),
  shiftLegend: device.shift,
  onPress: (shifted = device.shift) => {
    if (shifted) void device.mix.exportMix("midi");
    else own.onPress?.();
  },
});

// The dedicated Trash: deletes what the view has picked on a second press.
// Shift + Delete opens Revert from anywhere.
export const deletePad = (
  device: Device,
  own?: {
    label: string;
    key: string;
    prompt: string;
    run: () => void;
    // Whether there is anything to delete.
    when?: boolean;
  },
): PadBinding => ({
  label: device.shift ? "Revert" : (own?.label ?? "Delete"),
  icon: device.shift ? <RotateCcw /> : <Trash2 />,
  lit: own !== undefined && device.feedback.pending === own.key,
  shiftLegend: device.shift,
  onPress: (revert = device.shift) => {
    if (revert) {
      device.latch.release();
      device.views.setView("revert");
      return;
    }
    if (!own || own.when === false) return;
    if (device.feedback.confirm(own.key, own.prompt)) own.run();
  },
});

// Play and Stop for the drum pattern.
export const stepPads = ({ steps }: Device) => {
  const playing = steps.stepsRunning && !steps.recordingSteps;
  return {
    play: {
      label: playing ? "Stop the steps" : "Play the steps",
      icon: playing ? (
        <Pause fill="currentColor" />
      ) : (
        <Play fill="currentColor" />
      ),
      onPress: () => {
        if (playing) steps.stopSteps();
        else steps.playSteps(false);
      },
    },
    stop: {
      label: "Stop",
      icon: <Square fill="currentColor" />,
      onPress: () => {
        if (steps.stepsRunning) steps.stopSteps();
        else steps.moveStepHead(0);
      },
    },
  };
};

// Play and Stop for the tracks: the mix, from the top.
export const mixPads = ({ mix }: Device, stopLabel = "Stop") => ({
  play: {
    label: mix.playing ? "Pause tracks" : "Play tracks",
    icon: mix.playing ? (
      <Pause fill="currentColor" />
    ) : (
      <Play fill="currentColor" />
    ),
    onPress: mix.togglePlay,
  },
  stop: {
    label: stopLabel,
    icon: <Square fill="currentColor" />,
    onPress: mix.rewind,
  },
});

// Opens or closes the tracks or the album. While recording it ends the
// take, like Record.
const openTracks = ({ transport, latch, views }: Device, album: boolean) => {
  transport.setRollPosition(null);
  if (transport.recording) {
    transport.stop();
    return;
  }
  if (album) latch.release();
  views.toggleView(album ? "album" : "tracks");
};

// Opens or closes the take (record mode), which Record also opens, loading
// the picked track onto it; with `steps` the drum sequencer. While recording
// it ends the take.
const openTape = (device: Device, steps: boolean) => {
  const { transport, latch, views, lanes, feedback } = device;
  transport.setRollPosition(null);
  if (transport.recording) {
    transport.stop();
    return;
  }
  latch.release();
  // A track opens only where it was made: a played take on the tape, a drawn
  // pattern in the sequencer.
  const where = steps ? "steps" : "roll";
  const track = isTape(lanes.focusedLane) ? null : lanes.focusedLane;
  if (device.view !== where && track && trackSource(track) !== where) {
    feedback.showPrompt(
      steps
        ? "Open this track in the piano roll"
        : "Open this track in the drum grid",
    );
    return;
  }
  if (steps) {
    device.steps.toggleSteps();
    return;
  }
  if (device.view === "roll") {
    views.setView("scope");
    return;
  }
  if (!isTape(lanes.focusedLane)) lanes.loadOntoTape(lanes.focusedLane);
  views.setView("roll");
};

// The preset library, or with `params` the synth parameters; either closes
// on another press.
const openSynth = ({ view, views, sound, browse }: Device, params: boolean) => {
  if (view === (params ? "synth" : "presets")) {
    views.setView("scope");
    return;
  }
  if (params) {
    sound.showSelectedPage();
    views.setView("synth");
    return;
  }
  browse.setPresetIndex(
    Math.max(
      0,
      sound.presets.findIndex(({ id }) => id === sound.preset.id),
    ),
  );
  views.setView("presets");
};

// A module pad opens its view; with Shift it switches the module on or off
// without leaving the current view.
const modulePad = (device: Device, id: ModuleId, icon: ReactNode) => {
  const { label, title } = DEVICE_MODULES[id];
  const on = device.lanes.modules.on[id];
  return {
    label: device.shift
      ? `Turn ${label} ${on ? "off" : "on"}`
      : `${title} (${on ? "on" : "off"})`,
    icon,
    lit: device.view === id,
    indicator: on,
    shiftLegend: device.shift,
    onPress: () => {
      if (device.shift) device.lanes.toggleModule(id);
      else device.views.toggleModule(id);
    },
  };
};

// Like a module pad: it opens the tempo view, and with Shift starts or stops
// the click without leaving the current view.
const metronomePad = ({ shift, view, views, transport }: Device) => ({
  label: shift
    ? `Turn metronome ${transport.metronome ? "off" : "on"}`
    : `Tempo (metronome ${transport.metronome ? "on" : "off"})`,
  icon: <Metronome />,
  lit: view === "tempo",
  indicator: transport.metronome,
  shiftLegend: shift,
  onPress: () => {
    if (shift) {
      deviceEngine.unlock();
      transport.toggleMetronome();
      return;
    }
    transport.stopTapping();
    views.toggleView("tempo");
  },
});

const viewPad = (
  { view }: Device,
  opens: Device["view"],
  [open, close]: readonly [string, string],
  icon: ReactNode,
  onPress: () => void,
): PadBinding => ({
  label: view === opens ? close : open,
  icon,
  lit: view === opens,
  onPress,
});

// What every control does unless a mode rebinds it: the knobs set the
// volume and the selected param, the arrows move the octave (with Shift,
// the preset) and the pads open their views.
export function baseBindings(device: Device): Bindings {
  const { shift, views, output, transport, sound, performance, tape, browse } =
    device;
  const recording = transport.recording;

  return {
    knobs: {
      chalk: {
        label: "Volume",
        valueLabel: `${output.volumeStep * 10}%`,
        step: output.volumeStep,
        steps: KNOB_STEPS,
        onChange: output.setVolume,
      },
      green: seekKnob("", browse.idleSeek, KNOB_STEPS, browse.setIdleSeek),
      red: paramKnob(device),
      blue: {
        label: "Value",
        valueLabel: `${sound.selected.label} ${sound.selectedDisplay}`,
        step: valueToStep(
          sound.selected,
          sound.selectedValue,
          sound.valueSteps,
        ),
        steps: sound.valueSteps,
        onChange: sound.setSelectedValue,
      },
    },
    pads: {
      play: {
        label: recording
          ? "Stop recording"
          : tape.recordArmed
            ? "Start recording"
            : transport.playing
              ? "Pause"
              : "Play",
        icon: transport.playing ? (
          <Pause fill="currentColor" />
        ) : (
          <Play fill="currentColor" />
        ),
        onPress: tape.togglePlay,
      },
      record: {
        label: recording
          ? "Stop recording"
          : tape.recordArmed
            ? "Disarm recording"
            : "Arm recording",
        icon: <Circle fill="currentColor" />,
        lit: recording || tape.recordArmed,
        onPress: tape.toggleRecord,
      },
      stop: {
        label: "Stop",
        icon: <Square fill="currentColor" />,
        onPress: tape.stop,
      },
      // Every other view shows over the main one, so Play and Stop act on
      // what it plays: the tracks, the pattern, or (as above) the tape.
      ...(views.mainView === "tracks"
        ? mixPads(device)
        : views.mainView === "steps"
          ? stepPads(device)
          : {}),
      save: savePad(device, { label: "Save preset" }),
      album: viewPad(
        device,
        "album",
        ["Album", "Close album"],
        <DiscAlbum />,
        () => openTracks(device, true),
      ),
      tracks: viewPad(
        device,
        "tracks",
        ["Tracks", "Close tracks"],
        <TracksIcon />,
        () => openTracks(device, false),
      ),
      take: viewPad(
        device,
        "roll",
        ["Piano roll", "Close piano roll"],
        <ChartNoAxesGantt />,
        () => openTape(device, false),
      ),
      steps: viewPad(
        device,
        "steps",
        ["Drum grid", "Close drum grid"],
        <Grid3x3 />,
        () => openTape(device, true),
      ),
      adsr: modulePad(device, "adsr", <AdsrIcon />),
      lfo: modulePad(device, "lfo", <WavesHorizontal />),
      fx: modulePad(device, "fx", <AudioLines />),
      metronome: metronomePad(device),
      mute: { label: "Mute a track", icon: <VolumeX />, onPress: noop },
      clip: { label: "Clip a track", icon: <Scissors />, onPress: noop },
      up: { label: "Up", icon: <ArrowUp />, onPress: noop },
      down: { label: "Down", icon: <ArrowDown />, onPress: noop },
      delete: deletePad(device),
      synth: viewPad(
        device,
        "presets",
        ["Preset library", "Close preset library"],
        <LayoutGrid />,
        () => openSynth(device, false),
      ),
      params: viewPad(
        device,
        "synth",
        ["Synth parameters", "Close synth parameters"],
        <AudioWaveform />,
        () => openSynth(device, true),
      ),
      chords: viewPad(
        device,
        "chords",
        ["Chord palette", "Close chord palette"],
        <Music4 />,
        () => views.toggleView("chords"),
      ),
      style: viewPad(
        device,
        "chordStyle",
        ["Chord style", "Close chord style"],
        <ChordStyleIcon pattern={performance.chordStyle.id} />,
        () => views.toggleView("chordStyle"),
      ),
      ...arrowPads(
        device,
        shift
          ? ["Previous preset", "Next preset"]
          : ["Octave down", "Octave up"],
        (direction) =>
          shift ? sound.stepPreset(direction) : sound.shiftOctave(direction),
      ),
    },
    presetPad: (pad) => {
      const bound = padPreset(device, pad);
      const current = bound?.id === sound.preset.id;
      return {
        label: bound
          ? `${bound.name}${current ? " (current)" : ""}`
          : `Empty preset pad ${pad + 1}`,
        icon: bound && <PresetIcon icon={bound.icon} />,
        // Lit while either of its two presets plays.
        indicator: bound
          ? sound.library.buttons[pad] === sound.preset.id ||
            sound.library.shiftButtons[pad] === sound.preset.id
          : undefined,
        shiftLegend: shift,
        onPress: () => {
          if (!bound) return;
          sound.selectPreset(bound);
          if (!shift) return;
          // The alternate comes up to the pad's first layer, and a latched
          // Shift lets go once it's picked.
          swapPad(pad);
          device.latch.release();
        },
      };
    },
    chordPad: (index) => {
      const { name, label } = performance.macroChords[index];
      return {
        label: `${name} chord`,
        icon: label,
        pressed: performance.activeChord === index,
        onPress: () => performance.toggleChord(index),
      };
    },
    screen: {
      title: sound.preset.name,
      unsaved: Boolean(sound.edits),
      status: "",
      footer: ["", ""],
      badge: null,
    },
  };
}
