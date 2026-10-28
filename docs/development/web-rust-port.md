---
order = 6
---

# Porting the Device to Rust

How `web-rust` catches up with `web-react`: an audit of what is ported, the architecture the rest follows, the order it lands in, and what [fluid](https://github.com/nrayamajhee/fluid) needs. The [monorepo plan](./monorepo.md) says where each folder fits; this is the plan for the Device itself.

## Where it stands

| Part            | web-react                                                                                                                                    | web-rust                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Look            | the home page, the Device in both themes at every size                                                                                       | the same, pixel for pixel                                               |
| Sound           | the physical engine in an AudioWorklet                                                                                                       | the same engine, ported to Rust, matching it to the sample              |
| Docs, Debug     | `/docs`, the Debug panel                                                                                                                     | the same, plus the crates' Rust docs                                    |
| Keys and chords | the keybed, chord pads (latched or held), play styles, octave                                                                                | the keybed, chord pads as blocks, octave                                |
| Instruments     | 33 built in, saved ones, favorites, pads bound to any of them                                                                                | the six pads' presets only                                              |
| Knobs           | bound per view (17 views)                                                                                                                    | bound for the main view only                                            |
| Pads            | 36 pads bound per view, with Shift jobs                                                                                                      | the instrument, chord, octave and Shift pads; the rest keep their icons |
| Views           | scope, synth, save, instruments, chords, play style, progressions, beats, tapes, revert, ADSR, LFO, FX, tempo, piano roll, drum grid, tracks | scope                                                                   |
| Recording       | takes on the piano roll, patterns in the drum grid                                                                                           | none                                                                    |
| Tracks          | tapes of tracks: mixing, scrubbing, copies, clips, mute and solo, FLAC and MIDI export                                                       | none                                                                    |
| MIDI            | keyboards and controllers, mapped by moving them, OP-1 presets                                                                               | none                                                                    |
| Saved state     | presets, edits, favorites, chords, play styles, the take, tapes, MIDI maps, in `localStorage`                                                | the theme and the docs' folded folders                                  |

About 25,000 lines of the React app (the Device's components, providers, hooks and their data) are still to port.

## Audit

What the port so far gets right, and what has to change before the rest can sit on it.

- **The engine is sound.** `sound-engine` matches the TypeScript engine bit for bit on most of 34 parity cases and within the last bit of a `pow` on the rest, at every sample rate from 22.05 to 96 kHz with every param at its extremes, and runs in about 3–6% of the audio thread. Keep the parity script as the gate for any engine change.
- **The host is too small.** The Device needs from it what `PhysicalSynth` offers web-react: events at a time on the audio clock (the drum grid, previews and playback schedule ahead), metronome ticks, offline renders of a track through the same worklet (an `OfflineAudioContext`), the scrubber and the track mixer (Web Audio nodes), and overrides at construction for renders.
- **The Device is one struct with fixed jobs.** `device.rs` holds every signal and `pads.rs` gives each pad one job. web-react binds every control per view (a mode over base bindings), and every feature hangs off that. The state splits into stores like the providers, and the controls read their binding from the view.
- **Presets are a generated table.** `presets.rs` holds the six pad presets with each knob step's display baked in. The library, saved presets and the synth view need every patch's param specs and web-react's formatting; the Rust app reads them from `sound-engine`'s `patches.json` and formats them itself, and the table goes.
- **Keys are partial.** The tool keys (Space, Esc, `I`, `Z`, `V`, `B`…), Backspace, ⌘S, the keys held while others go down, and focus moving between pads are web-react's `HotkeyProvider`, `keymap.ts` and `focus.ts`, and come over as they are.
- **Nothing is kept.** Every store web-react keeps in `localStorage` comes over with the same key and JSON shape, so the Debug panel shows the same parts and a session reads the same in either app.
- **Parity is checked by hand.** The Playwright scripts that compared the two apps (behaviour, pixels, sound) move into the repo, so each step can be checked the same way.

## Architecture

The port follows web-react's structure, so each Rust module has one TypeScript file to read against.

- **Stores** (`src/state/`): one per provider (feedback, shift, view, transport, output, sound, performance, lanes, drum grid, tracks, mix, take, preview), each a struct of fluid signals with the provider's methods. They live for the page, shared through fluid's context as `&'static` like the `Device` now. Derived values are methods that read signals, so whatever reads them tracks them.
- **Bindings** (`src/modes/`): `base.rs` and a module per view, as `modes/*.tsx`. A control asks for its binding by slot (`knob(app, Knob::Red)`, `pad(app, Pad::Save)`, `screen(app)`): the view's mode answers, falling back to the base. A pad's look is a memo of its binding without the closures; its press resolves the binding again and runs it, so handlers never sit in signals.
- **Screen** (`src/ui/screen/`): `DeviceScreen.tsx`'s views, one module each: tiles with the pager, the module graphs, tempo, the piano roll and drum grid (canvas and CSS variables updated per frame, as web-react does), the tracks' lanes and the synth graph.
- **Data** (`data/*.json`): what web-react keeps as tables (the presets, chord palette, play styles, progressions, drum beats, the starter song, the synth pages) exported from its code by a script, as `patches.json` is, and parsed with serde. The functions over them are ported and tested natively.
- **Audio host** (`sound-engine::host`): the additions above, as `Synth` methods over web-sys; FLAC and MIDI files are written in plain Rust and tested natively.

## Steps

Each lands as its own commit, checked against web-react with the Playwright parity scripts before the next.

1. **Foundation.** The data export, the param formatting, the presets and modules tables, timing (meters, swing, timelines), chords and play styles, drum patterns, tracks, the saved stores, FLAC and MIDI writers, as plain Rust with unit tests.
2. **Stores and bindings.** The providers as stores, the view and mode system, the knobs, pads and keybed reading their bindings, the hotkeys and focus, feedback (notices, prompts, second presses); the scope view working through it, as now.
3. **Pickers.** Instruments (by model or band, favorites, binding pads, deleting saved ones), chords, play styles, progressions and beats with the preview player, tapes, revert and save.
4. **Sound views.** The synth view's pages and graphs, the ADSR, LFO and FX views, the tempo view and metronome.
5. **Takes.** The transport (record, play, pause, tap tempo), the piano roll, the drum grid and its step player.
6. **Tracks.** Lanes, the tracks view, the mix (offline renders through the worklet, the track mixer), scrubbing, copies, clips and trims, mute and solo, and saving the mix as FLAC or MIDI.
7. **MIDI.** Input, the MIDI panel, mapping by moving a control, and the OP-1 preset.
8. **The rest.** The starter tapes, Revert's Everything, and a full parity pass in both themes and at phone width.

Then the monorepo's own steps: moving the React app to `web-react/`, the `editor` backend, and CI.

## fluid

fluid has what the port needs: signals, memos, effects, scopes with context, keyed lists, `if` and `match`, typed events with modifiers (`@wheel.nonpassive.prevent`), SVG, and listeners on `window`. Two things would make it smoother; neither blocks the port.

- **A closure in a variable isn't reactive.** `html!` decides an attribute is reactive by its syntax (`title={ move || .. }`), so `title={ label }` with `label` a closure doesn't compile: `AttrValue` isn't implemented for closures. Implementing it for `F: FnMut() -> V` would let shared closures be passed around; until then each attribute writes its own `move ||`.
- **Callbacks outside a scope lose the context.** A timer, animation frame or async task runs outside any scope, so `use_context` there finds nothing. `Context::current()` taken while building and `ctx.run(..)` in the callback restore it; a `fluid::spawn_local` and timer helpers that do this would make it the default. The port captures the `&'static` stores instead, which needs neither.
