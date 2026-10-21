import { Plus } from "lucide-react";
import { plural } from "../deviceMath";
import { GAP, ScreenHint, ScreenPad, ScreenSeek } from "../DeviceScreen";
import { TapeDeckIcon } from "../instrumentIcons";
import { meterLabel } from "../noteRecorder";
import { deleteTape, newTape, openTape } from "../sessionStore";
import {
  arrowPads,
  deletePad,
  idleKnob,
  mixPads,
  savePad,
  seekKnob,
} from "./base";
import type { Mode } from "../../../types/bindings";
import type { Device } from "../../../types/device";

// Leaving a tape stops its mix and puts the tracks view back at its start.
const leaveTape = ({ mix, lanes, tracks }: Device) => {
  mix.rewind();
  lanes.setFocusIndex(0);
  tracks.resetTimeline();
};

// Opens the tape at `index`, with its tempo and time signature.
const pickTape = (device: Device, index: number) => {
  const { tapes, tape } = device.lanes;
  const next = tapes[Math.max(0, Math.min(index, tapes.length - 1))];
  if (!next || next.id === tape) return;
  leaveTape(device);
  openTape(next.id);
  device.transport.applyTapeTiming(next);
};

// The tapes, a tape a tile: the green knob and the arrows open a tape (the
// red and blue knobs set nothing here), Play plays its tracks, Save starts an
// empty tape at the tempo playing now and Delete removes the open one. A tile
// double-clicked opens its tape and closes the tapes onto its tracks.
export const tapesMode: Mode = (device, base) => {
  const { lanes, transport, feedback, views } = device;
  const { tapes, tapeIndex, currentTape } = lanes;
  const pick = (index: number) => pickTape(device, index);
  return {
    knobs: {
      green: seekKnob(
        currentTape?.name ?? "",
        tapeIndex,
        Math.max(2, tapes.length),
        pick,
      ),
      red: idleKnob(base.knobs.red),
      blue: idleKnob(base.knobs.blue),
    },
    pads: {
      ...mixPads(device),
      save: savePad(device, {
        label: "New tape",
        icon: <Plus />,
        onPress: () => {
          leaveTape(device);
          const started = newTape(
            transport.bpm,
            transport.timing.meter,
            transport.swing,
          );
          feedback.showNotice(`Started ${started.name}`);
        },
      }),
      delete: deletePad(
        device,
        currentTape && {
          label: `Delete ${currentTape.name}`,
          key: `delete:${currentTape.id}`,
          prompt: `Press again to delete ${currentTape.name}`,
          run: () => {
            leaveTape(device);
            const opened = deleteTape(currentTape.id);
            if (opened) transport.applyTapeTiming(opened);
            feedback.showNotice(`Deleted ${currentTape.name}`);
          },
        },
      ),
      ...arrowPads(device, ["Previous tape", "Next tape"], (direction) =>
        pick(tapeIndex + direction),
      ),
    },
    screen: {
      title: "Tapes",
      unsaved: false,
      status: (
        <ScreenSeek>
          {tapeIndex + 1}/{tapes.length}
        </ScreenSeek>
      ),
      footer: [
        currentTape
          ? `${plural(currentTape.tracks.length, "track")}${GAP}${currentTape.bpm} BPM${GAP}${meterLabel(currentTape.meter)}`
          : "",
        <ScreenHint key="hint">
          <ScreenPad label="Save">
            <Plus />
          </ScreenPad>{" "}
          new tape
        </ScreenHint>,
      ],
      tiles: tapes.map(({ id, name }) => ({
        id,
        label: name,
        icon: <TapeDeckIcon />,
      })),
      selected: tapeIndex,
      onSelect: pick,
      onActivate: (index) => {
        pick(index);
        views.setView("tracks");
      },
    },
  };
};
