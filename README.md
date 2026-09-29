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
- **Lint**: `npm run lint` (fix with `npm run lint:fix`)
- **Format**: `npm run format` (check with `npm run format:check`)

## Clean

- **Clean Artifacts & Dependencies**:

  ```bash
  npm run clean
  ```

## The Device (Home Page)

The home page (`app/routes/home.tsx`) renders The Device on a full-screen sky gradient (sunset in light mode, blue hour in dark mode). It implements the [Synth UI design canvas](https://claude.ai/artifact/CrrBAERp6Gc7j3Aon8k7XY) (artboards "Synth" for light and "Synth — dark"):

The layout is two rows:

```
| 3×3 pads | 2 knobs | screen | 2 knobs | 3×3 pads |
| 3×3 pads |          keybed           | 3×3 pads |
```

- **Knobs** — four gear-edged knobs, pad-sized (68 px), in two evenly spaced stacked pairs: Waveform and Volume left of the screen, Release and Filter cutoff right of it. They override the current preset's `osc1Wave`, `masterVol`, `release`, and `cutoff` in four detents (−135°, −45°, 45°, 135°). Drag horizontally (24 px per detent, right increases), scroll (one wheel notch per detent), or click to advance and wrap. A freshly loaded preset shows its nearest detent.
- **Screen** — a black oscilloscope bezel that draws three cycles of the current waveform, with the preset name (top left) and octave shift (top right).
- **Presets** (top-left 3×3) — Piano, Guitar, Bass, Drums, Flute, Sax (the `/studio` preset-panel icons), Synth, Strings, Organ. A pad also stays lit for related presets reached with Shift + arrows (e.g. Piano for Rhodes, Electronic Piano, Lo-Fi Keys).
- **Keybed** — two octaves, F3–E5 (14 white, 10 black keys), in a recessed well. Keys sustain while held and are engraved with their hotkey and note name (C keys show their octave).
- **Chord macros** (top-right 3×3) — Maj, Min, Dom7, Maj7, Min7, Sus4, Power, Dim, Add9. Toggling one makes every key play that chord from its root; toggle it again for single notes.
- **Bottom-left 3×3** — ← / → (octave down/up, −2…+2) and Shift, three unassigned pads, then the transport row: Play, Stop, Record. With Shift latched, ← / → step through every preset in `SYNTH_PRESETS`. Record captures what you play on the keys; Play plays the take back.
- **Bottom-right 3×3** — six unassigned pads above the recorder row: Tape (free timing, plays once), Sequencer (quantized to 16th notes at 120 BPM, loops whole bars), and a 120 BPM Metronome toggle.
- **Theme** — first visit follows the system preference; the top-right button then toggles only between light and dark with a 400 ms cross-fade.

### Keyboard hotkeys

Hotkeys match physical key positions (`KeyboardEvent.code`, labelled as QWERTY):

Three zones, each with its white keys on one row and every black key on the row above, between its neighbours. Zones meet at B|C, where there is no black key.

| Zone | White keys | Black keys |
| --- | --- | --- |
| Left | `Q W E R` → F3 G3 A3 B3 | `2 3 4` → F♯3 G♯3 A♯3 |
| Middle | `Z X C V B N M` → C4 D4 E4 F4 G4 A4 B4 | `S D G H J` → C♯4 D♯4 F♯4 G♯4 A♯4 |
| Right | `P [ ]` → C5 D5 E5 | `- =` → C♯5 D♯5 |

### Device architecture

| Path | Purpose |
| --- | --- |
| `app/routes/home.tsx` | Route shell: gradient background, theme toggle, hosts The Device |
| `app/components/home/SynthDevice.tsx` | The Device itself: layout, preset/knob/octave/chord state, hotkeys, keybed, screen |
| `app/components/home/useTransport.ts` | Play/stop/record, tape vs sequencer takes, metronome |
| `app/components/design-system-v2/` | Device primitives exported via `index.ts`: `Key` (piano key with hotkey/note labels, hold to play), `Knob` (gear-edged stepped knob: drag, scroll, click), `Pad` (square pad with an icon or text face; also exports `pressProps`) |
| `app/lib/synth.ts` | Shared synth engine; The Device plays through `synth.loadPreset`, `playNote` / `stopNote`, `updateParam`, `playMetronomeTick` |

Design rules for The Device:

- The Device is laid out at a native 1348×540 px and scaled uniformly by CSS (`--scale` in `SynthDevice.module.css`) to fit its container. Never reflow or squeeze its parts.
- One spacing value, `--gap` (32 px), is the bezel padding on all four sides and every gap between groups (pads, knobs, screen, key well, rows). Pads inside a 3×3 use 9 px.
- Light and dark values mirror the two artboards. Write each as `color-mix(in srgb, <light>, <dark> var(--theme-mix))` so it fades with the page's 400 ms theme cross-fade (`--theme-dark` in `app.css`), and keep color transitions off those elements; their own transitions snap to the end color mid-fade.
- Pads trigger on press (pointerdown); keys sound while held; knobs step on drag, scroll, or click.
- Keyboard hotkeys must never overlap between keys and any future pad shortcuts.

## Storybook

Stories are colocated with their components (`Component.stories.tsx`) and organized under two top-level titles. Components used only by `/studio` have no stories.

- **`Design System V2/*`** — `Key`, `Knob`, `Pad`.
- **`Home/*`** — `Device` (`SynthDevice`).

Setup conventions:

- Every component starts with a `Default` story that binds cleanly to its props so Autodocs and the Controls panel work out of the box.
- Components use the `autodocs` tag and `layout: "centered"` (or `"padded"` for surfaces).
- The Device story renders over the `.home-background` gradient via a decorator.
- Light/dark coverage comes from the theme addon (`@storybook/addon-themes`); components must be correct in both modes.

## Ignore `/studio`

The `/studio` route is the initial legacy project (multi-track mixer, piano roll, presets panel). It will be re-implemented around The Device. Do not extend, refactor, or reuse it as a reference for new work — build new functionality into the home page and `design-system-v2` instead. Shared, already-extracted pieces (`app/lib/synth.ts`, `SynthVisualizers`) may be imported.

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
