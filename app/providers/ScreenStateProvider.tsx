import { createContext, useContext, type ReactNode } from "react";
import { ArrowUp, Circle, Plus, RotateCcw } from "lucide-react";
import { formatParam } from "../lib/physical/patches/format";
import {
  ScreenLevel,
  ScreenPad,
  ScreenSeek,
  ScreenSelection,
  ScreenValue,
  TILES_PER_PAGE,
  type ScreenView,
} from "../components/home/DeviceScreen";
import { DEVICE_MODULES, KNOB_STEPS } from "../components/home/deviceEngine";
import { CHORD_PALETTE } from "../components/home/chords";
import { CHORD_STYLES } from "../components/home/chordStyles";
import { ICON_CHOICES, iconLabel } from "../components/home/presetIcons";
import {
  barMs,
  beatMs,
  gridLabel,
  meterLabel,
  positionLabel,
} from "../components/home/noteRecorder";
import { repeatsOf } from "../components/home/tracks";
import { useSession } from "../components/home/sessionStore";
import { MAX_BPM, MIN_BPM } from "../hooks/useTransport";
import { useDevice } from "./DeviceProvider";
import { useMasterLevel } from "./MasterLevelProvider";
import { useModules } from "./ModuleProvider";
import { usePerformance } from "./PerformanceProvider";
import { useSequencer } from "./SequencerProvider";
import { useSound } from "./SoundProvider";
import { useTracks } from "./TracksProvider";
import { useTransportContext } from "./TransportProvider";
import { useView } from "./ViewProvider";

export interface ScreenConfig {
  status: ReactNode;
  footer: readonly [ReactNode, ReactNode];
}

export interface Seek {
  step: number;
  steps: number;
  label: string;
  set: (step: number) => void;
}

interface ScreenStateValue {
  selection: ReactNode;
  seek: Seek;
  screen: Record<ScreenView, ScreenConfig>;
  badge: { label: string; on?: boolean } | null;
}

const ScreenStateContext = createContext<ScreenStateValue | null>(null);

