import { ArrowUp, Link2, Link2Off, Pointer } from "lucide-react";
import { MAX_BPM, MIN_BPM } from "../../../hooks/useTransport";
import { isTake } from "../../../providers/LanesProvider";
import { meterLabel } from "../noteRecorder";
import { followsTape, trackBpm } from "../tracks";
import { arrowPads, seekKnob, unusedPad } from "./base";
import type { Mode } from "../../../types/bindings";

// The tempo: the green knob and the arrows set it, a beat per minute at a
// time, as does dragging the number on the screen, or clicking it to type
// one; ↓ (between Slower and Faster) switches tap mode, where played notes
// tap the tempo. It is the take's, and so the tape's: what records, the
// click, the drum grid and the tracks' bar lines run at. With a track picked
// on the tracks it is that track's own instead, which it plays at whatever
// the tape's, and ↑ links it to the tape's or lets it go.
export const tempoMode: Mode = (device) => {
  const { transport, lanes, tracks } = device;
  const { bpm, setBpm, tapMode, tapCount, barBeats } = transport;
  const track = isTake(lanes.focusedLane) ? undefined : lanes.focusedLane;
  const linked = track !== undefined && followsTape(track);
  const tempo = track ? trackBpm(track, bpm) : bpm;
  const setTempo = (next: number) =>
    track ? tracks.setTrackTempo(track, next) : setBpm(next);
  return {
    knobs: {
      green: seekKnob(
        `${tempo} BPM`,
        tempo - MIN_BPM,
        MAX_BPM - MIN_BPM + 1,
        (step) => setTempo(MIN_BPM + step),
      ),
    },
    pads: {
      ...arrowPads(device, ["Slower", "Faster"], (direction) =>
        setTempo(tempo + direction),
      ),
      // ↓ has a job of its own here, so ↑ leaves the octave alone; with a
      // track picked, it links the track to the tape's tempo.
      up: track
        ? {
            label: linked
              ? `Give ${track.name} its own tempo`
              : `Link ${track.name} to the tape's tempo`,
            icon: linked ? <Link2 /> : <Link2Off />,
            lit: linked,
            onPress: () => tracks.toggleFollowTape(track),
          }
        : unusedPad("Octave up", <ArrowUp />),
      // Tapping sets the tape's tempo, so not a track's.
      down: track
        ? unusedPad("Tap tempo", <Pointer />)
        : {
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
      title: track ? `Tempo · ${track.name}` : "Tempo",
      unsaved: false,
      status: track
        ? linked
          ? "Tape's tempo"
          : "Own tempo"
        : meterLabel(transport.timing.meter),
      timing: { ...transport.timing, bpm: tempo },
      onBpm: setTempo,
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
