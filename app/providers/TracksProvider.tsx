import { useState, type ReactNode } from "react";
import { positionLabel } from "../components/home/deviceMath";
import {
  clipOf,
  cutToLoop,
  gridSteps,
  loopStep,
  maxRepeats,
  repeatsOf,
  takeBeats,
  takeBeatsAt,
  type Track,
} from "../components/home/tracks";
import { createStrictContext } from "./createStrictContext";
import { useFeedback } from "./FeedbackProvider";
import { isTape, useLanes } from "./LanesProvider";
import { useShift } from "./ShiftProvider";
import { useSteps } from "./StepsProvider";
import { useDeviceTransport } from "./TransportProvider";
import { useView } from "./ViewProvider";

// How many times Shift + red stretches the tracks' timeline across the
// lanes; it stops where a bar fills them.
const TRACK_ZOOMS = [1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128];

function useTracksValue() {
  const { view } = useView();
  const { shift, release } = useShift();
  const { showNotice } = useFeedback();
  const { bpm, barBeats } = useDeviceTransport();
  const { lanes, pickedTrack: track, setFocusIndex, updateTrack } = useLanes();
  const { patternClip } = useSteps();

  // The tracks view's zoom (a step of the zooms that fit) and the beat at
  // the left of its lanes.
  const [zoomStep, setZoomStep] = useState(0);
  const [panFrom, setPanFrom] = useState(0);
  // Each lane's clip at the tempo, on a timeline at least four bars long
  // that ends on the bar after the last lane's last repeat.
  const clips = lanes.map((lane) => clipOf(lane, bpm));
  const fitSpan =
    barBeats *
    Math.max(
      4,
      Math.ceil((patternClip?.length ?? 0) / barBeats),
      ...lanes.map((lane, i) =>
        Math.ceil(
          (lane.start + clips[i].offset + clips[i].length * clips[i].repeats) /
            barBeats,
        ),
      ),
    );
  // While a clip is trimmed (an edge dragged, or Shift turning its knobs)
  // the timeline keeps its length, so the lanes don't rescale under the
  // edit; letting go fits it again.
  const [dragSpan, setDragSpan] = useState<number | null>(null);
  const clipKnobs = view === "tracks" && shift && Boolean(track?.loop?.on);
  const [knobSpan, setKnobSpan] = useState<number | null>(null);
  const [hadClipKnobs, setHadClipKnobs] = useState(clipKnobs);
  if (clipKnobs !== hadClipKnobs) {
    setHadClipKnobs(clipKnobs);
    setKnobSpan(clipKnobs ? fitSpan : null);
  }
  const trackSpan = Math.max(fitSpan, dragSpan ?? 0, knobSpan ?? 0);
  const trackZooms = TRACK_ZOOMS.filter(
    (zoom) => zoom === 1 || trackSpan / zoom >= barBeats,
  );
  const trackZoom = trackZooms[Math.min(zoomStep, trackZooms.length - 1)];
  const trackWindow = trackSpan / trackZoom;
  const trackFrom = Math.min(Math.max(0, panFrom), trackSpan - trackWindow);

  // The picked track's loop while it plays. Shift turns the red and blue
  // knobs over to its edges, a step at a time: red its start, blue its end.
  const trackLoop = track?.loop?.on ? track.loop : null;
  const loopUnit = track ? loopStep(track) : 1;
  const loopReach = track ? takeBeats(track) : 0;

  return {
    clips,
    trackSpan,
    trackZooms,
    trackZoom,
    trackWindow,
    trackFrom,
    // Shift + blue pans the zoomed lanes a beat a step: a bar a step would
    // land each bar line where the last one was, so the grid would look
    // still.
    panSteps: Math.max(2, Math.ceil(trackSpan - trackWindow) + 1),
    panTracks: (beats: number) =>
      setPanFrom(
        Math.min(Math.max(0, trackFrom + beats), trackSpan - trackWindow),
      ),
    scrollTracks: (step: number) =>
      setPanFrom(Math.min(step, trackSpan - trackWindow)),
    // Zooms about the middle of what the lanes show.
    zoomTracks: (step: number) => {
      const zoom = trackZooms[step];
      setZoomStep(step);
      setPanFrom(trackFrom + trackWindow / 2 - trackSpan / zoom / 2);
    },
    resetTimeline: () => {
      setZoomStep(0);
      setPanFrom(0);
    },
    setDragging: (dragging: boolean) =>
      setDragSpan(dragging ? trackSpan : null),
    trackLoop,
    loopUnit,
    loopSteps: Math.max(2, Math.ceil(loopReach / loopUnit) + 1),
    loopLabel: (beats: number) =>
      positionLabel(
        beats,
        track?.timing.meter.beats ?? barBeats,
        track ? gridSteps(track) : 4,
      ),
    // Where a track starts on the timeline, as the footer shows it.
    startLabel: (beats: number) =>
      `Bar ${Math.floor(beats / barBeats) + 1}${
        beats % barBeats ? ` beat ${Math.floor(beats % barBeats) + 1}` : ""
      }`,
    // The arrows slide the picked track along the timeline by bars; Shift
    // and the blue knob slide it by beats. The tape doesn't move.
    slideTrack: (beats: number) => {
      if (!track) return;
      updateTrack(track.id, { start: Math.max(0, track.start + beats) });
    },
    // Shift and the arrows play the picked track once more or once less,
    // back to back: at least once, and for at most an hour.
    repeatTrack: (direction: 1 | -1) => {
      if (!track) return;
      const repeats = Math.min(
        maxRepeats(track, bpm),
        Math.max(1, repeatsOf(track) + direction),
      );
      updateTrack(track.id, { repeats });
    },
    // Dragging a clip's edge trims it to a loop, a grid step at a time
    // (finer than the knobs); it picks that track too.
    dragLoopEdge: (index: number, edge: "start" | "end", beats: number) => {
      const dragged = lanes[index];
      if (!dragged || isTape(dragged)) return;
      const unit = 1 / gridSteps(dragged);
      const reach = takeBeats(dragged);
      const at = Math.min(
        reach,
        Math.max(0, Math.round(takeBeatsAt(dragged, bpm, beats) / unit) * unit),
      );
      // A clip without its loop on trims from the whole take.
      const { start, end } = dragged.loop?.on
        ? dragged.loop
        : { start: 0, end: reach };
      setFocusIndex(index);
      updateTrack(dragged.id, {
        loop:
          edge === "start"
            ? { start: Math.max(0, Math.min(at, end - unit)), end, on: true }
            : { start, end: Math.max(at, start + unit), on: true },
      });
    },
    setLoopEdge: (edge: "start" | "end", step: number) => {
      if (!track || !trackLoop) return;
      const at = Math.min(step * loopUnit, loopReach);
      const { start, end } = trackLoop;
      updateTrack(track.id, {
        loop:
          edge === "start"
            ? { ...trackLoop, start: Math.max(0, Math.min(at, end - loopUnit)) }
            : { ...trackLoop, end: Math.max(at, start + loopUnit) },
      });
    },
    // Clips a track to its loop (the section it plays and repeats) or lets
    // it play whole, keeping the edges; at first the clip spans the whole
    // take.
    toggleClip: (clipped: Track) =>
      updateTrack(clipped.id, {
        loop: clipped.loop
          ? { ...clipped.loop, on: !clipped.loop.on }
          : { start: 0, end: takeBeats(clipped), on: true },
      }),
    // Trims a clipped track for good to its clip, and a latched Shift lets
    // go.
    trimToClip: (clipped: Track) => {
      updateTrack(clipped.id, cutToLoop(clipped, bpm));
      release();
      showNotice(`Trimmed ${clipped.name} to its clip`);
    },
    // A track's mute, or with `solo` its solo. The tape has neither.
    toggleSwitch: (switched: Track, solo: boolean) => {
      if (solo) updateTrack(switched.id, { soloed: !switched.soloed });
      else updateTrack(switched.id, { muted: !switched.muted });
    },
  };
}

export type TracksValue = ReturnType<typeof useTracksValue>;

const [TracksContext, useTracks] =
  createStrictContext<TracksValue>("TracksProvider");
export { useTracks };

// The tracks view's timeline (its span, zoom and pan) and editing the
// tracks on it: sliding, repeating, clipping and trimming, mute and solo.
export function TracksProvider({ children }: { children: ReactNode }) {
  return <TracksContext value={useTracksValue()}>{children}</TracksContext>;
}
