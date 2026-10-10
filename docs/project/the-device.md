# The Device (Home Page)

The home page (`app/routes/home.tsx`) renders The Device, a digital desktop synthesizer played through the physical-modeling engine (see [Synth engine](synth-engine.md)).

| Path                                   | Purpose                                                                                                                                                                            |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/components/home/SynthDevice.tsx`  | The Device: its providers and parts, as JSX                                                                                                                                        |
| `app/components/home/layout/`          | The case: `DeviceFrame`, `TopRow`, `KnobColumn`                                                                                                                                    |
| `app/components/home/parts/`           | `DeviceKnob`, `DevicePad`, `PadButtons` (every pad, 12×3), `Display` (the screen as the mode fills it), `Keybed`, `Grille`                                                         |
| `app/components/home/modes/`           | What each control does in each view (see [Modes](#modes)); `base.tsx` is the default                                                                                               |
| `app/components/home/DeviceScreen.tsx` | The screen and its views (presentational)                                                                                                                                          |
| `app/providers/`                       | The Device's state, one provider per domain, composed by `DeviceProviders`                                                                                                         |
| `app/types/`                           | Shared types: `Device` (what modes read) and the bindings modes return                                                                                                             |
| `app/components/home/deviceEngine.ts`  | The only audio module the Device imports; built-in presets                                                                                                                         |
| `app/components/home/presetStore.ts`   | Saved presets, pad bindings and edits (`localStorage`)                                                                                                                             |
| `app/hooks/useTransport.ts`            | Recording, playback, metronome, tempo and tap tempo                                                                                                                                |
| `app/components/home/noteRecorder.ts`  | Takes as played (start, held length, velocity); 16th-step quantizing                                                                                                               |
| `app/components/home/NoteRoll.tsx`     | The screen's piano roll: keys down the left (C0–C10), notes running out of them                                                                                                    |
| `app/hooks/useScrub.ts`                | Scrubbing the stopped roll: renders the take, plays it at the scroll's speed                                                                                                       |
| `app/components/home/tracks.ts`        | Takes kept as tracks: clip, start, repeats, mute, solo, loop and cut, and whether each was played on the tape or drawn in the sequencer (the one place it opens)                   |
| `app/components/home/sessionStore.ts`  | The tape's take, and the album: songs of tracks, each with its tempo (`localStorage`)                                                                                              |
| `app/components/home/synthGraphs.ts`   | The Synth screen's pages (`synthPages.ts`: which knob sets which param) and the graph of each, drawn from the patch with the engine's own exciters and loops                       |
| `app/components/home/modules.ts`       | ADSR, LFO and FX settings, which the tape and each track keep their own of                                                                                                         |
| `app/components/home/progressions.ts`  | Common chord progressions after David Bennett ([`chord-progressions.md`](chord-progressions.md)), previewed in their songs' keys, put onto the tape on a home note after Save      |
| `app/components/home/stepPattern.ts`   | The drum grid's pattern: hits in beats, kit rows, saving as a take; each piece's fixed note in a take (`PIECE_NOTES`), so moving pieces between keys never changes a recording     |
| `app/components/home/drumBeats.ts`     | Preset beats by style (Shift + Drum grid, [`drum-beats.md`](drum-beats.md)), each on the kit and tempo that suit it, previewed on a tap or Play, loaded into the drum grid on Save |
| `app/hooks/useStepPlayer.ts`           | Loops the drum pattern on the audio clock; lands recorded taps on the nearest step                                                                                                 |
| `app/hooks/usePreviewTape.ts`          | The hidden tape the pickers preview on: a take on any instrument, on the audio clock, paused and picked up again                                                                   |
| `app/components/home/exportMix.ts`     | Saving the tracks: the mix as FLAC (`flac.ts`), or MIDI                                                                                                                            |
| `app/components/page/`                 | The sky background and theme toggle the home page shares with `/docs`                                                                                                              |
| `app/components/design-system/`        | Device primitives `Key`, `Knob`, `Pad` and base controls                                                                                                                           |
| `app/components/lab/`                  | Instrument Lab (Storybook only)                                                                                                                                                    |

Design rules:

- The Device has a fixed native size and is scaled uniformly by CSS (`--scale`) to fit. Never reflow or squeeze its parts.
- Two spacing values, theme tokens in `app.css`: `bezel` (`p-bezel`; also the page margin, from twice it on wide screens down to half on phones) and `inset` (`gap-inset`) for everything else.
- Theme colours are `color-mix(in srgb, <light>, <dark> var(--theme-mix))` tokens in `app.css` (`bg-device`, `bg-pad`, `shadow-pad`…) so they fade with the 400 ms theme cross-fade. Keep colour transitions off those elements; their own transitions snap mid-fade.
- Keyboard hotkeys must never overlap between keys and pads.
- A pad with nothing bound to it (an empty preset pad) stays blank. A pad that does nothing in the current view keeps its icon.
- The screen's title leads its top line, or the footer where the top's left is taken (a pager's tabs, the scope's octave). Guides in the footer are `ScreenHint`s, the same size as the rest.

## Architecture

The Device's hardware is fixed; each view is a **mode** that rebinds it.

- **Providers** (`app/providers/`), outermost first, each reading only those above it: `Hotkey` (in the route) → `Feedback` (notices, prompts, overlays, second-press `confirm`, busy while the mix saves) → `Shift` → `View` → `Transport` → `Output` (volume, level) → `Sound` (preset, params, octave) → `Performance` (held keys, chords) → `Lanes` (the tape and the open song's tracks, the focused lane and its modules) → `Steps` → `Tracks` (timeline and track edits) → `Mix` (playback, scrub, export) → `Tape` (the roll) → `Preview` (the hidden tape the progression and beat pickers play on; leaving the view stops it) → `Mode`. `DeviceProviders` composes them. Persisted data stays in the stores (`sessionStore`, `presetStore`, `chordStore`); providers hold only live and view state.
- **Modes** (`app/components/home/modes/`): `baseBindings(device)` says what every knob, pad and the screen do by default, and each view's mode (`MODES[view]`) returns only what it changes. Modes are plain functions of the `Device` (`app/types/device.ts`), so they hold no hooks; `ModeProvider` resolves them and parts read their binding with `useBindings()`.
- **Synth parameters** (`modes/synth.tsx`): a page per module of the instrument, after an overview of its chain: ‹ Chain · Exciter · Resonator · Filter · Body · Output · Envelope · LFO ›, skipping the modules it doesn't have, named on the pager and turned by ← → (with Shift they still step the instrument).
  - **Chain** draws the modules as blocks in signal order, with the Envelope and LFO wired to what they move on this instrument (the breath, the bow, a string's damper; pitch, level, cutoff). The green knob picks a block and → opens it.
  - **Every other page** is a graph of what its knobs do over four readouts, like the ADSR, LFO and FX views: the four knobs set the page's four params directly, in the colours the graph draws them in, and held Shift reaches its extras (a guitar's Strum, the filter's Keytrack, the LFO's Shape and Delay), named in the footer. The shared modules keep each param on the same knob on every instrument (`synthPages.ts`), so Cutoff is always the white knob and the LFO's Pitch always green.
  - **The graphs** (`synthGraphs.ts`, drawn by `SynthGraph`) are computed from the patch and its values with the engine's own code, at the instrument's C nearest middle C: the harmonics the real `pluck`, `hammer` or `stick` puts in, with gaps where the position silences them; the bow's and reed's friction and opening curves; a string loop's partials from `StringLoop.partials` (stretched by stiffness, each with its T60) or a bar's modes; the SVF's response over the note's partials; the body's resonances; the drive's curve. Turning a knob redraws its page, and makes its param the one the main screen's footer shows.
- **Parts** own their DOM and their keys: `DevicePad` presses its binding from a click, its hotkey or a ⌘ shortcut, so a key always does what clicking its pad does. `Keybed`, `PadButtons` and `ShiftProvider` handle the note, chord and Shift keys.

## Modes

To change what a control does in a view, edit that view's mode; to add a view, add a mode and register it in `modes/index.ts`. Cross-domain commands (keeping the tape or a pattern as a track, the album's songs, Revert's options) live in the mode that uses them.
