import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  AudioLines,
  AudioWaveform,
  Circle,
  Activity,
  FileMusic,
  LayoutGrid,
  Metronome,
  ListMusic,
  Music4,
  Pause,
  Play,
  RotateCcw,
  Save,
  Scissors,
  Square,
  Star,
  Trash2,
  VolumeX,
  WavesHorizontal,
} from "lucide-react";
import { valueToStep } from "../../../lib/physical/patches/format";
import { isTake } from "../../../providers/LanesProvider";
import {
  DEVICE_MODULES,
  KNOB_STEPS,
  deviceEngine,
  engineName,
  presetCategory,
  type ModuleId,
} from "../deviceEngine";
import { ScreenSeek, ScreenValue, type ScreenPager } from "../DeviceScreen";
import { toggleFavorite, type FavoriteKind } from "../favoritesStore";
import {
  AdsrIcon,
  DrumGridIcon,
  PianoRollIcon,
  PlayStyleIcon,
  TapeDeckIcon,
  TracksIcon,
} from "../instrumentIcons";
import { MODULE_IDS } from "../modules";
import { PresetIcon } from "../presetIcons";
import { swapPad } from "../presetStore";
import { trackSource } from "../tracks";
import type {
  Bindings,
  KnobBinding,
  PadBinding,
} from "../../../types/bindings";
import type { Device } from "../../../types/device";

const noop = () => {};

// A pad with nothing to do in this view: it keeps its icon and says so.
export const unusedPad = (label: string, icon: ReactNode): PadBinding => ({
  label: `${label} (not used here)`,
  icon,
  onPress: noop,
});

// How the sound is made: the model's exciter, then each module layered over
// it that's on. Saved presets are named after it.
export const soundName = ({ sound, lanes }: Device) =>
  [
    engineName(sound.preset.target),
    ...MODULE_IDS.filter((id) => lanes.modules.on[id]).map(
      (id) => DEVICE_MODULES[id].label,
    ),
  ].join(" · ");

// The param the knobs edit, in the footer: its name in green, as the knob
// that picks it, and its value in blue.
export const selection = ({ sound }: Device) => (
  <>
    <ScreenSeek>{sound.selectedName}</ScreenSeek>{" "}
    <ScreenValue>{sound.selectedDisplay}</ScreenValue>
  </>
);

// With Shift a pad plays, binds or saves to its alternate.
export const padName = ({ shift }: Device, pad: number) =>
  `${shift ? "Shift pad" : "Pad"} ${pad + 1}`;

// The preset a pad plays now, with or without Shift.
export const padPreset = ({ shift, sound }: Device, pad: number) => {
  const id = (shift ? sound.library.shiftButtons : sound.library.buttons)[pad];
  return sound.presets.find((candidate) => candidate.id === id) ?? null;
};

export const paramKnob = ({ sound }: Device): KnobBinding => ({
  label: "Parameter",
  valueLabel: sound.selectedName,
  step: sound.specs.indexOf(sound.selected),
  steps: Math.max(2, sound.specs.length),
  onChange: (index) =>
    sound.selectParam(Math.min(index, sound.specs.length - 1)),
});

// A knob with nothing to set in this view: it stays where it is, so it
// doesn't jump, and turning it does nothing.
export const idleKnob = ({ step, steps }: KnobBinding): KnobBinding => ({
  label: "Not used here",
  step,
  steps,
  onChange: noop,
});

// A list's runs of one category, in order: each one's name, where it starts
// and how many it holds.
export type Shelf = { name: string; start: number; count: number };

export function shelvesOf<T>(
  items: readonly T[],
  categoryOf: (item: T) => string,
): Shelf[] {
  const shelves: Shelf[] = [];
  items.forEach((item, index) => {
    const name = categoryOf(item);
    const last = shelves.at(-1);
    if (last?.name === name) last.count++;
    else shelves.push({ name, start: index, count: 1 });
  });
  return shelves;
}

// The shelf holding `index`, and its place among the shelves.
export function shelfAt(shelves: readonly Shelf[], index: number) {
  const at = Math.max(
    0,
    shelves.findIndex(
      ({ start, count }) => index >= start && index < start + count,
    ),
  );
  return { shelf: shelves[at] ?? { name: "", start: 0, count: 0 }, at };
}

