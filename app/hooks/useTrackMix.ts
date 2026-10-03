import { useCallback, useEffect, useRef, useState } from "react";
import { MIX_LEAD } from "../lib/physical/TrackMixer";
import { deviceEngine } from "../components/home/deviceEngine";
import {
  audible,
  passOf,
  startsOf,
  type Track,
} from "../components/home/tracks";

type Mixer = NonNullable<ReturnType<typeof deviceEngine.mixer>>;

// What a track sounds like through the mix: its volume, or silent while
// muted or left out of a solo.
const levelOf = (track: Track, tracks: readonly Track[]) =>
  audible(track, tracks) ? track.volume : 0;

// The loop a track plays, which changes what renders and where it starts.
const loopOf = (track: Track) => (track.loop?.on ? track.loop : null);

// The tracks view's play mode: every track rendered offline with the sound it
// was saved with, then mixed together on the audio clock, looping over a
// timeline `span` beats long at `bpm`. A track renders again only when its
// sound or (on a grid) the tempo changes; volume, mute and solo just move its
// gain. Changing the arrangement while it plays carries on from the same
// place.
export function useTrackMix(
  tracks: readonly Track[],
  bpm: number,
  span: number,
) {
  const [playing, setPlaying] = useState(false);
  const renders = useRef(
    new Map<string, { key: string; buffer: Promise<AudioBuffer | null> }>(),
  );
  const mixer = useRef<Mixer | null>(null);
  // Where Play resumes (beats); a newer play or pause cancels a pending one.
  const paused = useRef(0);
  const run = useRef(0);
  const beatSeconds = useRef(60 / bpm);
  // Whether the mix loops: on the tracks view, not under a recording.
  const looping = useRef(true);

  const render = (track: Track) => {
    const key = [
      JSON.stringify(track.sound),
      track.timing.perBeat > 0 ? bpm : track.take.bpm,
      JSON.stringify(track.take),
      JSON.stringify(loopOf(track)),
    ].join("|");
    const cached = renders.current.get(track.id);
    if (cached?.key === key) return cached.buffer;
    const { length, notes } = passOf(track, bpm);
    const buffer = deviceEngine.render(notes, length, track.sound);
    renders.current.set(track.id, { key, buffer });
    return buffer;
  };

  // `from` is where to start (beats), or, once the tracks have rendered, a
  // function that says where.
  const start = async (
    from: number | ((beat: number) => number),
    loop = true,
  ) => {
    const ticket = ++run.current;
    deviceEngine.unlock();
    const buffers = await Promise.all(tracks.map(render));
    if (ticket !== run.current) return;
    mixer.current ??= deviceEngine.mixer();
    if (!mixer.current) return;
    const beat = 60 / bpm;
    beatSeconds.current = beat;
    const at = typeof from === "function" ? from(beat) : from;
    looping.current = loop;
    mixer.current.play(
      tracks.flatMap((track, i) => {
        const buffer = buffers[i];
        if (!buffer) return [];
        const starts = startsOf(track, passOf(track, bpm), bpm, span);
        return [
          {
            id: track.id,
            buffer,
            starts: starts.map((ms) => ms / 1000),
            gain: levelOf(track, tracks),
          },
        ];
      }),
      span * beat,
      at * beat,
      loop,
    );
  };

  const play = () => {
    setPlaying(true);
    void start(paused.current);
  };

  // Plays the timeline once through from the top at `origin`
  // (performance.now ms), so a take recorded from then lines up with it. If
  // the tracks are still rendering it joins late, already in step.
  const follow = (origin: number) => {
    paused.current = 0;
    setPlaying(true);
    void start(
      (beat) =>
        Math.max(
          0,
          (performance.now() + MIX_LEAD * 1000 - origin) / 1000 / beat,
        ),
      false,
    );
  };

  // Holds the mix where it is, so Play resumes there.
  const pause = useCallback(() => {
    run.current++;
    const at = mixer.current?.stop();
    if (at !== undefined) paused.current = at / beatSeconds.current;
    setPlaying(false);
  }, []);

  // Stops and rewinds to the top, so Play starts over.
  const stop = useCallback(() => {
    run.current++;
    mixer.current?.stop();
    paused.current = 0;
    setPlaying(false);
  }, []);

  // Where the mix is (beats); read every frame. Stopped, it holds the paused
  // position so the playhead stays put instead of disappearing.
  const position = useCallback(() => {
    const at = mixer.current?.position();
    return at == null ? paused.current : at / beatSeconds.current;
  }, []);

  const arrangement = JSON.stringify([
    bpm,
    span,
    tracks.map((track) => [
      track.id,
      track.start,
      track.sound,
      loopOf(track),
      track.repeats,
    ]),
  ]);
  const levels = JSON.stringify(tracks.map((track) => levelOf(track, tracks)));

  // Restart from the same place, looping or not as before, when the
  // arrangement changes under it (not when it starts playing).
  const restart = useRef(start);
  const isPlaying = useRef(playing);
  useEffect(() => {
    restart.current = start;
    isPlaying.current = playing;
  });
  useEffect(() => {
    if (!isPlaying.current) return;
    const at = mixer.current?.position();
    if (at != null)
      void restart.current(at / beatSeconds.current, looping.current);
  }, [arrangement]);

  const current = useRef(tracks);
  useEffect(() => {
    current.current = tracks;
  });
  useEffect(() => {
    for (const track of current.current)
      mixer.current?.setGain(track.id, levelOf(track, current.current));
  }, [levels]);

  useEffect(() => () => void mixer.current?.stop(), []);

  // Moves the play position (beats) without starting, so Play begins there;
  // while it plays, it carries on from the new place.
  const seek = useCallback((beat: number) => {
    paused.current = Math.max(0, beat);
    if (isPlaying.current)
      void restart.current(paused.current, looping.current);
  }, []);

  // One pass of a track as the mix plays it, rendered once and cached; the
  // scrubbed mix is built from these too.
  return {
    playing,
    play,
    follow,
    pause,
    stop,
    seek,
    position,
    renderPass: render,
  };
}
