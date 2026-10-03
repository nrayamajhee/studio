import {
  memo,
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  AudioLines,
  AudioWaveform,
  Headphones,
  ChartNoAxesGantt,
  Circle,
  Layers,
  Album,
  Disc3,
  Grid3x3,
  Plus,
  LayoutGrid,
  Metronome,
  Music4,
  Pause,
  Play,
  Pointer,
  FileMusic,
  RotateCcw,
  Save,
  Scissors,
  ScissorsLineDashed,
  SlidersHorizontal,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  WavesHorizontal,
} from "lucide-react";
import type { DrumPieceId } from "../../lib/physical";
import { PATCH_BY_ID } from "../../lib/physical/patches";
import {
  formatParam,
  stepToValue,
  valueToStep,
} from "../../lib/physical/patches/format";
import { cn } from "../../lib/utils";
import { Key, Knob, Pad } from "../design-system";
import {
  DEVICE_MODULES,
  DEVICE_PRESETS,
  KNOB_STEPS,
  deviceEngine,
  engineName,
  findPreset,
  isKit,
  keyPiece,
  presetValues,
  type DevicePreset,
  type ModuleId,
} from "./deviceEngine";
import {
  DeviceScreen,
  PARAMS_PER_PAGE,
  ScreenLevel,
  ScreenPad,
  ScreenSeek,
  ScreenSelection,
  ScreenValue,
  TILES_PER_PAGE,
  type ScreenOverlay,
  type ScreenReadout,
  type ScreenView,
} from "./DeviceScreen";
import {
  AdsrIcon,
  ChordStyleIcon,
  DRUM_PIECES,
  RollIcon,
} from "./instrumentIcons";
import {
  CHORD_RATES,
  CHORD_STYLES,
  DEFAULT_CHORD_STYLE,
  STRUM_GAPS,
  playChord,
} from "./chordStyles";
import {
  MAX_STEP_BARS,
  STEP_RESOLUTIONS,
  addHit,
  hitStep,
  hitsAt,
  kitRows,
  patternSteps,
  patternTake,
  takePattern,
  toggleHit,
} from "./stepPattern";
import { useStepPlayer } from "../../hooks/useStepPlayer";
import {
  DEFAULT_TIMING,
  METERS,
  SUBDIVISIONS,
  barMs,
  beatMs,
  gridLabel,
  meterLabel,
  type Meter,
} from "./noteRecorder";
import { ICON_CHOICES, PresetIcon } from "./presetIcons";
import {
  allPresets,
  bindPad,
  clearAllEdits,
  clearEdits,
  deletePreset,
  presetEdits,
  resetPads,
  setEdit,
  savePreset,
  swapPad,
  updatePreset,
  usePresetLibrary,
} from "./presetStore";
import { useHotkeyListener, useHotkeys } from "../../providers/HotkeyProvider";
import { hotkeyLabel, type Control, type Tool } from "./input/keymap";
import { CHORD_PALETTE, chordById } from "./chords";
import {
  resetChordMacros,
  setChordMacro,
  setChordStyle,
  useChordMacros,
  useChordStyle,
} from "./chordStore";
import {
  audible,
  clipOf,
  cutToLoop,
  gridSteps,
  loopStep,
  makeTrack,
  maxRepeats,
  passOf,
  repeatsOf,
  startsOf,
  takeBeats,
  takeBeatsAt,
  modulesChange,
  trackModules,
  type Track,
} from "./tracks";
import { useTrackMix } from "../../hooks/useTrackMix";
import {
  download,
  mixInto,
  mixToFlac,
  mixToMidi,
  type MidiPart,
  type MixPart,
} from "./exportMix";
import { foldNote } from "../../lib/physical/dsp/math";
import { useMixScrub } from "../../hooks/useMixScrub";
import {
  deleteSong,
  newSong,
  openSong,
  openedSong,
  setSongTiming,
  setSteps,
  setTake,
  setTakeModules,
  setTracks,
  useSession,
  type Song,
} from "./sessionStore";
import {
  INITIAL_MODULES,
  MODULE_IDS,
  applyModules,
  knobDisplay,
  knobValue,
  type ModuleSettings,
} from "./modules";
import { useScrub } from "../../hooks/useScrub";
import { MAX_BPM, MIN_BPM, useTransport } from "../../hooks/useTransport";
import styles from "./SynthDevice.module.css";

export interface SynthDeviceProps {
  className?: string;
}

const INITIAL_PRESET = "piano";
// The take shown as a potential track on the tracks view.
const TAKE_ID = "session-take";
// The system volume starts full, and the synth's level where the volume used
// to be, so the Device sounds as it did.
const INITIAL_VOLUME_STEP = 10;
const INITIAL_LEVEL_STEP = 8;
const NOTICE_MS = 1800;
const OVERLAY_MS = 1200;
// Where a time signature is in METERS (stored ones are copies).
const meterIndexOf = ({ beats, unit }: Meter) =>
  Math.max(
    0,
    METERS.findIndex((meter) => meter.beats === beats && meter.unit === unit),
  );

// A place in a take as bar.beat.step, counting from 1, to the nearest step.
const positionLabel = (beats: number, barBeats: number, perBeat: number) => {
  const steps = Math.round(beats * perBeat);
  const bar = Math.floor(steps / (barBeats * perBeat));
  const beat = Math.floor(steps / perBeat) % barBeats;
  return `${bar + 1}.${beat + 1}.${(steps % perBeat) + 1}`;
};

// Ten columns of holes, in rows along the screen's straight sides, with the
// four corner holes left undrilled so the field reads as rounded: a hole is
// drilled if it lies within a one-hole radius of the field's inner rectangle.
const GRILLE_COLUMNS = 10;
const GRILLE_ROWS = 52;
const GRILLE_RADIUS = 1;
const GRILLE_DRILLED = Array.from(
  { length: GRILLE_COLUMNS * GRILLE_ROWS },
  (_, hole) => {
    const column = hole % GRILLE_COLUMNS;
    const row = Math.floor(hole / GRILLE_COLUMNS);
    const x = Math.max(
      0,
      GRILLE_RADIUS - column,
      column - (GRILLE_COLUMNS - 1 - GRILLE_RADIUS),
    );
    const y = Math.max(
      0,
      GRILLE_RADIUS - row,
      row - (GRILLE_ROWS - 1 - GRILLE_RADIUS),
    );
    return x * x + y * y <= GRILLE_RADIUS * GRILLE_RADIUS;
  },
);

// A cosmetic speaker grille either side of the screen. Memoized: it never
// changes, and the Device re-renders on every knob turn.
const Grille = memo(function Grille() {
  return (
    <span className={styles.grille} aria-hidden="true">
      {GRILLE_DRILLED.map((drilled, hole) => (
        <span key={hole} data-blank={!drilled || undefined} />
      ))}
    </span>
  );
});

// How many times Shift + red stretches the tracks' timeline across the
// lanes; it stops where a bar fills them.
const TRACK_ZOOMS = [1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128];

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
const F3_MIDI = 53;
// The keybed has no velocity; every press plays mezzo-forte.
const KEY_VELOCITY = 0.8;
const WHITE_KEYS = [0, 2, 4, 6, 7, 9, 11, 12, 14, 16, 18, 19, 21, 23];
const BLACK_KEYS = [1, 3, 5, 8, 10, 13, 15, 17, 20, 22];
const KEYBED_LOW = F3_MIDI + WHITE_KEYS[0];
const KEYBED_HIGH = F3_MIDI + WHITE_KEYS[WHITE_KEYS.length - 1];

// How far the octave buttons reach for a preset: the shifted keybed may hang
// at most 11 notes past either end of its instrument's range, where they fold
// back in by octaves. The piano gets ±3, the flute ±1. Kits play pieces by
// pitch class, so shifting their octave would change nothing.
const octaveLimits = ({ target, octave }: DevicePreset) => {
  const patch = PATCH_BY_ID[target];
  if (patch.family === "drums") return [0, 0] as const;
  const [low, high] = patch.range;
  return [
    Math.ceil((low - 11 - (KEYBED_LOW + octave)) / 12),
    Math.floor((high + 11 - (KEYBED_HIGH + octave)) / 12),
  ] as const;
};

const clampOctave = (shift: number, preset: DevicePreset) => {
  const [lowest, highest] = octaveLimits(preset);
  return Math.min(highest, Math.max(lowest, shift));
};

const octaveOf = (midi: number) => Math.floor(midi / 12) - 1;

const spokenNote = (midi: number) =>
  `${NOTE_NAMES[midi % 12].replace("#", " sharp")} ${octaveOf(midi)}`;

const engravedNote = (midi: number) => {
  const name = NOTE_NAMES[midi % 12].replace("#", "♯");
  return name === "C" ? `C${octaveOf(midi)}` : name;
};

const iconLabel = (icon: string) =>
  icon.charAt(0).toUpperCase() + icon.slice(1);

// Moves an item index to the same slot on the next or previous page,
// stopping at the first and last page as the knob does.
const turnPage = (
  index: number,
  direction: 1 | -1,
  perPage: number,
  count: number,
) => {
  const pages = Math.ceil(count / perPage);
  const page = Math.min(
    pages - 1,
    Math.max(0, Math.floor(index / perPage) + direction),
  );
  return Math.min(page * perPage + (index % perPage), count - 1);
};

// A value that shows for `ms` after the last show(), e.g. a footer notice or
// the level overlay while a knob turns.
function useMomentary<T>(ms: number) {
  const [value, setValue] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const show = useCallback(
    (next: T) => {
      clearTimeout(timer.current);
      setValue(next);
      timer.current = setTimeout(() => setValue(null), ms);
    },
    [ms],
  );

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setValue(null);
  }, []);

  return [value, show, hide] as const;
}

interface HeldKey {
  semitones: number[];
  midis: number[];
  // Releases the key's notes, and stops its chord's pattern.
  stop: () => void;
}

