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
import { MAX_STEP_BARS, STEP_RESOLUTIONS, patternTake } from "../drumPattern";
import { makeTrack } from "../tracks";
import {
  arrowPads,
  deletePad,
  padPreset,
  seekKnob,
  drumGridPads,
} from "./base";
import type { Mode } from "../../../types/bindings";
import type { Device } from "../../../types/device";

// Save in the drum grid keeps the pattern as a new track on its grid, with
// the take's effects, and shows it on the tracks.
const keepPattern = (device: Device) => {
  const { sound, transport, lanes, drumGrid, mix, views, feedback } = device;
  const { stepKit, preset } = sound;
  if (!stepKit) return;
  const { timing, bpm } = transport;
  const kept = patternTake(lanes.drumPattern, stepKit, timing.meter, bpm);
  if (kept.notes.length === 0) {
    feedback.showPrompt("Set some steps first");
    return;
  }
  drumGrid.stopPattern();
  const saved = makeTrack(
    lanes.tracks.length,
    preset.name,
    kept,
    preset.id,
    deviceEngine.sound(),
    lanes.takeModules,
    { ...timing, perBeat: lanes.drumPattern.perBeat },
    "drumGrid",
  );
  lanes.addTrack(saved);
  mix.rewind();
  views.setView("tracks");
  feedback.showNotice(`Saved ${saved.name}`);
};

// The drum grid: the green knob moves the head, the red
// one sets the length and the blue one the resolution. Stopped, keys set or
// clear their piece at the head; Play loops the pattern, and Record loops it
// and lands each tap on the nearest step.
export const drumGridMode: Mode = (device, base) => {
  const { sound, transport, lanes, drumGrid, feedback } = device;
  const { drumPattern } = lanes;
  const { stepHead, stepCount, patternRunning, recordingPattern } = drumGrid;
  const resolution = gridLabel({
    ...transport.timing,
    perBeat: drumPattern.perBeat,
  });
  const length = plural(drumPattern.bars, "bar");
  return {
    knobs: {
      green: seekKnob(
        `Step ${stepHead + 1} of ${stepCount}`,
        stepHead,
        Math.max(2, stepCount),
        drumGrid.moveStepHead,
      ),
      red: {
        label: "Length",
        valueLabel: length,
        step: drumPattern.bars - 1,
        steps: MAX_STEP_BARS,
        onChange: (index) => drumGrid.setStepBars(index + 1),
      },
      blue: {
        label: "Resolution",
        valueLabel: resolution,
        step: STEP_RESOLUTIONS.indexOf(drumPattern.perBeat),
        steps: STEP_RESOLUTIONS.length,
        onChange: drumGrid.setStepResolution,
      },
    },
    pads: {
      ...drumGridPads(device),
      record: {
        label: recordingPattern
          ? "Stop recording the pattern"
          : "Record the pattern",
        icon: <Circle fill="currentColor" />,
        lit: transport.recording || recordingPattern,
        onPress: () => {
          deviceEngine.unlock();
          if (recordingPattern) drumGrid.stopPattern();
          else drumGrid.playPattern(true);
        },
      },
      save: {
        label: "Save pattern as a track",
        icon: <Save />,
        onPress: () => keepPattern(device),
      },
      delete: deletePad(device, {
        label: "Clear the pattern",
        key: "delete:pattern",
        prompt: "Press again to clear the pattern",
        when: drumPattern.hits.length > 0,
        run: () => {
          drumGrid.clearPattern();
          feedback.showNotice("Cleared the pattern");
        },
      }),
      ...arrowPads(
        device,
        ["Previous step", "Next step"],
        drumGrid.moveStepHeadBy,
      ),
    },
    instrumentPad: (pad) => {
      const own = base.instrumentPad(pad);
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
          {recordingPattern ? (
            <ScreenLevel>Rec</ScreenLevel>
          ) : patternRunning ? (
            "Play"
          ) : (
            <ScreenSeek>
              {positionLabel(
                stepHead / drumPattern.perBeat,
                transport.timing.meter.beats,
                drumPattern.perBeat,
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
          {recordingPattern ? (
            "Tap keys in time"
          ) : patternRunning ? (
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
      stepRows: drumGrid.stepRows.map((piece) => {
        const { name, Icon } = DRUM_PIECES[piece];
        return { id: piece, label: name, icon: Icon && <Icon /> };
      }),
      stepCount,
      stepsPerBeat: drumPattern.perBeat,
      stepsPerBar: drumGrid.stepsPerBar,
      stepHits: drumGrid.stepHits,
      getStepHead: drumGrid.getStepHead,
      stepRecording: recordingPattern,
      onToggleStep: drumGrid.toggleStep,
      onMoveStep: drumGrid.moveStepHeadBy,
    },
  };
};
