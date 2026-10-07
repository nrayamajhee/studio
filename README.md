> source available. all rights reserved.  
> this is not open source.  
> AI was used and paid for.  
> no copyright infringement intended.

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

The home page (`app/routes/home.tsx`) renders The Device, a digital desktop synthesizer played through the physical-modeling engine (see [Synth engine](#synth-engine)).

| Path                                   | Purpose                                                                                                                                                          |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/components/home/SynthDevice.tsx`  | The Device: its providers and parts, as JSX                                                                                                                      |
| `app/components/home/layout/`          | The case: `DeviceFrame`, `TopRow`, `KnobColumn`                                                                                                                  |
| `app/components/home/parts/`           | `DeviceKnob`, `DevicePad`, `PadButtons` (every pad, 12×3), `Display` (the screen as the mode fills it), `Keybed`, `Grille`                                       |
| `app/components/home/modes/`           | What each control does in each view (see [Modes](#modes)); `base.tsx` is the default                                                                             |
| `app/components/home/DeviceScreen.tsx` | The screen and its views (presentational)                                                                                                                        |
| `app/providers/`                       | The Device's state, one provider per domain, composed by `DeviceProviders`                                                                                       |
| `app/types/`                           | Shared types: `Device` (what modes read) and the bindings modes return                                                                                           |
| `app/components/home/deviceEngine.ts`  | The only audio module the Device imports; built-in presets                                                                                                       |
| `app/components/home/presetStore.ts`   | Saved presets, pad bindings and edits (`localStorage`)                                                                                                           |
| `app/hooks/useTransport.ts`            | Recording, playback, metronome, tempo and tap tempo                                                                                                              |
| `app/components/home/noteRecorder.ts`  | Takes as played (start, held length, velocity); 16th-step quantizing                                                                                             |
| `app/components/home/NoteRoll.tsx`     | The screen's piano roll: keys down the left (C0–C10), notes running out of them                                                                                  |
| `app/hooks/useScrub.ts`                | Scrubbing the stopped roll: renders the take, plays it at the scroll's speed                                                                                     |
| `app/components/home/tracks.ts`        | Takes kept as tracks: clip, start, repeats, mute, solo, loop and cut, and whether each was played on the tape or drawn in the sequencer (the one place it opens) |
| `app/components/home/sessionStore.ts`  | The tape's take, and the album: songs of tracks, each with its tempo (`localStorage`)                                                                            |
| `app/components/home/modules.ts`       | ADSR, LFO and FX settings, which the tape and each track keep their own of                                                                                       |
| `app/components/home/stepPattern.ts`   | The drum grid's pattern: hits in beats, kit rows, saving as a take                                                                                               |
| `app/hooks/useStepPlayer.ts`           | Loops the drum pattern on the audio clock; lands recorded taps on the nearest step                                                                               |
| `app/components/home/exportMix.ts`     | Saving the tracks: the mix as FLAC (`flac.ts`), or MIDI                                                                                                          |
| `app/components/design-system/`        | Device primitives `Key`, `Knob`, `Pad` and base controls                                                                                                         |
| `app/components/lab/`                  | Instrument Lab (Storybook only)                                                                                                                                  |

Design rules:

- The Device has a fixed native size and is scaled uniformly by CSS (`--scale`) to fit. Never reflow or squeeze its parts.
- Two spacing values, theme tokens in `app.css`: `bezel` (`p-bezel`; also the page margin, from twice it on wide screens down to half on phones) and `inset` (`gap-inset`) for everything else.
- Theme colours are `color-mix(in srgb, <light>, <dark> var(--theme-mix))` tokens in `app.css` (`bg-device`, `bg-pad`, `shadow-pad`…) so they fade with the 400 ms theme cross-fade. Keep colour transitions off those elements; their own transitions snap mid-fade.
- Keyboard hotkeys must never overlap between keys and pads.
- A pad with nothing bound to it (an empty preset pad) stays blank. A pad that does nothing in the current view keeps its icon.

### Architecture

The Device's hardware is fixed; each view is a **mode** that rebinds it.

- **Providers** (`app/providers/`), outermost first, each reading only those above it: `Hotkey` (in the route) → `Feedback` (notices, prompts, overlays, second-press `confirm`, busy while the mix saves) → `Shift` → `View` → `Transport` → `Output` (volume, level) → `Sound` (preset, params, octave) → `Performance` (held keys, chords) → `Lanes` (the tape and the open song's tracks, the focused lane and its modules) → `Steps` → `Tracks` (timeline and track edits) → `Mix` (playback, scrub, export) → `Tape` (the roll) → `Mode`. `DeviceProviders` composes them. Persisted data stays in the stores (`sessionStore`, `presetStore`, `chordStore`); providers hold only live and view state.
- **Modes** (`app/components/home/modes/`): `baseBindings(device)` says what every knob, pad and the screen do by default, and each view's mode (`MODES[view]`) returns only what it changes. Modes are plain functions of the `Device` (`app/types/device.ts`), so they hold no hooks; `ModeProvider` resolves them and parts read their binding with `useBindings()`.
- **Parts** own their DOM and their keys: `DevicePad` presses its binding from a click, its hotkey or a ⌘ shortcut, so a key always does what clicking its pad does. `Keybed`, `PadButtons` and `ShiftProvider` handle the note, chord and Shift keys.

### Modes

To change what a control does in a view, edit that view's mode; to add a view, add a mode and register it in `modes/index.ts`. Cross-domain commands (keeping the tape or a pattern as a track, the album's songs, Revert's options) live in the mode that uses them.

## Synth engine

The Device plays through a physical-modeling engine in `app/lib/physical/`, following `docs/new-synth-plan.md`; `docs/synth-model.md` walks through how it works, with diagrams. Every voice is an exciter → resonator chain rendered sample-accurately inside one TypeScript `AudioWorkletProcessor`:

| Family                      | Instruments                                                                                          | Model                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Struck and plucked strings  | piano, acoustic, electric and nylon guitar, ukulele, banjo, electric bass, upright bass, harp, sitar | single-delay-loop string with dispersion, loss and exact fractional tuning; felt-hammer simulation or pick/finger plucks (switchable per preset); unison strings, polarizations, dampers (none on the harp), sustain pedal, per-string allocation, pickup comb (electric guitar and bass); the sitar's jawari bridge (a passive switching allpass in the loop, after Pierce & Van Duyne) and sympathetic taraf strings as long body modes |
| Bowed string                | violin, cello                                                                                        | STK `Bowed` with the Maestre body filter (violin) or a modal body (cello), delayed vibrato, legato portamento                                                                                                                                                                                                                                                                                                                             |
| Blown                       | flute, alto sax, clarinet, trumpet, bass trumpet, trombone                                           | STK `Flute` / `Saxofony` / `Clarinet` / `Brass` with breath envelope on pressure, mono legato and portamento; the sax bell reflection tracks the note, and the brass lips keep a fixed Q, so the whole range speaks                                                                                                                                                                                                                       |
| Free reeds                  | harmonium, harmonica                                                                                 | each reed a self-oscillating (van der Pol) resonator tuned to the note, letting a pulse of air through its slot each swing; the sound is that flow's slope, so harder blowing brightens it; a second, slightly sharp reed beats against the first, and a shared swell (bellows, hand tremolo) moves every voice's pressure                                                                                                                |
| Tuned percussion            | xylophone, steel pan, kalimba                                                                        | each key a bank of modes at fixed ratios to the note (a bar's 1 : 3 : 6.2, a pan dome's 1 : 2 : 3 with near-twin modes, a tine's 1 : 6.27 : 17.55), struck by a half-sine mallet or thumb pulse whose length (hardness, velocity) sets how high it reaches; exact tuning, no dampers                                                                                                                                                      |
| Struck membranes and metals | drum kit, rock kit, jazz kit, 808 kit, madal, tabla                                                  | modal membranes (pitch drop, beater click, snare wires), brushes (a light push and a burst of bristle noise that drives the modes and hisses) and a brush sweep, pasted heads with near-harmonic partials per stroke, combo strokes, seeded metal tables, clap, hat choke                                                                                                                                                                 |
| Oscillator (not physical)   | oscillator                                                                                           | two band-limited oscillators (sine, triangle, square or saw; the second can be off, with level and phase) summed through a lowpass and a gate, legato glide; decay and sustain come from the master ADSR                                                                                                                                                                                                                                  |

Around the voices: per-instrument buses with a modal or radiation body and drive, a shared 8-line FDN reverb that sleeps when silent, a master ADSR on every voice, and over the whole mix an LFO (pitch, volume, filter or pan) and an FX chain (drive, chorus, ping-pong delay), each transparent at its defaults. Last come the master level (the Device's red Level knob), a 1.5 ms look-ahead peak limiter at −3 dBFS that turns coherent chord transients down instead of clipping them (so everything leaves the engine 1.5 ms late), and a safety clipper as a last resort; then a browser limiter, the analyser and the system volume (the white knob), which comes after them so turning it up never clips.

- **Layout** — `dsp/` building blocks, `models/` instruments, `engine/` (render loop, event queue, voice lifecycle, buses), `patches/` (per-instrument constants, `ParamSpec` macros and measured tuning tables), `offline/` (pure-TS renderer, OfflineAudioContext renderer, analysis and diagnostics). Only `processor.worklet.ts` touches worklet globals; nothing touches Web Audio at import time, so server rendering is safe.
- **API** — `physicalSynth` (from `app/lib/physical`): `start()` from a user gesture, `noteOn`/`noteOff` (reference-counted per note), `hit`, `setSustain`, `metronomeTick`, `setParam`, `allNotesOff`, `getAnalyser`, `onStats`, `render` (events offline through the worklet) and `scrubber` (plays a rendered buffer at a drag's speed, tape-style). Events sent before the worklet is ready are queued.
- **Calibration** — string tuning is exact by construction (loop phase delays are compensated at the fundamental). Flute, sax, clarinet, the trumpets, trombone, the free reeds, violin and cello use measured `tuningCents` tables per sample rate (44.1 / 48 kHz); re-bake them after changing those loops. Output gains put a mezzo-forte C4 at −18 dBFS RMS; drum pieces peak at −3 dBFS.
- **Audition and tune** — Storybook › `Lab/Instrument Lab`: press Start audio, pick an instrument, play with the mouse or `A W S E D F T G Y H U J K` (`Z`/`X` octave, hold Space for sustain), tweak the generated parameter panel, and use **Copy patch JSON** to move tuned values into `patches/*.ts`. The Diagnostics tab runs the tuning, decay, stability, level, onset/lifecycle and stress sweeps through the real worklet.
- **Add a patch** — add a `patches/<name>.ts` (a `StringPatch`, `BorePatch`, `BowedPatch`, `ReedPatch`, `BarPatch`, `DrumKitPatch` or `OscillatorPatch` with a `ParamSpec` list from `patches/params.ts`), add its id to `messages.ts` and `PATCHES`, then calibrate with the Lab.
- **Add a Device preset** — add an entry to `DEVICE_PRESETS` in `deviceEngine.ts` (target instrument, octave offset, optional param overrides) and a matching icon in `PRESET_ICONS`.

## Storybook

Stories are colocated with their components (`Component.stories.tsx`) and organized under three top-level titles.

- **`Design System/*`** — `Key`, `Knob`, `Pad` and the base controls.
- **`Home/*`** — `Device` (`SynthDevice`), `Screen` (`DeviceScreen`), `Layout` and `Parts/*` (`Device Knob`, `Device Pad`, `Pad Buttons`, `Display`, `Keybed`, `Grille`).
- **`Lab/*`** — `Instrument Lab` (dev tool; not mounted in any route).

Setup conventions:

- Every component starts with a `Default` story that binds cleanly to its props so Autodocs and the Controls panel work out of the box.
- Components use the `autodocs` tag and `layout: "centered"` (or `"padded"` for surfaces).
- The Device story renders over the `.home-background` gradient via a decorator.
- Parts that read the Device's state use the `withDevice` decorator (`app/components/home/storybook/`), which supplies only its providers; `parameters.device.view` opens a view. Stories show the component alone, without decoration.
- Every component's meta carries a one- or two-line `docs.description.component`.
- Light/dark coverage comes from the theme addon (`@storybook/addon-themes`); components must be correct in both modes.

## Agent Guidelines

### 1. Storybook & Component Story Structure

- **Start with a Default Story**: Every component must start with a `Default` story that cleanly binds to the component's props, allowing Storybook's Autodocs and Controls panel to interactively manipulate props out of the box.
- **Minimal, Focused Variants**: Follow the default story with a minimal set of variant stories. Avoid bloated or unnecessary permutations.
- **Avoid Redundant Prop Combinations**:
  - Each story must focus strictly on the feature or state it demonstrates.
  - For example, in a button states story (like disabled or loading states), do not add leading/trailing icons or subtitles if they are irrelevant to demonstrating the state, since layout combinations are already covered elsewhere.
  - Similarly, in a title-with-subtitle story, leave out extraneous icons unless specifically showcasing full anatomy.

### 2. Styling & Types

- **Tailwind only**: no CSS modules. Style with Tailwind classes; use `tv` (from `app/lib/utils`, which shares `cn`'s merge config) for variants and multi-part components. Add new theme values as tokens in `app.css` (`@theme static`) and register custom shadow or spacing names in `lib/utils.ts` so merging handles them.
- Controls that draw themselves use `<Button unstyled>`.
- **Types, never interfaces** (enforced by ESLint). Shared types go in `app/types/`.

### 3. Comment Removal & Clean Code Policy

- **Strip Thinking/Scratch Comments**: After code has been generated, all comments that were part of the thinking process, section dividers, or obvious restatements of code must be removed.
- **Preserve Only Critical Comments**: Only keep essential comments such as `TODO`, `FIXME`, and explanations of non-obvious tricky logic or magic numbers.

### 4. Testing Guidelines

- **No Automatic Interaction Tests**: Do not generate interaction tests (such as Storybook `play` functions or automated interaction suites) during initial component and story code generation.
- **Prompt the User First**: Always ask the user in a follow-up question whether interaction or unit tests should be added.