export function SynthDevice({ className }: SynthDeviceProps) {
  const library = usePresetLibrary();
  const presets = allPresets(library);
  const [preset, setPreset] = useState(() => findPreset(INITIAL_PRESET));
  const [paramIndex, setParamIndex] = useState(0);
  const [volumeStep, setVolumeStep] = useState(INITIAL_VOLUME_STEP);
  const [levelStep, setLevelStep] = useState(INITIAL_LEVEL_STEP);
  const [idleSeek, setIdleSeek] = useState(0);
  const [view, setView] = useState<ScreenView>("scope");
  // Where closing a module view goes back to.
  const [moduleReturn, setModuleReturn] = useState<ScreenView>("scope");
  const [paramPage, setParamPage] = useState(0);
  const [iconIndex, setIconIndex] = useState(0);
  const [presetIndex, setPresetIndex] = useState(0);
  // The saved preset the Delete pad removes, in the library.
  const trash =
    view === "presets" && presets[presetIndex]?.user
      ? presets[presetIndex]
      : null;
  // Where the stopped roll is scrolled to (the time on its keys line); null
  // is the end of the take.
  const [rollPosition, setRollPosition] = useState<number | null>(null);
  // Takes kept from record mode, and the one the blue knob picked.
  const {
    take,
    modules: takeModules,
    steps: stepPattern,
    songs,
    song,
    tracks,
  } = useSession();
  // The album: the open song, whose tracks the tracks view shows.
  const songIndex = Math.max(
    0,
    songs.findIndex(({ id }) => id === song),
  );
  const openSongNow = songs[songIndex] as Song | undefined;
  const [selectedIndex, setSelectedIndex] = useState(0);
  // The tracks view's zoom (a step of the zooms that fit) and the beat at
  // the left of its lanes.
  const [zoomStep, setZoomStep] = useState(0);
  const [panFrom, setPanFrom] = useState(0);
  const [octave, setOctave] = useState(0);
  // Shift and chords latch on a click; their hotkeys hold them while down.
  const [shiftLatched, setShiftLatched] = useState(false);
  const [chord, setChord] = useState<number | null>(null);
  const [chordIndex, setChordIndex] = useState(0);
  const chordMacros = useChordMacros();
  const chordStyle = useChordStyle();
  const chordStyleIndex = Math.max(
    0,
    CHORD_STYLES.findIndex(({ id }) => id === chordStyle.id),
  );
  const macroChords = chordMacros.map(chordById);
  const keys = useHotkeys();
  const activeChord = keys.chord ?? chord;
  const [litNotes, setLitNotes] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const [overlay, showOverlay] = useMomentary<ScreenOverlay>(OVERLAY_MS);
  const [notice, showFooterNotice] = useMomentary<string>(NOTICE_MS);
  // What needs attention shows over the screen, like the volume: "Press again
  // to…" for as long as the second press counts (whatever the press then does
  // clears it), and what to do first when a press can't act.
  const [prompt, showPrompt, hidePrompt] = useMomentary<string>(NOTICE_MS);
  const showNotice = (message: string) => {
    hidePrompt();
    showFooterNotice(message);
  };
  // A saved preset Stop deletes on a second press, while its warning shows.
  const [pendingDelete, armDelete] = useMomentary<string>(NOTICE_MS);
  // The Revert view's picked tile, which Save reverts on a second press.
  const [revertIndex, setRevertIndex] = useState(0);
  const [pendingRevert, armRevert] = useMomentary<string>(NOTICE_MS);
  // A pad press that binds or sets a chord macro is confirmed by a second
  // press, like the delete.
  const [pendingBind, armBind] = useMomentary<number>(NOTICE_MS);
  const [pendingChord, armChord] = useMomentary<number>(NOTICE_MS);
  const held = useRef(new Map<number, HeldKey>());
  const transport = useTransport();
  // Each song keeps its tempo and time signature: opening one sets them, and
  // changing them is kept with the song open.
  const songTiming = useRef({
    bpm: transport.bpm,
    meter: transport.meterIndex,
  });
  useEffect(() => {
    const { bpm, meterIndex } = transport;
    const last = songTiming.current;
    if (last.bpm === bpm && last.meter === meterIndex) return;
    songTiming.current = { bpm, meter: meterIndex };
    setSongTiming(bpm, METERS[meterIndex]);
  }, [transport]);
  const applySongTiming = (next: Song) => {
    transport.setBpm(next.bpm);
    transport.setMeter(
      Math.max(
        0,
        METERS.findIndex(
          ({ beats, unit }) =>
            beats === next.meter.beats && unit === next.meter.unit,
        ),
      ),
    );
  };
  const applyOpenedSong = useEffectEvent(() => {
    const opened = openedSong();
    if (opened) applySongTiming(opened);
  });
  useEffect(() => applyOpenedSong(), []);
  // The timing a held chord's pattern reads each step, so it follows the
  // tempo as it changes.
  const liveTiming = useRef(transport.timing);
  useEffect(() => {
    liveTiming.current = transport.timing;
  });
  const shift = shiftLatched || keys.shift;
  const tapMode = transport.tapping && view === "tempo";
  const barBeats = transport.timing.meter.beats;
  // The take as a potential track: the current take, named for the instrument
  // playing now. It has no mute or solo.
  const takeTrack: Track = {
    id: TAKE_ID,
    name: "Tape",
    color: "#f4f3ef",
    presetId: preset.id,
    sound: deviceEngine.sound(),
    take: take ?? { notes: [], length: 0, bpm: transport.bpm },
    timing: transport.timing,
    start: 0,
    volume: 1,
    muted: false,
    soloed: false,
  };
  const entries: readonly Track[] = [takeTrack, ...tracks];
  // The picked row, kept across views so the roll edits the picked track.
  const pickedEntry = entries[Math.min(selectedIndex, entries.length - 1)];
  const picked = view === "tracks" ? pickedEntry : undefined;
  const isTake = picked?.id === TAKE_ID;
  const track = picked && !isTake ? picked : undefined;
  // The picked row's ADSR, LFO and FX, the tape's or a track's own: the live
  // sound plays through them and the module knobs set them, a track's in
  // place (it renders again through them).
  const modules =
    pickedEntry.id === TAKE_ID ? takeModules : trackModules(pickedEntry);
  const { on: moduleOn, steps: moduleSteps } = modules;
  const modulesKey = JSON.stringify(modules);
  const modulesOwner = pickedEntry.id === TAKE_ID ? "Tape" : pickedEntry.name;
  const setModules = (next: ModuleSettings) => {
    if (pickedEntry.id === TAKE_ID) setTakeModules(next);
    else updateTrack(pickedEntry.id, modulesChange(pickedEntry, next));
  };

  // The drum sequencer (Shift + Tape): the kit playing, a row a piece, on the
  // tempo's meter. Stopped, keys set or clear their piece at the head (the
  // green knob); Play loops the pattern, and Record loops it and lands each
  // tap on the nearest step.
  const stepKit = isKit(preset.target) ? preset.target : null;
  const stepRows = stepKit ? kitRows(stepKit) : [];
  const stepCount = patternSteps(stepPattern, transport.timing.meter);
  const stepsPerBar = transport.timing.meter.beats * stepPattern.perBeat;
  const [stepCursor, setStepCursor] = useState(0);
  const stepHead = Math.min(stepCursor, stepCount - 1);
  const stepHeadRef = useRef(stepHead);
  useEffect(() => {
    stepHeadRef.current = stepHead;
  });
  const [stepRecording, setStepRecording] = useState(false);
  const stepPlayer = useStepPlayer(() => ({
    pattern: stepPattern,
    kit: stepKit ?? "drums",
    meter: transport.timing.meter,
    bpm: transport.bpm,
  }));
  const stepPosition = stepPlayer.position;
  const getStepHead = useCallback(
    () => stepPosition() ?? stepHeadRef.current,
    [stepPosition],
  );
  const stepsRunning = view === "steps" && stepPlayer.running;
  const recordingSteps = stepsRunning && stepRecording;
  const stepHits = new Set(
    stepPattern.hits.flatMap((hit) => {
      const row = stepRows.indexOf(hit.piece);
      const at = hitStep(hit, stepPattern.perBeat);
      return row < 0 || at >= stepCount ? [] : [`${row}:${at}`];
    }),
  );
  // Each entry's clip at the tempo, on a timeline at least four bars long
  // that ends on the bar after the last entry's last repeat.
  const clips = entries.map((candidate) => clipOf(candidate, transport.bpm));
  // The drum pattern, drawn on the tape's row over the take: the tape's other
  // half (see the sequencer).
  const patternClip = (() => {
    if (stepPattern.hits.length === 0) return undefined;
    const beat = 60_000 / transport.bpm;
    const drawn = patternTake(
      stepPattern,
      stepKit ?? "drums",
      transport.timing.meter,
      transport.bpm,
    );
    return {
      length: drawn.length / beat,
      offset: 0,
      repeats: 1,
      looped: false,
      notes: drawn.notes.map(({ note, start, duration }) => ({
        note,
        start: start / beat,
        length: duration / beat,
      })),
    };
  })();
  const fitSpan =
    barBeats *
    Math.max(
      4,
      Math.ceil((patternClip?.length ?? 0) / barBeats),
      ...entries.map((candidate, i) =>
        Math.ceil(
          (candidate.start +
            clips[i].offset +
            clips[i].length * clips[i].repeats) /
            barBeats,
        ),
      ),
    );
  // While a clip is trimmed (an edge dragged, or Shift turning its knobs) the
  // timeline keeps its length, so the lanes don't rescale under the edit;
  // letting go fits it again.
  const [dragSpan, setDragSpan] = useState<number | null>(null);
  const clipKnobs = view === "tracks" && shift && Boolean(track?.loop?.on);
  const [knobSpan, setKnobSpan] = useState<number | null>(null);
  const [hadClipKnobs, setHadClipKnobs] = useState(clipKnobs);
  if (clipKnobs !== hadClipKnobs) {
    setHadClipKnobs(clipKnobs);
    setKnobSpan(clipKnobs ? fitSpan : null);
  }
  const trackSpan = Math.max(fitSpan, dragSpan ?? 0, knobSpan ?? 0);
  const trackZooms = TRACK_ZOOMS.filter(
    (zoom) => zoom === 1 || trackSpan / zoom >= barBeats,
  );
  const trackZoom = trackZooms[Math.min(zoomStep, trackZooms.length - 1)];
  const trackWindow = trackSpan / trackZoom;
  const trackFrom = Math.min(Math.max(0, panFrom), trackSpan - trackWindow);
  const panTracks = (beats: number) =>
    setPanFrom(
      Math.min(Math.max(0, trackFrom + beats), trackSpan - trackWindow),
    );
  // Zooms about the middle of what the lanes show.
  const zoomTracks = (step: number) => {
    const zoom = trackZooms[step];
    setZoomStep(step);
    setPanFrom(trackFrom + trackWindow / 2 - trackSpan / zoom / 2);
  };
  // Shift + blue pans the zoomed lanes a beat a step: a bar a step would
  // land each bar line where the last one was, so the grid would look still.
  const panSteps = Math.max(2, Math.ceil(trackSpan - trackWindow) + 1);
  // The take is only an indicator; the mix plays the kept tracks.
  const mix = useTrackMix(tracks, transport.bpm, trackSpan);
  // The mix from `start` to `end` (ms), for scrubbing like a take: each
  // track's rendered pass laid at its starts, at its level, as the mixer
  // plays it.
  // `progress` hears how many of the tracks have rendered (0–1).
  const mixParts = async (
    progress?: (done: number) => void,
  ): Promise<MixPart[]> => {
    const heard = tracks.filter((track) => audible(track, tracks));
    let rendered = 0;
    const passes = await Promise.all(
      heard.map(async (track) => {
        const buffer = await mix.renderPass(track);
        progress?.(++rendered / heard.length);
        return buffer;
      }),
    );
    return heard.flatMap((track, t) => {
      const buffer = passes[t];
      if (!buffer || track.volume === 0) return [];
      const pass = passOf(track, transport.bpm);
      const starts = startsOf(track, pass, transport.bpm, trackSpan);
      return [{ buffer, starts, level: track.volume }];
    });
  };
  const renderMix = async (start: number, end: number) => {
    const parts = await mixParts();
    const rate = parts[0]?.buffer.sampleRate;
    if (!rate) return null;
    const out = new AudioBuffer({
      numberOfChannels: 2,
      length: Math.ceil(((end - start) * rate) / 1000),
      sampleRate: rate,
    });
    mixInto(parts, start, out.getChannelData(0), out.getChannelData(1), rate);
    return out;
  };

  // Save on the tracks downloads what they play: the mix as lossless FLAC,
  // or with Shift its notes as MIDI.
  // While the mix saves, the Device freezes under an overlay of its progress
  // (rendering the tracks, then the file), which goes once the file is
  // handed over.
  const exporting = useRef(false);
  const [saving, setSaving] = useState<ScreenOverlay | null>(null);
  const showSaving = (done: number) =>
    setSaving({
      label: "Saving",
      value: done,
      display: `${Math.round(done * 100)}%`,
    });
  const exportMix = async (format: "audio" | "midi") => {
    if (!tracks.some((track) => audible(track, tracks))) {
      showPrompt("No tracks to save");
      return;
    }
    if (exporting.current) return;
    exporting.current = true;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const name = `studio-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    try {
      if (format === "midi") {
        const parts: MidiPart[] = tracks
          .filter((track) => audible(track, tracks))
          .map((track) => {
            const pass = passOf(track, transport.bpm);
            const starts = startsOf(track, pass, transport.bpm, trackSpan);
            const { target, octave } = track.sound;
            const [low, high] = PATCH_BY_ID[target].range;
            return {
              name: track.name,
              target,
              volume: track.volume,
              notes: starts.flatMap((at) =>
                pass.notes.map((note) => ({
                  ...note,
                  start: note.start + at,
                  note: isKit(target)
                    ? note.note
                    : foldNote(note.note + octave, low, high),
                  piece: isKit(target)
                    ? keyPiece(target, note.note)
                    : undefined,
                })),
              ),
            };
          });
        download(
          mixToMidi(parts, transport.bpm, transport.timing.meter, isKit),
          `${name}.mid`,
        );
        showNotice(`Saved ${name}.mid`);
        return;
      }
      mix.pause();
      for (const entry of held.current.values()) entry.stop();
      held.current.clear();
      deviceEngine.allNotesOff();
      setLitNotes(new Set());
      showSaving(0);
      deviceEngine.unlock();
      const parts = await mixParts((done) => showSaving(done / 2));
      const rate = parts[0]?.buffer.sampleRate;
      if (!rate) {
        showPrompt("Couldn't render the mix");
        return;
      }
      const file = await mixToFlac(parts, rate, (done) =>
        showSaving(0.5 + done / 2),
      );
      download(file, `${name}.flac`);
      showNotice(`Saved ${name}.flac`);
    } catch {
      showPrompt("Couldn't save the mix");
    } finally {
      exporting.current = false;
      setSaving(null);
    }
  };
  const mixScrub = useMixScrub(
    JSON.stringify([
      transport.bpm,
      trackSpan,
      tracks.map((track) => [
        track.id,
        track.start,
        track.sound,
        track.take,
        track.loop?.on ? track.loop : null,
        track.repeats,
        audible(track, tracks) ? track.volume : 0,
      ]),
    ]),
    renderMix,
  );
  // Where the mix was last scrubbed to (ms), so the playhead follows it until
  // playback takes over.
  const [mixScrubPos, setMixScrubPos] = useState<number | null>(null);
  const scrubMix = (to: number) => {
    mixScrub.scrollTo(to, mixScrubPos ?? 0);
    setMixScrubPos(to);
    // Move the play position too, so Play resumes from where it was scrubbed.
    mix.seek(to / beatMs(transport.timing));
  };
  const mixBars = Math.max(
    1,
    Math.ceil((trackSpan * beatMs(transport.timing)) / barMs(transport.timing)),
  );
  const mixAt = mixScrubPos ?? (mix.position() ?? 0) * beatMs(transport.timing);
  const mixBar = Math.min(
    mixBars - 1,
    Math.floor(mixAt / barMs(transport.timing)),
  );
  // The seek knob is continuous in milliseconds, so scrubbing follows the
  // drag rather than snapping to a grid.
  const mixSteps = Math.max(
    2,
    Math.round(trackSpan * beatMs(transport.timing)),
  );
  const mixStep = Math.min(mixSteps - 1, mixAt);
  // What the Play pad shows: the mix on the tracks view, else the take. A
  // track's effects keep Play on the tracks, so each turn of a knob is heard
  // on the track itself.
  const tuningTrack =
    (view === "adsr" || view === "lfo" || view === "fx") &&
    pickedEntry.id !== TAKE_ID;
  const mixView = view === "tracks" || view === "album" || tuningTrack;
  const playing = mixView
    ? mix.playing
    : view === "steps"
      ? stepsRunning && !recordingSteps
      : transport.state === "playing";
  const pauseMix = mix.pause;
  // The mix plays on the tracks view, the album and a track's effects, and
  // under a take while it records.
  const recording = transport.state === "recording";
  useEffect(() => {
    if (!mixView && !recording) pauseMix();
  }, [mixView, recording, pauseMix]);
  const recordMode = view === "roll";
  const stopStepPlayer = stepPlayer.stop;
  // The instrument the sequencer swapped for a drum kit, put back when it
  // closes, so the tape and keys don't stay on drums.
  const beforeSteps = useRef<DevicePreset | null>(null);
  // The preset's own values plus any edits made since it was picked.
  const edits = library.edits[preset.id];
  const values = { ...presetValues(preset), ...edits };
  const specs = PATCH_BY_ID[preset.target].params;
  const selected = specs[Math.min(paramIndex, specs.length - 1)];
  const selectedValue = values[selected.id] ?? selected.default;
  // A param with named choices (the oscillator's wave) steps through them.
  const valueSteps = selected.options?.length ?? KNOB_STEPS;

  useEffect(() => {
    const initial = findPreset(INITIAL_PRESET);
    deviceEngine.loadPreset(initial, presetEdits(initial.id));
    deviceEngine.setVolume(INITIAL_VOLUME_STEP / (KNOB_STEPS - 1));
    deviceEngine.setLevel(INITIAL_LEVEL_STEP / (KNOB_STEPS - 1));
  }, []);

  useEffect(() => applyModules(JSON.parse(modulesKey)), [modulesKey]);

  useEffect(() => {
    const heldKeys = held.current;
    const releaseAll = () => {
      if (heldKeys.size === 0) return;
      for (const entry of heldKeys.values()) entry.stop();
      heldKeys.clear();
      deviceEngine.allNotesOff();
      setLitNotes(new Set());
    };
    const releaseWhenHidden = () => {
      if (document.hidden) releaseAll();
    };
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", releaseWhenHidden);
    return () => {
      releaseAll();
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", releaseWhenHidden);
    };
  }, []);

  const syncLitNotes = () =>
    setLitNotes(
      new Set([...held.current.values()].flatMap(({ semitones }) => semitones)),
    );

  // Revert closes on any press but its own (Delete, Shift, the arrows and
  // knobs), so it never traps anyone; the press then does what it does.
  const leaveRevert = () => {
    if (view === "revert") setView("scope");
  };

  const pressKey = (root: number, chordToPlay = activeChord) => {
    if (held.current.has(root)) return;
    leaveRevert();
    deviceEngine.unlock();
    if (tapMode) transport.tapNote();
    const intervals =
      chordToPlay === null ? [0] : macroChords[chordToPlay].intervals;
    const semitones = intervals.map((interval) => root + interval);
    const midis = semitones.map((semitone) => F3_MIDI + semitone + 12 * octave);
    // A chord plays in the chord style; the sequencer takes it as a block.
    const stop = playChord(
      midis,
      chordToPlay === null || view === "steps"
        ? DEFAULT_CHORD_STYLE
        : chordStyle,
      () => beatMs(liveTiming.current) / chordStyle.perBeat,
      {
        on: (midi) => {
          deviceEngine.noteOn(midi, KEY_VELOCITY);
          transport.capture(midi, true, KEY_VELOCITY);
        },
        off: (midi) => {
          deviceEngine.noteOff(midi);
          transport.capture(midi, false);
        },
      },
    );
    held.current.set(root, { semitones, midis, stop });
    syncLitNotes();
    if (view === "steps" && stepKit)
      for (const piece of new Set(midis.map((midi) => keyPiece(stepKit, midi))))
        tapStep(piece);
  };

  const releaseKey = (root: number) => {
    const entry = held.current.get(root);
    if (!entry) return;
    held.current.delete(root);
    entry.stop();
    syncLitNotes();
  };

  // Keeps the selected param when the next instrument has it too, and the
  // octave shift as far as the next one's range allows.
  const selectPreset = (next: DevicePreset) => {
    deviceEngine.unlock();
    deviceEngine.loadPreset(next, library.edits[next.id]);
    setPreset(next);
    setOctave((current) => clampOctave(current, next));
    const index = Math.max(
      0,
      PATCH_BY_ID[next.target].params.findIndex(({ id }) => id === selected.id),
    );
    setParamIndex(index);
    setParamPage(Math.floor(index / PARAMS_PER_PAGE));
  };

  const restoreAfterSteps = useEffectEvent(() => {
    const before = beforeSteps.current;
    beforeSteps.current = null;
    if (before) selectPreset(before);
  });
  useEffect(() => {
    if (view === "steps") return;
    stopStepPlayer();
    restoreAfterSteps();
  }, [view, stopStepPlayer]);

  const step = (direction: 1 | -1) => {
    if (view === "synth") {
      const count = Math.ceil(specs.length / PARAMS_PER_PAGE);
      showParamPage(turnPage(paramPage, direction, 1, count));
    } else if (view === "save") {
      setIconIndex((index) =>
        turnPage(index, direction, TILES_PER_PAGE.save, ICON_CHOICES.length),
      );
    } else if (view === "presets") {
      setPresetIndex((index) =>
        turnPage(index, direction, TILES_PER_PAGE.presets, presets.length),
      );
    } else if (view === "chords") {
      setChordIndex((index) =>
        turnPage(index, direction, TILES_PER_PAGE.chords, CHORD_PALETTE.length),
      );
    } else if (view === "revert") {
      setRevertIndex((index) =>
        turnPage(index, direction, TILES_PER_PAGE.revert, revertOptions.length),
      );
    } else if (view === "tempo") {
      transport.setBpm(transport.bpm + direction);
    } else if (view === "steps") {
      moveStepHead(stepHeadRef.current + direction);
    } else if (view === "chordStyle") {
      pickChordStyle(chordStyleIndex + direction);
    } else if (view === "album") {
      pickSong(songIndex + direction);
    } else if (view === "tracks") {
      if (shift) repeatTrack(direction);
      else slideTrack(direction * barBeats);
    } else if (shift) {
      const index = presets.findIndex(({ id }) => id === preset.id) + direction;
      selectPreset(presets[(index + presets.length) % presets.length]);
    } else {
      setOctave((current) => clampOctave(current + direction, preset));
    }
  };

  const padBindings = shift ? library.shiftButtons : library.buttons;

  // Record arms a take on the roll and Play starts it, like a tape deck. It
  // stays armed only while the roll is showing. The roll picks the take's row,
  // so it records through the take's own effects.
  const [armed, setArmed] = useState(false);
  const [armedView, setArmedView] = useState(view);
  if (view !== armedView) {
    setArmedView(view);
    if (view !== "roll") setArmed(false);
    if (view === "roll" || view === "steps") setSelectedIndex(0);
  }
  const recordArmed = armed && view === "roll";

  // Starts the armed take. The tracks play along from the top, lined up with
  // it.
  const startRecording = () => {
    setArmed(false);
    const origin = transport.record();
    if (origin !== null && entries.length > 0) mix.follow(origin);
  };

  // Holds the take where it is, so Play resumes there.
  const pause = () => {
    setRollPosition(transport.roll().now);
    transport.stop();
  };

  // One thing plays at a time: the tracks or the sequencer starting pauses
  // the tape, which otherwise plays on in other views.
  const pauseTape = () => {
    if (transport.state === "playing") pause();
  };

  // A key in the sequencer: recording, it lands on the nearest step; stopped,
  // it sets or clears its piece at the head; playing, it only plays.
  const tapStep = (piece: DrumPieceId) => {
    if (recordingSteps) {
      const at = stepPlayer.nearest(piece);
      if (at !== null)
        setSteps((current) => addHit(current, piece, at, KEY_VELOCITY));
      return;
    }
    if (!stepsRunning)
      setSteps((current) =>
        toggleHit(current, piece, stepHeadRef.current, KEY_VELOCITY),
      );
  };

  // Clicking a cell sets or clears it, sounding a hit it sets.
  const toggleStep = (row: number, at: number) => {
    const piece = stepRows[row];
    if (!piece || !stepKit) return;
    if (!stepHits.has(`${row}:${at}`)) {
      deviceEngine.unlock();
      deviceEngine.hit(stepKit, piece, KEY_VELOCITY);
    }
    setSteps((current) => toggleHit(current, piece, at, KEY_VELOCITY));
  };

  // Moving the stopped head sounds the step it lands on, like scrubbing.
  const moveStepHead = (to: number) => {
    const at = Math.max(0, Math.min(stepCount - 1, to));
    if (at === stepHeadRef.current) return;
    stepHeadRef.current = at;
    setStepCursor(at);
    if (!stepKit || stepsRunning) return;
    deviceEngine.unlock();
    for (const hit of hitsAt(stepPattern, at))
      deviceEngine.hit(stepKit, hit.piece, hit.velocity);
  };

  // A new resolution keeps the head on the same beat.
  const setStepResolution = (index: number) => {
    const perBeat = STEP_RESOLUTIONS[index];
    const beat = stepHeadRef.current / stepPattern.perBeat;
    setSteps((current) => ({ ...current, perBeat }));
    setStepCursor(Math.round(beat * perBeat));
  };

  // Stopping leaves the head where the loop got to.
  const stopSteps = () => {
    const at = stepPlayer.position();
    stepPlayer.stop();
    setStepRecording(false);
    if (at !== null) setStepCursor(at);
  };

  const playSteps = (recording: boolean) => {
    setStepRecording(recording);
    if (stepPlayer.running) return;
    pauseTape();
    stepPlayer.start(stepHeadRef.current);
  };

  // Opens the sequencer on a kit: the one playing, or the drum kit. With a
  // drum track picked it loads the track, kit, grid and time signature, and
  // saving the pattern then updates the track.
  const toggleSteps = () => {
    if (view === "steps") {
      setView("scope");
      return;
    }
    const loading =
      pickedEntry.id !== TAKE_ID && isKit(pickedEntry.sound.target)
        ? pickedEntry
        : null;
    const kit = loading
      ? presets.find(({ id }) => id === loading.presetId)
      : stepKit
        ? null
        : findPreset("drums");
    if (kit && kit.id !== preset.id) {
      if (!stepKit) beforeSteps.current = preset;
      selectPreset(kit);
    }
    // The tape holds just the track: its take is cleared too.
    if (loading && isKit(loading.sound.target)) {
      setSteps(takePattern(loading.take, loading.sound.target, loading.timing));
      setTake(null);
      transport.setMeter(meterIndexOf(loading.timing.meter));
      setStepCursor(0);
    }
    setView("steps");
  };

  // Save in the sequencer keeps the pattern as a new track on its grid, with
  // the tape's effects, and shows it on the tracks.
  const saveSteps = () => {
    if (!stepKit) return;
    const { meter } = transport.timing;
    const kept = patternTake(stepPattern, stepKit, meter, transport.bpm);
    if (kept.notes.length === 0) {
      showPrompt("Set some steps first");
      return;
    }
    stopSteps();
    const saved = makeTrack(
      tracks.length,
      preset.name,
      kept,
      preset.id,
      deviceEngine.sound(),
      takeModules,
      { ...transport.timing, perBeat: stepPattern.perBeat },
    );
    setTracks((current) => [...current, saved]);
    setSelectedIndex(tracks.length + 1);
    setMixScrubPos(null);
    mix.stop();
    setView("tracks");
    showNotice(`Saved ${saved.name}`);
  };

  // Play and pause in one: plays the take from where the stopped roll is
  // scrolled to (from the top when it rests at the end), and pauses it while
  // it plays. Armed, it starts recording; while recording, it ends the take.
  const pressPlay = () => {
    leaveRevert();
    if (view === "steps") {
      if (stepsRunning && !recordingSteps) stopSteps();
      else playSteps(false);
      return;
    }
    if (mixView) {
      setMixScrubPos(null);
      if (mix.playing) {
        mix.pause();
        return;
      }
      pauseTape();
      mix.play();
      return;
    }
    if (transport.state === "recording") {
      transport.stop();
      return;
    }
    if (recordArmed) {
      deviceEngine.unlock();
      startRecording();
      return;
    }
    if (transport.state === "playing") {
      pause();
      return;
    }
    deviceEngine.unlock();
    const from =
      rollPosition !== null && rollPosition < transport.takeLength
        ? rollPosition
        : 0;
    setRollPosition(null);
    transport.play(from);
  };

  // Stops playback. On the tracks it rewinds to the very start; on the take it
  // holds like pause, and a second press scrolls the take back to the top.
  // While recording it ends the take, and while armed it disarms.
  const pressStop = () => {
    leaveRevert();
    if (view === "steps") {
      if (stepsRunning) stopSteps();
      else moveStepHead(0);
      return;
    }
    if (mixView) {
      setMixScrubPos(null);
      mix.stop();
      return;
    }
    if (transport.state === "recording") {
      transport.stop();
      return;
    }
    if (recordArmed) {
      setArmed(false);
      return;
    }
    if (view === "roll") {
      if (transport.state === "playing") pause();
      else setRollPosition(0);
      return;
    }
    if (transport.state === "playing") pause();
  };

  // In the library Stop is Trash while a saved preset is highlighted; built-in
  // ones can't be deleted, so it stays Stop for them. Deleting the preset
  // playing falls back to its built-in.
  const pressDelete = (chosen: DevicePreset) => {
    if (pendingDelete !== chosen.id) {
      armDelete(chosen.id);
      showPrompt(`Press again to delete ${chosen.name}`);
      return;
    }
    deletePreset(chosen.id);
    showNotice(`Deleted ${chosen.name}`);
    setPresetIndex((index) => Math.max(0, Math.min(index, presets.length - 2)));
    if (preset.id === chosen.id)
      selectPreset(
        DEVICE_PRESETS.find(({ target }) => target === chosen.target) ??
          DEVICE_PRESETS[0],
      );
  };

  // The dedicated Trash: deletes the highlighted saved preset in the library,
  // or the picked track on the tracks view; press again to confirm.
  // Shift + Delete opens Revert from anywhere; there Delete reverts the
  // picked tile (on a second press) and Shift + Delete closes it.
  const pressTrash = () => {
    if (view === "revert") {
      if (shift) setView("scope");
      else pressRevert();
      return;
    }
    if (shift) {
      setShiftLatched(false);
      setView("revert");
      return;
    }
    if (trash) {
      pressDelete(trash);
      return;
    }
    if (view === "album") {
      if (!openSongNow) return;
      if (pendingDelete !== openSongNow.id) {
        armDelete(openSongNow.id);
        showPrompt(`Press again to delete ${openSongNow.name}`);
        return;
      }
      leaveSong();
      const opened = deleteSong(openSongNow.id);
      if (opened) applySongTiming(opened);
      showNotice(`Deleted ${openSongNow.name}`);
      return;
    }
    if (view === "steps") {
      if (stepPattern.hits.length === 0) return;
      if (pendingDelete !== "steps") {
        armDelete("steps");
        showPrompt("Press again to clear the steps");
        return;
      }
      setSteps((current) => ({ ...current, hits: [] }));
      showNotice("Cleared the steps");
      return;
    }
    if (view !== "tracks" || !picked) return;
    if (isTake) {
      if (pendingDelete !== TAKE_ID) {
        armDelete(TAKE_ID);
        showPrompt("Press again to discard the tape");
        return;
      }
      setTake(null);
      setSteps((current) => ({ ...current, hits: [] }));
      showNotice("Discarded the tape");
      return;
    }
    if (!track) return;
    if (pendingDelete !== track.id) {
      armDelete(track.id);
      showPrompt(`Press again to delete ${track.name}`);
      return;
    }
    setTracks((current) =>
      current.filter((candidate) => candidate.id !== track.id),
    );
    setSelectedIndex((index) =>
      Math.max(0, Math.min(index, entries.length - 2)),
    );
    showNotice(`Deleted ${track.name}`);
  };

  // Arms a take, showing the roll, or disarms it; Play then starts it. While
  // recording it ends the take where it stops. On the tracks, with a track
  // picked, it is the track's Loop instead (see pressLoop). Each recording replaces the
  // take from the top; the tracks are never touched.
  const pressRecord = () => {
    leaveRevert();
    deviceEngine.unlock();
    if (view === "steps") {
      if (recordingSteps) stopSteps();
      else playSteps(true);
      return;
    }
    if (track) {
      pressLoop(track);
      return;
    }
    if (transport.state === "recording") {
      transport.stop();
      return;
    }
    if (recordArmed) {
      setArmed(false);
      return;
    }
    setView("roll");
    setArmed(true);
  };

  // Like a module pad: it opens the tempo view, and with Shift starts or
  // stops the click without leaving the current view.
  const pressMetronome = () => {
    leaveRevert();
    if (shift) {
      deviceEngine.unlock();
      transport.toggleMetronome();
      return;
    }
    transport.stopTapping();
    setView((current) => (current === "tempo" ? "scope" : "tempo"));
  };

  const pressTool = (pad: Tool) => {
    if (pad === "record") pressRecord();
    else if (pad === "play") pressPlay();
    else if (pad === "stop") pressStop();
    else if (pad === "tracks") pressTracks();
    else if (pad === "take") pressTake();
    else if (pad === "metronome") pressMetronome();
    else if (pad === "synth") pressSynth();
    else if (pad === "save") pressSave();
    else if (pad === "delete") pressTrash();
    else if (pad === "mute") pressMute();
    else pressModule(pad);
  };

  // A pad's keycap badge, pressed in while its key is held.
  const hotkeyProps = (control: Control) => ({
    hotkey: hotkeyLabel(control),
    held: keys.isHeld(control),
  });

  const toolHotkey = (tool: Tool) => hotkeyProps({ kind: "tool", tool });

  const toggleChord = (index: number) =>
    setChord((current) => (current === index ? null : index));

  // In the chord palette a pad sets its macro to the highlighted chord; on the
  // Device a pad latches its macro.
  const pressChordPad = (index: number) => {
    leaveRevert();
    if (view === "chords") {
      const chosen = CHORD_PALETTE[chordIndex];
      // Set the macro on a second press of the same pad, like the delete.
      if (pendingChord !== index) {
        armChord(index);
        showPrompt(`Press again to set chord ${index + 1} to ${chosen.name}`);
        return;
      }
      setChordMacro(index, chosen.id);
      showNotice(`Chord ${index + 1} → ${chosen.name}`);
      return;
    }
    toggleChord(index);
  };

  // Mutes the picked track on the tracks; elsewhere it opens the chord
  // palette, or with Shift how the chords play.
  const pressMute = () => {
    leaveRevert();
    if (view === "tracks") {
      pressTrackSwitch();
      return;
    }
    if (view === "chordStyle") {
      setView("scope");
      return;
    }
    if (shift) {
      setShiftLatched(false);
      setView("chordStyle");
      return;
    }
    setView((current) => (current === "chords" ? "scope" : "chords"));
  };

  const pickChordStyle = (index: number) =>
    setChordStyle({
      id: CHORD_STYLES[Math.max(0, Math.min(index, CHORD_STYLES.length - 1))]
        .id,
    });

  // With Shift a pad plays, binds or saves to its alternate.
  const padName = (pad: number) => `${shift ? "Shift pad" : "Pad"} ${pad + 1}`;

  const pressPresetPad = (pad: number) => {
    leaveRevert();
    if (view === "presets") {
      const chosen = presets[presetIndex];
      // Bind on a second press of the same pad, like the delete.
      if (pendingBind !== pad) {
        armBind(pad);
        showPrompt(`Press again to bind to ${padName(pad).toLowerCase()}`);
        return;
      }
      bindPad(pad, chosen.id, shift);
      showNotice(`${padName(pad)} → ${chosen.name}`);
      return;
    }
    if (view === "save") {
      saveToPad(pad);
      return;
    }
    const bound = presets.find(({ id }) => id === padBindings[pad]);
    if (!bound) return;
    if (view === "steps" && !isKit(bound.target)) {
      showPrompt("The sequencer plays drum kits");
      return;
    }
    selectPreset(bound);
    // A Shift preset trades places with the pad's own and Shift lets go, so
    // the pad's light keeps showing what plays.
    if (shift) {
      swapPad(pad);
      setShiftLatched(false);
    }
  };

  // Either of its views closes on another press, Shift or not.
  const pressSynth = () => {
    leaveRevert();
    if (view === "presets" || view === "synth") {
      setView("scope");
      return;
    }
    if (shift) {
      setParamPage(Math.floor(paramIndex / PARAMS_PER_PAGE));
      setView((current) => (current === "synth" ? "scope" : "synth"));
      return;
    }
    setPresetIndex(
      Math.max(
        0,
        presets.findIndex(({ id }) => id === preset.id),
      ),
    );
    setView("presets");
  };

  // Opens or closes the tracks. While recording it ends the take, like Record.
  const pressTracks = () => {
    leaveRevert();
    setRollPosition(null);
    if (transport.state === "recording") {
      transport.stop();
      return;
    }
    if (view === "album") {
      setView("scope");
      return;
    }
    if (shift) {
      setShiftLatched(false);
      setView("album");
      return;
    }
    setView((current) => (current === "tracks" ? "scope" : "tracks"));
  };

  // Leaving a song stops its mix and puts the tracks view back at its start.
  const leaveSong = () => {
    mix.stop();
    setMixScrubPos(null);
    setSelectedIndex(0);
    setZoomStep(0);
    setPanFrom(0);
  };

  // Opens the album's song at `index`, with its tempo and time signature.
  const pickSong = (index: number) => {
    const next = songs[Math.max(0, Math.min(index, songs.length - 1))];
    if (!next || next.id === song) return;
    leaveSong();
    openSong(next.id);
    applySongTiming(next);
  };

  // Save on the album starts an empty song at the tempo playing now.
  const startSong = () => {
    leaveSong();
    const started = newSong(transport.bpm, transport.timing.meter);
    showNotice(`Started ${started.name}`);
  };

  // Opens or closes the take (record mode), which Record also opens. While
  // recording it ends the take.
  const pressTake = () => {
    leaveRevert();
    setRollPosition(null);
    if (transport.state === "recording") {
      transport.stop();
      return;
    }
    setShiftLatched(false);
    if (shift || view === "steps") {
      toggleSteps();
      return;
    }
    if (view === "roll") {
      setView("scope");
      return;
    }
    // Load the picked track onto the tape, with its instrument, effects, time
    // signature and grid, so the roll shows and plays it as the track does;
    // saving the tape then adds it as a new track, leaving the old one be.
    const loading = pickedEntry.id !== TAKE_ID ? pickedEntry : null;
    if (loading) {
      const own = presets.find(({ id }) => id === loading.presetId);
      if (own && own.id !== preset.id) selectPreset(own);
      // The tape holds just the track: its drum pattern is cleared too.
      setTake(loading.take);
      setSteps((current) => ({ ...current, hits: [] }));
      setTakeModules(trackModules(loading));
      const { meter, perBeat } = loading.timing;
      transport.setMeter(
        Math.max(
          0,
          METERS.findIndex(
            ({ beats, unit }) => beats === meter.beats && unit === meter.unit,
          ),
        ),
      );
      transport.setGrid(Math.max(0, SUBDIVISIONS.indexOf(perBeat)));
    }
    setView("roll");
  };

  // Save in record mode keeps the take as a new track, with the preset and
  // timing it plays with now, and shows it on the tracks from the top. Tracks
  // are never changed in place: a track loaded onto the tape saves as a new
  // one.
  const saveTrack = () => {
    const recorded = transport.keepTake();
    if (!recorded) {
      showPrompt("Record on the tape first");
      return;
    }
    const kept = makeTrack(
      tracks.length,
      preset.name,
      recorded,
      preset.id,
      deviceEngine.sound(),
      takeModules,
      { ...transport.timing, bpm: recorded.bpm },
    );
    setTracks((current) => [...current, kept]);
    setSelectedIndex(tracks.length + 1);
    setTake(null);
    setMixScrubPos(null);
    mix.stop();
    setView("tracks");
    showNotice(`Saved ${kept.name}`);
  };

  const updateTrack = (id: string, change: Partial<Track>) =>
    setTracks((current) =>
      current.map((candidate) =>
        candidate.id === id ? { ...candidate, ...change } : candidate,
      ),
    );

  // Where a track starts on the timeline, as the footer shows it.
  const startLabel = (beats: number) =>
    `Bar ${Math.floor(beats / barBeats) + 1}${
      beats % barBeats ? ` beat ${Math.floor(beats % barBeats) + 1}` : ""
    }`;

  // The arrows slide the picked track along the timeline by bars; Shift and
  // the blue knob slide it by beats. The take doesn't move.
  const slideTrack = (beats: number) => {
    if (!track) return;
    updateTrack(track.id, { start: Math.max(0, track.start + beats) });
  };

  // Shift and the arrows play the picked track once more or once less, back
  // to back: at least once, and for at most an hour.
  const repeatTrack = (direction: 1 | -1) => {
    if (!track) return;
    const repeats = Math.min(
      maxRepeats(track, transport.bpm),
      Math.max(1, repeatsOf(track) + direction),
    );
    updateTrack(track.id, { repeats });
  };

  // The picked track's loop while it plays. Shift turns the red and blue
  // knobs over to its edges, a step at a time: red its start, blue its end.
  const trackLoop = track?.loop?.on ? track.loop : null;
  const loopUnit = track ? loopStep(track) : 1;
  const loopReach = track ? takeBeats(track) : 0;
  const loopSteps = Math.max(2, Math.ceil(loopReach / loopUnit) + 1);
  const loopLabel = (beats: number) =>
    positionLabel(
      beats,
      track?.timing.meter.beats ?? barBeats,
      track ? gridSteps(track) : 4,
    );
  // Dragging a clip's edge trims it to a loop, a grid step at a time (finer
  // than the knobs); it picks that track too.
  const dragLoopEdge = (
    index: number,
    edge: "start" | "end",
    beats: number,
  ) => {
    const dragged = entries[index];
    if (!dragged || dragged.id === TAKE_ID) return;
    const unit = 1 / gridSteps(dragged);
    const reach = takeBeats(dragged);
    const at = Math.min(
      reach,
      Math.max(
        0,
        Math.round(takeBeatsAt(dragged, transport.bpm, beats) / unit) * unit,
      ),
    );
    // A clip without its loop on trims from the whole take.
    const { start, end } = dragged.loop?.on
      ? dragged.loop
      : { start: 0, end: reach };
    setSelectedIndex(index);
    updateTrack(dragged.id, {
      loop:
        edge === "start"
          ? { start: Math.max(0, Math.min(at, end - unit)), end, on: true }
          : { start, end: Math.max(at, start + unit), on: true },
    });
  };
  const setLoopEdge = (edge: "start" | "end", step: number) => {
    if (!track || !trackLoop) return;
    const at = Math.min(step * loopUnit, loopReach);
    const { start, end } = trackLoop;
    updateTrack(track.id, {
      loop:
        edge === "start"
          ? { ...trackLoop, start: Math.max(0, Math.min(at, end - loopUnit)) }
          : { ...trackLoop, end: Math.max(at, start + loopUnit) },
    });
  };

  // On the tracks the Record pad clips the picked track to its loop (the
  // section it plays and repeats) or lets it play whole, keeping the edges; at
  // first the clip spans the whole take. With Shift, while it is clipped, it
  // trims the track for good to its clip in one press, and a latched Shift
  // lets go.
  const pressLoop = (looping: Track) => {
    if (!shift || !looping.loop?.on) {
      updateTrack(looping.id, {
        loop: looping.loop
          ? { ...looping.loop, on: !looping.loop.on }
          : { start: 0, end: takeBeats(looping), on: true },
      });
      return;
    }
    updateTrack(looping.id, cutToLoop(looping, transport.bpm));
    setShiftLatched(false);
    showNotice(`Trimmed ${looping.name} to its clip`);
  };

  // The picked track's mute, and with Shift its solo. The take has neither.
  const pressTrackSwitch = () => {
    if (!track) return;
    if (shift) updateTrack(track.id, { soloed: !track.soloed });
    else updateTrack(track.id, { muted: !track.muted });
  };

  // How the sound is made: the model's exciter, then each module layered over
  // it that's on. Saved presets are named after it.
  const soundName = () =>
    [
      engineName(preset.target),
      ...MODULE_IDS.filter((id) => moduleOn[id]).map(
        (id) => DEVICE_MODULES[id].label,
      ),
    ].join(" · ");

  // With Shift, while the picked track loops, the Save pad cuts it.
  const cutPad = shift && trackLoop !== null;

  // Shift + Save resets the preset instead. Neither applies to the tempo, so
  // in its view Save switches tap mode, where played notes tap the tempo.
  const pressSave = () => {
    leaveRevert();
    if (view === "revert") return;
    if (view === "album") {
      startSong();
      return;
    }
    if (view === "tracks") {
      void exportMix(shift ? "midi" : "audio");
      return;
    }
    // On the roll, Save keeps the take as a track.
    if (view === "roll") {
      saveTrack();
      return;
    }
    if (view === "tempo") {
      if (transport.tapping) transport.stopTapping();
      else transport.startTapping();
      return;
    }
    if (view === "steps") {
      saveSteps();
      return;
    }
    if (view === "synth") {
      setIconIndex(Math.max(0, ICON_CHOICES.indexOf(preset.icon)));
      setView("save");
      return;
    }
    if (view !== "save") return;
    const saved = savePreset(
      preset,
      values,
      ICON_CHOICES[iconIndex],
      soundName(),
    );
    clearEdits(preset.id);
    finishSave(saved, `Saved ${saved.name}`);
  };

  // Saving onto the pad that already holds this saved preset overwrites it;
  // anything else becomes a new preset bound to that pad.
  const saveToPad = (pad: number) => {
    const icon = ICON_CHOICES[iconIndex];
    const saved =
      preset.user && padBindings[pad] === preset.id
        ? updatePreset(preset, values, icon, soundName())
        : savePreset(preset, values, icon, soundName());
    bindPad(pad, saved.id, shift);
    clearEdits(preset.id);
    finishSave(saved, `Saved ${saved.name} to ${padName(pad).toLowerCase()}`);
  };

  // Saving bakes the edits into the saved preset, so the one it came from goes
  // back to its own values.
  const finishSave = (saved: DevicePreset, message: string) => {
    deviceEngine.loadPreset(saved);
    setPreset(saved);
    setView("scope");
    showNotice(message);
  };

  // The green knob picks a param on the scope, the red one on the synth page;
  // the blue one sets its value on both. The screen shows them in their knob
  // colours.
  const selectParam = (index: number) => {
    setParamIndex(index);
    setParamPage(Math.floor(index / PARAMS_PER_PAGE));
  };

  // Turning a page selects its first (top-left) param.
  const showParamPage = (page: number) => {
    setParamPage(page);
    setParamIndex(page * PARAMS_PER_PAGE);
  };

  // Turning back to the preset's own step restores its exact value and drops
  // the edit.
  const setSelectedValue = (step: number) => {
    const own = presetValues(preset)[selected.id];
    const original = step === valueToStep(selected, own, valueSteps);
    const value = original ? own : stepToValue(selected, step, valueSteps);
    deviceEngine.setValue(selected.id, value);
    setEdit(preset.id, selected.id, original ? null : value);
  };

  // Turning a module's knob switches the module on so the change is audible.
  const setModuleStep = (id: ModuleId, index: number, step: number) =>
    setModules({
      on: { ...moduleOn, [id]: true },
      steps: {
        ...moduleSteps,
        [id]: moduleSteps[id].map((value, i) => (i === index ? step : value)),
      },
    });

  // A module pad opens its view, and pressed again goes back to the view it
  // was opened from (moving between modules keeps that); with Shift it
  // switches the module on or off without leaving the current view.
  const pressModule = (id: ModuleId) => {
    leaveRevert();
    if (shift) {
      setModules({ ...modules, on: { ...moduleOn, [id]: !moduleOn[id] } });
      return;
    }
    if (view === id) {
      setView(moduleReturn);
      return;
    }
    if (view !== "adsr" && view !== "lfo" && view !== "fx")
      setModuleReturn(view === "revert" ? "scope" : view);
    setView(id);
  };

  const setVolume = (step: number) => {
    setVolumeStep(step);
    deviceEngine.setVolume(step / (KNOB_STEPS - 1));
    showOverlay({
      label: "Volume",
      value: step / (KNOB_STEPS - 1),
      display: `${step * 10}%`,
    });
  };

  // What Revert can put back, a tile each: the sounds' edits, the pads and
  // chords as built in, and the modules, tempo and levels as they start.
  const revertOptions: readonly {
    id: string;
    label: string;
    detail: string;
    icon: React.ReactNode;
    run: () => void;
  }[] = [
    {
      id: "sound",
      label: "This sound",
      detail: `${preset.name}'s settings`,
      icon: <SlidersHorizontal />,
      run: () => {
        clearEdits(preset.id);
        deviceEngine.loadPreset(preset);
      },
    },
    {
      id: "sounds",
      label: "All sounds",
      detail: "Every preset's settings",
      icon: <Layers />,
      run: () => {
        clearAllEdits();
        deviceEngine.loadPreset(preset);
      },
    },
    {
      id: "pads",
      label: "Preset pads",
      detail: "The built-in presets on the pads",
      icon: <LayoutGrid />,
      run: resetPads,
    },
    {
      id: "chords",
      label: "Chord pads",
      detail: "The built-in chords, played as blocks",
      icon: <Music4 />,
      run: resetChordMacros,
    },
    {
      id: "modules",
      label: "Modules",
      detail: `${modulesOwner}'s ADSR, LFO and FX, off`,
      icon: <AdsrIcon />,
      run: () => setModules(INITIAL_MODULES),
    },
    {
      id: "tempo",
      label: "Tempo",
      detail: `${DEFAULT_TIMING.bpm} BPM in ${meterLabel(DEFAULT_TIMING.meter)}, grid off`,
      icon: <Metronome />,
      run: () => {
        transport.setBpm(DEFAULT_TIMING.bpm);
        transport.setMeter(METERS.indexOf(DEFAULT_TIMING.meter));
        transport.setGrid(SUBDIVISIONS.indexOf(DEFAULT_TIMING.perBeat));
      },
    },
    {
      id: "levels",
      label: "Levels",
      detail: `Level ${INITIAL_LEVEL_STEP * 10}%, volume ${INITIAL_VOLUME_STEP * 10}%`,
      icon: <Volume2 />,
      run: () => {
        setLevelStep(INITIAL_LEVEL_STEP);
        deviceEngine.setLevel(INITIAL_LEVEL_STEP / (KNOB_STEPS - 1));
        setVolumeStep(INITIAL_VOLUME_STEP);
        deviceEngine.setVolume(INITIAL_VOLUME_STEP / (KNOB_STEPS - 1));
      },
    },
    {
      id: "everything",
      label: "Everything",
      detail: "All of the above",
      icon: <RotateCcw />,
      run: () => revertOptions.slice(0, -1).forEach((option) => option.run()),
    },
  ];
  const revertOption = revertOptions[revertIndex];

  // Save in Revert puts the picked tile back, on a second press.
  const pressRevert = () => {
    const { id, label } = revertOption;
    if (pendingRevert !== id) {
      armRevert(id);
      showPrompt(`Press Revert again to revert ${label.toLowerCase()}`);
      return;
    }
    revertOption.run();
    showNotice(`Reverted ${label.toLowerCase()}`);
  };

  // The red knob on the scope: the synth's level before the clipper.
  const setLevel = (step: number) => {
    setLevelStep(step);
    deviceEngine.setLevel(step / (KNOB_STEPS - 1));
    showOverlay({
      label: "Level",
      value: step / (KNOB_STEPS - 1),
      display: `${step * 10}%`,
    });
  };

  // In a module's view the four knobs set its params, in knob order.
  const renderModuleKnob = (
    id: ModuleId,
    index: number,
    color: string,
    markColor?: string,
  ) => {
    const knob = DEVICE_MODULES[id].knobs[index];
    const step = moduleSteps[id][index];
    return (
      <Knob
        label={knob.spec.label}
        valueLabel={knobDisplay(knob, step)}
        step={step}
        steps={knob.steps}
        color={color}
        markColor={markColor}
        onChange={(next) => setModuleStep(id, index, next)}
      />
    );
  };

  const renderModulePad = (id: ModuleId, icon: React.ReactNode) => {
    const module = DEVICE_MODULES[id];
    return (
      <Pad
        label={
          shift
            ? `Turn ${module.label} ${moduleOn[id] ? "off" : "on"}`
            : `${module.title} (${moduleOn[id] ? "on" : "off"})`
        }
        accent="var(--synth-red)"
        lit={view === id}
        indicator={moduleOn[id]}
        {...toolHotkey(id)}
        onPress={() => pressModule(id)}
      >
        {icon}
      </Pad>
    );
  };

  // With a kit selected, keys show the drum they play instead of a note name.
  const renderKey = (semitone: number, slot: number, black: boolean) => {
    const midi = F3_MIDI + semitone + 12 * octave;
    const piece = isKit(preset.target)
      ? DRUM_PIECES[keyPiece(preset.target, midi)]
      : null;
    return (
      <Key
        key={semitone}
        variant={black ? "black" : "white"}
        label={piece ? `${piece.name} (${spokenNote(midi)})` : spokenNote(midi)}
        note={
          piece ? piece.Icon ? <piece.Icon /> : piece.name : engravedNote(midi)
        }
        hotkey={hotkeyLabel({ kind: "note", semitone })}
        lit={litNotes.has(semitone)}
        className={cn(styles.slot, black ? styles.blackSlot : styles.whiteSlot)}
        style={{ "--slot": slot } as CSSProperties}
        onPress={() => pressKey(semitone)}
        onRelease={() => releaseKey(semitone)}
      />
    );
  };

  useHotkeyListener(({ control, down, held: now, ignore }) => {
    if (exporting.current) {
      ignore();
      return;
    }
    switch (control.kind) {
      case "note":
        if (down) pressKey(control.semitone, now.chord ?? chord);
        else releaseKey(control.semitone);
        return;
      // On a Shift or chord a click latched, the key releases the latch
      // instead of holding it.
      case "shift":
        if (down && shiftLatched) {
          setShiftLatched(false);
          ignore();
        }
        return;
      case "chord":
        // Holding any chord key drops a latched chord, so it doesn't come
        // back when the key is let go; the key for the latched chord just
        // stops it rather than playing it.
        if (down) {
          leaveRevert();
          if (chord !== null) setChord(null);
          if (chord === control.index) ignore();
        }
        return;
      default:
        if (!down) return;
        if (control.kind === "preset") pressPresetPad(control.index);
        else if (control.kind === "step") step(control.direction);
        else pressTool(control.tool);
    }
  });

  const selectedDisplay = formatParam(selected, selectedValue);
  const selection = (
    <>
      <ScreenSeek>{selected.label}</ScreenSeek>{" "}
      <ScreenValue>{selectedDisplay}</ScreenValue>
    </>
  );
  const params = specs.map((spec) => ({
    id: spec.id,
    label: spec.label,
    value: formatParam(spec, values[spec.id] ?? spec.default),
    selected: spec === selected,
  }));
  const pages = Math.ceil(params.length / PARAMS_PER_PAGE);
  const paging =
    view === "synth" ||
    view === "save" ||
    view === "presets" ||
    view === "chords";
  const activeModule: ModuleId | null =
    view === "adsr" || view === "lfo" || view === "fx" ? view : null;
  const readouts: ScreenReadout[] = activeModule
    ? DEVICE_MODULES[activeModule].knobs.map((knob, i) => {
        const step = moduleSteps[activeModule][i];
        const value = knobValue(knob, step);
        return {
          label: knob.spec.label,
          display: knobDisplay(knob, step),
          amount:
            knob.spec.id === "adsr.sustain" ? value : step / (knob.steps - 1),
        };
      })
    : [];
  // The Synth pad opens the library by default, the parameters with Shift.
  const synthMode = view === "synth" || shift;
  const padPresets = padBindings.map(
    (id) => presets.find((candidate) => candidate.id === id) ?? null,
  );

  // Stopped, the roll shows the whole take and scrolls by beats from its start
  // to its end. The keys line is the playhead: what crosses it plays.
  const beatLength = beatMs(transport.timing);
  const barLength = barMs(transport.timing);
  const rollEnd = transport.takeLength;
  const rollFirst = 0;
  const rollScrolls =
    view === "roll" && transport.state === "stopped" && rollEnd > 0;
  const rollAt = Math.min(rollEnd, rollPosition ?? rollEnd);
  const rollSteps = Math.max(
    2,
    Math.ceil((rollEnd - rollFirst) / beatLength) + 1,
  );
  const barOf = (ms: number) => Math.max(1, Math.ceil(ms / barLength));
  // Scrolling scrubs the take: it plays at the speed it is scrolled.
  const scrub = useScrub(
    [
      transport.takeId,
      JSON.stringify(take),
      JSON.stringify(transport.timing),
      preset.id,
      JSON.stringify(values),
      modulesKey,
      levelStep,
    ].join("|"),
    () => {
      const { now, notes } = transport.roll();
      return { notes, length: now };
    },
  );
  const stopScrub = scrub.stop;
  useEffect(() => {
    if (!rollScrolls) stopScrub();
  }, [rollScrolls, stopScrub]);

  const scrollRoll = (ms: number) =>
    setRollPosition(scrub.scrollBy(ms, rollAt, rollFirst, rollEnd));

  // The green knob scrolls whatever the screen shows; on the scope it picks a
  // param and on the tracks it seeks the mix (see the knobs), and while the
  // roll runs it is idle.
  const seek =
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
                          // The last step is the end, which stays put as the take grows.
                          set: (step: number) => {
                            const end = step >= rollSteps - 1;
                            const to = end
                              ? rollEnd
                              : rollFirst + step * beatLength;
                            scrub.scrollTo(to, rollAt);
                            setRollPosition(end ? null : to);
                          },
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
  const screen = {
    scope: {
      status: (
        <>
          {octaveLabel} · <ScreenLevel>Level {levelStep * 10}%</ScreenLevel>
        </>
      ),
      footer: [engine, selection],
    },
    // The highlighted row shows the selection, so the footer shows the page.
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
    // The picked track in blue, as the blue knob picks it, and where it
    // starts.
    tracks: {
      status: picked ? (
        <ScreenValue>
          {selectedIndex + 1}/{entries.length}
        </ScreenValue>
      ) : (
        ""
      ),
      // Left, the picked track: where it starts (or the section it's clipped
      // to), its repeats and volume; with Shift, just what the knobs move, in
      // their colours. Right, what the knobs do now.
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
    // The length and resolution in the red and blue of the knobs that set
    // them; stopped, where the head is, in green.
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
    // The meter and grid in the red and blue of the knobs that set them; when
    // stopped, the bar the green knob scrolled to, in green.
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
          <ScreenSelection
            label={meterLabel(transport.timing.meter)}
            value={gridLabel(transport.timing)}
          />
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
    // The pattern's rate and the strum's gap in the red and blue of the knobs
    // that set them.
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
  }[view];
  const screenTracks =
    view === "tracks"
      ? entries.map((candidate, i) => ({
          id: candidate.id,
          name: candidate.name,
          detail:
            presets.find(({ id }) => id === candidate.presetId)?.name ?? "",
          color: candidate.color,
          start: candidate.start,
          clip: clips[i],
          volume: candidate.volume,
          muted: candidate.muted,
          soloed: candidate.soloed,
          audible: candidate.id === TAKE_ID ? true : audible(candidate, tracks),
          potential: candidate.id === TAKE_ID,
          pattern: candidate.id === TAKE_ID ? patternClip : undefined,
        }))
      : [];
  // On/off, centred along the bottom of the module and tempo views; armed, a
  // hint along the roll's, until Play starts the take.
  const badge = activeModule
    ? { label: DEVICE_MODULES[activeModule].label, on: moduleOn[activeModule] }
    : view === "tempo"
      ? tapMode
        ? { label: "Tap a note" }
        : { label: "Metronome", on: transport.metronome }
      : recordArmed
        ? { label: "Press Play to record" }
        : null;

  return (
    <div className={cn(styles.stage, className)}>
      <div className={styles.frame}>
        <div
          className={styles.device}
          role="group"
          aria-label="Synthesizer"
          aria-busy={saving !== null}
          inert={saving !== null}
          onPointerUp={() => deviceEngine.unlock()}
        >
          <div className={styles.topRow}>
            <div className={styles.knobColumn}>
              {activeModule ? (
                renderModuleKnob(
                  activeModule,
                  0,
                  "var(--synth-chalk)",
                  "#141413",
                )
              ) : (
                <Knob
                  label="Volume"
                  valueLabel={`${volumeStep * 10}%`}
                  step={volumeStep}
                  steps={KNOB_STEPS}
                  color="var(--synth-chalk)"
                  markColor="#141413"
                  onChange={setVolume}
                />
              )}
              {activeModule ? (
                renderModuleKnob(activeModule, 1, "var(--synth-green)")
              ) : view === "scope" ? (
                <Knob
                  label="Parameter"
                  valueLabel={selected.label}
                  step={specs.indexOf(selected)}
                  steps={Math.max(2, specs.length)}
                  color="var(--synth-green)"
                  onChange={(index) =>
                    selectParam(Math.min(index, specs.length - 1))
                  }
                />
              ) : view === "tracks" && shift && track ? (
                <Knob
                  label="Slide"
                  valueLabel={startLabel(track.start)}
                  step={Math.round(track.start)}
                  steps={trackSpan + 1}
                  color="var(--synth-green)"
                  onChange={(beats) => updateTrack(track.id, { start: beats })}
                />
              ) : view === "tracks" ? (
                <Knob
                  label="Seek"
                  valueLabel={`Bar ${mixBar + 1} of ${mixBars}`}
                  step={mixStep}
                  steps={mixSteps}
                  color="var(--synth-green)"
                  fine
                  onChange={(step) => scrubMix(step)}
                />
              ) : (
                <Knob
                  label="Seek"
                  valueLabel={seek.label || undefined}
                  step={seek.step}
                  steps={seek.steps}
                  color="var(--synth-green)"
                  onChange={seek.set}
                />
              )}
            </div>

            <Grille />

            <DeviceScreen
              className={styles.screenSlot}
              view={view}
              overlay={
                saving ?? overlay ?? (prompt ? { label: prompt } : undefined)
              }
              title={
                activeModule
                  ? `${DEVICE_MODULES[activeModule].label} · ${modulesOwner}`
                  : view === "tempo"
                    ? "Tempo"
                    : view === "tracks"
                      ? `Tracks · ${openSongNow?.name ?? ""}`
                      : view === "album"
                        ? "Album"
                        : view === "chords"
                          ? "Chords"
                          : view === "chordStyle"
                            ? "Chord style"
                            : view === "revert"
                              ? "Revert"
                              : preset.name
              }
              unsaved={
                Boolean(edits) &&
                !activeModule &&
                view !== "tempo" &&
                view !== "tracks"
              }
              status={screen.status}
              footer={[notice ?? screen.footer[0], screen.footer[1]]}
              badges={badge && !notice ? [badge] : undefined}
              timing={transport.timing}
              tracks={screenTracks}
              getTrackPosition={() =>
                mixScrubPos !== null
                  ? mixScrubPos / beatMs(transport.timing)
                  : mix.position()
              }
              trackSpan={trackSpan}
              trackZoom={trackZoom}
              trackFrom={trackFrom}
              onPanTracks={panTracks}
              barBeats={barBeats}
              getRoll={transport.roll}
              rollPosition={rollScrolls ? rollAt : null}
              onRollScroll={rollScrolls ? scrollRoll : undefined}
              beat={
                tapMode
                  ? transport.tapCount > 0
                    ? (transport.tapCount - 1) % barBeats
                    : null
                  : transport.beat
              }
              getAnalyser={deviceEngine.getAnalyser}
              params={params}
              page={paramPage}
              tiles={
                view === "save"
                  ? ICON_CHOICES.map((icon) => ({
                      id: icon,
                      label: iconLabel(icon),
                      icon: <PresetIcon icon={icon} />,
                    }))
                  : view === "album"
                    ? songs.map(({ id, name }) => ({
                        id,
                        label: name,
                        icon: <Disc3 />,
                      }))
                    : view === "chordStyle"
                      ? CHORD_STYLES.map(({ id, name }) => ({
                          id,
                          label: name,
                          icon: <ChordStyleIcon pattern={id} />,
                        }))
                      : view === "revert"
                        ? revertOptions.map(({ id, label, icon }) => ({
                            id,
                            label,
                            icon,
                          }))
                        : view === "chords"
                          ? CHORD_PALETTE.map((chord) => ({
                              id: chord.id,
                              label: chord.name,
                              icon: <span>{chord.label}</span>,
                            }))
                          : presets.map((candidate) => {
                              const bound = [
                                ...library.buttons.map((id, pad) =>
                                  id === candidate.id ? `${pad + 1}` : "",
                                ),
                                ...library.shiftButtons.map((id, pad) =>
                                  id === candidate.id ? `⇧${pad + 1}` : "",
                                ),
                              ].filter(Boolean);
                              return {
                                id: candidate.id,
                                label: candidate.name,
                                icon: <PresetIcon icon={candidate.icon} />,
                                badge:
                                  bound.length > 0
                                    ? bound.join(" ")
                                    : undefined,
                              };
                            })
              }
              selected={
                view === "save"
                  ? iconIndex
                  : view === "album"
                    ? songIndex
                    : view === "chordStyle"
                      ? chordStyleIndex
                      : view === "revert"
                        ? revertIndex
                        : view === "tracks"
                          ? selectedIndex
                          : view === "chords"
                            ? chordIndex
                            : presetIndex
              }
              onSelect={
                view === "save"
                  ? setIconIndex
                  : view === "album"
                    ? pickSong
                    : view === "chordStyle"
                      ? pickChordStyle
                      : view === "revert"
                        ? setRevertIndex
                        : view === "tracks"
                          ? setSelectedIndex
                          : view === "chords"
                            ? setChordIndex
                            : setPresetIndex
              }
              onLoopEdge={dragLoopEdge}
              onLoopEdgeDrag={(dragging) =>
                setDragSpan(dragging ? trackSpan : null)
              }
              stepRows={stepRows.map((piece) => {
                const { name, Icon } = DRUM_PIECES[piece];
                return { id: piece, label: name, icon: Icon && <Icon /> };
              })}
              stepCount={stepCount}
              stepsPerBeat={stepPattern.perBeat}
              stepsPerBar={stepsPerBar}
              stepHits={stepHits}
              getStepHead={getStepHead}
              stepRecording={recordingSteps}
              onToggleStep={toggleStep}
              onMoveStep={(by) => moveStepHead(stepHeadRef.current + by)}
              onSelectParam={selectParam}
              readouts={readouts}
              lfoShape={moduleSteps.lfo[2]}
              lfoRate={knobValue(
                DEVICE_MODULES.lfo.knobs[0],
                moduleSteps.lfo[0],
              )}
            />

            <Grille />

            <div className={styles.knobColumn}>
              {activeModule ? (
                renderModuleKnob(activeModule, 2, "var(--synth-red)")
              ) : shift && trackLoop ? (
                <Knob
                  label="Clip start"
                  valueLabel={loopLabel(trackLoop.start)}
                  step={Math.round(trackLoop.start / loopUnit)}
                  steps={loopSteps}
                  color="var(--synth-red)"
                  onChange={(step) => setLoopEdge("start", step)}
                />
              ) : view === "tracks" && shift ? (
                <Knob
                  label="Zoom"
                  valueLabel={`×${trackZoom}`}
                  step={trackZooms.indexOf(trackZoom)}
                  steps={Math.max(2, trackZooms.length)}
                  color="var(--synth-red)"
                  onChange={(step) =>
                    zoomTracks(Math.min(step, trackZooms.length - 1))
                  }
                />
              ) : view === "tracks" ? (
                <Knob
                  label="Track volume"
                  valueLabel={
                    track ? `${Math.round(track.volume * 100)}%` : undefined
                  }
                  step={Math.round((track?.volume ?? 1) * (KNOB_STEPS - 1))}
                  steps={KNOB_STEPS}
                  color="var(--synth-red)"
                  onChange={(step) => {
                    if (track)
                      updateTrack(track.id, {
                        volume: step / (KNOB_STEPS - 1),
                      });
                  }}
                />
              ) : view === "chordStyle" ? (
                <Knob
                  label="Rate"
                  valueLabel={gridLabel({
                    ...transport.timing,
                    perBeat: chordStyle.perBeat,
                  })}
                  step={CHORD_RATES.indexOf(chordStyle.perBeat)}
                  steps={CHORD_RATES.length}
                  color="var(--synth-red)"
                  onChange={(index) =>
                    setChordStyle({ perBeat: CHORD_RATES[index] })
                  }
                />
              ) : view === "steps" ? (
                <Knob
                  label="Length"
                  valueLabel={`${stepPattern.bars} bar${stepPattern.bars > 1 ? "s" : ""}`}
                  step={stepPattern.bars - 1}
                  steps={MAX_STEP_BARS}
                  color="var(--synth-red)"
                  onChange={(index) =>
                    setSteps((current) => ({ ...current, bars: index + 1 }))
                  }
                />
              ) : view === "roll" ? (
                <Knob
                  label="Time signature"
                  valueLabel={meterLabel(transport.timing.meter)}
                  step={transport.meterIndex}
                  steps={METERS.length}
                  color="var(--synth-red)"
                  onChange={transport.setMeter}
                />
              ) : view === "scope" ? (
                <Knob
                  label="Level"
                  valueLabel={`${levelStep * 10}%`}
                  step={levelStep}
                  steps={KNOB_STEPS}
                  color="var(--synth-red)"
                  onChange={setLevel}
                />
              ) : (
                <Knob
                  label="Parameter"
                  valueLabel={selected.label}
                  step={specs.indexOf(selected)}
                  steps={Math.max(2, specs.length)}
                  color="var(--synth-red)"
                  onChange={(index) =>
                    selectParam(Math.min(index, specs.length - 1))
                  }
                />
              )}
              {activeModule ? (
                renderModuleKnob(activeModule, 3, "var(--synth-blue)")
              ) : shift && trackLoop ? (
                <Knob
                  label="Clip end"
                  valueLabel={loopLabel(trackLoop.end)}
                  step={Math.round(trackLoop.end / loopUnit)}
                  steps={loopSteps}
                  color="var(--synth-blue)"
                  onChange={(step) => setLoopEdge("end", step)}
                />
              ) : view === "tracks" && shift ? (
                <Knob
                  label="Scroll"
                  valueLabel={`Bar ${Math.floor(trackFrom / barBeats) + 1}.${(Math.round(trackFrom) % barBeats) + 1}`}
                  step={Math.round(trackFrom)}
                  steps={panSteps}
                  color="var(--synth-blue)"
                  onChange={(step) =>
                    setPanFrom(Math.min(step, trackSpan - trackWindow))
                  }
                />
              ) : view === "tracks" ? (
                <Knob
                  label="Track"
                  valueLabel={picked?.name}
                  step={selectedIndex}
                  steps={Math.max(2, entries.length)}
                  color="var(--synth-blue)"
                  onChange={(index) =>
                    setSelectedIndex(Math.min(index, entries.length - 1))
                  }
                />
              ) : view === "chordStyle" ? (
                <Knob
                  label="Strum"
                  valueLabel={`${chordStyle.strum} ms`}
                  step={STRUM_GAPS.indexOf(chordStyle.strum)}
                  steps={STRUM_GAPS.length}
                  color="var(--synth-blue)"
                  onChange={(index) =>
                    setChordStyle({ strum: STRUM_GAPS[index] })
                  }
                />
              ) : view === "steps" ? (
                <Knob
                  label="Resolution"
                  valueLabel={gridLabel({
                    ...transport.timing,
                    perBeat: stepPattern.perBeat,
                  })}
                  step={STEP_RESOLUTIONS.indexOf(stepPattern.perBeat)}
                  steps={STEP_RESOLUTIONS.length}
                  color="var(--synth-blue)"
                  onChange={setStepResolution}
                />
              ) : view === "roll" ? (
                <Knob
                  label="Grid"
                  valueLabel={gridLabel(transport.timing)}
                  step={transport.gridIndex}
                  steps={SUBDIVISIONS.length}
                  color="var(--synth-blue)"
                  onChange={transport.setGrid}
                />
              ) : (
                <Knob
                  label="Value"
                  valueLabel={`${selected.label} ${selectedDisplay}`}
                  step={valueToStep(selected, selectedValue, valueSteps)}
                  steps={valueSteps}
                  color="var(--synth-blue)"
                  onChange={setSelectedValue}
                />
              )}
            </div>
          </div>

          <div
            className={styles.banks}
            data-focus-group="pads"
            data-focus-order="rows"
          >
            <div className={styles.padRow}>
              <div className={styles.bank} role="group" aria-label="Tools">
                <Pad
                  label={
                    mixView
                      ? mix.playing
                        ? "Pause tracks"
                        : "Play tracks"
                      : view === "steps"
                        ? playing
                          ? "Stop the steps"
                          : "Play the steps"
                        : transport.state === "recording"
                          ? "Stop recording"
                          : recordArmed
                            ? "Start recording"
                            : playing
                              ? "Pause"
                              : "Play"
                  }
                  {...toolHotkey("play")}
                  onPress={pressPlay}
                >
                  {playing ? (
                    <Pause fill="currentColor" />
                  ) : (
                    <Play fill="currentColor" />
                  )}
                </Pad>
                <Pad
                  label={view === "tracks" ? "Stop and rewind" : "Stop"}
                  accent="var(--synth-red)"
                  {...toolHotkey("stop")}
                  onPress={pressStop}
                >
                  <Square fill="currentColor" />
                </Pad>
                <Pad
                  label={
                    cutPad
                      ? "Trim track to its clip"
                      : track
                        ? `Clip ${trackLoop ? "off" : "on"}`
                        : view === "steps"
                          ? recordingSteps
                            ? "Stop recording steps"
                            : "Record steps"
                          : transport.state === "recording"
                            ? "Stop recording"
                            : recordArmed
                              ? "Disarm recording"
                              : "Arm recording"
                  }
                  accent="var(--synth-red)"
                  lit={
                    track
                      ? trackLoop !== null
                      : transport.state === "recording" ||
                        recordArmed ||
                        recordingSteps
                  }
                  {...toolHotkey("record")}
                  onPress={pressRecord}
                >
                  {cutPad ? (
                    <ScissorsLineDashed />
                  ) : track ? (
                    <Scissors />
                  ) : (
                    <Circle fill="currentColor" />
                  )}
                </Pad>
                <Pad
                  label={
                    view === "revert"
                      ? "Save"
                      : view === "tempo"
                        ? tapMode
                          ? "Stop tap tempo"
                          : "Tap tempo"
                        : view === "tracks"
                          ? shift
                            ? "Save the tracks as MIDI"
                            : "Save the mix"
                          : view === "album"
                            ? "New song"
                            : view === "roll"
                              ? "Save tape as a track"
                              : view === "steps"
                                ? "Save steps as a track"
                                : "Save preset"
                  }
                  accent="var(--synth-red)"
                  lit={tapMode}
                  {...toolHotkey("save")}
                  onPress={pressSave}
                >
                  {view === "album" ? (
                    <Plus />
                  ) : view === "tempo" ? (
                    <Pointer />
                  ) : view === "tracks" && shift ? (
                    <FileMusic />
                  ) : (
                    <Save />
                  )}
                </Pad>
                <Pad
                  label={
                    view === "album"
                      ? "Close album"
                      : shift
                        ? "Album"
                        : "Tracks"
                  }
                  accent="var(--synth-red)"
                  lit={view === "tracks" || view === "album"}
                  {...toolHotkey("tracks")}
                  onPress={pressTracks}
                >
                  {shift || view === "album" ? <Album /> : <ChartNoAxesGantt />}
                </Pad>
                <Pad
                  label={
                    shift
                      ? `Turn metronome ${transport.metronome ? "off" : "on"}`
                      : `Tempo (metronome ${transport.metronome ? "on" : "off"})`
                  }
                  accent="var(--synth-green)"
                  lit={view === "tempo"}
                  indicator={transport.metronome}
                  {...toolHotkey("metronome")}
                  onPress={pressMetronome}
                >
                  <Metronome />
                </Pad>
              </div>
              <div className={styles.bank} role="group" aria-label="Modules">
                {renderModulePad("adsr", <AdsrIcon />)}
                <Pad
                  label={
                    view === "synth"
                      ? "Close synth parameters"
                      : view === "presets"
                        ? "Close preset library"
                        : synthMode
                          ? "Synth parameters"
                          : "Preset library"
                  }
                  accent="var(--synth-red)"
                  lit={view === "synth" || view === "presets"}
                  {...toolHotkey("synth")}
                  onPress={pressSynth}
                >
                  {synthMode ? <AudioWaveform /> : <LayoutGrid />}
                </Pad>
              </div>
              <div className={styles.bank} role="group" aria-label="Presets">
                {padPresets.map((padPreset, pad) => {
                  const name = padPreset?.name ?? "empty";
                  const current = padPreset?.id === preset.id;
                  return (
                    <Pad
                      key={pad}
                      label={
                        view === "presets"
                          ? `Bind to ${padName(pad).toLowerCase()} (${name})`
                          : view === "save"
                            ? `Save to ${padName(pad).toLowerCase()} (${name})`
                            : padPreset
                              ? `${padPreset.name}${current ? " (current)" : ""}`
                              : `Empty preset pad ${pad + 1}`
                      }
                      accent="var(--synth-red)"
                      indicator={padPreset ? current : undefined}
                      {...hotkeyProps({ kind: "preset", index: pad })}
                      onPress={() => pressPresetPad(pad)}
                    >
                      {padPreset && <PresetIcon icon={padPreset.icon} />}
                    </Pad>
                  );
                })}
              </div>
            </div>
            <div className={styles.padRow}>
              <div className={styles.bank} role="group" aria-label="Transport">
                <Pad
                  label={shiftLatched ? "Shift (latched)" : "Shift"}
                  {...hotkeyProps({ kind: "shift" })}
                  // No colour: a modifier, not a state. Latched, it stays
                  // pressed in, as it looks while its key is held.
                  held={shift}
                  onPress={() => setShiftLatched((on) => !on)}
                >
                  <ArrowUp />
                </Pad>
                <Pad
                  label={
                    paging
                      ? "Previous page"
                      : view === "tempo"
                        ? "Slower"
                        : view === "steps"
                          ? "Previous step"
                          : view === "chordStyle"
                            ? "Previous chord style"
                            : view === "album"
                              ? "Previous song"
                              : view === "tracks"
                                ? shift
                                  ? "Repeat track less"
                                  : "Slide track earlier"
                                : shift
                                  ? "Previous preset"
                                  : "Octave down"
                  }
                  accent="var(--synth-red)"
                  {...hotkeyProps({ kind: "step", direction: -1 })}
                  onPress={() => step(-1)}
                >
                  <ArrowLeft />
                </Pad>
                <Pad
                  label={
                    paging
                      ? "Next page"
                      : view === "tempo"
                        ? "Faster"
                        : view === "steps"
                          ? "Next step"
                          : view === "chordStyle"
                            ? "Next chord style"
                            : view === "album"
                              ? "Next song"
                              : view === "tracks"
                                ? shift
                                  ? "Repeat track more"
                                  : "Slide track later"
                                : shift
                                  ? "Next preset"
                                  : "Octave up"
                  }
                  accent="var(--synth-red)"
                  {...hotkeyProps({ kind: "step", direction: 1 })}
                  onPress={() => step(1)}
                >
                  <ArrowRight />
                </Pad>
                <Pad
                  label={
                    view === "revert"
                      ? shift
                        ? "Close revert"
                        : `Revert ${revertOption.label.toLowerCase()}`
                      : shift
                        ? "Revert"
                        : trash
                          ? `Delete ${trash.name}`
                          : view === "tracks" && track
                            ? `Delete ${track.name}`
                            : view === "steps"
                              ? "Clear the steps"
                              : view === "album" && openSongNow
                                ? `Delete ${openSongNow.name}`
                                : "Delete"
                  }
                  accent="var(--synth-red)"
                  lit={
                    view === "revert" ||
                    pendingDelete ===
                      (trash?.id ??
                        track?.id ??
                        (view === "steps"
                          ? "steps"
                          : view === "album"
                            ? openSongNow?.id
                            : ""))
                  }
                  {...toolHotkey("delete")}
                  onPress={pressTrash}
                >
                  {view === "revert" || shift ? <RotateCcw /> : <Trash2 />}
                </Pad>
                <Pad
                  label={
                    view === "steps"
                      ? "Close drum sequencer"
                      : shift
                        ? "Drum sequencer"
                        : "Tape (record mode)"
                  }
                  accent="var(--synth-red)"
                  lit={recordMode || view === "steps"}
                  {...toolHotkey("take")}
                  onPress={pressTake}
                >
                  {shift || view === "steps" ? <Grid3x3 /> : <RollIcon />}
                </Pad>
              </div>
              <div className={styles.bank} role="group" aria-label="Modules">
                {renderModulePad("lfo", <WavesHorizontal />)}
                {renderModulePad("fx", <AudioLines />)}
              </div>
              <div className={styles.bank} role="group" aria-label="Mute">
                <Pad
                  label={
                    view === "tracks" && track
                      ? `${
                          shift
                            ? track.soloed
                              ? "Unsolo"
                              : "Solo"
                            : track.muted
                              ? "Unmute"
                              : "Mute"
                        } ${track.name}`
                      : view === "tracks"
                        ? "Mute / Solo"
                        : view === "chordStyle"
                          ? "Close chord style"
                          : shift
                            ? "Chord style"
                            : view === "chords"
                              ? "Close chord palette"
                              : "Chord palette"
                  }
                  accent="var(--synth-red)"
                  lit={
                    view === "tracks"
                      ? Boolean(shift ? track?.soloed : track?.muted)
                      : view === "chords" || view === "chordStyle"
                  }
                  {...toolHotkey("mute")}
                  onPress={pressMute}
                >
                  {view === "tracks" ? (
                    shift ? (
                      <Headphones />
                    ) : (
                      <VolumeX />
                    )
                  ) : shift || view === "chordStyle" ? (
                    <ChordStyleIcon pattern={chordStyle.id} />
                  ) : (
                    <Music4 />
                  )}
                </Pad>
              </div>
              <div
                className={styles.bank}
                role="group"
                aria-label="Chord macros"
              >
                {macroChords.map(({ id, name, label }, index) => (
                  <Pad
                    key={`${index}-${id}`}
                    label={
                      view === "chords"
                        ? `Set chord ${index + 1} to ${CHORD_PALETTE[chordIndex]?.name ?? ""}`
                        : `${name} chord`
                    }
                    accent="var(--synth-blue)"
                    pressed={activeChord === index}
                    {...hotkeyProps({ kind: "chord", index })}
                    onPress={() => pressChordPad(index)}
                  >
                    {label}
                  </Pad>
                ))}
              </div>
            </div>
          </div>
          <div className={styles.keybed}>
            <div
              className={styles.keys}
              role="group"
              aria-label="Piano keys"
              data-focus-group="keys"
              data-focus-order="columns"
            >
              {WHITE_KEYS.map((semitone, slot) =>
                renderKey(semitone, slot, false),
              )}
              {BLACK_KEYS.map((semitone) =>
                renderKey(semitone, WHITE_KEYS.indexOf(semitone - 1) + 1, true),
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