// Turning a list's category pages, from ← → or the screen's arrows: to the
// next category's first, stopping at either end.
export const shelfStep =
  (shelves: readonly Shelf[], at: number, select: (index: number) => void) =>
  (direction: -1 | 1) =>
    select(
      shelves[Math.max(0, Math.min(shelves.length - 1, at + direction))]
        ?.start ?? 0,
    );

// The screen's pager for a list by category, in the red of the knob that
// picks the category.
export const shelfPager = (
  shelves: readonly Shelf[],
  at: number,
  select: (index: number) => void,
): ScreenPager => ({
  pages: shelves.map(({ name }) => name),
  at,
  color: "red",
  onPick: (page) => select(shelves[page]?.start ?? 0),
});

// Browsing a list by category: the red knob steps through the categories,
// landing on each one's first, and the blue one through what is in the
// current one.
export function shelfKnobs(
  shelves: readonly Shelf[],
  index: number,
  name: string,
  select: (index: number) => void,
) {
  const { shelf, at } = shelfAt(shelves, index);
  const red: KnobBinding = {
    label: "Category",
    valueLabel: shelf.name || undefined,
    step: at,
    steps: Math.max(2, shelves.length),
    onChange: (step) =>
      select(shelves[Math.min(step, shelves.length - 1)]?.start ?? 0),
  };
  const blue: KnobBinding = {
    label: "Pick",
    valueLabel: name || undefined,
    step: index - shelf.start,
    steps: Math.max(2, shelf.count),
    onChange: (step) => select(shelf.start + Math.min(step, shelf.count - 1)),
  };
  return { red, blue };
}

const FAVORITES = "Favorites";

// A picker's items led by its favorites, on a page of their own, then every
// one on its category's page.
export function listFavorites<T extends { id: string }>(
  items: readonly T[],
  categoryOf: (item: T) => string,
  favorites: readonly string[],
) {
  return [
    ...favorites.flatMap((id) => {
      const item = items.find((candidate) => candidate.id === id);
      return item ? [{ ...item, page: FAVORITES }] : [];
    }),
    ...items.map((item) => ({ ...item, page: categoryOf(item) })),
  ];
}

// A picker led by its favorites (see listFavorites): its list, its pages and
// the item picked, at `index` (or, where the pick is what plays, `picked`,
// wherever that is if it was picked elsewhere), with `select` to pick
// another, which sets `index` and passes the item to `onPick`. Mute stars the
// pick or lets it go: the pick stays on its item, on its category's page,
// or, let go from the favorites' page, moves to the next favorite while any
// are left (unless it plays).
export function favoritesPicker<T extends { id: string; name: string }>(
  { browse, feedback }: Device,
  {
    kind,
    items,
    categoryOf,
    index,
    setIndex,
    picked,
    onPick,
  }: {
    kind: FavoriteKind;
    items: readonly T[];
    categoryOf: (item: T) => string;
    index: number;
    setIndex: (index: number) => void;
    picked?: string;
    onPick?: (item: T) => void;
  },
) {
  const favorites = browse.favorites[kind];
  const listed = listFavorites(items, categoryOf, favorites);
  const shelves = shelvesOf(listed, ({ page }) => page);
  const at = Math.min(index, listed.length - 1);
  const pick =
    picked === undefined || listed[at]?.id === picked
      ? at
      : Math.max(
          0,
          listed.findIndex(({ id }) => id === picked),
        );
  const chosen = listed[pick];
  const favorite = favorites.includes(chosen.id);
  const select = (to: number, from = listed) => {
    setIndex(to);
    onPick?.(from[to]);
  };
  const star = () => {
    const next = listFavorites(
      items,
      categoryOf,
      toggleFavorite(kind, chosen.id),
    );
    const left = next.filter(({ page }) => page === FAVORITES).length;
    const to =
      picked === undefined && chosen.page === FAVORITES && left > 0
        ? Math.min(pick, left - 1)
        : next.findIndex(
            ({ id, page }) => id === chosen.id && page !== FAVORITES,
          );
    if (next[to].id === chosen.id) setIndex(to);
    else select(to, next);
    feedback.showNotice(
      favorite ? "Removed from favorites" : "Added to favorites",
    );
  };
  return {
    listed,
    shelves,
    index: pick,
    chosen,
    select,
    // Lets an item about to be deleted go from the favorites.
    forget: (id: string) => {
      if (favorites.includes(id)) toggleFavorite(kind, id);
    },
    mute: {
      label: favorite
        ? `Remove ${chosen.name} from favorites`
        : `Add ${chosen.name} to favorites`,
      icon: <Star fill={favorite ? "currentColor" : "none"} />,
      lit: favorite,
      onPress: star,
    } satisfies PadBinding,
    // A star on a favorite, on its category's page.
    star: ({ id, page }: { id: string; page: string }) =>
      page !== FAVORITES && favorites.includes(id) ? "★" : undefined,
  };
}

