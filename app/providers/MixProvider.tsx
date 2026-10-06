import { useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { PATCH_BY_ID } from "../lib/physical/patches";
import { foldNote } from "../lib/physical/dsp/math";
import { deviceEngine, isKit, keyPiece } from "../components/home/deviceEngine";
import {
  download,
  mixInto,
  mixToFlac,
  mixToMidi,
  type MidiPart,
  type MixPart,
} from "../components/home/exportMix";
import { barMs, beatMs } from "../components/home/noteRecorder";
import { audible, passOf, startsOf } from "../components/home/tracks";
import { useMixScrub } from "../hooks/useMixScrub";
import { useTrackMix } from "../hooks/useTrackMix";
import { createStrictContext } from "./createStrictContext";
import { useFeedback } from "./FeedbackProvider";
import { isTape, useLanes } from "./LanesProvider";
import { usePerformance } from "./PerformanceProvider";
import { useTracks } from "./TracksProvider";
import { useDeviceTransport } from "./TransportProvider";
import { isModuleView, useView } from "./ViewProvider";

const pad2 = (n: number) => String(n).padStart(2, "0");
const fileName = (now: Date) =>
  `studio-${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}`;

function useMixValue() {
  const { view } = useView();
  const feedback = useFeedback();
  const transport = useDeviceTransport();
  const { releaseAll } = usePerformance();
  const { tracks, focusedLane } = useLanes();
  const { trackSpan } = useTracks();
  const { bpm, timing } = transport;
  // The tape is only an indicator; the mix plays the kept tracks.
  const mix = useTrackMix(tracks, bpm, trackSpan);

  // The mix from `start` to `end` (ms), for scrubbing like a take: each
  // track's rendered pass laid at its starts, at its level, as the mixer
  // plays it. `progress` hears how many of the tracks have rendered (0–1).
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
      const pass = passOf(track, bpm);
      const starts = startsOf(track, pass, bpm, trackSpan);
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

  const midiParts = (): MidiPart[] =>
    tracks
      .filter((track) => audible(track, tracks))
      .map((track) => {
        const pass = passOf(track, bpm);
        const starts = startsOf(track, pass, bpm, trackSpan);
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
              piece: isKit(target) ? keyPiece(target, note.note) : undefined,
            })),
          ),
        };
      });

  // Saves what the tracks play: the mix as lossless FLAC, or its notes as
  // MIDI. The Device freezes while the mix renders.
  const exportMix = async (format: "audio" | "midi") => {
    if (!tracks.some((track) => audible(track, tracks))) {
      feedback.showPrompt("No tracks to save");
      return;
    }
    if (feedback.isBusy()) return;
    const name = fileName(new Date());
    await feedback.whileBusy(async () => {
      try {
        if (format === "midi") {
          download(
            mixToMidi(midiParts(), bpm, timing.meter, isKit),
            `${name}.mid`,
          );
          feedback.showNotice(`Saved ${name}.mid`);
          return;
        }
        mix.pause();
        releaseAll();
        feedback.showProgress(0);
        deviceEngine.unlock();
        const parts = await mixParts((done) => feedback.showProgress(done / 2));
        const rate = parts[0]?.buffer.sampleRate;
        if (!rate) {
          feedback.showPrompt("Couldn't render the mix");
          return;
        }
        const file = await mixToFlac(parts, rate, (done) =>
          feedback.showProgress(0.5 + done / 2),
        );
        download(file, `${name}.flac`);
        feedback.showNotice(`Saved ${name}.flac`);
      } catch {
        feedback.showPrompt("Couldn't save the mix");
      }
    });
  };

  const mixScrub = useMixScrub(
    JSON.stringify([
      bpm,
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
  // Where the mix was last scrubbed to (ms), so the playhead follows it
  // until playback takes over.
  const [scrubbedTo, setScrubbedTo] = useState<number | null>(null);
  const mixBars = Math.max(
    1,
    Math.ceil((trackSpan * beatMs(timing)) / barMs(timing)),
  );
  const mixAt = scrubbedTo ?? (mix.position() ?? 0) * beatMs(timing);
  // The seek knob is continuous in milliseconds, so scrubbing follows the
  // drag rather than snapping to a grid.
  const mixSteps = Math.max(2, Math.round(trackSpan * beatMs(timing)));

  // The mix plays on the tracks view, the album and a track's effects, so
  // each turn of a knob is heard on the track itself, and under a take
  // while it records.
  const mixView =
    view === "tracks" ||
    view === "album" ||
    (isModuleView(view) && !isTape(focusedLane));
  const pauseMix = useEffectEvent(mix.pause);
  useEffect(() => {
    if (!mixView && !transport.recording) pauseMix();
  }, [mixView, transport.recording]);

  const rewind = () => {
    setScrubbedTo(null);
    mix.stop();
  };

  return {
    mixView,
    playing: mix.playing,
    follow: mix.follow,
    exportMix,
    mixBars,
    mixBar: Math.min(mixBars - 1, Math.floor(mixAt / barMs(timing))),
    mixSteps,
    mixStep: Math.min(mixSteps - 1, mixAt),
    scrubMix: (to: number) => {
      mixScrub.scrollTo(to, scrubbedTo ?? 0);
      setScrubbedTo(to);
      // Move the play position too, so Play resumes from where it was
      // scrubbed.
      mix.seek(to / beatMs(timing));
    },
    getTrackPosition: () =>
      scrubbedTo !== null ? scrubbedTo / beatMs(timing) : mix.position(),
    togglePlay: () => {
      setScrubbedTo(null);
      if (mix.playing) {
        mix.pause();
        return;
      }
      transport.pauseTape();
      mix.play();
    },
    // Stops the mix and rewinds it to the very start.
    rewind,
  };
}

export type MixValue = ReturnType<typeof useMixValue>;

const [MixContext, useMix] = createStrictContext<MixValue>("MixProvider");
export { useMix };

// The tracks played together: playing, scrubbing and saving the mix.
export function MixProvider({ children }: { children: ReactNode }) {
  return <MixContext value={useMixValue()}>{children}</MixContext>;
}
