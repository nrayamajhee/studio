import { useEffect, useState, type ReactNode } from "react";
import { deviceEngine } from "../components/home/deviceEngine";
import { meterIndexOf } from "../components/home/deviceMath";
import { applyModules, type ModuleSettings } from "../components/home/modules";
import type { ModuleId } from "../components/home/deviceEngine";
import { SUBDIVISIONS } from "../components/home/noteRecorder";
import {
  setSteps,
  setTake,
  setTakeModules,
  setTracks,
  useSession,
  type Song,
} from "../components/home/sessionStore";
import {
  modulesChange,
  trackModules,
  type Track,
} from "../components/home/tracks";
import { createStrictContext } from "./createStrictContext";
import { useSound } from "./SoundProvider";
import { useDeviceTransport } from "./TransportProvider";
import { useView } from "./ViewProvider";

// The tape, shown on the tracks view as a potential track.
export const TAPE_ID = "session-take";
export const isTape = (lane: Track) => lane.id === TAPE_ID;

function useLanesValue() {
  const { view } = useView();
  const transport = useDeviceTransport();
  const { preset, presets, selectPreset } = useSound();
  const {
    take,
    modules: tapeModules,
    steps: stepPattern,
    songs,
    song,
    tracks,
  } = useSession();
  // The album: the open song, whose tracks the tracks view shows.
  const songIndex = Math.max(
    0,
    songs.findIndex(({ id }) => id === song),
  );
  // The lane the blue knob picked, kept across views so the roll edits the
  // picked track; the tape and the sequencer start on the tape.
  const [focusIndex, setFocusIndex] = useState(0);
  const [focusView, setFocusView] = useState(view);
  if (view !== focusView) {
    setFocusView(view);
    if (view === "roll" || view === "steps") setFocusIndex(0);
  }

  // The tape as a potential track: the current take, named for the
  // instrument playing now. It has no mute or solo.
  const tapeLane: Track = {
    id: TAPE_ID,
    name: "Tape",
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
  const lanes: readonly Track[] = [tapeLane, ...tracks];
  const focusedLane = lanes[Math.min(focusIndex, lanes.length - 1)];
  // The tracks view's pick, and the track it is (the tape isn't one).
  const pickedLane = view === "tracks" ? focusedLane : undefined;
  const pickedTrack =
    pickedLane && !isTape(pickedLane) ? pickedLane : undefined;

  // The focused lane's ADSR, LFO and FX, the tape's or a track's own: the
  // live sound plays through them and the module knobs set them, a track's
  // in place (it renders again through them).
  const modules = isTape(focusedLane) ? tapeModules : trackModules(focusedLane);
  const modulesKey = JSON.stringify(modules);
  useEffect(() => applyModules(JSON.parse(modulesKey)), [modulesKey]);

  const updateTrack = (id: string, change: Partial<Track>) =>
    setTracks((current) =>
      current.map((candidate) =>
        candidate.id === id ? { ...candidate, ...change } : candidate,
      ),
    );
  const setModules = (next: ModuleSettings) => {
    if (isTape(focusedLane)) setTakeModules(next);
    else updateTrack(focusedLane.id, modulesChange(focusedLane, next));
  };

  return {
    take,
    tapeModules,
    stepPattern,
    songs,
    song,
    songIndex,
    currentSong: songs[songIndex] as Song | undefined,
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
    modulesOwner: isTape(focusedLane) ? "Tape" : focusedLane.name,
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
    // A kept take or pattern joins the song as its last track, picked.
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
    // Loads a track onto the tape, with its instrument, effects, time
    // signature and grid, so the roll shows and plays it as the track does;
    // saving the tape then adds it as a new track, leaving the old one be.
    loadOntoTape: (track: Track) => {
      const own = presets.find(({ id }) => id === track.presetId);
      if (own && own.id !== preset.id) selectPreset(own);
      // The tape holds just the track: its drum pattern is cleared too.
      setTake(track.take);
      setSteps((current) => ({ ...current, hits: [] }));
      setTakeModules(trackModules(track));
      transport.setMeter(meterIndexOf(track.timing.meter));
      transport.setGrid(
        Math.max(0, SUBDIVISIONS.indexOf(track.timing.perBeat)),
      );
    },
    discardTape: () => {
      setTake(null);
      setSteps((current) => ({ ...current, hits: [] }));
    },
  };
}

export type LanesValue = ReturnType<typeof useLanesValue>;

const [LanesContext, useLanes] =
  createStrictContext<LanesValue>("LanesProvider");
export { useLanes };

// The session as lanes: the tape (the take and its modules) and the open
// song's tracks, one of them focused, whose modules the live sound plays
// through and the module knobs set.
export function LanesProvider({ children }: { children: ReactNode }) {
  return <LanesContext value={useLanesValue()}>{children}</LanesContext>;
}
