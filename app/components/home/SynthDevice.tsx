import {
  useCallback,
  useEffect,
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
  CassetteTape,
  ChartNoAxesGantt,
  Circle,
  LayoutGrid,
  Metronome,
  Music,
  Pause,
  Play,
  Pointer,
  RotateCcw,
  Save,
  Square,
  Trash2,
  VolumeX,
  WavesHorizontal,
} from "lucide-react";
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
  type ModuleKnob,
} from "./deviceEngine";
import {
  DeviceScreen,
  PARAMS_PER_PAGE,
  ScreenLevel,
  ScreenSeek,
  ScreenSelection,
  TILES_PER_PAGE,
  type ScreenOverlay,
  type ScreenReadout,
  type ScreenView,
} from "./DeviceScreen";
import { AdsrIcon, DRUM_PIECES } from "./instrumentIcons";
import {
  METERS,
  SUBDIVISIONS,
  barMs,
  beatMs,
  gridLabel,
  meterLabel,
  overdub,
  shiftTake,
  type Take,
} from "./noteRecorder";
import { ICON_CHOICES, PresetIcon } from "./presetIcons";
import {
  allPresets,
  bindPad,
  clearEdits,
  deletePreset,
  presetEdits,
  setEdit,
  savePreset,
  swapPad,
  updatePreset,
  usePresetLibrary,
} from "./presetStore";
import { useHotkeyListener, useHotkeys } from "../../providers/HotkeyProvider";
import { hotkeyLabel, type Control, type Tool } from "./input/keymap";
import { CHORD_PALETTE, chordById } from "./chords";
import { setChordMacro, useChordMacros } from "./chordStore";
import { audible, clipOf, makeTrack, passOf, startsOf, type Track } from "./tracks";
import { useTrackMix } from "../../hooks/useTrackMix";
import { useMixScrub } from "../../hooks/useMixScrub";
import { setTake, setTracks, useSession } from "./sessionStore";
import { useScrub } from "../../hooks/useScrub";
import { MAX_BPM, MIN_BPM, useTransport } from "../../hooks/useTransport";
import styles from "./SynthDevice.module.css";

export interface SynthDeviceProps {
  className?: string;
}

const INITIAL_PRESET = "piano";
// The take shown as a potential track on the tracks view.
const TAKE_ID = "session-take";
const INITIAL_VOLUME_STEP = 8;
const NOTICE_MS = 1800;
const OVERLAY_MS = 1200;
const MODULE_IDS: readonly ModuleId[] = ["adsr", "lfo", "fx"];
// The green knob moves the tempo in 5 BPM steps; the arrows by 1.
const BPM_KNOB_STEP = 5;

type ModuleSteps = Readonly<Record<ModuleId, readonly number[]>>;

const INITIAL_MODULE_STEPS = Object.fromEntries(
  MODULE_IDS.map((id) => [
    id,
    DEVICE_MODULES[id].knobs.map(({ spec, steps }) =>
      valueToStep(spec, spec.default, steps),
    ),
  ]),
) as unknown as ModuleSteps;

const MODULES_OFF: Readonly<Record<ModuleId, boolean>> = {
  adsr: false,
  lfo: false,
  fx: false,
};

const knobValue = ({ spec, steps, floor }: ModuleKnob, step: number) =>
  step === 0 && floor !== undefined ? floor : stepToValue(spec, step, steps);

const knobDisplay = (knob: ModuleKnob, step: number) =>
  knob.options?.[step] ?? formatParam(knob.spec, knobValue(knob, step));

// Off restores the engine's defaults for the module's params, which leave the
// modelled sound untouched; the knob settings are kept for switching back on.
function applyModule(id: ModuleId, on: boolean, steps: readonly number[]) {
  const { knobs } = DEVICE_MODULES[id];
  deviceEngine.setMasterParams(
    knobs.map(({ spec }) => spec.id),
    on
      ? Object.fromEntries(
          knobs.map((knob, i) => [knob.spec.id, knobValue(knob, steps[i])]),
        )
      : null,
  );
}

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

const octaveOf = (midi: number) => Math.floor(midi / 12) - 1;

const spokenNote = (midi: number) =>
  `${NOTE_NAMES[midi % 12].replace("#", " sharp")} ${octaveOf(midi)}`;

