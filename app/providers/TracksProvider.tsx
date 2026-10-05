import { createContext, useContext, useState, type ReactNode } from "react";
import { PATCH_BY_ID } from "../lib/physical/patches";
import { foldNote } from "../lib/physical/dsp/math";
import type { ScreenTrack } from "../components/home/DeviceScreen";
import { deviceEngine, isKit, keyPiece } from "../components/home/deviceEngine";
import {
  download,
  mixInto,
  mixToFlac,
  mixToMidi,
  type MidiPart,
  type MixPart,
} from "../components/home/exportMix";
import {
  barMs,
  beatMs,
  positionLabel,
} from "../components/home/noteRecorder";
import { patternTake } from "../components/home/stepPattern";
import { setTracks, useSession } from "../components/home/sessionStore";
import {
  audible,
  clipOf,
  cutToLoop,
  gridSteps,
  loopStep,
  maxRepeats,
  passOf,
  repeatsOf,
  startsOf,
  takeBeats,
  takeBeatsAt,
  type Track,
} from "../components/home/tracks";
import { useMixScrub } from "../hooks/useMixScrub";
import { useTrackMix } from "../hooks/useTrackMix";
import { useFeedback } from "./FeedbackProvider";
import { usePerformance } from "./PerformanceProvider";
import { useSequencer } from "./SequencerProvider";
import { useSound } from "./SoundProvider";
import { useTransportContext } from "./TransportProvider";
import { useView } from "./ViewProvider";

// The take shown as a potential track on the tracks view.
export const TAKE_ID = "session-take";

// How many times Shift + red stretches the tracks' timeline across the lanes;
// it stops where a bar fills them.
const TRACK_ZOOMS = [1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128];

interface TracksValue {
  entries: readonly Track[];
  takeTrack: Track;
  picked: Track | undefined;
  pickedEntry: Track;
  isTake: boolean;
  track: Track | undefined;
  selectedIndex: number;
  setSelectedIndex: (change: number | ((current: number) => number)) => void;
  setPanFrom: (pan: number) => void;
  clips: ReturnType<typeof clipOf>[];
  trackSpan: number;
  trackZoom: number;
  trackFrom: number;
  trackZooms: readonly number[];
  trackWindow: number;
  panSteps: number;
  dragSpan: number | null;
  setDragSpan: (span: number | null) => void;
  mixScrubPos: number | null;
  setMixScrubPos: (pos: number | null) => void;
  mix: ReturnType<typeof useTrackMix>;
  mixScrub: ReturnType<typeof useMixScrub>;
  mixAt: number;
  mixBars: number;
  mixStep: number;
  mixSteps: number;
  trackLoop: Track["loop"] | null;
  loopUnit: number;
  loopSteps: number;
  screenTracks: readonly ScreenTrack[];
  panTracks: (beats: number) => void;
  zoomTracks: (step: number) => void;
  updateTrack: (id: string, change: Partial<Track>) => void;
  slideTrack: (beats: number) => void;
  repeatTrack: (direction: 1 | -1) => void;
  setLoopEdge: (edge: "start" | "end", step: number) => void;
  dragLoopEdge: (index: number, edge: "start" | "end", beats: number) => void;
  toggleClip: (clipped: Track) => void;
  trimToClip: (clipped: Track) => void;
  pressLoop: (looping: Track) => void;
  pressTrackSwitch: (solo?: boolean) => void;
  scrubMix: (to: number) => void;
  exportMix: (format: "audio" | "midi") => Promise<void>;
  leaveSong: () => void;
  startLabel: (beats: number) => string;
  loopLabel: (beats: number) => string;
}

const TracksContext = createContext<TracksValue | null>(null);

