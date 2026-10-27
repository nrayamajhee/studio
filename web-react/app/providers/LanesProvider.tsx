import { useEffect, useState, type ReactNode } from "react";
import { deviceEngine } from "../components/home/deviceEngine";
import { meterIndexOf } from "../components/home/deviceMath";
import { applyModules, type ModuleSettings } from "../components/home/modules";
import type { ModuleId } from "../components/home/deviceEngine";
import {
  setPattern,
  setTake,
  setTakeModules,
  setTracks,
  useSession,
  type Tape,
} from "../components/home/sessionStore";
import {
  modulesChange,
  trackModules,
  trackTake,
  type Track,
} from "../components/home/tracks";
import { createStrictContext } from "./createStrictContext";
import { useSound } from "./SoundProvider";
import { useDeviceTransport } from "./TransportProvider";
import { useView } from "./ViewProvider";

// The take, shown on the tracks view as a potential track.
export const TAKE_ID = "session-take";
export const isTake = (lane: Track) => lane.id === TAKE_ID;

function useLanesValue() {
  const { view } = useView();
  const transport = useDeviceTransport();
  const { preset, presets, selectPreset } = useSound();
  const {
    take,
    modules: takeModules,
    pattern: drumPattern,
    tapes,
    tape,
    tracks,
  } = useSession();
  // The open tape, whose tracks the tracks view shows.
  const tapeIndex = Math.max(
    0,
    tapes.findIndex(({ id }) => id === tape),
  );
  // The lane the blue knob picked, kept across views so the roll edits the
  // picked track; the piano roll and the drum grid start on the take.
  const [focusIndex, setFocusIndex] = useState(0);
  const [focusView, setFocusView] = useState(view);
  if (view !== focusView) {
    setFocusView(view);
    if (view === "roll" || view === "drumGrid") setFocusIndex(0);
  }

  // The take as a potential track, named for the
  // instrument playing now. It has no mute or solo.
  const takeLane: Track = {
    id: TAKE_ID,
    name: "Take",
    color: "#f4f3ef",
    presetId: preset.id,
    sound: deviceEngine.sound(),
    take: take ?? { notes: [], length: 0, bpm: transport.bpm },
    timing: transport.timing,
    start: 0,
    volume: 1,
    muted: false,
    soloed: false,
  };
  const lanes: readonly Track[] = [takeLane, ...tracks];
  const focusedLane = lanes[Math.min(focusIndex, lanes.length - 1)];
  // The tracks view's pick, and the track it is (the take isn't one).
  const pickedLane = view === "tracks" ? focusedLane : undefined;
  const pickedTrack =
    pickedLane && !isTake(pickedLane) ? pickedLane : undefined;

  // The focused lane's ADSR, LFO and FX, the take's or a track's own: the
  // live sound plays through them and the module knobs set them, a track's
  // in place (it renders again through them).
  const modules = isTake(focusedLane) ? takeModules : trackModules(focusedLane);
  const modulesKey = JSON.stringify(modules);
  useEffect(() => applyModules(JSON.parse(modulesKey)), [modulesKey]);

  const updateTrack = (id: string, change: Partial<Track>) =>
    setTracks((current) =>
      current.map((candidate) =>
        candidate.id === id ? { ...candidate, ...change } : candidate,
      ),
    );
  const setModules = (next: ModuleSettings) => {
    if (isTake(focusedLane)) setTakeModules(next);
    else updateTrack(focusedLane.id, modulesChange(focusedLane, next));
  };

  return {
    take,
    takeModules,
    drumPattern,
    tapes,
    tape,
    tapeIndex,
    currentTape: tapes[tapeIndex] as Tape | undefined,
    tracks,
    lanes,
    focusIndex,
    setFocusIndex,
    focusedLane,
    pickedLane,
    pickedTrack,
    // ↑ and ↓ on the tracks pick the row above or below, like the blue knob.
    stepFocus: (direction: 1 | -1) =>
      setFocusIndex((index) =>
        Math.max(0, Math.min(lanes.length - 1, index + direction)),
      ),
    modules,
    modulesKey,
    modulesOwner: isTake(focusedLane) ? "Take" : focusedLane.name,
    setModules,
    // Turning a module's knob switches the module on so the change is
    // audible.
    setModuleStep: (id: ModuleId, index: number, step: number) =>
      setModules({
        on: { ...modules.on, [id]: true },
        steps: {
          ...modules.steps,
          [id]: modules.steps[id].map((value, i) =>
            i === index ? step : value,
          ),
        },
      }),
    toggleModule: (id: ModuleId) =>
      setModules({ ...modules, on: { ...modules.on, [id]: !modules.on[id] } }),
    updateTrack,
    // A kept take or pattern joins the tape as its last track, picked.
    addTrack: (track: Track) => {
      setTracks((current) => [...current, track]);
      setFocusIndex(tracks.length + 1);
    },
    deleteTrack: (id: string) => {
      setTracks((current) =>
        current.filter((candidate) => candidate.id !== id),
      );
      setFocusIndex((index) => Math.max(0, Math.min(index, lanes.length - 2)));
    },
    // Loads a track as the take, with its instrument, effects and time
    // signature, so the roll shows and plays it as the track does;
    // saving the take then adds it as a new track, leaving the old one be.
    loadTake: (track: Track) => {
      const own = presets.find(({ id }) => id === track.presetId);
      if (own && own.id !== preset.id) selectPreset(own);
      // The take holds just the track: its drum pattern is cleared too.
      setTake(trackTake(track));
      setPattern((current) => ({ ...current, hits: [] }));
      setTakeModules(trackModules(track));
      transport.setMeter(meterIndexOf(track.timing.meter));
    },
    discardTake: () => {
      setTake(null);
      setPattern((current) => ({ ...current, hits: [] }));
    },
  };
}

export type LanesValue = ReturnType<typeof useLanesValue>;

const [LanesContext, useLanes] =
  createStrictContext<LanesValue>("LanesProvider");
export { useLanes };

// The session as lanes: the take (with its pattern and modules) and the open
// tape's tracks, one of them focused, whose modules the live sound plays
// through and the module knobs set.
export function LanesProvider({ children }: { children: ReactNode }) {
  return <LanesContext value={useLanesValue()}>{children}</LanesContext>;
}