const engravedNote = (midi: number) => {
  const name = NOTE_NAMES[midi % 12].replace("#", "♯");
  return name === "C" ? `C${octaveOf(midi)}` : name;
};

const iconLabel = (icon: string) =>
  icon.charAt(0).toUpperCase() + icon.slice(1);

// Moves an item index to the same slot on the next or previous page, wrapping.
const turnPage = (
  index: number,
  direction: 1 | -1,
  perPage: number,
  count: number,
) => {
  const pages = Math.ceil(count / perPage);
  const page = (Math.floor(index / perPage) + direction + pages) % pages;
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

  return [value, show] as const;
}

interface HeldKey {
  semitones: number[];
  midis: number[];
}

export function SynthDevice({ className }: SynthDeviceProps) {
  const library = usePresetLibrary();
  const presets = allPresets(library);
  const [preset, setPreset] = useState(() => findPreset(INITIAL_PRESET));
  const [paramIndex, setParamIndex] = useState(0);
  const [volumeStep, setVolumeStep] = useState(INITIAL_VOLUME_STEP);
  const [moduleSteps, setModuleSteps] = useState(INITIAL_MODULE_STEPS);
  const [moduleOn, setModuleOn] = useState(MODULES_OFF);
  const [idleSeek, setIdleSeek] = useState(0);
  const [view, setView] = useState<ScreenView>("scope");
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
  // Takes kept from record mode, and the one the green knob picked.
  const { take, tracks } = useSession();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [octave, setOctave] = useState(0);
  // Shift and chords latch on a click; their hotkeys hold them while down.
  const [shiftLatched, setShiftLatched] = useState(false);
  const [chord, setChord] = useState<number | null>(null);
  const [chordIndex, setChordIndex] = useState(0);
  const chordMacros = useChordMacros();
  const macroChords = chordMacros.map(chordById);
  const keys = useHotkeys();
  const activeChord = keys.chord ?? chord;
  const [litNotes, setLitNotes] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const [overlay, showOverlay] = useMomentary<ScreenOverlay>(OVERLAY_MS);
  const [notice, showNotice] = useMomentary<string>(NOTICE_MS);
  // A saved preset Stop deletes on a second press, while its warning shows.
  const [pendingDelete, armDelete] = useMomentary<string>(NOTICE_MS);
  // A pad press that binds or sets a chord macro is confirmed by a second
  // press, like the delete.
  const [pendingBind, armBind] = useMomentary<number>(NOTICE_MS);
  const [pendingChord, armChord] = useMomentary<number>(NOTICE_MS);
  const held = useRef(new Map<number, HeldKey>());
  const transport = useTransport();
  const shift = shiftLatched || keys.shift;
  const tapMode = transport.tapping && view === "tempo";
  const barBeats = transport.timing.meter.beats;
  // The take as a potential track: the current take, named for the instrument
  // playing now. It has no mute or solo.
  const takeTrack: Track = {
    id: TAKE_ID,
    name: "Take",
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
  // Each entry's clip at the tempo, on a timeline at least four bars long
  // that ends on the bar after the last entry's first pass.
  const clips = entries.map((candidate) => clipOf(candidate, transport.bpm));
  const trackSpan =
    barBeats *
    Math.max(
      4,
      ...entries.map((candidate, i) =>
        Math.ceil((candidate.start + clips[i].length) / barBeats),
      ),
    );
  // The take is only an indicator; the mix plays the kept tracks.
  const mix = useTrackMix(tracks, transport.bpm, trackSpan);
  // Renders every track's arrangement over the timeline and sums them, so the
  // mix can be scrubbed like a take.
  const renderMix = async () => {
    const span = trackSpan * beatMs(transport.timing);
    const parts = await Promise.all(
      tracks.map((track) => {
        const pass = passOf(track, transport.bpm);
        const starts = startsOf(track, pass, transport.bpm, trackSpan);
        const notes = starts.flatMap((at) =>
          pass.notes.map((note) => ({ ...note, start: note.start + at })),
        );
        return deviceEngine.render(notes, span, track.sound);
      }),
    );
    const buffers = parts.filter(
      (buffer): buffer is AudioBuffer => buffer !== null,
    );
    if (buffers.length === 0) return null;
    const length = Math.max(...buffers.map((buffer) => buffer.length));
    const out = new AudioBuffer({
      numberOfChannels: 2,
      length,
      sampleRate: buffers[0].sampleRate,
    });
    for (let c = 0; c < out.numberOfChannels; c++) {
      const dst = out.getChannelData(c);
      for (const buffer of buffers) {
        const src = buffer.getChannelData(
          Math.min(c, buffer.numberOfChannels - 1),
        );
        for (let i = 0; i < buffer.length; i++) dst[i] += src[i];
      }
    }
    return out;
  };
  const mixScrub = useMixScrub(
    JSON.stringify([
      transport.bpm,
      trackSpan,
      tracks.map((track) => [track.id, track.start, track.sound, track.take]),
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
    Math.ceil(
      (trackSpan * beatMs(transport.timing)) / barMs(transport.timing),
    ),
  );
  const mixAt =
    mixScrubPos ?? (mix.position() ?? 0) * beatMs(transport.timing);
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
  // What the Play pad shows: the mix on the tracks view, else the take.
  const playing =
    view === "tracks" ? mix.playing : transport.state === "playing";
  const pauseMix = mix.pause;
  // The mix plays on the tracks view, and under a take while it records.
  const recording = transport.state === "recording";
  useEffect(() => {
    if (view !== "tracks" && !recording) pauseMix();
  }, [view, recording, pauseMix]);
  const recordMode = view === "roll";
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
    for (const id of MODULE_IDS)
      applyModule(id, false, INITIAL_MODULE_STEPS[id]);
  }, []);

  useEffect(() => {
    const heldKeys = held.current;
    const releaseAll = () => {
      if (heldKeys.size === 0) return;
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

  const pressKey = (root: number, chordToPlay = activeChord) => {
    if (held.current.has(root)) return;
    deviceEngine.unlock();
    if (tapMode) transport.tapNote();
    const intervals =
      chordToPlay === null ? [0] : macroChords[chordToPlay].intervals;
    const semitones = intervals.map((interval) => root + interval);
    const midis = semitones.map((semitone) => {
      const midi = F3_MIDI + semitone + 12 * octave;
      deviceEngine.noteOn(midi, KEY_VELOCITY);
      transport.capture(midi, true, KEY_VELOCITY);
      return midi;
    });
    held.current.set(root, { semitones, midis });
    syncLitNotes();
  };

  const releaseKey = (root: number) => {
    const entry = held.current.get(root);
    if (!entry) return;
    held.current.delete(root);
    for (const midi of entry.midis) {
      deviceEngine.noteOff(midi);
      transport.capture(midi, false);
    }
    syncLitNotes();
  };

  // Keeps the selected param when the next instrument has it too.
  const selectPreset = (next: DevicePreset) => {
    deviceEngine.unlock();
    deviceEngine.loadPreset(next, library.edits[next.id]);
    setPreset(next);
    const index = Math.max(
      0,
      PATCH_BY_ID[next.target].params.findIndex(({ id }) => id === selected.id),
    );
    setParamIndex(index);
    setParamPage(Math.floor(index / PARAMS_PER_PAGE));
  };

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
    } else if (view === "tempo") {
      transport.setBpm(transport.bpm + direction);
    } else if (view === "tracks") {
      slideTrack(direction * (shift ? 1 : barBeats));
    } else if (shift) {
      const index = presets.findIndex(({ id }) => id === preset.id) + direction;
      selectPreset(presets[(index + presets.length) % presets.length]);
    } else {
      setOctave((current) => Math.min(2, Math.max(-2, current + direction)));
    }
  };

  const padBindings = shift ? library.shiftButtons : library.buttons;

  // Holds the take where it is, so Play resumes there.
  const pause = () => {
    setRollPosition(transport.roll().now);
    transport.stop();
  };

  // Which entry a recording lands on, the take as it was before it (so a track
  // take can be restored), and where on the take the recording began.
  const recordTarget = useRef<string>(TAKE_ID);
  const takeBefore = useRef<Take | null>(null);
  const recordStart = useRef(0);

  // Ends the take and lays it over what the recording targeted: the take, or
  // the picked track (an overdub). The recording began at `recordStart`.
  const finishTake = () => {
    const recorded = transport.keepTake();
    if (!recorded) return;
    const placed = shiftTake(recorded, recordStart.current);
    const target = recordTarget.current;
    if (target === TAKE_ID) {
      setTake(overdub(takeBefore.current, placed));
    } else {
      const merged = overdub(takeBefore.current, placed);
      setTracks((current) =>
        current.map((candidate) =>
          candidate.id === target ? { ...candidate, take: merged } : candidate,
        ),
      );
      setTake(merged);
    }
  };

  // Play and pause in one: plays the take from where the stopped roll is
  // scrolled to (from the top when it rests at the end), and pauses it while
  // it plays. While recording, Play pauses the take.
  const pressPlay = () => {
    if (view === "tracks") {
      setMixScrubPos(null);
      if (mix.playing) mix.pause();
      else mix.play();
      return;
    }
    if (transport.state === "recording") {
      finishTake();
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
  // While recording, Stop pauses the take.
  const pressStop = () => {
    if (view === "tracks") {
      setMixScrubPos(null);
      mix.stop();
      return;
    }
    if (transport.state === "recording") {
      finishTake();
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
      showNotice(`Press again to delete ${chosen.name}`);
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
  const pressTrash = () => {
    if (trash) {
      pressDelete(trash);
      return;
    }
    if (view !== "tracks" || !picked) return;
    if (isTake) {
      if (pendingDelete !== TAKE_ID) {
        armDelete(TAKE_ID);
        showNotice("Press again to discard the take");
        return;
      }
      setTake(null);
      showNotice("Discarded the take");
      return;
    }
    if (!track) return;
    if (pendingDelete !== track.id) {
      armDelete(track.id);
      showNotice(`Press again to delete ${track.name}`);
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

  // Starts a take, showing it on the roll, or ends it where it stops. The take
  // lands on whatever is picked: the take, or a track. Recording always starts
  // from where the stopped roll is scrolled to.
  const pressRecord = () => {
    deviceEngine.unlock();
    if (transport.state === "recording") {
      finishTake();
      return;
    }
    recordTarget.current = pickedEntry?.id ?? TAKE_ID;
    takeBefore.current = take;
    recordStart.current = rollPosition ?? 0;
    setView("roll");
    // The tracks play along from the top, lined up with the new take.
    const origin = transport.record();
    if (origin !== null && entries.length > 0) mix.follow(origin);
  };

  // Like a module pad: it opens the tempo view, and with Shift starts or
  // stops the click without leaving the current view.
  const pressMetronome = () => {
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
    if (view === "chords") {
      const chosen = CHORD_PALETTE[chordIndex];
      // Set the macro on a second press of the same pad, like the delete.
      if (pendingChord !== index) {
        armChord(index);
        showNotice(`Press again to set chord ${index + 1} to ${chosen.name}`);
        return;
      }
      setChordMacro(index, chosen.id);
      showNotice(`Chord ${index + 1} → ${chosen.name}`);
      return;
    }
    toggleChord(index);
  };

  // Mutes the picked track on the tracks; elsewhere it opens the chord palette.
  const pressMute = () => {
    if (view === "tracks") {
      pressTrackSwitch();
      return;
    }
    setView((current) => (current === "chords" ? "scope" : "chords"));
  };

  // With Shift a pad plays, binds or saves to its alternate.
  const padName = (pad: number) => `${shift ? "Shift pad" : "Pad"} ${pad + 1}`;

  const pressPresetPad = (pad: number) => {
    if (view === "presets") {
      const chosen = presets[presetIndex];
      // Bind on a second press of the same pad, like the delete.
      if (pendingBind !== pad) {
        armBind(pad);
        showNotice(`Press again to bind to ${padName(pad).toLowerCase()}`);
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
    selectPreset(bound);
    // A Shift preset trades places with the pad's own and Shift lets go, so
    // the pad's light keeps showing what plays.
    if (shift) {
      swapPad(pad);
      setShiftLatched(false);
    }
  };

  const pressSynth = () => {
    if (view === "presets") {
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
    setRollPosition(null);
    if (transport.state === "recording") {
      finishTake();
      return;
    }
    setView((current) => (current === "tracks" ? "scope" : "tracks"));
  };

  // Opens or closes the take (record mode), which Record also opens. While
  // recording it ends the take.
  const pressTake = () => {
    setRollPosition(null);
    if (transport.state === "recording") {
      finishTake();
      return;
    }
    setShiftLatched(false);
    if (view === "roll") {
      setView("scope");
      return;
    }
    // Load the picked track into the take, so the roll shows and edits it.
    if (pickedEntry.id !== TAKE_ID) setTake(pickedEntry.take);
    setView("roll");
  };

  // Save in record mode keeps the take as a new track, with the preset and
  // timing it plays with now, and shows it on the tracks.
  const saveTrack = () => {
    const recorded = transport.keepTake();
    if (!recorded) {
      showNotice("Record a take first");
      return;
    }
    const kept = makeTrack(
      tracks.length,
      preset.name,
      recorded,
      preset.id,
      deviceEngine.sound(),
      { ...transport.timing, bpm: recorded.bpm },
    );
    setTracks((current) => [...current, kept]);
    setSelectedIndex(tracks.length + 1);
    setTake(null);
    setView("tracks");
    showNotice(`Saved ${kept.name}`);
  };

  const updateTrack = (id: string, change: Partial<Track>) =>
    setTracks((current) =>
      current.map((candidate) =>
        candidate.id === id ? { ...candidate, ...change } : candidate,
      ),
    );

  // The arrows slide the picked track along the timeline, by bars, or with
  // Shift by beats. The take doesn't move.
  const slideTrack = (beats: number) => {
    if (!track) return;
    updateTrack(track.id, { start: Math.max(0, track.start + beats) });
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

  // Shift + Save resets the preset instead. Neither applies to the tempo, so
  // in its view Save switches tap mode, where played notes tap the tempo.
  const pressSave = () => {
    // On the roll and the tracks, Save keeps the take as a track.
    if (view === "roll" || view === "tracks") {
      saveTrack();
      return;
    }
    if (view === "tempo") {
      if (transport.tapping) transport.stopTapping();
      else transport.startTapping();
      return;
    }
    // Shift reverts the preset, which only matters while configuring it.
    if (shift && canRevert) {
      pressReset();
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

  // The red knob picks a param, the blue one sets its value; the footer shows
  // both in their knob colours.
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

  const pressReset = () => {
    if (!edits) {
      showNotice("No changes to reset");
      return;
    }
    clearEdits(preset.id);
    deviceEngine.loadPreset(preset);
    showNotice(`Reset ${preset.name}`);
  };

  // Turning a module's knob switches the module on so the change is audible.
  const setModuleStep = (id: ModuleId, index: number, step: number) => {
    const next = moduleSteps[id].map((value, i) =>
      i === index ? step : value,
    );
    setModuleSteps((current) => ({ ...current, [id]: next }));
    setModuleOn((current) => ({ ...current, [id]: true }));
    applyModule(id, true, next);
  };

  // A module pad opens its view; with Shift it switches the module on or off
  // without leaving the current view.
  const pressModule = (id: ModuleId) => {
    if (shift) {
      const on = !moduleOn[id];
      setModuleOn((current) => ({ ...current, [id]: on }));
      applyModule(id, on, moduleSteps[id]);
      return;
    }
    setView((current) => (current === id ? "scope" : id));
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
    <ScreenSelection label={selected.label} value={selectedDisplay} />
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
  // Shift reverts the preset, but only while configuring it on the synth view.
  const canRevert = view === "synth";
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
  // The roll's frame, shifted to where the recording began so a take recorded
  // from a scrolled position shows from there.
  const rollFrame = () => {
    const frame = transport.roll();
    if (transport.state !== "recording" || recordStart.current === 0)
      return frame;
    const at = recordStart.current;
    return {
      now: frame.now + at,
      notes: frame.notes.map((note) => ({ ...note, start: note.start + at })),
      state: frame.state,
    };
  };
  // Scrolling scrubs the take: it plays at the speed it is scrolled.
  const scrub = useScrub(
    [
      transport.takeId,
      JSON.stringify(take),
      JSON.stringify(transport.timing),
      preset.id,
      JSON.stringify(values),
      JSON.stringify(moduleOn),
      JSON.stringify(moduleSteps),
      volumeStep,
    ].join("|"),
    () => {
      const { now, notes } = rollFrame();
      return { notes, length: now };
    },
  );
  const stopScrub = scrub.stop;
  useEffect(() => {
    if (!rollScrolls) stopScrub();
  }, [rollScrolls, stopScrub]);

  const scrollRoll = (ms: number) =>
    setRollPosition(scrub.scrollBy(ms, rollAt, rollFirst, rollEnd));

  // The green knob scrolls whatever the screen shows; on the scope it is idle.
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
            : rollScrolls
              ? {
                  step: Math.round((rollAt - rollFirst) / beatLength),
                  steps: rollSteps,
                  label: `Bar ${barOf(rollAt)} of ${barOf(rollEnd)}`,
                  // The last step is the end, which stays put as the take grows.
                  set: (step: number) => {
                    const end = step >= rollSteps - 1;
                    const to = end ? rollEnd : rollFirst + step * beatLength;
                    scrub.scrollTo(to, rollAt);
                    setRollPosition(end ? null : to);
                  },
                }
              : view === "tracks"
                ? {
                    step: selectedIndex,
                    steps: Math.max(2, entries.length),
                    label: picked?.name ?? "",
                    set: (index: number) =>
                      setSelectedIndex(Math.min(index, entries.length - 1)),
                  }
                : view === "tempo"
                  ? {
                      step: Math.round(
                        (transport.bpm - MIN_BPM) / BPM_KNOB_STEP,
                      ),
                      steps: (MAX_BPM - MIN_BPM) / BPM_KNOB_STEP + 1,
                      label: `${transport.bpm} BPM`,
                      set: (step: number) =>
                        transport.setBpm(MIN_BPM + step * BPM_KNOB_STEP),
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
    scope: { status: octaveLabel, footer: [engine, selection] },
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
    // The picked track in green, as the green knob picks it, and where it
    // starts.
    tracks: {
      status: picked ? (
        <ScreenSeek>
          {selectedIndex + 1}/{entries.length}
        </ScreenSeek>
      ) : (
        ""
      ),
      footer: track
        ? [
            <>
              Starts bar {Math.floor(track.start / barBeats) + 1}
              {track.start % barBeats
                ? ` beat ${(track.start % barBeats) + 1}`
                : ""}
              {" · "}
              <ScreenLevel>Vol {Math.round(track.volume * 100)}%</ScreenLevel>
            </>,
            "←→ slide · Mute/Solo · Trash",
          ]
        : picked
          ? ["Take · record, or Save to keep it", ""]
          : ["", ""],
    },
    // The meter and grid in the red and blue of the knobs that set them; when
    // stopped, the bar the green knob scrolled to, in green.
    roll: {
      status: (
        <>
          {rollScrolls ? (
            <ScreenSeek>
              Bar {barOf(rollAt)}/{barOf(rollEnd)}
            </ScreenSeek>
          ) : transport.state === "recording" ? (
            "Rec"
          ) : transport.state === "playing" ? (
            "Play"
          ) : (
            "Take"
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
      footer: [
        presets[presetIndex]?.name ?? "",
        "Press a pad twice to bind",
      ],
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
        }))
      : [];
  // On/off, centred along the bottom of the module and tempo views.
  const badge = activeModule
    ? { label: DEVICE_MODULES[activeModule].label, on: moduleOn[activeModule] }
    : view === "tempo"
      ? tapMode
        ? { label: "Tap a note" }
        : { label: "Metronome", on: transport.metronome }
      : null;

  return (
    <div className={cn(styles.stage, className)}>
      <div className={styles.frame}>
        <div
          className={styles.device}
          role="group"
          aria-label="Synthesizer"
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

            <DeviceScreen
              className={styles.screenSlot}
              view={view}
              overlay={overlay ?? undefined}
              title={
                activeModule
                  ? DEVICE_MODULES[activeModule].label
                  : view === "tempo"
                    ? "Tempo"
                    : view === "tracks"
                      ? "Tracks"
                      : view === "chords"
                        ? "Chords"
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
              barBeats={barBeats}
              getRoll={rollFrame}
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
                          badge: bound.length > 0 ? bound.join(" ") : undefined,
                        };
                      })
              }
              selected={
                view === "save"
                  ? iconIndex
                  : view === "tracks"
                    ? selectedIndex
                    : view === "chords"
                      ? chordIndex
                      : presetIndex
              }
              onSelect={
                view === "save"
                  ? setIconIndex
                  : view === "tracks"
                    ? setSelectedIndex
                    : view === "chords"
                      ? setChordIndex
                      : setPresetIndex
              }
              onSelectParam={selectParam}
              readouts={readouts}
              lfoShape={moduleSteps.lfo[2]}
              lfoRate={knobValue(
                DEVICE_MODULES.lfo.knobs[0],
                moduleSteps.lfo[0],
              )}
            />

            <div className={styles.knobColumn}>
              {activeModule ? (
                renderModuleKnob(activeModule, 2, "var(--synth-red)")
              ) : view === "tracks" ? (
                <Knob
                  label="Seek"
                  valueLabel={`Bar ${mixBar + 1} of ${mixBars}`}
                  step={mixStep}
                  steps={mixSteps}
                  color="var(--synth-red)"
                  fine
                  onChange={(step) => scrubMix(step)}
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
              ) : view === "tracks" ? (
                <Knob
                  label="Track volume"
                  valueLabel={
                    track ? `${Math.round(track.volume * 100)}%` : undefined
                  }
                  step={Math.round((track?.volume ?? 1) * (KNOB_STEPS - 1))}
                  steps={KNOB_STEPS}
                  color="var(--synth-blue)"
                  onChange={(step) => {
                    if (track)
                      updateTrack(track.id, {
                        volume: step / (KNOB_STEPS - 1),
                      });
                  }}
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
                    view === "tracks"
                      ? mix.playing
                        ? "Pause tracks"
                        : "Play tracks"
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
                    transport.state === "recording"
                      ? "Stop recording"
                      : "Record"
                  }
                  accent="var(--synth-red)"
                  lit={transport.state === "recording"}
                  {...toolHotkey("record")}
                  onPress={pressRecord}
                >
                  <Circle fill="currentColor" />
                </Pad>
                <Pad
                  label={
                    view === "tempo"
                      ? tapMode
                        ? "Stop tap tempo"
                        : "Tap tempo"
                      : view === "roll" || view === "tracks"
                        ? "Save take as a track"
                        : shift
                          ? "Reset preset"
                          : "Save preset"
                  }
                  accent="var(--synth-red)"
                  lit={tapMode}
                  {...toolHotkey("save")}
                  onPress={pressSave}
                >
                  {view === "tempo" ? (
                    <Pointer />
                  ) : shift && canRevert ? (
                    <RotateCcw />
                  ) : (
                    <Save />
                  )}
                </Pad>
                <Pad
                  label="Tracks"
                  accent="var(--synth-red)"
                  lit={view === "tracks"}
                  {...toolHotkey("tracks")}
                  onPress={pressTracks}
                >
                  <ChartNoAxesGantt />
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
                  label={synthMode ? "Synth parameters" : "Preset library"}
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
                        : view === "tracks"
                          ? "Slide track earlier"
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
                        : view === "tracks"
                          ? "Slide track later"
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
                    trash
                      ? `Delete ${trash.name}`
                      : view === "tracks" && track
                        ? `Delete ${track.name}`
                        : "Delete"
                  }
                  accent="var(--synth-red)"
                  lit={pendingDelete === (trash?.id ?? track?.id)}
                  {...toolHotkey("delete")}
                  onPress={pressTrash}
                >
                  <Trash2 />
                </Pad>
                <Pad
                  label="Take (record mode)"
                  accent="var(--synth-red)"
                  lit={recordMode}
                  {...toolHotkey("take")}
                  onPress={pressTake}
                >
                  <CassetteTape />
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
                        : view === "chords"
                          ? "Close chord palette"
                          : "Chord palette"
                  }
                  accent="var(--synth-red)"
                  lit={
                    view === "tracks"
                      ? Boolean(shift ? track?.soloed : track?.muted)
                      : view === "chords"
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
                  ) : (
                    <Music />
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
