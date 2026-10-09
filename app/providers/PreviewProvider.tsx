import { useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { findPreset, isKit } from "../components/home/deviceEngine";
import type { Take } from "../components/home/noteRecorder";
import { usePreviewTape, type PreviewSound } from "../hooks/usePreviewTape";
import { createStrictContext } from "./createStrictContext";
import { useMix } from "./MixProvider";
import { useSound } from "./SoundProvider";
import { useSteps } from "./StepsProvider";
import { useDeviceTransport } from "./TransportProvider";
import { useView } from "./ViewProvider";

function usePreviewValue() {
  const { view } = useView();
  const transport = useDeviceTransport();
  const steps = useSteps();
  const mix = useMix();
  const { preset } = useSound();
  const tape = usePreviewTape();
  // The preview held, playing or paused: what it was played as, where Play
  // picks it up (s), and whether it plays on the keys' instrument.
  const [cued, setCued] = useState<{
    id: string;
    at: number;
    onKeys: boolean;
  } | null>(null);

  // The instrument the keys play, which a preview of notes follows as it
  // changes. A kit would play the notes as drums, so they're heard on the
  // piano.
  const { target, octave } = isKit(preset.target)
    ? findPreset("piano")
    : preset;
  const keysSound: PreviewSound = { target, octave };
  const followKeys = useEffectEvent(() => {
    if (cued?.onKeys) tape.setSound(keysSound);
  });
  useEffect(() => followKeys(), [target, octave]);

  const pause = () => {
    const at = tape.stop();
    if (at !== null) setCued((held) => held && { ...held, at });
  };
  const stop = () => {
    tape.stop();
    setCued(null);
  };

  // A preview belongs to the view that played it: leaving stops it.
  const stopOnLeave = useEffectEvent(stop);
  useEffect(() => () => stopOnLeave(), [view]);

  return {
    playing: tape.playing,
    // The id of the preview held, playing or paused.
    cued: cued?.id ?? null,
    // Plays `take` as `id` on `sound`, or without one on the keys'
    // instrument: from where it paused if it is the one held, else from the
    // top. One thing plays at a time, so it pauses the tape, the sequencer
    // and the tracks; and not while a take records, which would hear it.
    play: (id: string, take: Take, sound?: PreviewSound) => {
      if (transport.recording) return;
      transport.pauseTape();
      if (steps.stepsRunning) steps.stopSteps();
      mix.pause();
      const from = cued?.id === id ? cued.at : 0;
      tape.play(take, sound ?? keysSound, from);
      // Played through, it starts from the top again.
      setCued({ id, at: 0, onKeys: !sound });
    },
    pause,
    stop,
  };
}

export type PreviewValue = ReturnType<typeof usePreviewValue>;

const [PreviewContext, usePreview] =
  createStrictContext<PreviewValue>("PreviewProvider");
export { usePreview };

// The hidden tape the pickers audition on: a progression on the keys'
// instrument, switching as it does, or a beat on its kit; played once
// through, never on the tape or the tracks, and paused and picked up again
// with Play.
export function PreviewProvider({ children }: { children: ReactNode }) {
  return <PreviewContext value={usePreviewValue()}>{children}</PreviewContext>;
}
