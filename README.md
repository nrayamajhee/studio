> source available. all rights reserved.  
> this is not open source.  
> ai use was used and paid for.  
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

| Path                                   | Purpose                                                                      |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| `app/components/home/SynthDevice.tsx`  | The Device: layout, state, hotkeys                                           |
| `app/components/home/DeviceScreen.tsx` | The screen and its views                                                     |
| `app/components/home/deviceEngine.ts`  | The only audio module the Device imports; built-in presets                   |
| `app/components/home/presetStore.ts`   | Saved presets, pad bindings and edits (`localStorage`)                       |
| `app/hooks/useTransport.ts`            | Recording, playback, metronome, tempo and tap tempo                          |
| `app/components/home/noteRecorder.ts`  | Takes as played (start, held length, velocity); 16th-step quantizing         |
| `app/components/home/NoteRoll.tsx`     | The screen's piano roll: C0–C10 keys, notes rising from them                 |
| `app/hooks/useScrub.ts`                | Scrubbing the stopped roll: renders the take, plays it at the scroll's speed |
| `app/components/home/tracks.ts`        | Takes kept as tracks: clip, start, mute and solo                             |
| `app/components/home/sessionStore.ts`  | The tape's take and the tracks (`localStorage`)                              |
| `app/components/design-system/`        | Device primitives `Key`, `Knob`, `Pad` and base controls                    |
| `app/components/lab/`                  | Instrument Lab (Storybook only)                                              |

Design rules:

- The Device has a fixed native size and is scaled uniformly by CSS (`--scale`) to fit. Never reflow or squeeze its parts.
- Two spacing values: `--gap` for the bezel (and the page margin, from twice it on wide screens down to half on phones), `--inset` for everything else.
- Theme colours are `color-mix(in srgb, <light>, <dark> var(--theme-mix))` so they fade with the 400 ms theme cross-fade. Keep colour transitions off those elements; their own transitions snap mid-fade.
- Keyboard hotkeys must never overlap between keys and pads.
- A pad with no function stays blank; never give it an icon it can't act on.

## Synth engine

The Device plays through a physical-modeling engine in `app/lib/physical/`, following `docs/new-synth-plan.md`; `docs/synth-model.md` walks through how it works, with diagrams. Every voice is an exciter → resonator chain rendered sample-accurately inside one TypeScript `AudioWorkletProcessor`:

| Family                      | Instruments                                                                   | Model                                                                                                                                                                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Struck and plucked strings  | piano, acoustic, electric and nylon guitar, electric bass, upright bass, harp | single-delay-loop string with dispersion, loss and exact fractional tuning; felt-hammer simulation or pick/finger plucks; unison strings, polarizations, dampers (none on the harp), sustain pedal, per-string allocation, pickup comb (electric guitar and bass) |
| Bowed string                | violin, cello                                                                 | STK `Bowed` with the Maestre body filter (violin) or a modal body (cello), delayed vibrato, legato portamento                                                                                                                                                     |
| Blown                       | flute, alto sax, trumpet, bass trumpet                                        | STK `Flute` / `Saxofony` / `Brass` with breath envelope on pressure, mono legato and portamento; the sax bell reflection tracks the note, and the brass lips keep a fixed Q, so the whole range speaks                                                            |
| Struck membranes and metals | drum kit, 808 kit, madal, tabla                                               | modal membranes (pitch drop, beater click, snare wires), pasted heads with near-harmonic partials per stroke, combo strokes, seeded metal tables, clap, hat choke                                                                                                 |
| Oscillator (not physical)   | oscillator                                                                    | band-limited sine, triangle, square or saw (polyBLEP / polyBLAMP) through a lowpass and a gate, legato glide; decay and sustain come from the master ADSR                                                                                                         |

Around the voices: per-instrument buses with a modal or radiation body and drive, a shared 8-line FDN reverb that sleeps when silent, a master ADSR on every voice, and over the whole mix an LFO (pitch, volume, filter or pan) and an FX chain (drive, chorus, ping-pong delay), each transparent at its defaults. Last come master volume and a transparent safety clipper, then a browser limiter and analyser.

- **Layout** — `dsp/` building blocks, `models/` instruments, `engine/` (render loop, event queue, voice lifecycle, buses), `patches/` (per-instrument constants, `ParamSpec` macros and measured tuning tables), `offline/` (pure-TS renderer, OfflineAudioContext renderer, analysis and diagnostics). Only `processor.worklet.ts` touches worklet globals; nothing touches Web Audio at import time, so prerendering is safe.
- **API** — `physicalSynth` (from `app/lib/physical`): `start()` from a user gesture, `noteOn`/`noteOff` (reference-counted per note), `hit`, `setSustain`, `metronomeTick`, `setParam`, `allNotesOff`, `getAnalyser`, `onStats`, `render` (events offline through the worklet) and `scrubber` (plays a rendered buffer at a drag's speed, tape-style). Events sent before the worklet is ready are queued.
- **Calibration** — string tuning is exact by construction (loop phase delays are compensated at the fundamental). Flute, sax, the trumpets, violin and cello use measured `tuningCents` tables per sample rate (44.1 / 48 kHz); re-bake them after changing those loops. Output gains put a mezzo-forte C4 at −18 dBFS RMS; drum pieces peak at −3 dBFS.
- **Audition and tune** — Storybook › `Lab/Instrument Lab`: press Start audio, pick an instrument, play with the mouse or `A W S E D F T G Y H U J K` (`Z`/`X` octave, hold Space for sustain), tweak the generated parameter panel, and use **Copy patch JSON** to move tuned values into `patches/*.ts`. The Diagnostics tab runs the tuning, decay, stability, level, onset/lifecycle and stress sweeps through the real worklet.
- **Add a patch** — add a `patches/<name>.ts` (a `StringPatch`, `BorePatch`, `BowedPatch`, `DrumKitPatch` or `OscillatorPatch` with a `ParamSpec` list from `patches/params.ts`), add its id to `messages.ts` and `PATCHES`, then calibrate with the Lab.
- **Add a Device preset** — add an entry to `DEVICE_PRESETS` in `deviceEngine.ts` (target instrument, octave offset, optional param overrides) and a matching icon in `PRESET_ICONS`.

## Storybook

Stories are colocated with their components (`Component.stories.tsx`) and organized under three top-level titles.

- **`Design System/*`** — `Key`, `Knob`, `Pad`.
- **`Home/*`** — `Device` (`SynthDevice`), `Screen` (`DeviceScreen`).
- **`Lab/*`** — `Instrument Lab` (dev tool; not mounted in any route).

Setup conventions:

- Every component starts with a `Default` story that binds cleanly to its props so Autodocs and the Controls panel work out of the box.
- Components use the `autodocs` tag and `layout: "centered"` (or `"padded"` for surfaces).
- The Device story renders over the `.home-background` gradient via a decorator.
- Light/dark coverage comes from the theme addon (`@storybook/addon-themes`); components must be correct in both modes.

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
