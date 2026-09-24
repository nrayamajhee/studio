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

The home page (`app/routes/home.tsx`) renders The Device on a full-screen sky gradient (sunset in light mode, blue hour in dark mode). It is a digital replica of a physical synthesizer unit with:

- **Home row** — a compact transport strip (no longer full-width): two `< >` navigator groups and numbered section squares:
  - **Section navigator `< 01/06 · Exciter >`** — cycles the six synth sections (keyboard hotkeys `1`–`6` jump directly).
  - **Preset navigator `< Electric Guitar · 1/22 >`** — cycles every preset in `SYNTH_PRESETS` (the same stack the studio page uses).
  - **Numbered squares `1`–`6`** — direct section jumps; the active one is highlighted.
- **Piano keys** — one octave (C–B) with raised black keys. Keys are glass Cards that rotate around their top edge when pressed and show engraved hotkeys (`A W S E D F T G Y H U J`).
- **Drum pads** — 16 black `Pad` buttons in a 4×4 grid at the same unit size as the home-row squares, covering a chromatic drum range (C1–D#2) with hotkeys `I O P [ ] K L ; M , . / N B V C`.
- **Screen** — a dark solid card between the knobs showing the current instrument, section counter, the live output waveform (oscilloscope from the Studio sidebar) at the top, the selected section's visualization, and four parameter readouts. Screen and knobs are frozen in place: switching sections must never resize, shift, or reflow them.
- **Four knobs** — two on each side of the screen. They edit the four parameters of the selected section. Dragging is slider-like: only horizontal pointer movement changes the value (right increases, left decreases), and the 0 (bottom-left) and MAX (bottom-right) end notches float beside each dial.
- **Theme** — first visit follows the system preference; the top-right button then toggles only between light and dark.

### Device architecture

| Path | Purpose |
| --- | --- |
| `app/routes/home.tsx` | Route shell: gradient background, theme toggle, centers The Device |
| `app/components/home/HomePiano.tsx` | The Device itself: state for preset, section, and pressed notes; wiring to the synth engine |
| `app/components/home/SynthScreen.tsx` | The dark screen (visualization + readouts) |
| `app/components/home/synthSections.ts` | The six synth sections; each exposes four controls with `value`/`display`/`update` mappers (0–100 knob space) |
| `app/components/design-system-v2/` | Device primitives: `Card` (solid/glass), `Key`, `Knob`, `Pad` (square Key); exported via `index.ts` |
| `app/lib/synth.ts` | Shared synth engine (`synth` singleton, `SYNTH_PRESETS`); The Device plays through `synth.playNote` / `synth.playDrum` |

Design rules for The Device:

- All interactive surfaces are built from the same `Card`/`Key`/`Pad` family — same semantics, scaled by CSS (`aspect-ratio`), never squeezed.
- The 16-track grid in `HomePiano.module.css` aligns the keybed (12 tracks) and the 4×4 drum grid (4 tracks); keep knobs and screen at fixed sizes.
- Keyboard hotkeys must never overlap between piano notes, sections, and drum notes.

## Storybook

Stories are colocated with their components (`Component.stories.tsx`) and organized under two top-level titles:

- **`Design System V2/*`** — `Card`, `Key`, `Knob`, `Pad`.
- **`Home/*`** — `Device` (`HomePiano`), `Synth Screen`.

Setup conventions:

- Every component starts with a `Default` story that binds cleanly to its props so Autodocs and the Controls panel work out of the box.
- Components use the `autodocs` tag and `layout: "centered"` (or `"padded"` for surfaces).
- Glass/translucent components are showcased over the `.home-background` gradient class via a decorator so their translucency is visible.
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
