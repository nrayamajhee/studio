import type { ReactNode } from "react";
import {
  ArrowUp,
  Layers,
  LayoutGrid,
  Metronome,
  Music4,
  RotateCcw,
  SlidersHorizontal,
  Volume2,
} from "lucide-react";
import { resetChordMacros } from "../chordStore";
import { turnPage } from "../deviceMath";
import { ScreenPad, TILES_PER_PAGE } from "../DeviceScreen";
import { AdsrIcon } from "../instrumentIcons";
import { INITIAL_MODULES } from "../modules";
import {
  DEFAULT_TIMING,
  METERS,
  SUBDIVISIONS,
  meterLabel,
} from "../noteRecorder";
import { resetPads } from "../presetStore";
import {
  INITIAL_LEVEL_STEP,
  INITIAL_VOLUME_STEP,
} from "../../../providers/OutputProvider";
import { arrowPads, savePad, seekKnob } from "./base";
import type { Mode, PadBinding, PadSlot } from "../../../types/bindings";
import type { Device } from "../../../types/device";

type RevertOption = {
  id: string;
  label: string;
  detail: string;
  icon: ReactNode;
  run: () => void;
};

// What Revert can put back, a tile each: the sounds' edits, the pads and
// chords as built in, and the modules, tempo and levels as they start.
const revertOptions = ({
  sound,
  lanes,
  transport,
  output,
}: Device): readonly RevertOption[] => {
  const options: RevertOption[] = [
    {
      id: "sound",
      label: "This sound",
      detail: `${sound.preset.name}'s settings`,
      icon: <SlidersHorizontal />,
      run: sound.revertSound,
    },
    {
      id: "sounds",
      label: "All sounds",
      detail: "Every instrument's settings",
      icon: <Layers />,
      run: sound.revertAllSounds,
    },
    {
      id: "pads",
      label: "Instrument pads",
      detail: "The built-in instruments on the pads",
      icon: <LayoutGrid />,
      run: resetPads,
    },
    {
      id: "chords",
      label: "Chord pads",
      detail: "The built-in chords, played as blocks",
      icon: <Music4 />,
      run: resetChordMacros,
    },
    {
      id: "modules",
      label: "Modules",
      detail: `${lanes.modulesOwner}'s ADSR, LFO and FX, off`,
      icon: <AdsrIcon />,
      run: () => lanes.setModules(INITIAL_MODULES),
    },
    {
      id: "tempo",
      label: "Tempo",
      detail: `${DEFAULT_TIMING.bpm} BPM in ${meterLabel(DEFAULT_TIMING.meter)}, grid off`,
      icon: <Metronome />,
      run: () => {
        transport.setBpm(DEFAULT_TIMING.bpm);
        transport.setMeter(METERS.indexOf(DEFAULT_TIMING.meter));
        transport.setGrid(SUBDIVISIONS.indexOf(DEFAULT_TIMING.perBeat));
      },
    },
    {
      id: "levels",
      label: "Levels",
      detail: `Level ${INITIAL_LEVEL_STEP * 10}%, volume ${INITIAL_VOLUME_STEP * 10}%`,
      icon: <Volume2 />,
      run: output.resetLevels,
    },
  ];
  return [
    ...options,
    {
      id: "everything",
      label: "Everything",
      detail: "All of the above",
      icon: <RotateCcw />,
      run: () => options.forEach((option) => option.run()),
    },
  ];
};

// Pads that keep Revert open: its own (Delete and the arrows) and those
// that do nothing here.
const KEEPS_REVERT: ReadonlySet<PadSlot> = new Set([
  "delete",
  "left",
  "right",
  "up",
  "down",
  "mute",
  "clip",
]);

// Shift + Delete opens Revert from anywhere: the green knob picks what to
// put back, and Delete puts it back on a second press. Any other pad closes
// it first, then does what it does.
export const revertMode: Mode = (device, base) => {
  const { shift, views, browse, feedback } = device;
  const options = revertOptions(device);
  const option = options[browse.revertIndex];
  const closing = (pad: PadBinding): PadBinding => ({
    ...pad,
    onPress: (shifted) => {
      views.leaveRevert();
      pad.onPress(shifted);
    },
  });
  const pads = Object.fromEntries(
    Object.entries(base.pads).map(([slot, pad]) => [
      slot,
      KEEPS_REVERT.has(slot as PadSlot) ? pad : closing(pad),
    ]),
  ) as typeof base.pads;

  return {
    knobs: {
      green: seekKnob(
        option.label,
        browse.revertIndex,
        options.length,
        (index) => browse.setRevertIndex(Math.min(index, options.length - 1)),
      ),
    },
    pads: {
      ...pads,
      save: closing(savePad(device, { label: "Save" })),
      delete: {
        label: shift ? "Close revert" : `Revert ${option.label.toLowerCase()}`,
        icon: <RotateCcw />,
        lit: true,
        shiftLegend: shift,
        onPress: (close = shift) => {
          if (close) {
            views.setView("scope");
            return;
          }
          const label = option.label.toLowerCase();
          if (
            !feedback.confirm(
              `revert:${option.id}`,
              `Press Revert again to revert ${label}`,
            )
          )
            return;
          option.run();
          feedback.showNotice(`Reverted ${label}`);
        },
      },
      ...arrowPads(device, ["Previous page", "Next page"], (direction) =>
        browse.setRevertIndex((index) =>
          turnPage(index, direction, TILES_PER_PAGE.revert, options.length),
        ),
      ),
    },
    presetPad: (pad) => closing(base.presetPad(pad)),
    chordPad: (index) => closing(base.chordPad(index)),
    screen: {
      title: "Revert",
      unsaved: false,
      status: (
        <>
          <ScreenPad label="Shift">
            <ArrowUp />
          </ScreenPad>
          <ScreenPad label="Delete">
            <RotateCcw />
          </ScreenPad>{" "}
          to close
        </>
      ),
      footer: [
        option.detail,
        <>
          Press{" "}
          <ScreenPad label="Delete">
            <RotateCcw />
          </ScreenPad>{" "}
          twice to revert
        </>,
      ],
      tiles: options.map(({ id, label, icon }) => ({ id, label, icon })),
      selected: browse.revertIndex,
      onSelect: browse.setRevertIndex,
    },
  };
};
