import { Link2, Link2Off, ListMusic, Pointer } from "lucide-react";
import { MAX_BPM, MIN_BPM } from "../../../hooks/useTransport";
import { isTake } from "../../../providers/LanesProvider";
import { meterLabel } from "../noteRecorder";
import { ScreenHint, ScreenLevel, ScreenValue } from "../DeviceScreen";
import {
  MAX_SWING,
  MIN_SWING,
  STRAIGHT,
  SWING_UNITS,
  type Swing,
} from "../swing";
import { followsTape, trackBpm } from "../tracks";
import { arrowPads, seekKnob, unusedPad } from "./base";
import type { Mode } from "../../../types/bindings";

// The tempo: the green knob and the arrows set it, a beat per minute at a
// time, as does dragging the number on the screen, or clicking it to type
// one; ↓ (between Slower and Faster) switches tap mode, where played notes
// tap the tempo. It is the take's, and so the tape's: what records, the
// click, the drum grid and the tracks' bar lines run at. With a track picked
// on the tracks it is that track's own instead, which it plays at whatever
// the tape's, and ↑ links it to the tape's or lets it go; without one, ↑
// gives every track the tape's tempo as its own. The red knob sets the swing
// and the blue one what it swings, eighths or sixteenths: the tape's, which
// the take, the drum grid and the play styles play through, or the picked
// track's own (kept from the tape's when it was saved).
export const tempoMode: Mode = (device) => {
  const { transport, lanes, tracks, feedback } = device;
  const { bpm, setBpm, tapMode, tapCount, barBeats } = transport;
  const track = isTake(lanes.focusedLane) ? undefined : lanes.focusedLane;
  const linked = track !== undefined && followsTape(track);
  const tempo = track ? trackBpm(track, bpm) : bpm;
  const setTempo = (next: number) =>
    track ? tracks.setTrackTempo(track, next) : setBpm(next);
  const swing = (track ? track.timing.swing : transport.swing) ?? STRAIGHT;
  const setSwing = (next: Swing) =>
    track ? tracks.setTrackSwing(track, next) : transport.setSwing(next);
  const { meter } = track ? track.timing : transport.timing;
  const unit = `1/${meter.unit * swing.perBeat}`;
  // A drum-grid track on triplets is swung already, and plays straight.
  const triplets =
    track !== undefined &&
    track.timing.perBeat % 3 === 0 &&
    track.timing.perBeat > 0;
  return {
    knobs: {
      green: seekKnob(
        `${tempo} BPM`,
        tempo - MIN_BPM,
        MAX_BPM - MIN_BPM + 1,
        (step) => setTempo(MIN_BPM + step),
      ),
      red: {
        label: "Swing",
        valueLabel:
          swing.amount > MIN_SWING
            ? `${swing.amount}%${triplets ? " (triplets play straight)" : ""}`
            : "Straight",
        step: swing.amount - MIN_SWING,
        steps: MAX_SWING - MIN_SWING + 1,
        onChange: (step) => setSwing({ ...swing, amount: MIN_SWING + step }),
      },
      blue: {
        label: "Swing on",
        valueLabel: unit,
        step: SWING_UNITS.indexOf(swing.perBeat),
        steps: SWING_UNITS.length,
        onChange: (step) =>
          setSwing({ ...swing, perBeat: SWING_UNITS[step] ?? swing.perBeat }),
      },
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
        : {
            label: `Set every track to ${tempo} BPM`,
            icon: <ListMusic />,
            onPress: () => {
              if (lanes.tracks.length === 0) {
                feedback.showPrompt("No tracks on this tape");
                return;
              }
              tracks.setAllTrackTempo(tempo);
              feedback.showNotice(`Every track at ${tempo} BPM`);
            },
          },
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
      // The swing in the colours of the knobs that set it: how much in red,
      // what it swings in blue, as the BPM is in green.
      status: (
        <>
          {track
            ? linked
              ? "Tape's tempo"
              : "Own tempo"
            : meterLabel(transport.timing.meter)}
          {" · "}
          {triplets ? (
            <ScreenHint>no swing on triplets</ScreenHint>
          ) : (
            <>
              {"Swing "}
              <ScreenLevel>{swing.amount}%</ScreenLevel>
              {" on "}
              <ScreenValue>{unit}</ScreenValue>
            </>
          )}
        </>
      ),
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
