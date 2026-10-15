import { ArrowDown, ArrowUp, Save } from "lucide-react";
import { deviceEngine } from "../deviceEngine";
import { ScreenLevel, ScreenSeek, ScreenValue } from "../DeviceScreen";
import { METERS, SUBDIVISIONS, gridLabel, meterLabel } from "../noteRecorder";
import { setTake } from "../sessionStore";
import { makeTrack } from "../tracks";
import { seekKnob } from "./base";
import type { Mode } from "../../../types/bindings";
import type { Device } from "../../../types/device";

// Save in record mode keeps the take as a new track, with the preset and
// timing it plays with now, and shows it on the tracks from the top. Tracks
// are never changed in place: a track loaded as the take saves as a new
// one.
const saveTake = ({
  transport,
  sound,
  lanes,
  mix,
  views,
  feedback,
}: Device) => {
  const recorded = transport.keepTake();
  if (!recorded) {
    feedback.showPrompt("Record a take first");
    return;
  }
  const kept = makeTrack(
    lanes.tracks.length,
    sound.preset.name,
    recorded,
    sound.preset.id,
    deviceEngine.sound(),
    lanes.takeModules,
    { ...transport.timing, bpm: recorded.bpm },
    "roll",
  );
  lanes.addTrack(kept);
  setTake(null);
  mix.rewind();
  views.setView("tracks");
  feedback.showNotice(`Saved ${kept.name}`);
};

// The piano roll (record mode): the take on the roll. Record arms it and Play
// starts it; stopped, the green knob scrolls it in time. The red knob sets
// the time signature and the blue one the roll's octave (with Shift, the
// grid); ↑ and ↓ move it a semitone.
export const rollMode: Mode = (device, base) => {
  const { shift, transport, take } = device;
  const { timing } = transport;
  const status = take.recordArmed ? (
    <ScreenLevel>Armed</ScreenLevel>
  ) : take.rollScrolls ? (
    <ScreenSeek>
      Bar {take.barOf(take.rollAt)}/{take.barOf(take.rollEnd)}
    </ScreenSeek>
  ) : transport.recording ? (
    "Rec"
  ) : transport.playing ? (
    "Play"
  ) : (
    "Take"
  );
  return {
    knobs: {
      green: take.rollScrolls
        ? seekKnob(
            `Bar ${take.barOf(take.rollAt)} of ${take.barOf(take.rollEnd)}`,
            take.rollStep,
            take.rollSteps,
            take.scrubRollTo,
          )
        : base.knobs.green,
      red: {
        label: "Time signature",
        valueLabel: meterLabel(timing.meter),
        step: transport.meterIndex,
        steps: METERS.length,
        onChange: transport.setMeter,
      },
      blue: shift
        ? {
            label: "Grid",
            valueLabel: gridLabel(timing),
            step: transport.gridIndex,
            steps: SUBDIVISIONS.length,
            onChange: transport.setGrid,
          }
        : {
            label: "Pitch",
            valueLabel: take.rollRange,
            step: take.rollOctave,
            steps: take.rollOctaves,
            onChange: take.setRollOctave,
          },
    },
    pads: {
      save: {
        label: "Save take as a track",
        icon: <Save />,
        onPress: () => saveTake(device),
      },
      up: {
        label: "Up a semitone",
        icon: <ArrowUp />,
        onPress: () => take.scrollRollPitch(1),
      },
      down: {
        label: "Down a semitone",
        icon: <ArrowDown />,
        onPress: () => take.scrollRollPitch(-1),
      },
    },
    // The meter, grid and notes in view, in the colours of the knobs that
    // set them (Shift turns blue over to the grid); when stopped, the bar
    // the green knob scrolled to, in green.
    screen: {
      status: (
        <>
          {status}
          {" · "}
          <ScreenLevel>{meterLabel(timing.meter)}</ScreenLevel>{" "}
          {shift ? (
            <ScreenValue>{gridLabel(timing)}</ScreenValue>
          ) : (
            gridLabel(timing)
          )}
          {" · "}
          {shift ? take.rollRange : <ScreenValue>{take.rollRange}</ScreenValue>}
        </>
      ),
      getRoll: transport.roll,
      timing,
      rollPosition: take.rollScrolls ? take.rollAt : null,
      rollLow: take.rollLow,
      onRollScroll: take.rollScrolls ? take.scrollRoll : undefined,
      onRollPitch: take.scrollRollPitch,
      // Armed, a hint along the bottom until Play starts the take.
      badge: take.recordArmed ? { label: "Press Play to record" } : null,
    },
  };
};
