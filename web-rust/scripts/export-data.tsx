// Writes web-rust/data/*.json from web-react's own code: the tables the
// Rust app reads as they are (the chord progressions, the drum beats) and
// every icon the Device draws, as React renders it. Run from web-react
// after changing any of them:
//   npx tsx ../web-rust/scripts/export-data.tsx
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { ComponentType } from "react";
import { DRUM_BEATS } from "../../web-react/app/components/home/drumBeats";
import {
  AdsrIcon,
  DRUM_PIECES,
  DrumGridIcon,
  PianoRollIcon,
  PlayStyleIcon,
  TakeIcon,
  TapeDeckIcon,
  TracksIcon,
} from "../../web-react/app/components/home/instrumentIcons";
import { PLAY_STYLES } from "../../web-react/app/components/home/playStyles";
import { PRESET_ICONS } from "../../web-react/app/components/home/presetIcons";
import { PROGRESSIONS } from "../../web-react/app/components/home/progressions";

// React and lucide as web-react installs them: the copies its components
// render with, which a bare import from here wouldn't find.
const fromWebReact = createRequire(
  new URL("../../web-react/package.json", import.meta.url),
);
const { createElement } = fromWebReact("react") as typeof import("react");
const { renderToStaticMarkup } = fromWebReact(
  "react-dom/server",
) as typeof import("react-dom/server");
const lucide = fromWebReact("lucide-react") as typeof import("lucide-react");

const out = (name: string, value: unknown) =>
  writeFileSync(
    new URL(`../data/${name}.json`, import.meta.url),
    `${JSON.stringify(value, null, 1)}\n`,
  );

// Every chord written out as [root, quality, bass], the bass 0 where the
// chord stands on its root.
out(
  "progressions",
  PROGRESSIONS.map((progression) => ({
    ...progression,
    chords: progression.chords.map(([root, quality, bass = 0]) => [
      root,
      quality,
      bass,
    ]),
  })),
);

out("beats", DRUM_BEATS);

const render = (Icon: ComponentType, props: object = {}) =>
  renderToStaticMarkup(createElement(Icon, props));

// The lucide icons the Device's components import, by name.
const LUCIDE = [
  "Activity",
  "ArrowBigUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "Asterisk",
  "AudioLines",
  "AudioWaveform",
  "Bell",
  "Check",
  "ChevronLeft",
  "ChevronRight",
  "Circle",
  "Copy",
  "CopyPlus",
  "Drum",
  "FileMusic",
  "Hand",
  "Headphones",
  "KeyboardMusic",
  "Layers",
  "LayoutGrid",
  "Link2",
  "Link2Off",
  "ListMusic",
  "Menu",
  "Metronome",
  "Minus",
  "Music4",
  "Pause",
  "Play",
  "Plus",
  "Pointer",
  "RotateCcw",
  "Save",
  "Scissors",
  "ScissorsLineDashed",
  "SlidersHorizontal",
  "Square",
  "Star",
  "Trash2",
  "Volume2",
  "VolumeX",
  "WavesHorizontal",
  "X",
] as const;

const icons = lucide as unknown as Record<string, ComponentType>;

out("icons", {
  lucide: Object.fromEntries(
    LUCIDE.map((name) => {
      const Icon = icons[name];
      if (!Icon) throw new Error(`No lucide icon ${name}`);
      return [name, render(Icon)];
    }),
  ),
  // The Device's own drawings on its pads.
  device: {
    Tracks: render(TracksIcon),
    TapeDeck: render(TapeDeckIcon),
    Take: render(TakeIcon),
    PianoRoll: render(PianoRollIcon),
    DrumGrid: render(DrumGridIcon),
    Adsr: render(AdsrIcon),
  },
  // Each preset icon by key, in the order the Save view offers them.
  presets: Object.entries(PRESET_ICONS).map(([key, Icon]) => [
    key,
    render(Icon),
  ]),
  playStyles: Object.fromEntries(
    PLAY_STYLES.map(({ id }) => [
      id,
      render(PlayStyleIcon as ComponentType, { pattern: id }),
    ]),
  ),
  // What each key shows with a kit: an icon, or a stroke's syllable.
  pieces: Object.fromEntries(
    Object.entries(DRUM_PIECES).map(([id, { name, Icon }]) => [
      id,
      { name, icon: Icon ? render(Icon) : null },
    ]),
  ),
});
