import { formatParam, valueToStep } from "../../../lib/physical/patches/format";
import { DEVICE_MODULES, KNOB_STEPS } from "../deviceEngine";
import { knobDisplay } from "../modules";
import {
  MAX_STEP_BARS,
  STEP_RESOLUTIONS,
} from "../stepPattern";
import { CHORD_RATES, STRUM_GAPS } from "../chordStyles";
import { setChordStyle } from "../chordStore";
import { METERS, SUBDIVISIONS, barMs, gridLabel, meterLabel } from "../noteRecorder";
import { setSteps, useSession } from "../sessionStore";
import { useDevice } from "../../../providers/DeviceProvider";
import { useMasterLevel } from "../../../providers/MasterLevelProvider";
import { useScreenState } from "../../../providers/ScreenStateProvider";
import { useModules } from "../../../providers/ModuleProvider";
import { usePerformance } from "../../../providers/PerformanceProvider";
import { useSequencer } from "../../../providers/SequencerProvider";
import { useSound } from "../../../providers/SoundProvider";
import { useTracks } from "../../../providers/TracksProvider";
import { useTransportContext } from "../../../providers/TransportProvider";
import { useView } from "../../../providers/ViewProvider";
import type { KnobProps } from "../../design-system/Knob";

export type KnobSpec = Omit<KnobProps, "className">;