export function TracksProvider({ children }: { children: ReactNode }) {
  const { view } = useView();
  const transport = useTransportContext();
  const { preset, presets } = useSound();
  const { shift, held, setLitNotes } = usePerformance();
  const { stepKit } = useSequencer();
  const {
    showNotice,
    showPrompt,
    showSaving,
    setSaving,
    exportingRef,
  } = useFeedback();
  const { take, steps: stepPattern, tracks } = useSession();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [zoomStep, setZoomStep] = useState(0);
  const [panFrom, setPanFrom] = useState(0);

  const barBeats = transport.timing.meter.beats;

  // The take as a potential track: the current take, named for the instrument
  // playing now. It has no mute or solo.
  const takeTrack: Track = {
    id: TAKE_ID,
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
  const entries: readonly Track[] = [takeTrack, ...tracks];
  // The picked row, kept across views so the roll edits the picked track.
  const pickedEntry = entries[Math.min(selectedIndex, entries.length - 1)];
  const picked = view === "tracks" ? pickedEntry : undefined;
  const isTake = picked?.id === TAKE_ID;
  const track = picked && !isTake ? picked : undefined;

  // Each entry's clip at the tempo, on a timeline at least four bars long
  // that ends on the bar after the last entry's last repeat.
  const clips = entries.map((candidate) => clipOf(candidate, transport.bpm));
  // The drum pattern, drawn on the tape's row over the take.
  const patternClip = (() => {
    if (stepPattern.hits.length === 0) return undefined;
    const beat = 60_000 / transport.bpm;
    const drawn = patternTake(
      stepPattern,
      stepKit ?? "drums",
      transport.timing.meter,
      transport.bpm,
    );
    return {
      length: drawn.length / beat,
      offset: 0,
      repeats: 1,
      looped: false,
      notes: drawn.notes.map(({ note, start, duration }) => ({
        note,
        start: start / beat,
        length: duration / beat,
      })),
    };
  })();
  const fitSpan =
    barBeats *
    Math.max(
      4,
      Math.ceil((patternClip?.length ?? 0) / barBeats),
      ...entries.map((candidate, i) =>
        Math.ceil(
          (candidate.start +
            clips[i].offset +
            clips[i].length * clips[i].repeats) /
            barBeats,
        ),
      ),
    );
  // While a clip is trimmed (an edge dragged, or Shift turning its knobs) the
  // timeline keeps its length, so the lanes don't rescale under the edit.
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
  const panTracks = (beats: number) =>
    setPanFrom(
      Math.min(Math.max(0, trackFrom + beats), trackSpan - trackWindow),
    );
  // Zooms about the middle of what the lanes show.
  const zoomTracks = (step: number) => {
    const zoom = trackZooms[step];
    setZoomStep(step);
    setPanFrom(trackFrom + trackWindow / 2 - trackSpan / zoom / 2);
  };
  // Shift + blue pans the zoomed lanes a beat a step.
  const panSteps = Math.max(2, Math.ceil(trackSpan - trackWindow) + 1);

  // The take is only an indicator; the mix plays the kept tracks.
  const mix = useTrackMix(tracks, transport.bpm, trackSpan);
  const mixParts = async (
    progress?: (done: number) => void,
  ): Promise<MixPart[]> => {
    const heard = tracks.filter((track) => audible(track, tracks));
    let rendered = 0;
    const passes = await Promise.all(
      heard.map(async (track) => {
        const buffer = await mix.renderPass(track);
        progress?.(++rendered / heard.length);
        return buffer;
      }),
    );
    return heard.flatMap((track, t) => {
      const buffer = passes[t];
      if (!buffer || track.volume === 0) return [];
      const pass = passOf(track, transport.bpm);
      const starts = startsOf(track, pass, transport.bpm, trackSpan);
      return [{ buffer, starts, level: track.volume }];
    });
  };
  const renderMix = async (start: number, end: number) => {
    const parts = await mixParts();
    const rate = parts[0]?.buffer.sampleRate;
    if (!rate) return null;
    const out = new AudioBuffer({
      numberOfChannels: 2,
      length: Math.ceil(((end - start) * rate) / 1000),
      sampleRate: rate,
    });
    mixInto(parts, start, out.getChannelData(0), out.getChannelData(1), rate);
    return out;
  };

  // Save on the tracks downloads what they play: the mix as lossless FLAC,
  // or with Shift its notes as MIDI.
  const exportMix = async (format: "audio" | "midi") => {
    if (!tracks.some((track) => audible(track, tracks))) {
      showPrompt("No tracks to save");
      return;
    }
    if (exportingRef.current) return;
    exportingRef.current = true;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const name = `studio-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    try {
      if (format === "midi") {
        const parts: MidiPart[] = tracks
          .filter((track) => audible(track, tracks))
          .map((track) => {
            const pass = passOf(track, transport.bpm);
            const starts = startsOf(track, pass, transport.bpm, trackSpan);
            const { target, octave } = track.sound;
            const [low, high] = PATCH_BY_ID[target].range;
            return {
              name: track.name,
              target,
              volume: track.volume,
              notes: starts.flatMap((at) =>
                pass.notes.map((note) => ({
                  ...note,
                  start: note.start + at,
                  note: isKit(target)
                    ? note.note
                    : foldNote(note.note + octave, low, high),
                  piece: isKit(target)
                    ? keyPiece(target, note.note)
                    : undefined,
                })),
              ),
            };
          });
        download(
          mixToMidi(parts, transport.bpm, transport.timing.meter, isKit),
          `${name}.mid`,
        );
        showNotice(`Saved ${name}.mid`);
        return;
      }
      mix.pause();
      for (const entry of held.current.values()) entry.stop();
      held.current.clear();
      deviceEngine.allNotesOff();
      setLitNotes(new Set());
      showSaving(0);
      deviceEngine.unlock();
      const parts = await mixParts((done) => showSaving(done / 2));
      const rate = parts[0]?.buffer.sampleRate;
      if (!rate) {
        showPrompt("Couldn't render the mix");
        return;
      }
      const file = await mixToFlac(parts, rate, (done) =>
        showSaving(0.5 + done / 2),
      );
      download(file, `${name}.flac`);
      showNotice(`Saved ${name}.flac`);
    } catch {
      showPrompt("Couldn't save the mix");
    } finally {
      exportingRef.current = false;
      setSaving(null);
    }
  };
  const mixScrub = useMixScrub(
    JSON.stringify([
      transport.bpm,
      trackSpan,
      tracks.map((track) => [
        track.id,
        track.start,
        track.sound,
        track.take,
        track.loop?.on ? track.loop : null,
        track.repeats,
        audible(track, tracks) ? track.volume : 0,
      ]),
    ]),
    renderMix,
  );
  // Where the mix was last scrubbed to (ms), so the playhead follows it until
  // playback takes over.
  const [mixScrubPos, setMixScrubPos] = useState<number | null>(null);
  const scrubMix = (to: number) => {
    mixScrub.scrollTo(to, mixScrubPos ?? 0);
    setMixScrubPos(to);
    // Move the play position too, so Play resumes from where it was scrubbed.
    mix.seek(to / beatMs(transport.timing));
  };
  const mixBars = Math.max(
    1,
    Math.ceil((trackSpan * beatMs(transport.timing)) / barMs(transport.timing)),
  );
  const mixAt = mixScrubPos ?? (mix.position() ?? 0) * beatMs(transport.timing);
  // The seek knob is continuous in milliseconds, so scrubbing follows the
  // drag rather than snapping to a grid.
  const mixSteps = Math.max(
    2,
    Math.round(trackSpan * beatMs(transport.timing)),
  );
  const mixStep = Math.min(mixSteps - 1, mixAt);

  const updateTrack = (id: string, change: Partial<Track>) =>
    setTracks((current) =>
      current.map((candidate) =>
        candidate.id === id ? { ...candidate, ...change } : candidate,
      ),
    );

  // Where a track starts on the timeline, as the footer shows it.
  const startLabel = (beats: number) =>
    `Bar ${Math.floor(beats / barBeats) + 1}${
      beats % barBeats ? ` beat ${Math.floor(beats % barBeats) + 1}` : ""
    }`;

  // The arrows slide the picked track along the timeline by bars; Shift and
  // the blue knob slide it by beats. The take doesn't move.
  const slideTrack = (beats: number) => {
    if (!track) return;
    updateTrack(track.id, { start: Math.max(0, track.start + beats) });
  };

  // Shift and the arrows play the picked track once more or once less.
  const repeatTrack = (direction: 1 | -1) => {
    if (!track) return;
    const repeats = Math.min(
      maxRepeats(track, transport.bpm),
      Math.max(1, repeatsOf(track) + direction),
    );
    updateTrack(track.id, { repeats });
  };

  // The picked track's loop while it plays.
  const trackLoop = track?.loop?.on ? track.loop : null;
  const loopUnit = track ? loopStep(track) : 1;
  const loopReach = track ? takeBeats(track) : 0;
  const loopSteps = Math.max(2, Math.ceil(loopReach / loopUnit) + 1);
  const loopLabel = (beats: number) =>
    positionLabel(
      beats,
      track?.timing.meter.beats ?? barBeats,
      track ? gridSteps(track) : 4,
    );
  // Dragging a clip's edge trims it to a loop, a grid step at a time.
  const dragLoopEdge = (
    index: number,
    edge: "start" | "end",
    beats: number,
  ) => {
    const dragged = entries[index];
    if (!dragged || dragged.id === TAKE_ID) return;
    const unit = 1 / gridSteps(dragged);
    const reach = takeBeats(dragged);
    const at = Math.min(
      reach,
      Math.max(
        0,
        Math.round(takeBeatsAt(dragged, transport.bpm, beats) / unit) * unit,
      ),
    );
    const { start, end } = dragged.loop?.on
      ? dragged.loop
      : { start: 0, end: reach };
    setSelectedIndex(index);
    updateTrack(dragged.id, {
      loop:
        edge === "start"
          ? { start: Math.max(0, Math.min(at, end - unit)), end, on: true }
          : { start, end: Math.max(at, start + unit), on: true },
    });
  };
  const setLoopEdge = (edge: "start" | "end", step: number) => {
    if (!track || !trackLoop) return;
    const at = Math.min(step * loopUnit, loopReach);
    const { start, end } = trackLoop;
    updateTrack(track.id, {
      loop:
        edge === "start"
          ? { ...trackLoop, start: Math.max(0, Math.min(at, end - loopUnit)) }
          : { ...trackLoop, end: Math.max(at, start + loopUnit) },
    });
  };

  // On the tracks the Record pad clips the picked track to its loop or lets it
  // play whole; with Shift, while it is clipped, it trims it for good.
  const toggleClip = (clipped: Track) =>
    updateTrack(clipped.id, {
      loop: clipped.loop
        ? { ...clipped.loop, on: !clipped.loop.on }
        : { start: 0, end: takeBeats(clipped), on: true },
    });
  const trimToClip = (clipped: Track) => {
    updateTrack(clipped.id, cutToLoop(clipped, transport.bpm));
    showNotice(`Trimmed ${clipped.name} to its clip`);
  };

  const pressLoop = (looping: Track) => {
    if (!shift) toggleClip(looping);
    else if (looping.loop?.on) trimToClip(looping);
    else showPrompt(`Clip ${looping.name} first`);
  };

  // The picked track's mute, and with Shift its solo. The take has neither.
  const pressTrackSwitch = (solo = shift) => {
    if (!track) return;
    if (solo) updateTrack(track.id, { soloed: !track.soloed });
    else updateTrack(track.id, { muted: !track.muted });
  };

  // Leaving a song stops its mix and puts the tracks view back at its start.
  const leaveSong = () => {
    mix.stop();
    setMixScrubPos(null);
    setSelectedIndex(0);
    setZoomStep(0);
    setPanFrom(0);
  };

  const screenTracks =
    view === "tracks"
      ? entries.map((candidate, i) => ({
          id: candidate.id,
          name: candidate.name,
          detail:
            presets.find(({ id }) => id === candidate.presetId)?.name ?? "",
          color: candidate.color,
          start: candidate.start,
          clip: clips[i],
          volume: candidate.volume,
          muted: candidate.muted,
          soloed: candidate.soloed,
          audible: candidate.id === TAKE_ID ? true : audible(candidate, tracks),
          potential: candidate.id === TAKE_ID,
          pattern: candidate.id === TAKE_ID ? patternClip : undefined,
        }))
      : [];

  const value: TracksValue = {
    entries,
    takeTrack,
    picked,
    pickedEntry,
    isTake,
    track,
    selectedIndex,
    setSelectedIndex,
    setPanFrom,
    clips,
    trackSpan,
    trackZoom,
    trackFrom,
    trackZooms,
    trackWindow,
    panSteps,
    dragSpan,
    setDragSpan,
    mixScrubPos,
    setMixScrubPos,
    mix,
    mixScrub,
    mixAt,
    mixBars,
    mixStep,
    mixSteps,
    trackLoop,
    loopUnit,
    loopSteps,
    screenTracks,
    panTracks,
    zoomTracks,
    updateTrack,
    slideTrack,
    repeatTrack,
    setLoopEdge,
    dragLoopEdge,
    toggleClip,
    trimToClip,
    pressLoop,
    pressTrackSwitch,
    scrubMix,
    exportMix,
    leaveSong,
    startLabel,
    loopLabel,
  };

  return <TracksContext.Provider value={value}>{children}</TracksContext.Provider>;
}

export function useTracks() {
  const context = useContext(TracksContext);
  if (!context) throw new Error("Wrap the Device in a TracksProvider");
  return context;
}
