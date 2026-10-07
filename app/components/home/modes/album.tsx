import { Disc3, Plus } from "lucide-react";
import { plural } from "../deviceMath";
import { ScreenPad, ScreenSeek } from "../DeviceScreen";
import { meterLabel } from "../noteRecorder";
import { deleteSong, newSong, openSong } from "../sessionStore";
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

// Leaving a song stops its mix and puts the tracks view back at its start.
const leaveSong = ({ mix, lanes, tracks }: Device) => {
  mix.rewind();
  lanes.setFocusIndex(0);
  tracks.resetTimeline();
};

// Opens the album's song at `index`, with its tempo and time signature.
const pickSong = (device: Device, index: number) => {
  const { songs, song } = device.lanes;
  const next = songs[Math.max(0, Math.min(index, songs.length - 1))];
  if (!next || next.id === song) return;
  leaveSong(device);
  openSong(next.id);
  device.transport.applySongTiming(next);
};

// The album, a song a tile: the green knob and the arrows open a song (the
// red and blue knobs set nothing here), Play plays its tracks, Save starts an
// empty song at the tempo playing now and Delete removes the open one.
export const albumMode: Mode = (device, base) => {
  const { lanes, transport, feedback } = device;
  const { songs, songIndex, currentSong } = lanes;
  const pick = (index: number) => pickSong(device, index);
  return {
    knobs: {
      green: seekKnob(
        currentSong?.name ?? "",
        songIndex,
        Math.max(2, songs.length),
        pick,
      ),
      red: idleKnob(base.knobs.red),
      blue: idleKnob(base.knobs.blue),
    },
    pads: {
      ...mixPads(device),
      save: savePad(device, {
        label: "New song",
        icon: <Plus />,
        onPress: () => {
          leaveSong(device);
          const started = newSong(transport.bpm, transport.timing.meter);
          feedback.showNotice(`Started ${started.name}`);
        },
      }),
      delete: deletePad(
        device,
        currentSong && {
          label: `Delete ${currentSong.name}`,
          key: `delete:${currentSong.id}`,
          prompt: `Press again to delete ${currentSong.name}`,
          run: () => {
            leaveSong(device);
            const opened = deleteSong(currentSong.id);
            if (opened) transport.applySongTiming(opened);
            feedback.showNotice(`Deleted ${currentSong.name}`);
          },
        },
      ),
      ...arrowPads(device, ["Previous song", "Next song"], (direction) =>
        pick(songIndex + direction),
      ),
    },
    screen: {
      title: "Albums",
      unsaved: false,
      status: (
        <ScreenSeek>
          {songIndex + 1}/{songs.length}
        </ScreenSeek>
      ),
      footer: [
        currentSong
          ? `${plural(currentSong.tracks.length, "track")} · ${currentSong.bpm} BPM · ${meterLabel(currentSong.meter)}`
          : "",
        <>
          <ScreenPad label="Save">
            <Plus />
          </ScreenPad>{" "}
          new song
        </>,
      ],
      tiles: songs.map(({ id, name }) => ({
        id,
        label: name,
        icon: <Disc3 />,
      })),
      selected: songIndex,
      onSelect: pick,
    },
  };
};
