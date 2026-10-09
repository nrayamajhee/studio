import {
  ArrowDown,
  ArrowUp,
  Headphones,
  Scissors,
  ScissorsLineDashed,
  VolumeX,
} from "lucide-react";
import { KNOB_STEPS } from "../deviceEngine";
import {
  ScreenHint,
  ScreenLevel,
  ScreenSeek,
  ScreenSelection,
  ScreenValue,
} from "../DeviceScreen";
import { audible, repeatsOf } from "../tracks";
import { isTape } from "../../../providers/LanesProvider";
import { arrowPads, deletePad, mixPads, savePad, seekKnob } from "./base";
import type { Mode } from "../../../types/bindings";

// The tracks: the mix plays them all, and the blue knob picks one. The
// green knob seeks the mix and the red one sets the picked track's volume;
// the arrows slide it by bars. With Shift the knobs zoom and scroll the
// lanes, or trim a clipped track's edges, the green one slides it by beats
// and the arrows repeat it.
export const tracksMode: Mode = (device) => {
  const { shift, lanes, tracks, mix, transport, sound, steps, feedback } =
    device;
  const { lanes: rows, focusIndex, pickedLane, pickedTrack: track } = lanes;
  const { trackLoop, loopLabel, startLabel, trackSpan, trackFrom } = tracks;
  const { barBeats } = transport;

  return {
    knobs: {
      green:
        shift && track
          ? {
              label: "Slide",
              valueLabel: startLabel(track.start),
              step: Math.round(track.start),
              steps: trackSpan + 1,
              onChange: (beats) =>
                lanes.updateTrack(track.id, { start: beats }),
            }
          : {
              ...seekKnob(
                `Bar ${mix.mixBar + 1} of ${mix.mixBars}`,
                mix.mixStep,
                mix.mixSteps,
                mix.scrubMix,
              ),
              fine: true,
            },
      red:
        shift && trackLoop
          ? {
              label: "Clip start",
              valueLabel: loopLabel(trackLoop.start),
              step: Math.round(trackLoop.start / tracks.loopUnit),
              steps: tracks.loopSteps,
              onChange: (step) => tracks.setLoopEdge("start", step),
            }
          : shift
            ? {
                label: "Zoom",
                valueLabel: `×${tracks.trackZoom}`,
                step: tracks.trackZooms.indexOf(tracks.trackZoom),
                steps: Math.max(2, tracks.trackZooms.length),
                onChange: (step) =>
                  tracks.zoomTracks(
                    Math.min(step, tracks.trackZooms.length - 1),
                  ),
              }
            : {
                label: "Track volume",
                valueLabel: track
                  ? `${Math.round(track.volume * 100)}%`
                  : undefined,
                step: Math.round((track?.volume ?? 1) * (KNOB_STEPS - 1)),
                steps: KNOB_STEPS,
                onChange: (step) => {
                  if (track)
                    lanes.updateTrack(track.id, {
                      volume: step / (KNOB_STEPS - 1),
                    });
                },
              },
      blue:
        shift && trackLoop
          ? {
              label: "Clip end",
              valueLabel: loopLabel(trackLoop.end),
              step: Math.round(trackLoop.end / tracks.loopUnit),
              steps: tracks.loopSteps,
              onChange: (step) => tracks.setLoopEdge("end", step),
            }
          : shift
            ? {
                label: "Scroll",
                valueLabel: `Bar ${Math.floor(trackFrom / barBeats) + 1}.${(Math.round(trackFrom) % barBeats) + 1}`,
                step: Math.round(trackFrom),
                steps: tracks.panSteps,
                onChange: tracks.scrollTracks,
              }
            : {
                label: "Track",
                valueLabel: pickedLane?.name,
                step: focusIndex,
                steps: Math.max(2, rows.length),
                onChange: (index) =>
                  lanes.setFocusIndex(Math.min(index, rows.length - 1)),
              },
    },
    pads: {
      ...mixPads(device, "Stop and rewind"),
      save: savePad(device, {
        label: "Save the mix",
        onPress: () => void mix.exportMix("audio"),
      }),
      // Mutes the picked track (with Shift, solos it).
      mute: {
        label: track
          ? shift
            ? `${track.soloed ? "Unsolo" : "Solo"} ${track.name}`
            : `${track.muted ? "Unmute" : "Mute"} ${track.name}`
          : shift
            ? "Solo a track"
            : "Mute a track",
        icon: shift ? <Headphones /> : <VolumeX />,
        lit: Boolean(shift ? track?.soloed : track?.muted),
        shiftLegend: shift,
        onPress: () => {
          if (track) tracks.toggleSwitch(track, shift);
          else
            feedback.showPrompt(`Pick a track to ${shift ? "solo" : "mute"}`);
        },
      },
      // Clips the picked track to its loop or lets it play whole; with
      // Shift, while it is clipped, trims it for good to its clip.
      clip: {
        label: shift
          ? "Trim track to its clip"
          : track
            ? `Clip ${trackLoop ? "off" : "on"}`
            : "Clip a track",
        icon: shift ? <ScissorsLineDashed /> : <Scissors />,
        lit: trackLoop !== null,
        shiftLegend: shift,
        onPress: () => {
          if (!track) {
            feedback.showPrompt(`Pick a track to ${shift ? "trim" : "clip"}`);
            return;
          }
          if (!shift) tracks.toggleClip(track);
          else if (track.loop?.on) tracks.trimToClip(track);
          else feedback.showPrompt(`Clip ${track.name} first`);
        },
      },
      delete: deletePad(
        device,
        pickedLane && isTape(pickedLane)
          ? {
              label: "Delete",
              key: "delete:tape",
              prompt: "Press again to discard the tape",
              run: () => {
                lanes.discardTape();
                feedback.showNotice("Discarded the tape");
              },
            }
          : track && {
              label: `Delete ${track.name}`,
              key: `delete:${track.id}`,
              prompt: `Press again to delete ${track.name}`,
              run: () => {
                lanes.deleteTrack(track.id);
                feedback.showNotice(`Deleted ${track.name}`);
              },
            },
      ),
      up: {
        label: "Previous track",
        icon: <ArrowUp />,
        onPress: () => lanes.stepFocus(-1),
      },
      down: {
        label: "Next track",
        icon: <ArrowDown />,
        onPress: () => lanes.stepFocus(1),
      },
      ...arrowPads(
        device,
        shift
          ? ["Repeat track less", "Repeat track more"]
          : ["Slide track earlier", "Slide track later"],
        (direction) =>
          shift
            ? tracks.repeatTrack(direction)
            : tracks.slideTrack(direction * barBeats),
      ),
    },
    screen: {
      title: `Tracks · ${lanes.currentSong?.name ?? ""}`,
      unsaved: false,
      // The picked track in blue, as the blue knob picks it.
      status: (
        <ScreenValue>
          {focusIndex + 1}/{rows.length}
        </ScreenValue>
      ),
      // Left, the picked track: where it starts (or the section it's
      // clipped to), its repeats and volume; with Shift, just what the knobs
      // move, in their colours. Right, what the knobs do now.
      footer: [
        track && shift ? (
          <>
            <ScreenSeek>Starts {startLabel(track.start)}</ScreenSeek>
            {trackLoop && (
              <>
                {" · Clip "}
                <ScreenSelection
                  label={`${loopLabel(trackLoop.start)} –`}
                  value={loopLabel(trackLoop.end)}
                />
              </>
            )}
          </>
        ) : track ? (
          <>
            {trackLoop
              ? `Clip ${loopLabel(trackLoop.start)} – ${loopLabel(trackLoop.end)}`
              : `Starts ${startLabel(track.start)}`}
            {` · ×${repeatsOf(track)} · `}
            <ScreenLevel>Vol {Math.round(track.volume * 100)}%</ScreenLevel>
          </>
        ) : (
          <>
            Tape ·{" "}
            <ScreenHint>
              record in the piano roll or drum grid, then save it
            </ScreenHint>
          </>
        ),
        <ScreenHint key="knobs">
          {(shift || track) && (
            <>
              <ScreenLevel>
                {shift ? (trackLoop ? "Clip start" : "Zoom") : "Volume"}
              </ScreenLevel>
              {" · "}
            </>
          )}
          <ScreenSeek>{shift && track ? "Slide" : "Seek"}</ScreenSeek>
          {" · "}
          <ScreenValue>
            {shift ? (trackLoop ? "Clip end" : "Scroll") : "Track"}
          </ScreenValue>
        </ScreenHint>,
      ],
      tracks: rows.map((lane, i) => ({
        id: lane.id,
        name: lane.name,
        detail:
          sound.presets.find(({ id }) => id === lane.presetId)?.name ?? "",
        color: lane.color,
        start: lane.start,
        clip: tracks.clips[i],
        volume: lane.volume,
        muted: lane.muted,
        soloed: lane.soloed,
        audible: isTape(lane) ? true : audible(lane, lanes.tracks),
        potential: isTape(lane),
        pattern: isTape(lane) ? steps.patternClip : undefined,
      })),
      getTrackPosition: mix.getTrackPosition,
      trackSpan,
      trackZoom: tracks.trackZoom,
      trackFrom,
      onPanTracks: tracks.panTracks,
      barBeats,
      selected: focusIndex,
      onSelect: lanes.setFocusIndex,
      onLoopEdge: tracks.dragLoopEdge,
      onLoopEdgeDrag: tracks.setDragging,
    },
  };
};
