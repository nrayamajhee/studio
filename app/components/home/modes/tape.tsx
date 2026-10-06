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
// are never changed in place: a track loaded onto the tape saves as a new
// one.
const keepTape = ({
  transport,
  sound,
  lanes,
  mix,
  views,
  feedback,
}: Device) => {
  const recorded = transport.keepTake();
  if (!recorded) {
    feedback.showPrompt("Record on the tape first");
    return;
  }
  const kept = makeTrack(
    lanes.tracks.length,
    sound.preset.name,
    recorded,
    sound.preset.id,
    deviceEngine.sound(),
    lanes.tapeModules,
    { ...transport.timing, bpm: recorded.bpm },
  );
  lanes.addTrack(kept);
  setTake(null);
  mix.rewind();
  views.setView("tracks");
  feedback.showNotice(`Saved ${kept.name}`);
};

// The tape (record mode): the take on the roll. Record arms it and Play
// starts it; stopped, the green knob scrolls it in time. The red knob sets
// the time signature and the blue one the roll's octave (with Shift, the
// grid); ↑ and ↓ move it a semitone.
export const tapeMode: Mode = (device, base) => {
  const { shift, transport, tape } = device;
  const { timing } = transport;
  const status = tape.recordArmed ? (
    <ScreenLevel>Armed</ScreenLevel>
  ) : tape.rollScrolls ? (
    <ScreenSeek>
      Bar {tape.barOf(tape.rollAt)}/{tape.barOf(tape.rollEnd)}
    </ScreenSeek>
  ) : transport.recording ? (
    "Rec"
  ) : transport.playing ? (
    "Play"
  ) : (
    "Tape"
  );
  return {
    knobs: {
      green: tape.rollScrolls
        ? seekKnob(
            `Bar ${tape.barOf(tape.rollAt)} of ${tape.barOf(tape.rollEnd)}`,
            tape.rollStep,
            tape.rollSteps,
            tape.scrubRollTo,
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
            valueLabel: tape.rollRange,
            step: tape.rollOctave,
            steps: tape.rollOctaves,
            onChange: tape.setRollOctave,
          },
    },
    pads: {
      save: {
        label: "Save tape as a track",
        icon: <Save />,
        onPress: () => keepTape(device),
      },
      up: {
        label: "Up a semitone",
        icon: <ArrowUp />,
        onPress: () => tape.scrollRollPitch(1),
      },
      down: {
        label: "Down a semitone",
        icon: <ArrowDown />,
        onPress: () => tape.scrollRollPitch(-1),
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
          {shift ? tape.rollRange : <ScreenValue>{tape.rollRange}</ScreenValue>}
        </>
      ),
      getRoll: transport.roll,
      timing,
      rollPosition: tape.rollScrolls ? tape.rollAt : null,
      rollLow: tape.rollLow,
      onRollScroll: tape.rollScrolls ? tape.scrollRoll : undefined,
      onRollPitch: tape.scrollRollPitch,
      // Armed, a hint along the bottom until Play starts the take.
      badge: tape.recordArmed ? { label: "Press Play to record" } : null,
    },
  };
};