// The four knobs, top-left to bottom-right, as data for the two knob columns.
// The module override and every Shift sub-branch resolve here.
export function useKnobSpecs(): [KnobSpec, KnobSpec, KnobSpec, KnobSpec] {
  const { view } = useView();
  const transport = useTransportContext();
  const { specs, selected, selectedValue, valueSteps, selectParam, setSelectedValue } =
    useSound();
  const { volumeStep, levelStep, setVolume, setLevel } = useMasterLevel();
  const { shift, chordStyle } = usePerformance();
  const {
    entries,
    picked,
    selectedIndex,
    setSelectedIndex,
    setPanFrom,
    track,
    trackFrom,
    trackSpan,
    trackWindow,
    panSteps,
    trackZooms,
    trackZoom,
    zoomTracks,
    mixAt,
    mixBars,
    mixStep,
    mixSteps,
    trackLoop,
    loopUnit,
    loopSteps,
    updateTrack,
    setLoopEdge,
    loopLabel,
    startLabel,
    scrubMix,
  } = useTracks();
  const { stepPerBeat, setStepResolution } = useSequencer();
  const { moduleSteps, setModuleStep, activeModule } = useModules();
  const { seek } = useScreenState();
  const { rollRange, rollOctave, rollOctaves, setRollOctave } = useDevice();
  const { steps: stepPattern } = useSession();

  const selectedDisplay = formatParam(selected, selectedValue);
  const barBeats = transport.timing.meter.beats;
  const mixBar = Math.min(
    mixBars - 1,
    Math.floor(mixAt / barMs(transport.timing)),
  );

  const moduleKnob = (
    index: number,
    color: string,
    markColor?: string,
  ): KnobSpec => {
    const id = activeModule!;
    const knob = DEVICE_MODULES[id].knobs[index];
    const step = moduleSteps[id][index];
    return {
      label: knob.spec.label,
      valueLabel: knobDisplay(knob, step),
      step,
      steps: knob.steps,
      color,
      markColor,
      onChange: (next) => setModuleStep(id, index, next),
    };
  };

  const topLeft: KnobSpec = activeModule
    ? moduleKnob(0, "var(--synth-chalk)", "#141413")
    : {
        label: "Volume",
        valueLabel: `${volumeStep * 10}%`,
        step: volumeStep,
        steps: KNOB_STEPS,
        color: "var(--synth-chalk)",
        markColor: "#141413",
        onChange: setVolume,
      };

  const bottomLeft: KnobSpec = activeModule
    ? moduleKnob(1, "var(--synth-green)")
    : view === "scope"
      ? {
          label: "Parameter",
          valueLabel: selected.label,
          step: specs.indexOf(selected),
          steps: Math.max(2, specs.length),
          color: "var(--synth-green)",
          onChange: (index) => selectParam(Math.min(index, specs.length - 1)),
        }
      : view === "tracks" && shift && track
        ? {
            label: "Slide",
            valueLabel: startLabel(track.start),
            step: Math.round(track.start),
            steps: trackSpan + 1,
            color: "var(--synth-green)",
            onChange: (beats) => updateTrack(track.id, { start: beats }),
          }
        : view === "tracks"
          ? {
              label: "Seek",
              valueLabel: `Bar ${mixBar + 1} of ${mixBars}`,
              step: mixStep,
              steps: mixSteps,
              color: "var(--synth-green)",
              fine: true,
              onChange: (step) => scrubMix(step),
            }
          : {
              label: "Seek",
              valueLabel: seek.label || undefined,
              step: seek.step,
              steps: seek.steps,
              color: "var(--synth-green)",
              onChange: seek.set,
            };

  const topRight: KnobSpec = activeModule
    ? moduleKnob(2, "var(--synth-red)")
    : view === "tracks" && shift && trackLoop
      ? {
          label: "Clip start",
          valueLabel: loopLabel(trackLoop.start),
          step: Math.round(trackLoop.start / loopUnit),
          steps: loopSteps,
          color: "var(--synth-red)",
          onChange: (step) => setLoopEdge("start", step),
        }
      : view === "tracks" && shift
        ? {
            label: "Zoom",
            valueLabel: `×${trackZoom}`,
            step: trackZooms.indexOf(trackZoom),
            steps: Math.max(2, trackZooms.length),
            color: "var(--synth-red)",
            onChange: (step) => zoomTracks(Math.min(step, trackZooms.length - 1)),
          }
        : view === "tracks"
          ? {
              label: "Track volume",
              valueLabel: track
                ? `${Math.round(track.volume * 100)}%`
                : undefined,
              step: Math.round((track?.volume ?? 1) * (KNOB_STEPS - 1)),
              steps: KNOB_STEPS,
              color: "var(--synth-red)",
              onChange: (step) => {
                if (track)
                  updateTrack(track.id, { volume: step / (KNOB_STEPS - 1) });
              },
            }
          : view === "chordStyle"
            ? {
                label: "Rate",
                valueLabel: gridLabel({
                  ...transport.timing,
                  perBeat: chordStyle.perBeat,
                }),
                step: CHORD_RATES.indexOf(chordStyle.perBeat),
                steps: CHORD_RATES.length,
                color: "var(--synth-red)",
                onChange: (index) => setChordStyle({ perBeat: CHORD_RATES[index] }),
              }
            : view === "steps"
              ? {
                  label: "Length",
                  valueLabel: `${stepPattern.bars} bar${stepPattern.bars > 1 ? "s" : ""}`,
                  step: stepPattern.bars - 1,
                  steps: MAX_STEP_BARS,
                  color: "var(--synth-red)",
                  onChange: (index) =>
                    setSteps((current) => ({ ...current, bars: index + 1 })),
                }
              : view === "roll"
                ? {
                    label: "Time signature",
                    valueLabel: meterLabel(transport.timing.meter),
                    step: transport.meterIndex,
                    steps: METERS.length,
                    color: "var(--synth-red)",
                    onChange: transport.setMeter,
                  }
                : view === "scope"
                  ? {
                      label: "Level",
                      valueLabel: `${levelStep * 10}%`,
                      step: levelStep,
                      steps: KNOB_STEPS,
                      color: "var(--synth-red)",
                      onChange: setLevel,
                    }
                  : {
                      label: "Parameter",
                      valueLabel: selected.label,
                      step: specs.indexOf(selected),
                      steps: Math.max(2, specs.length),
                      color: "var(--synth-red)",
                      onChange: (index) =>
                        selectParam(Math.min(index, specs.length - 1)),
                    };

  const bottomRight: KnobSpec = activeModule
    ? moduleKnob(3, "var(--synth-blue)")
    : view === "tracks" && shift && trackLoop
      ? {
          label: "Clip end",
          valueLabel: loopLabel(trackLoop.end),
          step: Math.round(trackLoop.end / loopUnit),
          steps: loopSteps,
          color: "var(--synth-blue)",
          onChange: (step) => setLoopEdge("end", step),
        }
      : view === "tracks" && shift
        ? {
            label: "Scroll",
            valueLabel: `Bar ${Math.floor(trackFrom / barBeats) + 1}.${(Math.round(trackFrom) % barBeats) + 1}`,
            step: Math.round(trackFrom),
            steps: panSteps,
            color: "var(--synth-blue)",
            onChange: (step) =>
              setPanFrom(Math.min(step, trackSpan - trackWindow)),
          }
        : view === "tracks"
          ? {
              label: "Track",
              valueLabel: picked?.name,
              step: selectedIndex,
              steps: Math.max(2, entries.length),
              color: "var(--synth-blue)",
              onChange: (index) =>
                setSelectedIndex(Math.min(index, entries.length - 1)),
            }
          : view === "chordStyle"
            ? {
                label: "Strum",
                valueLabel: `${chordStyle.strum} ms`,
                step: STRUM_GAPS.indexOf(chordStyle.strum),
                steps: STRUM_GAPS.length,
                color: "var(--synth-blue)",
                onChange: (index) =>
                  setChordStyle({ strum: STRUM_GAPS[index] }),
              }
            : view === "steps"
              ? {
                  label: "Resolution",
                  valueLabel: gridLabel({
                    ...transport.timing,
                    perBeat: stepPerBeat,
                  }),
                  step: STEP_RESOLUTIONS.indexOf(stepPerBeat),
                  steps: STEP_RESOLUTIONS.length,
                  color: "var(--synth-blue)",
                  onChange: setStepResolution,
                }
              : view === "roll" && shift
                ? {
                    label: "Grid",
                    valueLabel: gridLabel(transport.timing),
                    step: transport.gridIndex,
                    steps: SUBDIVISIONS.length,
                    color: "var(--synth-blue)",
                    onChange: transport.setGrid,
                  }
                : view === "roll"
                  ? {
                      label: "Pitch",
                      valueLabel: rollRange,
                      step: rollOctave,
                      steps: rollOctaves,
                      color: "var(--synth-blue)",
                      onChange: setRollOctave,
                    }
                  : {
                      label: "Value",
                      valueLabel: `${selected.label} ${selectedDisplay}`,
                      step: valueToStep(selected, selectedValue, valueSteps),
                      steps: valueSteps,
                      color: "var(--synth-blue)",
                      onChange: setSelectedValue,
                    };

  return [topLeft, bottomLeft, topRight, bottomRight];
}