// The green knob scrolling whatever the screen lists.
export const seekKnob = (
  valueLabel: string,
  step: number,
  steps: number,
  onChange: (step: number) => void,
): KnobBinding => ({
  label: "Seek",
  valueLabel: valueLabel || undefined,
  step,
  steps,
  onChange,
});

// ← and →: what they step through, shown with ⇧ while Shift is held so
// their Shift job can be found even where they have none.
export const arrowPad = (
  { shift }: Device,
  direction: 1 | -1,
  label: string,
  onPress: () => void,
): PadBinding => ({
  label,
  icon: direction < 0 ? <ArrowLeft /> : <ArrowRight />,
  shiftLegend: shift,
  onPress,
});

export const arrowPads = (
  device: Device,
  [previous, next]: readonly [string, string],
  step: (direction: 1 | -1) => void,
) => ({
  left: arrowPad(device, -1, previous, () => step(-1)),
  right: arrowPad(device, 1, next, () => step(1)),
});

// With Shift, Save keeps the tracks as MIDI from any view but the piano roll and
// the drum grid, where it always keeps what's on them as a track.
export const savePad = (
  device: Device,
  own: { label: string; icon?: ReactNode; onPress?: () => void },
): PadBinding => ({
  label: device.shift ? "Save the tracks as MIDI" : own.label,
  icon: device.shift ? <FileMusic /> : (own.icon ?? <Save />),
  shiftLegend: device.shift,
  onPress: (shifted = device.shift) => {
    if (shifted) void device.mix.exportMix("midi");
    else own.onPress?.();
  },
});

// A job the Delete pad does on a second press.
type DeleteJob = {
  label: string;
  key: string;
  prompt: string;
  run: () => void;
};

// The dedicated Trash: deletes what the view has picked on a second press.
// Shift + Delete opens Revert on the main screen, and in a view with a reset
// of its own (a picked track's sound or effect) does that, also on a second
// press; in any other view Shift leaves it the view's Delete.
export const deletePad = (
  device: Device,
  own?: DeleteJob & {
    // Whether there is anything to delete.
    when?: boolean;
  },
  reset?: DeleteJob,
): PadBinding => {
  const { shift, feedback } = device;
  const onScope = device.view === "scope";
  const revert = shift && onScope;
  const resetting = shift && !onScope ? reset : undefined;
  const pending = (job?: DeleteJob) =>
    job !== undefined && feedback.pending === job.key;
  return {
    label: revert
      ? "Open revert"
      : (resetting?.label ?? own?.label ?? "Delete (nothing to delete here)"),
    icon: revert || resetting ? <RotateCcw /> : <Trash2 />,
    lit: pending(own) || pending(reset),
    shiftLegend: revert || resetting !== undefined,
    onPress: (shifted = shift) => {
      if (shifted && onScope) {
        device.latch.release();
        device.views.setView("revert");
        return;
      }
      if (shifted && reset) {
        if (feedback.confirm(reset.key, reset.prompt)) reset.run();
        return;
      }
      if (!own || own.when === false) return;
      if (feedback.confirm(own.key, own.prompt)) own.run();
    },
  };
};

// Play and Stop for the drum pattern.
export const drumGridPads = ({ drumGrid }: Device) => {
  const playing = drumGrid.patternRunning && !drumGrid.recordingPattern;
  return {
    play: {
      label: playing ? "Stop the pattern" : "Play the pattern",
      icon: playing ? (
        <Pause fill="currentColor" />
      ) : (
        <Play fill="currentColor" />
      ),
      onPress: () => {
        if (playing) drumGrid.stopPattern();
        else drumGrid.playPattern(false);
      },
    },
    stop: {
      label: drumGrid.patternRunning
        ? "Stop the pattern"
        : "Back to the pattern's start",
      icon: <Square fill="currentColor" />,
      onPress: () => {
        if (drumGrid.patternRunning) drumGrid.stopPattern();
        else drumGrid.moveStepHead(0);
      },
    },
  };
};