// The screen's per-view status, footer, tiles-paging seek and bottom badge,
// derived from every provider.
export function ScreenStateProvider({ children }: { children: ReactNode }) {
  const { view } = useView();
  const transport = useTransportContext();
  const {
    selected,
    selectedValue,
    paramPage,
    pages,
    presets,
    presetIndex,
    iconIndex,
    revertIndex,
    showParamPage,
    setIconIndex,
    setPresetIndex,
    setRevertIndex,
  } = useSound();
  const { idleSeek, setIdleSeek, levelStep } = useMasterLevel();
  const {
    octave,
    shift,
    chordIndex,
    chordStyle,
    chordStyleIndex,
    tapMode,
    pickChordStyle,
    setChordIndex,
  } = usePerformance();
  const { picked, track, trackLoop, entries, selectedIndex, loopLabel, startLabel } =
    useTracks();
  const {
    stepKit,
    stepHead,
    stepCount,
    stepsRunning,
    recordingSteps,
    moveStepHead,
  } = useSequencer();
  const { moduleOn, activeModule } = useModules();
  const { steps: stepPattern, songs, song } = useSession();
  const {
    recordArmed,
    rollScrolls,
    rollAt,
    rollEnd,
    rollRange,
    revertOption,
    revertOptions,
    pickSong,
    rollSeek,
    soundName,
  } = useDevice();

  const songIndex = Math.max(
    0,
    songs.findIndex(({ id }) => id === song),
  );
  const openSongNow = songs[songIndex];

  const beatLength = beatMs(transport.timing);
  const barLength = barMs(transport.timing);
  const rollFirst = 0;
  const rollSteps = Math.max(
    2,
    Math.ceil((rollEnd - rollFirst) / beatLength) + 1,
  );
  const barOf = (ms: number) => Math.max(1, Math.ceil(ms / barLength));

  const selectedDisplay = formatParam(selected, selectedValue);
  const selection = (
    <>
      <ScreenSeek>{selected.label}</ScreenSeek>{" "}
      <ScreenValue>{selectedDisplay}</ScreenValue>
    </>
  );

  const seek: Seek =
    view === "synth"
      ? {
          step: paramPage,
          steps: Math.max(2, pages),
          label: `Page ${paramPage + 1} of ${pages}`,
          set: showParamPage,
        }
      : view === "save"
        ? {
            step: iconIndex,
            steps: ICON_CHOICES.length,
            label: iconLabel(ICON_CHOICES[iconIndex]),
            set: setIconIndex,
          }
        : view === "presets"
          ? {
              step: presetIndex,
              steps: Math.max(2, presets.length),
              label: presets[presetIndex]?.name ?? "",
              set: (index: number) =>
                setPresetIndex(Math.min(index, presets.length - 1)),
            }
          : view === "chords"
            ? {
                step: chordIndex,
                steps: Math.max(2, CHORD_PALETTE.length),
                label: CHORD_PALETTE[chordIndex]?.name ?? "",
                set: (index: number) =>
                  setChordIndex(Math.min(index, CHORD_PALETTE.length - 1)),
              }
            : view === "album"
              ? {
                  step: songIndex,
                  steps: Math.max(2, songs.length),
                  label: openSongNow?.name ?? "",
                  set: pickSong,
                }
              : view === "chordStyle"
                ? {
                    step: chordStyleIndex,
                    steps: CHORD_STYLES.length,
                    label: CHORD_STYLES[chordStyleIndex].name,
                    set: pickChordStyle,
                  }
                : view === "steps"
                  ? {
                      step: stepHead,
                      steps: Math.max(2, stepCount),
                      label: `Step ${stepHead + 1} of ${stepCount}`,
                      set: moveStepHead,
                    }
                  : view === "revert"
                    ? {
                        step: revertIndex,
                        steps: revertOptions.length,
                        label: revertOption.label,
                        set: (index: number) =>
                          setRevertIndex(
                            Math.min(index, revertOptions.length - 1),
                          ),
                      }
                    : rollScrolls
                      ? {
                          step: Math.round((rollAt - rollFirst) / beatLength),
                          steps: rollSteps,
                          label: `Bar ${barOf(rollAt)} of ${barOf(rollEnd)}`,
                          set: (step: number) =>
                            rollSeek(rollFirst + step * beatLength),
                        }
                      : view === "tempo"
                        ? {
                            step: transport.bpm - MIN_BPM,
                            steps: MAX_BPM - MIN_BPM + 1,
                            label: `${transport.bpm} BPM`,
                            set: (step: number) =>
                              transport.setBpm(MIN_BPM + step),
                          }
                        : {
                            step: idleSeek,
                            steps: KNOB_STEPS,
                            label: "",
                            set: setIdleSeek,
                          };

  const engine = soundName();
  const octaveLabel = `OCT ${octave > 0 ? "+" : octave < 0 ? "−" : "±"}${Math.abs(octave)}`;
  const paramPageLabel = (
    <ScreenSeek>
      Params {paramPage + 1}/{pages}
    </ScreenSeek>
  );

  const screen: Record<ScreenView, ScreenConfig> = {
    scope: {
      status: (
        <>
          {octaveLabel} · <ScreenLevel>Level {levelStep * 10}%</ScreenLevel>
        </>
      ),
      footer: [engine, selection],
    },
    synth: {
      status: octaveLabel,
      footer: [engine, paramPageLabel],
    },
    save: {
      status: (
        <ScreenSeek>
          Icons {Math.floor(iconIndex / TILES_PER_PAGE.save) + 1}/
          {Math.ceil(ICON_CHOICES.length / TILES_PER_PAGE.save)}
        </ScreenSeek>
      ),
      footer: ["Pick an icon", "Press a pad to save"],
    },
    adsr: { status: "", footer: ["", ""] },
    lfo: { status: "", footer: ["", ""] },
    fx: { status: "", footer: ["", ""] },
    tempo: { status: meterLabel(transport.timing.meter), footer: ["", ""] },
    tracks: {
      status: picked ? (
        <ScreenValue>
          {selectedIndex + 1}/{entries.length}
        </ScreenValue>
      ) : (
        ""
      ),
      footer: picked
        ? [
            track && shift ? (
              <>
                <ScreenSeek>Starts {startLabel(track.start)}</ScreenSeek>
                {trackLoop && (
                  <>
                    {" · Clip "}
                    <ScreenSelection
                      label={`${loopLabel(trackLoop.start)} –`}
                      value={loopLabel(trackLoop.end)}
                    />
                  </>
                )}
              </>
            ) : track ? (
              <>
                {trackLoop
                  ? `Clip ${loopLabel(trackLoop.start)} – ${loopLabel(trackLoop.end)}`
                  : `Starts ${startLabel(track.start)}`}
                {` · ×${repeatsOf(track)} · `}
                <ScreenLevel>Vol {Math.round(track.volume * 100)}%</ScreenLevel>
              </>
            ) : (
              "Tape · record and save it in the tape view"
            ),
            <>
              {(shift || track) && (
                <>
                  <ScreenLevel>
                    {shift ? (trackLoop ? "Clip start" : "Zoom") : "Volume"}
                  </ScreenLevel>
                  {" · "}
                </>
              )}
              <ScreenSeek>{shift && track ? "Slide" : "Seek"}</ScreenSeek>
              {" · "}
              <ScreenValue>
                {shift ? (trackLoop ? "Clip end" : "Scroll") : "Track"}
              </ScreenValue>
            </>,
          ]
        : ["", ""],
    },
    steps: {
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
          <ScreenSelection
            label={`${stepPattern.bars} bar${stepPattern.bars > 1 ? "s" : ""}`}
            value={gridLabel({
              ...transport.timing,
              perBeat: stepPattern.perBeat,
            })}
          />
        </>
      ),
      footer: [
        stepKit ? "" : "Pick a drum kit",
        recordingSteps ? (
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
        ),
      ],
    },
    roll: {
      status: (
        <>
          {recordArmed ? (
            <ScreenLevel>Armed</ScreenLevel>
          ) : rollScrolls ? (
            <ScreenSeek>
              Bar {barOf(rollAt)}/{barOf(rollEnd)}
            </ScreenSeek>
          ) : transport.state === "recording" ? (
            "Rec"
          ) : transport.state === "playing" ? (
            "Play"
          ) : (
            "Tape"
          )}
          {" · "}
          <ScreenLevel>{meterLabel(transport.timing.meter)}</ScreenLevel>{" "}
          {shift ? (
            <ScreenValue>{gridLabel(transport.timing)}</ScreenValue>
          ) : (
            gridLabel(transport.timing)
          )}
          {" · "}
          {shift ? rollRange : <ScreenValue>{rollRange}</ScreenValue>}
        </>
      ),
      footer: ["", ""],
    },
    presets: {
      status: (
        <ScreenSeek>
          Presets {Math.floor(presetIndex / TILES_PER_PAGE.presets) + 1}/
          {Math.max(1, Math.ceil(presets.length / TILES_PER_PAGE.presets))}
        </ScreenSeek>
      ),
      footer: [presets[presetIndex]?.name ?? "", "Press a pad twice to bind"],
    },
    chords: {
      status: (
        <ScreenSeek>
          Chords {Math.floor(chordIndex / TILES_PER_PAGE.chords) + 1}/
          {Math.max(1, Math.ceil(CHORD_PALETTE.length / TILES_PER_PAGE.chords))}
        </ScreenSeek>
      ),
      footer: [
        CHORD_PALETTE[chordIndex]?.name ?? "",
        "Press a chord pad twice to set",
      ],
    },
    album: {
      status: (
        <ScreenSeek>
          {songIndex + 1}/{songs.length}
        </ScreenSeek>
      ),
      footer: [
        openSongNow
          ? `${openSongNow.tracks.length} track${openSongNow.tracks.length === 1 ? "" : "s"} · ${openSongNow.bpm} BPM · ${meterLabel(openSongNow.meter)}`
          : "",
        <>
          <ScreenPad label="Save">
            <Plus />
          </ScreenPad>{" "}
          new song
        </>,
      ],
    },
    chordStyle: {
      status: (
        <ScreenSeek>
          {chordStyleIndex + 1}/{CHORD_STYLES.length}
        </ScreenSeek>
      ),
      footer: [
        CHORD_STYLES[chordStyleIndex].detail,
        <ScreenSelection
          key="style"
          label={`Rate ${gridLabel({ ...transport.timing, perBeat: chordStyle.perBeat })}`}
          value={`Strum ${chordStyle.strum} ms`}
        />,
      ],
    },
    revert: {
      status: (
        <>
          <ScreenPad label="Shift">
            <ArrowUp />
          </ScreenPad>
          <ScreenPad label="Delete">
            <RotateCcw />
          </ScreenPad>{" "}
          to close
        </>
      ),
      footer: [
        revertOption.detail,
        <>
          Press{" "}
          <ScreenPad label="Delete">
            <RotateCcw />
          </ScreenPad>{" "}
          twice to revert
        </>,
      ],
    },
  };

  const badge = activeModule
    ? { label: DEVICE_MODULES[activeModule].label, on: moduleOn[activeModule] }
    : view === "tempo"
      ? tapMode
        ? { label: "Tap a note" }
        : { label: "Metronome", on: transport.metronome }
      : recordArmed
        ? { label: "Press Play to record" }
        : null;

  const value: ScreenStateValue = { selection, seek, screen, badge };
  return (
    <ScreenStateContext.Provider value={value}>
      {children}
    </ScreenStateContext.Provider>
  );
}

export function useScreenState() {
  const context = useContext(ScreenStateContext);
  if (!context) throw new Error("Wrap the Device in a ScreenStateProvider");
  return context;
}
