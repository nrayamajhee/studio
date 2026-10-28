import { useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { positionLabel } from "../components/home/deviceMath";
import { MAX_BPM, MIN_BPM } from "../hooks/useTransport";
import {
  DEVICE_PRESETS,
  deviceEngine,
  type DevicePreset,
} from "../components/home/deviceEngine";
import { withModules } from "../components/home/modules";
import {
  clipOf,
  copiesChange,
  cutToLoop,
  followsTape,
  gridSteps,
  loopStep,
  maxRepeats,
  passOf,
  placedCopies,
  settleCopies,
  takeBeats,
  takeBeatsAt,
  trackBpm,
  trackModules,
  type Track,
  type TrackCopy,
} from "../components/home/tracks";
import type { Swing } from "../components/home/swing";
import { createStrictContext } from "./createStrictContext";
import { useFeedback } from "./FeedbackProvider";
import { isTake, useLanes } from "./LanesProvider";
import { useShift } from "./ShiftProvider";
import { useSound } from "./SoundProvider";
import { useDrumGrid } from "./DrumGridProvider";
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
  const {
    lanes,
    tracks,
    focusedLane,
    pickedTrack: track,
    setFocusIndex,
    updateTrack,
  } = useLanes();
  const { patternClip } = useDrumGrid();
  const sound = useSound();

  // The Synth view with a track picked shows and sets the track's own sound:
  // opening it puts the track's instrument and settings on the keys, and
  // each change made there is kept with the track.
  const synthTrack =
    view === "synth" && !isTake(focusedLane) ? focusedLane : null;
  const synthTrackId = synthTrack?.id ?? null;
  const openTrackSound = useEffectEvent(() => {
    const opened = synthTrack;
    if (!opened) return;
    const preset =
      sound.presets.find(({ id }) => id === opened.presetId) ??
      DEVICE_PRESETS.find(({ target }) => target === opened.sound.target);
    if (preset)
      sound.playWith(preset, opened.sound.overrides[opened.sound.target] ?? {});
  });
  useEffect(() => openTrackSound(), [synthTrackId]);
  const keepTrackSound = useEffectEvent(() => {
    const kept = synthTrack;
    if (!kept || sound.preset.id !== kept.presetId) return;
    const { target } = kept.sound;
    const live = deviceEngine.sound().overrides[target] ?? {};
    const own = kept.sound.overrides[target] ?? {};
    const same =
      Object.keys(live).length === Object.keys(own).length &&
      Object.entries(live).every(([id, value]) => own[id] === value);
    if (!same)
      updateTrack(kept.id, {
        sound: {
          ...kept.sound,
          overrides: { ...kept.sound.overrides, [target]: live },
        },
      });
  });
  const soundKey = JSON.stringify(sound.values);
  useEffect(() => keepTrackSound(), [synthTrackId, soundKey]);

  // The tracks view's zoom (a step of the zooms that fit) and the beat at
  // the left of its lanes.
  const [zoomStep, setZoomStep] = useState(0);
  const [panFrom, setPanFrom] = useState(0);
  // Each lane's clip at the tempo, on a timeline at least four bars long
  // that ends on the bar after the last lane's last copy.
  const clips = lanes.map((lane) => clipOf(lane, bpm));
  const fitSpan =
    barBeats *
    Math.max(
      4,
      Math.ceil((patternClip?.length ?? 0) / barBeats),
      ...clips.map(({ copies, offset, length }) => {
        const last = copies[copies.length - 1];
        return Math.ceil(
          (last.start + offset + length * last.repeats) / barBeats,
        );
      }),
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

  // The picked track's copies as they play, and the one its arrows, Shift +
  // green and Delete act on: picked with Shift + ↓ ↑, and the first again
  // whenever another track is picked.
  const [copyPick, setCopyPick] = useState({ id: "", index: 0 });
  const copies = track ? placedCopies(track, bpm) : [];
  const copyIndex =
    track && copyPick.id === track.id
      ? Math.min(copyPick.index, copies.length - 1)
      : 0;
  const copy: TrackCopy | undefined = copies[copyIndex];
  const passBeats = track ? passOf(track, bpm).length / (60_000 / bpm) : 0;
  const copyEnd = ({ start, repeats }: TrackCopy) =>
    start + passBeats * repeats;
  // Keeps the picked track's copies, settled so none overlap: one that
  // grows or slides later pushes those after it along.
  const setCopies = (next: readonly TrackCopy[]) => {
    if (track)
      updateTrack(track.id, copiesChange(settleCopies(next, passBeats)));
  };
  // Moves the picked copy to `start`, but never before the one ahead of it
  // ends (or the timeline starts).
  const moveCopy = (start: number) => {
    if (!copy) return;
    const earliest = copyIndex > 0 ? copyEnd(copies[copyIndex - 1]) : 0;
    setCopies(
      copies.map((other, i) =>
        i === copyIndex
          ? { ...other, start: Math.max(earliest, start) }
          : other,
      ),
    );
  };

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
    // The same in short for the footer: the bar, and the beat after a dot
    // when it isn't the first.
    startShort: (beats: number) =>
      `${Math.floor(beats / barBeats) + 1}${
        beats % barBeats ? `.${Math.floor(beats % barBeats) + 1}` : ""
      }`,
    copies,
    copyIndex,
    copy,
    // The arrows slide the picked copy along the timeline by bars; Shift
    // and the green knob slide it by beats. The take doesn't move.
    slideTrack: (beats: number) => {
      if (copy) moveCopy(copy.start + beats);
    },
    slideTo: moveCopy,
    // Shift and the arrows play the picked copy once more or once less,
    // back to back: at least once, and for at most an hour.
    repeatTrack: (direction: 1 | -1) => {
      if (!track || !copy) return;
      const repeats = Math.min(
        maxRepeats(track, bpm),
        Math.max(1, copy.repeats + direction),
      );
      setCopies(
        copies.map((other, i) =>
          i === copyIndex ? { ...other, repeats } : other,
        ),
      );
    },
    // Shift + ↓ picks the next copy of the picked track, or past the last
    // adds one right after it, repeating as often; Shift + ↑ the one before.
    stepCopy: (direction: 1 | -1) => {
      if (!track || !copy) return;
      if (direction > 0 && copyIndex === copies.length - 1) {
        setCopies([...copies, { start: copyEnd(copy), repeats: copy.repeats }]);
        showNotice(`Copied ${track.name} (${copies.length + 1})`);
      }
      setCopyPick({
        id: track.id,
        index: Math.max(0, copyIndex + direction),
      });
    },
    // A copy clicked in a lane: picks its track, and that copy.
    pickCopy: (index: number, copy: number) => {
      const clicked = lanes[index];
      if (!clicked || isTake(clicked)) return;
      setFocusIndex(index);
      setCopyPick({ id: clicked.id, index: copy });
    },
    // Takes the picked copy out, picking the one before it; the last copy
    // left is the track.
    deleteCopy: () => {
      if (!track || copies.length < 2) return;
      setCopies(copies.filter((_, i) => i !== copyIndex));
      setCopyPick({ id: track.id, index: Math.max(0, copyIndex - 1) });
    },
    // Dragging a clipped track's edge trims its loop, a grid step at a time
    // (finer than the knobs); it picks that track too. A track that isn't
    // clipped has no edges to drag: Clip comes first.
    dragLoopEdge: (index: number, edge: "start" | "end", beats: number) => {
      const dragged = lanes[index];
      if (!dragged || isTake(dragged) || !dragged.loop?.on) return;
      const unit = 1 / gridSteps(dragged);
      const reach = takeBeats(dragged);
      const at = Math.min(
        reach,
        Math.max(0, Math.round(takeBeatsAt(dragged, bpm, beats) / unit) * unit),
      );
      const { start, end } = dragged.loop;
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
    // Sets a track's own tempo, which it plays at from now on: it stops
    // following the tape's.
    setTrackTempo: (tempoed: Track, tempo: number) =>
      updateTrack(tempoed.id, {
        followTape: false,
        timing: {
          ...tempoed.timing,
          bpm: Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(tempo))),
        },
      }),
    // A track's own swing, which it keeps whatever the tape's.
    setTrackSwing: (swung: Track, swing: Swing) =>
      updateTrack(swung.id, { timing: { ...swung.timing, swing } }),
    // Gives every track the same tempo of its own: `tempo`, the tape's.
    setAllTrackTempo: (tempo: number) => {
      for (const each of tracks)
        updateTrack(each.id, {
          followTape: false,
          timing: { ...each.timing, bpm: tempo },
        });
    },
    // Links a track to the tape's tempo, or unlinks it, keeping the speed
    // it plays at now as its own.
    toggleFollowTape: (linked: Track) =>
      updateTrack(
        linked.id,
        followsTape(linked)
          ? {
              followTape: false,
              timing: { ...linked.timing, bpm: trackBpm(linked, bpm) },
            }
          : { followTape: true },
      ),
    // Puts the preset now playing on a track, as it sounds now, through the
    // track's own ADSR, LFO and FX. The take keeps the notes it was played
    // with, and plays them on the new instrument (see trackTake).
    setTrackInstrument: (changed: Track, preset: DevicePreset) =>
      updateTrack(changed.id, {
        name: preset.name,
        presetId: preset.id,
        sound: withModules(deviceEngine.sound(), trackModules(changed)),
        takeTarget: changed.takeTarget ?? changed.sound.target,
      }),
    // A track's mute, or with `solo` its solo. The take has neither.
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