// Play and Stop in a picker, for its preview: Play plays the picked one
// (`play`) or pauses it, picking up where it paused, and Stop lets it go.
export const previewPads = (
  { preview }: Device,
  name: string,
  play: () => void,
) => ({
  play: {
    label: preview.playing ? "Pause the preview" : `Play ${name}`,
    icon: preview.playing ? (
      <Pause fill="currentColor" />
    ) : (
      <Play fill="currentColor" />
    ),
    onPress: preview.playing ? preview.pause : play,
  },
  stop: {
    label: "Stop the preview",
    icon: <Square fill="currentColor" />,
    onPress: preview.stop,
  },
});

// Play and Stop for the tracks: the mix, from the top.
export const mixPads = ({ mix }: Device) => ({
  play: {
    label: mix.playing ? "Pause the tracks" : "Play the tracks",
    icon: mix.playing ? (
      <Pause fill="currentColor" />
    ) : (
      <Play fill="currentColor" />
    ),
    onPress: mix.togglePlay,
  },
  stop: {
    label: "Stop and rewind the tracks",
    icon: <Square fill="currentColor" />,
    onPress: mix.rewind,
  },
});

// Opens or closes the tracks or the tapes. While recording it ends the
// take, like Record.
const openTracks = ({ transport, latch, views }: Device, tapes: boolean) => {
  transport.setRollPosition(null);
  if (transport.recording) {
    transport.stop();
    return;
  }
  if (tapes) latch.release();
  views.toggleView(tapes ? "tapes" : "tracks");
};

// Opens or closes the take (record mode), which Record also opens, loading
// the picked track onto it; with `drumGrid` the drum grid. While recording
// it ends the take.
const openTake = (device: Device, drumGrid: boolean) => {
  const { transport, latch, views, lanes, feedback } = device;
  transport.setRollPosition(null);
  if (transport.recording) {
    transport.stop();
    return;
  }
  latch.release();
  // A track opens only where it was made: a played take in the piano roll, a
  // drawn pattern in the drum grid.
  const where = drumGrid ? "drumGrid" : "roll";
  const track = isTake(lanes.focusedLane) ? null : lanes.focusedLane;
  if (device.view !== where && track && trackSource(track) !== where) {
    feedback.showPrompt(
      drumGrid
        ? "Open this track in the piano roll"
        : "Open this track in the drum grid",
    );
    return;
  }
  if (drumGrid) {
    device.drumGrid.toggleDrumGrid();
    return;
  }
  if (device.view === "roll") {
    views.setView("scope");
    return;
  }
  if (!isTake(lanes.focusedLane)) lanes.loadTake(lanes.focusedLane);
  views.setView("roll");
};

// The preset library, on the sound playing (on the favorites' page if it is
// one), or with `params` the synth parameters; either closes on another
// press.
const openSynth = ({ view, views, sound, browse }: Device, params: boolean) => {
  if (view === (params ? "synth" : "instruments")) {
    views.setView("scope");
    return;
  }
  if (params) {
    views.setView("synth");
    return;
  }
  browse.setPresetIndex(
    Math.max(
      0,
      listFavorites(
        sound.presets,
        presetCategory,
        browse.favorites.instruments,
      ).findIndex(({ id }) => id === sound.preset.id),
    ),
  );
  views.setView("instruments");
};

// A module pad opens its view; with Shift it switches the module on or off
// without leaving the current view.
const modulePad = (device: Device, id: ModuleId, icon: ReactNode) => {
  const { label } = DEVICE_MODULES[id];
  const on = device.lanes.modules.on[id];
  return {
    label: device.shift
      ? `Turn ${label} ${on ? "off" : "on"}`
      : `${device.view === id ? "Close" : "Open"} the ${label} (${on ? "on" : "off"})`,
    icon,
    lit: device.view === id,
    indicator: on,
    shiftLegend: device.shift,
    onPress: () => {
      if (device.shift) device.lanes.toggleModule(id);
      else device.views.toggleModule(id);
    },
  };
};

