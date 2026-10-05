import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  LayoutGrid,
  Layers,
  Metronome,
  Music4,
  RotateCcw,
  SlidersHorizontal,
  Volume2,
} from "lucide-react";
import { PATCH_BY_ID } from "../lib/physical/patches";
import {
  PARAMS_PER_PAGE,
  TILES_PER_PAGE,
  type ScreenView,
} from "../components/home/DeviceScreen";
import {
  DEVICE_MODULES,
  DEVICE_PRESETS,
  KNOB_STEPS,
  deviceEngine,
  engineName,
  findPreset,
  isKit,
  type DevicePreset,
} from "../components/home/deviceEngine";
import { AdsrIcon } from "../components/home/instrumentIcons";
import { CHORD_PALETTE } from "../components/home/chords";
import { resetChordMacros, setChordMacro } from "../components/home/chordStore";
import { clampOctave, F3_MIDI } from "../components/home/input/keybed";
import { shiftedNote, type Tool } from "../components/home/input/keymap";
import { turnPage } from "../components/home/input/paging";
import { INITIAL_MODULES, MODULE_IDS } from "../components/home/modules";
import {
  DEFAULT_TIMING,
  METERS,
  SUBDIVISIONS,
  meterLabel,
} from "../components/home/noteRecorder";
import {
  ROLL_LANES,
  ROLL_LOW,
  ROLL_TOP,
  rollNote,
} from "../components/home/NoteRoll";
import { ICON_CHOICES } from "../components/home/presetIcons";
import {
  bindPad,
  clearAllEdits,
  clearEdits,
  deletePreset,
  presetEdits,
  resetPads,
  savePreset,
  updatePreset,
} from "../components/home/presetStore";
import {
  deleteSong,
  newSong,
  openSong,
  setSteps,
  setTake,
  setTakeModules,
  setTracks,
  useSession,
} from "../components/home/sessionStore";
import { patternTake, takePattern } from "../components/home/stepPattern";
import { makeTrack, trackModules } from "../components/home/tracks";
import { useScrub } from "../hooks/useScrub";
import { useFeedback } from "./FeedbackProvider";
import { useHotkeyListener } from "./HotkeyProvider";
import {
  INITIAL_LEVEL_STEP,
  INITIAL_VOLUME_STEP,
  useMasterLevel,
} from "./MasterLevelProvider";
import { useModules } from "./ModuleProvider";
import { usePerformance } from "./PerformanceProvider";
import { useSequencer } from "./SequencerProvider";
import { ScreenStateProvider } from "./ScreenStateProvider";
import { INITIAL_PRESET, useSound } from "./SoundProvider";
import { TAKE_ID, useTracks } from "./TracksProvider";
import { useTransportContext } from "./TransportProvider";
import { useView } from "./ViewProvider";

const noSubscribe = () => () => {};
const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform);

// Where a time signature is in METERS (stored ones are copies).
const meterIndexOf = ({ beats, unit }: { beats: number; unit: number }) =>
  Math.max(
    0,
    METERS.findIndex((meter) => meter.beats === beats && meter.unit === unit),
  );

interface RevertOption {
  id: string;
  label: string;
  detail: string;
  icon: ReactNode;
  run: () => void;
}

interface DeviceValue {
  armed: boolean;
  recordArmed: boolean;
  recordMode: boolean;
  onTracks: boolean;
  trackShift: boolean;
  savesTrack: boolean;
  midiSave: boolean;
  tuningTrack: boolean;
  mixView: boolean;
  playing: boolean;
  recording: boolean;
  rollScrolls: boolean;
  rollAt: number;
  rollEnd: number;
  rollRange: string;
  rollSeek: (to: number) => void;
  rollLow: number;
  command: string;
  trash: DevicePreset | null;
  padBindings: readonly string[];
  padPresets: readonly (DevicePreset | null)[];
  revertOptions: readonly RevertOption[];
  revertOption: RevertOption;
  selectPreset: (next: DevicePreset) => void;
  scrollRoll: (ms: number) => void;
  scrollRollPitch: (semitones: number) => void;
  setRollOctave: (step: number) => void;
  rollOctave: number;
  rollOctaves: number;
  pressPlay: () => void;
  pressStop: () => void;
  pressRecord: () => void;
  pressMetronome: (click?: boolean) => void;
  pressTool: (pad: Tool) => void;
  pressTrash: (revert?: boolean) => void;
  pressSave: (midi?: boolean) => void;
  pressSynth: (params?: boolean) => void;
  pressTracks: (album?: boolean) => void;
  pressTake: (steps?: boolean) => void;
  pressMute: () => void;
  pressClip: () => void;
  pressPresetPad: (pad: number) => void;
  pressChordPad: (index: number) => void;
  pressRevert: () => void;
  step: (direction: 1 | -1) => void;
  pickRow: (direction: 1 | -1) => void;
  saveTrack: () => void;
  saveSteps: () => void;
  toggleSteps: () => void;
  startSong: () => void;
  pickSong: (index: number) => void;
  padName: (pad: number) => string;
  soundName: () => string;
}

