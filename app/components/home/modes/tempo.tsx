import { ArrowUp, Pointer } from "lucide-react";
import { MAX_BPM, MIN_BPM } from "../../../hooks/useTransport";
import { meterLabel } from "../noteRecorder";
import { arrowPads, seekKnob } from "./base";
import type { Mode } from "../../../types/bindings";

// The tempo: the green knob and the arrows set it, a beat per minute at a
// time, as does dragging the number on the screen, or clicking it to type
// one; ↓ (between Slower and Faster) switches tap mode, where played notes
// tap the tempo.
export const tempoMode: Mode = (device) => {
  const { transport } = device;
  const { bpm, setBpm, tapMode, tapCount, barBeats } = transport;
  return {
    knobs: {
      green: seekKnob(
        `${bpm} BPM`,
        bpm - MIN_BPM,
        MAX_BPM - MIN_BPM + 1,
        (step) => setBpm(MIN_BPM + step),
      ),
    },
    pads: {
      ...arrowPads(device, ["Slower", "Faster"], (direction) =>
        setBpm(bpm + direction),
      ),
      // ↓ has a job of its own here, so ↑ leaves the octave alone.
      up: { label: "Up", icon: <ArrowUp />, onPress: () => {} },
      down: {
        label: tapMode ? "Stop tap tempo" : "Tap tempo",
        icon: <Pointer />,
        lit: tapMode,
        onPress: () => {
          if (transport.tapping) transport.stopTapping();
          else transport.startTapping();
        },
      },
    },
    screen: {
      title: "Tempo",
      unsaved: false,
      status: meterLabel(transport.timing.meter),
      timing: transport.timing,
      onBpm: setBpm,
      beat: tapMode
        ? tapCount > 0
          ? (tapCount - 1) % barBeats
          : null
        : transport.beat,
      badge: tapMode
        ? { label: "Tap a note" }
        : { label: "Metronome", on: transport.metronome },
    },
  };
};
