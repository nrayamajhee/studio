import { Circle, Save } from "lucide-react";
import { deviceEngine, isKit } from "../deviceEngine";
import { plural, positionLabel } from "../deviceMath";
import {
  ScreenHint,
  ScreenLevel,
  ScreenPad,
  ScreenSeek,
  ScreenSelection,
} from "../DeviceScreen";
import { DRUM_PIECES } from "../instrumentIcons";
import { gridLabel } from "../noteRecorder";
import { MAX_STEP_BARS, STEP_RESOLUTIONS, patternTake } from "../stepPattern";
import { makeTrack } from "../tracks";
import { arrowPads, deletePad, padPreset, seekKnob, stepPads } from "./base";
import type { Mode } from "../../../types/bindings";
import type { Device } from "../../../types/device";

// Save in the sequencer keeps the pattern as a new track on its grid, with
// the tape's effects, and shows it on the tracks.
const keepPattern = (device: Device) => {
  const { sound, transport, lanes, steps, mix, views, feedback } = device;
  const { stepKit, preset } = sound;
  if (!stepKit) return;
  const { timing, bpm } = transport;
  const kept = patternTake(lanes.stepPattern, stepKit, timing.meter, bpm);
  if (kept.notes.length === 0) {
    feedback.showPrompt("Set some steps first");
    return;
  }
  steps.stopSteps();
  const saved = makeTrack(
    lanes.tracks.length,
    preset.name,
    kept,
    preset.id,
    deviceEngine.sound(),
    lanes.tapeModules,
    { ...timing, perBeat: lanes.stepPattern.perBeat },
    "steps",
  );
  lanes.addTrack(saved);
  mix.rewind();
  views.setView("tracks");
  feedback.showNotice(`Saved ${saved.name}`);
};

// The drum sequencer: the green knob moves the head, the red
// one sets the length and the blue one the resolution. Stopped, keys set or
// clear their piece at the head; Play loops the pattern, and Record loops it
// and lands each tap on the nearest step.
export const stepsMode: Mode = (device, base) => {
  const { sound, transport, lanes, steps, feedback } = device;
  const { stepPattern } = lanes;
  const { stepHead, stepCount, stepsRunning, recordingSteps } = steps;
  const resolution = gridLabel({
    ...transport.timing,
    perBeat: stepPattern.perBeat,
  });
  const length = plural(stepPattern.bars, "bar");
  return {
    knobs: {
      green: seekKnob(
        `Step ${stepHead + 1} of ${stepCount}`,
        stepHead,
        Math.max(2, stepCount),
        steps.moveStepHead,
      ),
      red: {
        label: "Length",
        valueLabel: length,
        step: stepPattern.bars - 1,
        steps: MAX_STEP_BARS,
        onChange: (index) => steps.setStepBars(index + 1),
      },
      blue: {
        label: "Resolution",
        valueLabel: resolution,
        step: STEP_RESOLUTIONS.indexOf(stepPattern.perBeat),
        steps: STEP_RESOLUTIONS.length,
        onChange: steps.setStepResolution,
      },
    },
    pads: {
      ...stepPads(device),
      record: {
        label: recordingSteps ? "Stop recording steps" : "Record steps",
        icon: <Circle fill="currentColor" />,
        lit: transport.recording || recordingSteps,
        onPress: () => {
          deviceEngine.unlock();
          if (recordingSteps) steps.stopSteps();
          else steps.playSteps(true);
        },
      },
      save: {
        label: "Save steps as a track",
        icon: <Save />,
        onPress: () => keepPattern(device),
      },
      delete: deletePad(device, {
        label: "Clear the steps",
        key: "delete:steps",
        prompt: "Press again to clear the steps",
        when: stepPattern.hits.length > 0,
        run: () => {
          steps.clearSteps();
          feedback.showNotice("Cleared the steps");
        },
      }),
      ...arrowPads(
        device,
        ["Previous step", "Next step"],
        steps.moveStepHeadBy,
      ),
    },
    presetPad: (pad) => {
      const own = base.presetPad(pad);
      return {
        ...own,
        onPress: () => {
          const bound = padPreset(device, pad);
          if (bound && !isKit(bound.target)) {
            feedback.showPrompt("The drum grid plays drum kits");
            return;
          }
          own.onPress();
        },
      };
    },
    // The length and resolution in the red and blue of the knobs that set
    // them; stopped, where the head is, in green.
    screen: {
      status: (
        <>
          {recordingSteps ? (
            <ScreenLevel>Rec</ScreenLevel>
          ) : stepsRunning ? (
            "Play"
          ) : (
            <ScreenSeek>
              {positionLabel(
                stepHead / stepPattern.perBeat,
                transport.timing.meter.beats,
                stepPattern.perBeat,
              )}
            </ScreenSeek>
          )}
          {" · "}
          <ScreenSelection label={length} value={resolution} />
        </>
      ),
      footer: [
        sound.stepKit ? "" : <ScreenHint key="kit">Pick a drum kit</ScreenHint>,
        <ScreenHint key="hint">
          {recordingSteps ? (
            "Tap keys in time"
          ) : stepsRunning ? (
            <>
              <ScreenPad label="Record">
                <Circle fill="currentColor" />
              </ScreenPad>{" "}
              to tap hits in
            </>
          ) : (
            "Keys set hits at the head"
          )}
        </ScreenHint>,
      ],
      stepRows: steps.stepRows.map((piece) => {
        const { name, Icon } = DRUM_PIECES[piece];
        return { id: piece, label: name, icon: Icon && <Icon /> };
      }),
      stepCount,
      stepsPerBeat: stepPattern.perBeat,
      stepsPerBar: steps.stepsPerBar,
      stepHits: steps.stepHits,
      getStepHead: steps.getStepHead,
      stepRecording: recordingSteps,
      onToggleStep: steps.toggleStep,
      onMoveStep: steps.moveStepHeadBy,
    },
  };
};