const DeviceContext = createContext<DeviceValue | null>(null);

export function DeviceProvider({ children }: { children: ReactNode }) {
  const { view, setView, leaveRevert, toggleView } = useView();
  const transport = useTransportContext();
  const {
    library,
    presets,
    preset,
    values,
    specs,
    selected,
    paramIndex,
    paramPage,
    iconIndex,
    presetIndex,
    revertIndex,
    setPreset,
    setParamIndex,
    setParamPage,
    setIconIndex,
    setPresetIndex,
    setRevertIndex,
    showParamPage,
  } = useSound();
  const { levelStep, setLevelStep, setVolumeStep } = useMasterLevel();
  const {
    shift,
    shiftLatched,
    setShiftLatched,
    octave,
    setOctave,
    chord,
    setChord,
    chordIndex,
    setChordIndex,
    chordStyleIndex,
    toggleChord,
    pickChordStyle,
    keyNotes,
    pressKey,
    releaseKey,
  } = usePerformance();
  const {
    entries,
    takeTrack,
    pickedEntry,
    picked,
    isTake,
    track,
    setSelectedIndex,
    mix,
    setMixScrubPos,
    slideTrack,
    repeatTrack,
    pressLoop,
    pressTrackSwitch,
    exportMix,
    leaveSong,
  } = useTracks();
  const {
    stepKit,
    stepsRunning,
    recordingSteps,
    stepPlayer,
    stepHeadRef,
    setStepRecording,
    setStepCursor,
    moveStepHead,
    stopSteps,
  } = useSequencer();
  const { moduleOn, modulesKey, modulesOwner, setModules, pressModule } =
    useModules();
  const { pending, armPending, showNotice, showPrompt, exportingRef } = useFeedback();
  const {
    songs,
    song,
    tracks,
    modules: takeModules,
    steps: stepPattern,
  } = useSession();

  const songIndex = Math.max(
    0,
    songs.findIndex(({ id }) => id === song),
  );
  const openSongNow = songs[songIndex];

  // The Device boots on the piano, at the volume and level it starts with.
  useEffect(() => {
    const initial = findPreset(INITIAL_PRESET);
    deviceEngine.loadPreset(initial, presetEdits(initial.id));
    deviceEngine.setVolume(INITIAL_VOLUME_STEP / (KNOB_STEPS - 1));
    deviceEngine.setLevel(INITIAL_LEVEL_STEP / (KNOB_STEPS - 1));
  }, []);

  const [armed, setArmed] = useState(false);
  const [armedView, setArmedView] = useState<ScreenView>(view);
  if (view !== armedView) {
    setArmedView(view);
    if (view !== "roll") setArmed(false);
    if (view === "roll" || view === "steps") setSelectedIndex(0);
  }
  const recordArmed = armed && view === "roll";
  const recordMode = view === "roll";
  const onTracks = view === "tracks";
  const trackShift = shift && onTracks;
  const savesTrack = view === "roll" || view === "steps";
  const midiSave = shift && !savesTrack;

  // Where the stopped roll is scrolled to; null is the start of the take.
  const [rollPosition, setRollPosition] = useState<number | null>(null);
  // The roll's lowest note in view, once scrolled.
  const [rollScrolledLow, setRollLow] = useState<number | null>(null);

  const barBeats = transport.timing.meter.beats;
  const rollEnd = transport.takeLength;
  const rollFirst = 0;
  const rollScrolls =
    view === "roll" && transport.state === "stopped" && rollEnd > 0;
  const rollAt = Math.min(rollEnd, rollPosition ?? rollFirst);
  // Scrolling scrubs the take: it plays at the speed it is scrolled.
  const scrub = useScrub(
    [
      transport.takeId,
      JSON.stringify(takeTrack.take),
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

  const clampRollLow = (low: number) =>
    Math.min(ROLL_TOP, Math.max(ROLL_LOW, low));
  const rollLow = clampRollLow(rollScrolledLow ?? F3_MIDI - 1 + 12 * octave);
  const rollRange = `${rollNote(rollLow)}–${rollNote(rollLow + ROLL_LANES - 1)}`;
  const scrollRollPitch = (semitones: number) =>
    setRollLow(clampRollLow(rollLow + semitones));
  const rollOctave = Math.floor((rollLow - ROLL_LOW) / 12);
  const rollOctaves = Math.floor((ROLL_TOP - ROLL_LOW) / 12) + 1;
  const setRollOctave = (step: number) =>
    setRollLow(clampRollLow(rollLow + 12 * (step - rollOctave)));

  // Scrubs the stopped roll to `to` (ms), clamped to the take.
  const rollSeek = (to: number) => {
    const target = Math.min(rollEnd, Math.max(rollFirst, to));
    scrub.scrollTo(target, rollAt);
    setRollPosition(target);
  };

  // The instrument the sequencer swapped for a drum kit, put back when it
  // closes.
  const beforeSteps = useRef<DevicePreset | null>(null);

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
    stopSteps();
    restoreAfterSteps();
  }, [view, stopSteps]);

  // The mix plays on the tracks view, the album and a track's effects, and
  // under a take while it records.
  const tuningTrack =
    (view === "adsr" || view === "lfo" || view === "fx") &&
    pickedEntry.id !== TAKE_ID;
  const mixView = view === "tracks" || view === "album" || tuningTrack;
  const playing = mixView
    ? mix.playing
    : view === "steps"
      ? stepsRunning && !recordingSteps
      : transport.state === "playing";
  const recording = transport.state === "recording";
  useEffect(() => {
    if (!mixView && !recording) mix.pause();
  }, [mixView, recording, mix]);

  // ↑ and ↓ on the tracks pick the row above or below, like the blue knob.
  const pickRow = (direction: 1 | -1) => {
    if (view === "roll") {
      scrollRollPitch(-direction);
      return;
    }
    if (view !== "tracks") return;
    setSelectedIndex((index) =>
      Math.max(0, Math.min(entries.length - 1, index + direction)),
    );
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
  const padPresets = padBindings.map(
    (id) => presets.find((candidate) => candidate.id === id) ?? null,
  );
  const trash =
    view === "presets" && presets[presetIndex]?.user
      ? presets[presetIndex]
      : null;

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
  // the tape.
  const pauseTape = () => {
    if (transport.state === "playing") pause();
  };

  const playSteps = (recording: boolean) => {
    setStepRecording(recording);
    if (stepPlayer.running) return;
    pauseTape();
    stepPlayer.start(stepHeadRef.current);
  };

  // Opens the sequencer on a kit: the one playing, or the drum kit.
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
    if (loading && isKit(loading.sound.target)) {
      setSteps(takePattern(loading.take, loading.sound.target, loading.timing));
      setTake(null);
      transport.setMeter(meterIndexOf(loading.timing.meter));
      setStepCursor(0);
    }
    setView("steps");
  };

  // Save in the sequencer keeps the pattern as a new track on its grid.
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
      else setRollPosition(null);
      return;
    }
    if (transport.state === "playing") pause();
  };

  const pressDelete = (chosen: DevicePreset) => {
    const id = `delete:${chosen.id}`;
    if (pending !== id) {
      armPending(id);
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

  const pressTrash = (revert = shift) => {
    if (view === "revert") {
      if (revert) setView("scope");
      else pressRevert();
      return;
    }
    if (revert) {
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
      const id = `delete:${openSongNow.id}`;
      if (pending !== id) {
        armPending(id);
        showPrompt(`Press again to delete ${openSongNow.name}`);
        return;
      }
      leaveSong();
      const opened = deleteSong(openSongNow.id);
      if (opened) transport.applySongTiming(opened);
      showNotice(`Deleted ${openSongNow.name}`);
      return;
    }
    if (view === "steps") {
      if (stepPattern.hits.length === 0) return;
      if (pending !== "delete:steps") {
        armPending("delete:steps");
        showPrompt("Press again to clear the steps");
        return;
      }
      setSteps((current) => ({ ...current, hits: [] }));
      showNotice("Cleared the steps");
      return;
    }
    if (view !== "tracks" || !picked) return;
    if (isTake) {
      if (pending !== `delete:${TAKE_ID}`) {
        armPending(`delete:${TAKE_ID}`);
        showPrompt("Press again to discard the tape");
        return;
      }
      setTake(null);
      setSteps((current) => ({ ...current, hits: [] }));
      showNotice("Discarded the tape");
      return;
    }
    if (!track) return;
    const id = `delete:${track.id}`;
    if (pending !== id) {
      armPending(id);
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

  // Arms a take, showing the roll, or disarms it.
  const pressRecord = () => {
    leaveRevert();
    deviceEngine.unlock();
    if (view === "steps") {
      if (recordingSteps) stopSteps();
      else playSteps(true);
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

  const pressMetronome = (click = shift) => {
    leaveRevert();
    if (click) {
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
    else if (pad === "tracks") pressTracks(false);
    else if (pad === "album") pressTracks(true);
    else if (pad === "take") pressTake(false);
    else if (pad === "steps") pressTake(true);
    else if (pad === "metronome") pressMetronome();
    else if (pad === "synth") pressSynth(false);
    else if (pad === "params") pressSynth(true);
    else if (pad === "chords") toggleView("chords");
    else if (pad === "style") toggleView("chordStyle");
    else if (pad === "clip") pressClip();
    else if (pad === "save") pressSave();
    else if (pad === "delete") pressTrash();
    else if (pad === "mute") pressMute();
    else pressModule(pad);
  };

  // In the chord palette a pad sets its macro; on the Device it latches it.
  const pressChordPad = (index: number) => {
    leaveRevert();
    if (view === "chords") {
      const chosen = CHORD_PALETTE[chordIndex];
      const id = `chord:${index}`;
      if (pending !== id) {
        armPending(id);
        showPrompt(`Press again to set chord ${index + 1} to ${chosen.name}`);
        return;
      }
      setChordMacro(index, chosen.id);
      showNotice(`Chord ${index + 1} → ${chosen.name}`);
      return;
    }
    toggleChord(index);
  };

  // On the tracks, mutes (with Shift, solos) the picked track.
  const pressMute = () => {
    if (!onTracks) return;
    if (track) pressTrackSwitch();
    else showPrompt(`Pick a track to ${shift ? "solo" : "mute"}`);
  };

  // On the tracks, clips (with Shift, trims) the picked track.
  const pressClip = () => {
    if (!onTracks) return;
    if (track) pressLoop(track);
    else showPrompt(`Pick a track to ${shift ? "trim" : "clip"}`);
  };

  // With Shift a pad plays, binds or saves to its alternate.
  const padName = (pad: number) => `${shift ? "Shift pad" : "Pad"} ${pad + 1}`;

  const pressPresetPad = (pad: number) => {
    leaveRevert();
    if (view === "presets") {
      const chosen = presets[presetIndex];
      const id = `bind:${pad}`;
      if (pending !== id) {
        armPending(id);
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
    if (shift) setShiftLatched(false);
  };

  const pressSynth = (params = shift) => {
    leaveRevert();
    if (view === (params ? "synth" : "presets")) {
      setView("scope");
      return;
    }
    if (params) {
      setParamPage(Math.floor(paramIndex / PARAMS_PER_PAGE));
      setView("synth");
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

  const pressTracks = (album = shift) => {
    leaveRevert();
    setRollPosition(null);
    if (transport.state === "recording") {
      transport.stop();
      return;
    }
    if (album) setShiftLatched(false);
    const opens = album ? "album" : "tracks";
    setView((current) => (current === opens ? "scope" : opens));
  };

  const pickSong = (index: number) => {
    const next = songs[Math.max(0, Math.min(index, songs.length - 1))];
    if (!next || next.id === song) return;
    leaveSong();
    openSong(next.id);
    transport.applySongTiming(next);
  };

  const startSong = () => {
    leaveSong();
    const started = newSong(transport.bpm, transport.timing.meter);
    showNotice(`Started ${started.name}`);
  };

  const pressTake = (steps = shift) => {
    leaveRevert();
    setRollPosition(null);
    if (transport.state === "recording") {
      transport.stop();
      return;
    }
    setShiftLatched(false);
    if (steps) {
      toggleSteps();
      return;
    }
    if (view === "roll") {
      setView("scope");
      return;
    }
    const loading = pickedEntry.id !== TAKE_ID ? pickedEntry : null;
    if (loading) {
      const own = presets.find(({ id }) => id === loading.presetId);
      if (own && own.id !== preset.id) selectPreset(own);
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

  // How the sound is made: the model's exciter, then each module layered over
  // it that's on.
  const soundName = () =>
    [
      engineName(preset.target),
      ...MODULE_IDS.filter((id) => moduleOn[id]).map(
        (id) => DEVICE_MODULES[id].label,
      ),
    ].join(" · ");

  const pressSave = (midi = shift) => {
    leaveRevert();
    if (midi && !savesTrack) {
      void exportMix("midi");
      return;
    }
    if (view === "revert") return;
    if (view === "album") {
      startSong();
      return;
    }
    if (view === "tracks") {
      void exportMix("audio");
      return;
    }
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

  const finishSave = (saved: DevicePreset, message: string) => {
    deviceEngine.loadPreset(saved);
    setPreset(saved);
    setView("scope");
    showNotice(message);
  };

  // What Revert can put back, a tile each.
  const revertOptions: readonly RevertOption[] = [
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

  const pressRevert = () => {
    const { id, label } = revertOption;
    const key = `revert:${id}`;
    if (pending !== key) {
      armPending(key);
      showPrompt(`Press Revert again to revert ${label.toLowerCase()}`);
      return;
    }
    revertOption.run();
    showNotice(`Reverted ${label.toLowerCase()}`);
  };

  const command = useSyncExternalStore(
    noSubscribe,
    () => (isMac() ? "⌘" : "Ctrl "),
    () => "⌘",
  );
  const onCommandKey = useEffectEvent((event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    const press =
      event.code === "KeyS"
        ? pressSave
        : event.code === "Backspace"
          ? pressTrash
          : null;
    if (!press) return;
    event.preventDefault();
    if (!event.repeat && !exportingRef.current) press(event.shiftKey || shift);
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onCommandKey(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  useHotkeyListener(({ control, down, held: now, ignore }) => {
    if (exportingRef.current) {
      ignore();
      return;
    }
    switch (control.kind) {
      case "note":
        if (down) {
          const semitone = shift
            ? shiftedNote(control.semitone)
            : control.semitone;
          keyNotes.current.set(control.semitone, semitone);
          pressKey(semitone, now.chord ?? chord);
        } else {
          releaseKey(
            keyNotes.current.get(control.semitone) ?? control.semitone,
          );
          keyNotes.current.delete(control.semitone);
        }
        return;
      case "shift":
        if (down && shiftLatched) {
          setShiftLatched(false);
          ignore();
        }
        return;
      case "chord":
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
        else if (control.kind === "pick") pickRow(control.direction);
        else pressTool(control.tool);
    }
  });

  const value: DeviceValue = {
    armed,
    recordArmed,
    recordMode,
    onTracks,
    trackShift,
    savesTrack,
    midiSave,
    tuningTrack,
    mixView,
    playing,
    recording,
    rollScrolls,
    rollAt,
    rollEnd,
    rollRange,
    rollLow,
    rollSeek,
    command,
    trash,
    padBindings,
    padPresets,
    revertOptions,
    revertOption,
    selectPreset,
    scrollRoll,
    scrollRollPitch,
    setRollOctave,
    rollOctave,
    rollOctaves,
    pressPlay,
    pressStop,
    pressRecord,
    pressMetronome,
    pressTool,
    pressTrash,
    pressSave,
    pressSynth,
    pressTracks,
    pressTake,
    pressMute,
    pressClip,
    pressPresetPad,
    pressChordPad,
    pressRevert,
    step,
    pickRow,
    saveTrack,
    saveSteps,
    toggleSteps,
    startSong,
    pickSong,
    padName,
    soundName,
  };

  return (
    <DeviceContext.Provider value={value}>
      <ScreenStateProvider>{children}</ScreenStateProvider>
    </DeviceContext.Provider>
  );
}

export function useDevice() {
  const context = useContext(DeviceContext);
  if (!context) throw new Error("Wrap the Device in a DeviceProvider");
  return context;
}