// Like a module pad: it opens the tempo view, and with Shift starts or stops
// the click without leaving the current view.
const metronomePad = ({ shift, view, views, transport }: Device) => ({
  label: shift
    ? `Turn metronome ${transport.metronome ? "off" : "on"}`
    : `${view === "tempo" ? "Close" : "Open"} the tempo (metronome ${transport.metronome ? "on" : "off"})`,
  icon: <Metronome />,
  lit: view === "tempo",
  indicator: transport.metronome,
  shiftLegend: shift,
  onPress: () => {
    if (shift) {
      deviceEngine.unlock();
      transport.toggleMetronome();
      return;
    }
    transport.stopTapping();
    views.toggleView("tempo");
  },
});

const viewPad = (
  { view }: Device,
  opens: Device["view"],
  [open, close]: readonly [string, string],
  icon: ReactNode,
  onPress: () => void,
): PadBinding => ({
  label: view === opens ? close : open,
  icon,
  lit: view === opens,
  onPress,
});

// The tracks, tapes, piano roll and drum grid pads end a recording before
// they open anything (see openTracks and openTake).
const endsRecording = ({ transport }: Device, pad: PadBinding): PadBinding =>
  transport.recording ? { ...pad, label: "Stop recording" } : pad;

// What every control does unless a mode rebinds it: the knobs set the
// volume and the selected param, ↑ and ↓ move the octave (so do ← and →,
// which with Shift step the preset) and the pads open their views.
export function baseBindings(device: Device): Bindings {
  const { shift, views, output, transport, sound, performance, take, browse } =
    device;
  const recording = transport.recording;

  return {
    knobs: {
      chalk: {
        label: "Volume",
        valueLabel: `${output.volumeStep * 10}%`,
        step: output.volumeStep,
        steps: KNOB_STEPS,
        onChange: output.setVolume,
      },
      green: seekKnob("", browse.idleSeek, KNOB_STEPS, browse.setIdleSeek),
      red: paramKnob(device),
      blue: {
        label: "Value",
        valueLabel: `${sound.selectedName} ${sound.selectedDisplay}`,
        step: valueToStep(
          sound.selected,
          sound.selectedValue,
          sound.valueSteps,
        ),
        steps: sound.valueSteps,
        onChange: sound.setSelectedValue,
      },
    },
    pads: {
      play: {
        label: recording
          ? "Stop recording"
          : take.recordArmed
            ? "Start recording"
            : transport.playing
              ? "Pause the take"
              : "Play the take",
        icon: transport.playing ? (
          <Pause fill="currentColor" />
        ) : (
          <Play fill="currentColor" />
        ),
        onPress: take.togglePlay,
      },
      record: {
        label: recording
          ? "Stop recording"
          : take.recordArmed
            ? "Disarm recording"
            : "Arm recording",
        icon: <Circle fill="currentColor" />,
        lit: recording || take.recordArmed,
        onPress: take.toggleRecord,
      },
      stop: {
        label: recording
          ? "Stop recording"
          : take.recordArmed
            ? "Disarm recording"
            : transport.playing
              ? "Pause the take"
              : device.view === "roll"
                ? "Back to the take's start"
                : "Stop (nothing is playing)",
        icon: <Square fill="currentColor" />,
        onPress: take.stop,
      },
      // Every other view shows over the main one, so Play and Stop act on
      // what it plays: the tracks, the pattern, or (as above) the take.
      ...(views.mainView === "tracks"
        ? mixPads(device)
        : views.mainView === "drumGrid"
          ? drumGridPads(device)
          : {}),
      // Save keeps what the view holds; here, without Shift, nothing.
      save: savePad(device, { label: "Save (not used here)" }),
      tapes: endsRecording(
        device,
        viewPad(
          device,
          "tapes",
          ["Open the tapes", "Close the tapes"],
          <TapeDeckIcon />,
          () => openTracks(device, true),
        ),
      ),
      tracks: endsRecording(
        device,
        viewPad(
          device,
          "tracks",
          ["Open the tracks", "Close the tracks"],
          <TracksIcon />,
          () => openTracks(device, false),
        ),
      ),
      // With Shift, the chord progressions.
      roll: shift
        ? {
            label:
              device.view === "progressions"
                ? "Close the chord progressions"
                : "Open the chord progressions",
            icon: <ListMusic />,
            lit: device.view === "progressions",
            shiftLegend: true,
            onPress: () => {
              device.latch.release();
              views.toggleView("progressions");
            },
          }
        : endsRecording(
            device,
            viewPad(
              device,
              "roll",
              ["Open the piano roll", "Close the piano roll"],
              <PianoRollIcon />,
              () => openTake(device, false),
            ),
          ),
      // With Shift, the drum beats.
      drumGrid: shift
        ? {
            label:
              device.view === "beats"
                ? "Close the drum beats"
                : "Open the drum beats",
            icon: <Activity />,
            lit: device.view === "beats",
            shiftLegend: true,
            onPress: () => {
              device.latch.release();
              views.toggleView("beats");
            },
          }
        : endsRecording(
            device,
            viewPad(
              device,
              "drumGrid",
              ["Open the drum grid", "Close the drum grid"],
              <DrumGridIcon />,
              () => openTake(device, true),
            ),
          ),
      adsr: modulePad(device, "adsr", <AdsrIcon />),
      lfo: modulePad(device, "lfo", <WavesHorizontal />),
      fx: modulePad(device, "fx", <AudioLines />),
      metronome: metronomePad(device),
      mute: unusedPad("Mute a track", <VolumeX />),
      clip: unusedPad("Clip a track", <Scissors />),
      up: {
        label: "Octave up",
        icon: <ArrowUp />,
        onPress: () => sound.shiftOctave(1),
      },
      down: {
        label: "Octave down",
        icon: <ArrowDown />,
        onPress: () => sound.shiftOctave(-1),
      },
      delete: deletePad(device),
      instruments: viewPad(
        device,
        "instruments",
        ["Open the instruments", "Close the instruments"],
        <LayoutGrid />,
        () => openSynth(device, false),
      ),
      synth: viewPad(
        device,
        "synth",
        ["Open the synth parameters", "Close the synth parameters"],
        <AudioWaveform />,
        () => openSynth(device, true),
      ),
      // With Shift, the chord progressions.
      chords: viewPad(
        device,
        "chords",
        ["Open the chords", "Close the chords"],
        <Music4 />,
        () => views.toggleView("chords"),
      ),
      playStyle: viewPad(
        device,
        "playStyle",
        ["Open the play style", "Close the play style"],
        <PlayStyleIcon pattern={performance.playStyle.id} />,
        () => views.toggleView("playStyle"),
      ),
      ...arrowPads(
        device,
        shift
          ? ["Previous instrument", "Next instrument"]
          : ["Octave down", "Octave up"],
        (direction) =>
          shift ? sound.stepPreset(direction) : sound.shiftOctave(direction),
      ),
    },
    instrumentPad: (pad) => {
      const bound = padPreset(device, pad);
      const current = bound?.id === sound.preset.id;
      return {
        label: bound
          ? current
            ? `${bound.name} (playing)`
            : `Switch to ${bound.name}`
          : `Empty instrument pad ${pad + 1} (bind one in the instruments)`,
        icon: bound && <PresetIcon icon={bound.icon} />,
        // Lit while either of its two presets plays.
        indicator: bound
          ? sound.library.buttons[pad] === sound.preset.id ||
            sound.library.shiftButtons[pad] === sound.preset.id
          : undefined,
        shiftLegend: shift,
        onPress: () => {
          if (!bound) return;
          sound.selectPreset(bound);
          if (!shift) return;
          // The alternate comes up to the pad's first layer, and a latched
          // Shift lets go once it's picked.
          swapPad(pad);
          device.latch.release();
        },
      };
    },
    chordPad: (index) => {
      const { name, label } = performance.padChords[index];
      return {
        label:
          performance.chord === index
            ? `Let go of ${name} chords`
            : `Play ${name} chords on the keys`,
        icon: label,
        pressed: performance.activeChord === index,
        onPress: () => performance.toggleChord(index),
      };
    },
    screen: {
      title: sound.preset.name,
      unsaved: Boolean(sound.edits),
      status: "",
      footer: ["", ""],
      badge: null,
    },
  };
}
