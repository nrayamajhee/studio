# Studio

Studio is a browser-based instrument. The home page hosts **The Device**: a digital version of a physical desktop synthesizer. The app is built with React Router (v8), React 19, Tailwind CSS v4, and Storybook 10.

## Installation

```bash
npm install
```

## Development

- **App Dev Server**: Runs on port `5173` (`http://localhost:5173`)

  ```bash
  npm run dev
  ```

- **Storybook**: Runs on port `6006` (`http://localhost:6006`)
  ```bash
  npm run storybook
  ```

## Build

- **Build App**:

  ```bash
  npm run build
  ```

- **Build Storybook**:

  ```bash
  npm run build-storybook
  ```

## Checks

- **Typecheck**: `npm run typecheck`
- **Unit tests** (DSP and synth engine, Node): `npm run test:unit`
- **Story smoke tests** (headless Chromium): `npx vitest run --project storybook`
- **Lint**: `npm run lint` (fix with `npm run lint:fix`)
- **Format**: `npm run format` (check with `npm run format:check`)

## Clean

- **Clean Artifacts & Dependencies**:

  ```bash
  npm run clean
  ```

## The Device (Home Page)

The home page (`app/routes/home.tsx`) renders The Device on a full-screen sky gradient (sunset in light mode, blue hour in dark mode). It implements the [Synth UI design canvas](https://claude.ai/artifact/CrrBAERp6Gc7j3Aon8k7XY) (artboards "Synth" for light and "Synth — dark"):

The layout is two rows; pad banks are 4 columns wide, 2 rows on top and 3 below:

```
| 2×4 pads | 2 knobs | screen | 2 knobs | 2×4 pads |
| 3×4 pads |          keybed           | 3×4 pads |
```

- **Knobs** — four gear-edged knobs, 56 px (the Knob's `--knob-size`), in two stacked pairs, each centred on one of the two top pad rows, in a muted palette: white, green, red (`--synth-red`) and blue. Left of the screen: white (top) is master **Volume** only (11 steps); every change shows a solid volume bar over whatever the screen is displaying. Green (bottom) is **Seek**, which moves through whatever the screen shows (parameter pages, the icon picker, the preset library; idle on the scope); what it controls is marked green on the screen. Right of the screen: red (top) is **Parameter**, which cycles through every setting of the current instrument, and blue (bottom) is **Value**, which sets the selected setting (11 steps across its range). The footer shows the instrument's engine (Hammer, Pluck, Breath, Reed, Bow or Strike) on the left and the selected setting on the right, its name in red and its value in blue to match the knobs; on the synth view its row is highlighted the same way instead. Only Volume uses the overlay. Switching presets keeps the selected setting when the new instrument has it. Drag horizontally (24 px per step, right increases), scroll (one wheel notch per step), or click to advance and wrap. In ADSR mode all four knobs set the envelope instead: white Attack, green Decay, red Sustain, blue Release.
- **Screen** (`DeviceScreen`) — a black bezel that reaches past the top row into the Device's padding, stopping 16 px from the top edge and from the key well (177 px tall), with the preset name and a status on top and a footer underneath. It shows one of five views: a live oscilloscope (default), the synth parameters (Synth, 12 per page in 3 rows × 4; tap a setting to select it; the octave stays top right and the page counter replaces the selection in the footer), the ADSR envelope (drawn in the knob colours, sustain filling whatever the other stages leave), the Save icon picker (two pages, each one row of 16 small square icons: instruments and sound, then gear and moods), or the preset library (Shift + Synth, one row of 8 per page).
- **Presets** (top-left 2×4) — grouped by engine: Grand Piano (hammer); Acoustic Guitar, Upright Bass (pluck); Violin (bow); Flute (breath); Alto Sax (reed); Drum Kit, 808 Kit (strike). All are played by the physical-modeling engine (see [Synth engine](#synth-engine)). Pressing a pad loads its preset (the screen title shows which one is active; pads don't stay lit). Any pad can be rebound to any preset, including saved ones. With a kit selected, keys play pieces by pitch class.
- **Keybed** — two octaves, F3–E5 (14 white, 10 black keys), in a recessed well. Keys sustain while held and are engraved with their hotkey and note name (C keys show their octave); with a kit selected, the note name becomes an icon of the drum the key plays.
- **Chord macros** (top-right 2×4) — most used first: Maj, Min, Dom7, Min7, Maj7, Power, Sus4, Add9. Toggling one makes every key play that chord from its root; toggle it again for single notes.
- **Bottom-left 3×4** — three rows (blank pads fill the rest):
  - **Synth, ADSR.** Synth (an audio waveform icon, which becomes a grid icon while Shift is on or the library is open) toggles the parameter view. Save only works from the parameter view: it opens an icon picker (Seek or tap to choose, ← / → for the second page). Then press a preset pad to save the tweaked sound there with the new icon: it becomes a new preset named "<instrument> <n>" bound to that pad, or, if that pad already holds the saved preset being edited, overwrites it. Pressing Save again instead stores it in the library without binding a pad. Presets persist in `localStorage` under `studio.instruments` (pads still on their default preset are stored as `null`, so they follow changes to the default order). Shift + Synth toggles the preset library (built-in and saved presets, with the pads each is bound to): highlight one with Seek or a tap (the status shows the page, e.g. Presets 1/2), then press a preset pad to bind it there. ADSR toggles the envelope view: one master amplitude envelope over every instrument's voices (drums included), set with the four knobs. Its knobs start at 0, 200 ms, 50% and 200 ms, but the envelope itself starts off (the modelled sound, untouched); turning any ADSR knob switches it on, and Shift + ADSR switches it off or back on, keeping its settings. The ADSR view is titled "ADSR" and shows On or Off top right. While the envelope is on, the main footer reads e.g. "Hammer · ADSR". A shorter release fades notes faster, but it can't make a damped string ring longer.
  - **Save, ← / → and Shift** (an up arrow). Save is described above. While the screen shows pages (parameters, icon picker, library), ← / → turn them (e.g. Params 1/2 → 2/2, wrapping). On the scope they shift the octave (−2…+2), or with Shift on, step through every preset. Clicking Shift toggles it. Holding the keyboard Shift key holds the pad down until you let go; if a click latched Shift, pressing the key unlatches it.
  - **Transport:** Record, Play, Stop. Record captures what you play on the keys; Play plays the take back.
- **Bottom-right 3×4** — ten blank, unassigned pads, then two toggles: **Sequencer** (on: takes are quantized to 16th notes at 120 BPM and loop whole bars; off: free timing, plays once) and a 120 BPM **Metronome**.
- **Toggles** — only the chord macros, Shift, Sequencer and Metronome are toggle buttons (`aria-pressed`). Preset pads, Save and ← / → are one-shot actions and never stay lit (the screen shows the octave); Synth, ADSR and the transport light up to show state but are plain buttons. Every pad sinks while held, like a key.
- **Theme** — first visit follows the system preference; the top-right button then toggles only between light and dark with a 400 ms cross-fade.

### Keyboard hotkeys

Hotkeys match physical key positions (`KeyboardEvent.code`, labelled as QWERTY):

White keys sit on one row and every black key on the row above, between its neighbours. The low zone meets the rest at B3|C4, and `K` is skipped at B4|C5, since B|C has no black key.

| Zone | White keys                                            | Black keys                                    |
| ---- | ----------------------------------------------------- | --------------------------------------------- |
| Low  | `Q W E R` → F3 G3 A3 B3                               | `2 3 4` → F♯3 G♯3 A♯3                         |
| Main | `Z X C V B N M , . /` → C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 | `S D G H J L ;` → C♯4 D♯4 F♯4 G♯4 A♯4 C♯5 D♯5 |

### Device architecture

| Path                                   | Purpose                                                                                                                                                                                                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/routes/home.tsx`                  | Route shell: gradient background, theme toggle, hosts The Device                                                                                                                                                                                         |
| `app/components/home/SynthDevice.tsx`  | The Device itself: layout, preset/knob/octave/chord state, hotkeys, keybed, screen                                                                                                                                                                       |
| `app/components/home/useTransport.ts`  | Play/stop/record, tape vs sequencer takes, metronome                                                                                                                                                                                                     |
| `app/components/home/deviceEngine.ts`  | The only audio module the Device imports: `DEVICE_PRESETS` (instrument, octave offset, optional param overrides), held-note routing, keybed → drum-piece map, volume, metronome                                                                          |
| `app/components/home/DeviceScreen.tsx` | The screen: scope, synth parameters, icon picker and preset library views                                                                                                                                                                                |
| `app/components/home/Oscilloscope.tsx` | Live scope on the engine's analyser (flat until audio starts)                                                                                                                                                                                            |
| `app/components/home/presetStore.ts`   | Saved presets and pad bindings (`localStorage`, `useSyncExternalStore` so prerendering matches)                                                                                                                                                          |
| `app/components/home/presetIcons.tsx`  | Preset icons and the Save picker's choices                                                                                                                                                                                                               |
| `app/components/design-system-v2/`     | Device primitives exported via `index.ts`: `Key` (piano key with hotkey/note labels, hold to play), `Knob` (gear-edged stepped knob: drag, scroll, click), `Pad` (square pad with an icon or text face that sinks while held; also exports `pressProps`) |
| `app/lib/physical/`                    | Physical-modeling synth engine (see below)                                                                                                                                                                                                               |
| `app/components/lab/`                  | Instrument Lab: audition, tuning and diagnostics harness (Storybook only)                                                                                                                                                                                |
| `app/lib/synth.ts`                     | Legacy engine, `/studio` only                                                                                                                                                                                                                            |

Design rules for The Device:

- The Device is laid out at a native 1470×463 px and scaled uniformly by CSS (`--scale` in `SynthDevice.module.css`) to fit its container. Never reflow or squeeze its parts.
- Two spacing values. `--gap` (32 px) is the bezel on all four sides and the gap between the top and bottom rows. `--inset` (16 px) separates groups within a row (pads, knobs, screen, key well) and is also how far the screen stops from the top edge and from the key well. Pads inside a bank use 9 px.
- Light and dark values mirror the two artboards. Write each as `color-mix(in srgb, <light>, <dark> var(--theme-mix))` so it fades with the page's 400 ms theme cross-fade (`--theme-dark` in `app.css`), and keep color transitions off those elements; their own transitions snap to the end color mid-fade.
- Pads trigger on press (pointerdown); keys sound while held; knobs step on drag, scroll, or click.
- Keyboard hotkeys must never overlap between keys and any future pad shortcuts.

## Synth engine

The Device plays through a physical-modeling engine in `app/lib/physical/`, following `docs/new-synth-plan.md`; `docs/synth-model.md` walks through how it works, with diagrams. Every voice is an exciter → resonator chain rendered sample-accurately inside one TypeScript `AudioWorkletProcessor`:

| Family                      | Instruments                                         | Model                                                                                                                                                                                                  |
| --------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Struck and plucked strings  | piano, acoustic guitar, electric bass, upright bass | single-delay-loop string with dispersion, loss and exact fractional tuning; felt-hammer simulation or pick/finger plucks; unison strings, polarizations, dampers, sustain pedal, per-string allocation |
| Bowed string                | violin                                              | STK `Bowed` with the Maestre body filter, delayed vibrato                                                                                                                                              |
| Blown                       | flute, alto sax                                     | STK `Flute` / `Saxofony` with breath envelope on pressure, mono legato and portamento; the sax bell reflection tracks the note so the whole range speaks                                               |
| Struck membranes and metals | drum kit, 808 kit                                   | modal membranes (pitch drop, beater click, snare wires), seeded metal tables, clap, hat choke                                                                                                          |

Around the voices: per-instrument buses with a modal or radiation body and drive, a shared 8-line FDN reverb that sleeps when silent, master volume and a transparent safety clipper, then a browser limiter and analyser.

- **Layout** — `dsp/` building blocks, `models/` instruments, `engine/` (render loop, event queue, voice lifecycle, buses), `patches/` (per-instrument constants, `ParamSpec` macros and measured tuning tables), `offline/` (pure-TS renderer, OfflineAudioContext renderer, analysis and diagnostics). Only `processor.worklet.ts` touches worklet globals; nothing touches Web Audio at import time, so prerendering is safe.
- **API** — `physicalSynth` (from `app/lib/physical`): `start()` from a user gesture, `noteOn`/`noteOff` (reference-counted per note), `hit`, `setSustain`, `metronomeTick`, `setParam`, `allNotesOff`, `getAnalyser`, `onStats`. Events sent before the worklet is ready are queued.
- **Calibration** — string tuning is exact by construction (loop phase delays are compensated at the fundamental). Flute, sax and violin use measured `tuningCents` tables per sample rate (44.1 / 48 kHz); re-bake them after changing those loops. Output gains put a mezzo-forte C4 at −18 dBFS RMS; drum pieces peak at −3 dBFS.
- **Audition and tune** — Storybook › `Lab/Instrument Lab`: press Start audio, pick an instrument, play with the mouse or `A W S E D F T G Y H U J K` (`Z`/`X` octave, hold Space for sustain), tweak the generated parameter panel, and use **Copy patch JSON** to move tuned values into `patches/*.ts`. The Diagnostics tab runs the tuning, decay, stability, level, onset/lifecycle and stress sweeps through the real worklet.
- **Add a patch** — add a `patches/<name>.ts` (a `StringPatch`, `BorePatch`, `BowedPatch` or `DrumKitPatch` with a `ParamSpec` list from `patches/params.ts`), add its id to `messages.ts` and `PATCHES`, then calibrate with the Lab.
- **Add a Device preset** — add an entry to `DEVICE_PRESETS` in `deviceEngine.ts` (target instrument, octave offset, optional param overrides) and a matching icon in `PRESET_ICONS`.

## Storybook

Stories are colocated with their components (`Component.stories.tsx`) and organized under three top-level titles. Components used only by `/studio` have no stories.

- **`Design System V2/*`** — `Key`, `Knob`, `Pad`.
- **`Home/*`** — `Device` (`SynthDevice`), `Screen` (`DeviceScreen`).
- **`Lab/*`** — `Instrument Lab` (dev tool; not mounted in any route).

Setup conventions:

- Every component starts with a `Default` story that binds cleanly to its props so Autodocs and the Controls panel work out of the box.
- Components use the `autodocs` tag and `layout: "centered"` (or `"padded"` for surfaces).
- The Device story renders over the `.home-background` gradient via a decorator.
- Light/dark coverage comes from the theme addon (`@storybook/addon-themes`); components must be correct in both modes.

## Ignore `/studio`

The `/studio` route is the initial legacy project (multi-track mixer, piano roll, presets panel). It will be re-implemented around The Device. Do not extend, refactor, or reuse it as a reference for new work — build new functionality into the home page and `design-system-v2` instead. Shared, already-extracted pieces (`SynthVisualizers`) may be imported; new audio work goes into `app/lib/physical/`, not `app/lib/synth.ts`.

## Agent Guidelines

### 1. Storybook & Component Story Structure

- **Start with a Default Story**: Every component must start with a `Default` story that cleanly binds to the component's props, allowing Storybook's Autodocs and Controls panel to interactively manipulate props out of the box.
- **Minimal, Focused Variants**: Follow the default story with a minimal set of variant stories. Avoid bloated or unnecessary permutations.
- **Avoid Redundant Prop Combinations**:
  - Each story must focus strictly on the feature or state it demonstrates.
  - For example, in a button states story (like disabled or loading states), do not add leading/trailing icons or subtitles if they are irrelevant to demonstrating the state, since layout combinations are already covered elsewhere.
  - Similarly, in a title-with-subtitle story, leave out extraneous icons unless specifically showcasing full anatomy.

### 2. Comment Removal & Clean Code Policy

- **Strip Thinking/Scratch Comments**: After code has been generated, all comments that were part of the thinking process, section dividers, or obvious restatements of code must be removed.
- **Preserve Only Critical Comments**: Only keep essential comments such as `TODO`, `FIXME`, and explanations of non-obvious tricky logic or magic numbers.

### 3. Testing Guidelines

- **No Automatic Interaction Tests**: Do not generate interaction tests (such as Storybook `play` functions or automated interaction suites) during initial component and story code generation.
- **Prompt the User First**: Always ask the user in a follow-up question whether interaction or unit tests should be added.
