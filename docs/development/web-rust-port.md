---
order = 6
---

# Porting the Device to Rust

How `web-rust` caught up with `web-react`: where the port stands and how its parity was checked, what the audit of the first step found and what came of it, the architecture the port follows, the steps it landed in, and what [fluid](https://github.com/nrayamajhee/fluid) taught it. The [monorepo plan](./monorepo.md) says where each folder fits; this is the record for the Device itself.

## Where it stands

The port is complete: `web-rust` is the whole Device, and it looks, plays, sounds and keeps its state as `web-react`'s does.

| Part            | web-react and web-rust                                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Look            | the home page, the Device in both themes at every size, phone width included                                                                 |
| Sound           | the physical engine in an AudioWorklet (in web-rust ported to Rust, matching it to the sample)                                               |
| Docs, Debug     | `/docs`, the Debug panel (web-rust adds the crates' Rust docs)                                                                               |
| Keys and chords | the keybed, chord pads (latched or held), play styles, octave                                                                                |
| Instruments     | 33 built in, saved ones, favorites, pads bound to any of them                                                                                |
| Knobs and pads  | bound per view (17 views), with Shift jobs, notices, prompts and second presses                                                              |
| Views           | scope, synth, save, instruments, chords, play style, progressions, beats, tapes, revert, ADSR, LFO, FX, tempo, piano roll, drum grid, tracks |
| Recording       | takes on the piano roll, patterns in the drum grid                                                                                           |
| Tracks          | tapes of tracks: mixing, scrubbing, copies, clips, mute and solo, FLAC and MIDI export                                                       |
| MIDI            | keyboards and controllers, mapped by moving them, OP-1 presets                                                                               |
| Saved state     | presets, edits, favorites, chords, play styles, the take, tapes, MIDI maps, in `localStorage` under the same keys and JSON                   |

### How parity was checked

Each step was checked against web-react before the next, in three ways that now stay in the repo (see [web-rust's checks](../../web-rust/README.md#checks)):

- **Against web-react's own code.** Scripts in `web-rust/scripts/` run web-react's modules and write what they give: the tables the Rust app reads (`data/`), `tests/fixtures.json` (param formatting, timelines, chords, progressions, beats and patterns, tracks, modules, presets, the starter tapes, FLAC and MIDI bytes) and `tests/graphs.json` (the synth view's graph for every page of every instrument at three knob steps). `cargo test` checks the Rust against them.
- **Side by side in a browser.** `web-rust/scripts/parity/parity.cjs` plays the same steps in both apps at once with Playwright and compares, after every step, what each shows: the pads, knobs and keys with their labels, state and colours, the screen's text, tiles, graphs, drum grid and track rows laid out to the pixel, the MIDI panel, and `localStorage`. Its steps files cover the basics, the pickers, the synth and its modules, the drum grid, the piano roll, the tracks, and MIDI from a stand-in controller, the OP-1's map included. Every step matches. web-react's dev build spends about 75 ms longer on a key, so a notice can time out a moment later in it: a step that differs is compared again, twice, 250 ms apart, before it counts. A playing drum pattern starts later in it too, so the steps where one plays leave out its head and the position shown with it.
- **Pixel for pixel.** `shots.cjs` screenshots both apps after the same steps, in both themes, and diffs them on a canvas: every picker, the synth's pages, the ADSR, LFO and FX, tempo, save, the drum grid, the piano roll, the tracks, the MIDI panel, and the page at phone width (390×844). Most come out the same to the pixel. The rest differ by anti-aliasing alone, 58 pixels at most: a glyph's or an icon's edge, or a column of the grille's dots. Some of it changes from run to run. The rest is where web-react writes a readout as several text nodes (JSX splits `{meter} · Swing {swing}%` at each expression) and web-rust as one, which moves what follows a few hundredths of a pixel. web-rust's footer adds a **Rust docs** link, which the phone shots leave out.

The sound was checked by `sound-engine`'s own parity script, and the exported FLAC and MIDI files are byte for byte the same.

## Audit

What the first step got right, what had to change before the rest could sit on it, and what came of each.

- **The engine was sound.** `sound-engine` matches the TypeScript engine bit for bit on most of 34 parity cases and within the last bit of a `pow` on the rest, at every sample rate from 22.05 to 96 kHz with every param at its extremes, and runs in about 3–6% of the audio thread. Its parity script stays the gate for any engine change.
- **The host was too small.** The Device needed from it what `PhysicalSynth` offers web-react. The host gained events at a time on the audio clock (the drum grid, previews and playback schedule ahead), metronome ticks, offline renders of a track through the same worklet (an `OfflineAudioContext`), the scrubber and the track mixer (Web Audio nodes), and overrides at construction for renders.
- **The Device was one struct with fixed jobs.** `device.rs` held every signal and `pads.rs` gave each pad one job, where web-react binds every control per view. The state split into stores like the providers (`src/state/`), and the controls read their bindings from the open view (`src/modes/`); `device.rs` and `pads.rs` went.
- **Presets were a generated table.** `presets.rs` held the six pad presets with each knob step's display baked in. The library, saved presets and the synth view needed every patch's param specs and web-react's formatting, so the Rust app reads them from `sound-engine`'s `patches.json` and formats them itself (`src/logic/params.rs`), and the table and its export script went.
- **Keys were partial.** The tool keys (Space, Esc, `I`, `Z`, `V`, `B`…), Backspace, ⌘S, the keys held while others go down, and focus moving between pads came over as web-react's `HotkeyProvider`, `keymap.ts` and `focus.ts` have them.
- **Nothing was kept.** Every store web-react keeps in `localStorage` came over with the same key and JSON shape (`src/store/`), so the Debug panel shows the same parts and a session reads the same in either app.
- **Parity was checked by hand.** The Playwright scripts that compared the two apps moved into the repo, as `web-rust/scripts/parity/`.

## Architecture

The port follows web-react's structure, so each Rust module has one TypeScript file to read against.

- **Stores** (`src/state/`): one per provider (feedback, Shift, view, transport, output, sound, performance, lanes, drum grid, tracks, mix, scrub, take, preview), each a struct of fluid signals with the provider's methods. They live for the page in one `App`, reached from anywhere with `app()` as a `&'static`. Derived values are methods that read signals, so whatever reads them tracks them.
- **Bindings** (`src/modes/`): `base.rs` and a module per view, as `web-react/app/components/home/modes/`. Each view rebinds what it changes of the base: the knobs, pads, keybed and screen. One memo resolves the open view's bindings for the controls to draw from; a press reads them again, untracked, and runs the handler as it is now, so a handler never runs stale.
- **Screen** (`src/ui/screen/`): `DeviceScreen.tsx`'s views, a module each: tiles with the pager, the module graphs, tempo, the piano roll (a canvas) and drum grid, their heads moved every frame as web-react moves them, the tracks' lanes and the scope.
- **Data** (`data/*.json`): what web-react keeps as tables and the Rust app reads as they are (the progressions, the drum beats, every icon as React renders it), exported from its code by `scripts/export-data.tsx`, as `patches.json` is, and parsed with serde. The functions over them are ported and tested natively (`src/logic/`).
- **Audio host** (`sound-engine::host`): the additions above, as `Synth` methods over web-sys; FLAC and MIDI files are written in plain Rust and tested natively.

## Steps

Each landed as its own commit, checked against web-react with the parity scripts before the next.

1. **Foundation.** The data export, the param formatting, the presets and modules tables, timing (meters, swing, timelines), chords and play styles, drum patterns, tracks, the saved stores, FLAC and MIDI writers, as plain Rust with unit tests.
2. **Stores and bindings.** The providers as stores, the view and mode system, the knobs, pads and keybed reading their bindings, the hotkeys and focus, feedback (notices, prompts, second presses), and the scope view working through it.
3. **Pickers.** Instruments (by model or band, favorites, binding pads, deleting saved ones), chords, play styles, progressions and beats with the preview player, tapes, revert and save.
4. **Sound views.** The synth view's pages and graphs, the ADSR, LFO and FX views, the tempo view and metronome.
5. **Takes.** The transport (record, play, pause, tap tempo), the piano roll, the drum grid and its step player.
6. **Tracks.** Lanes, the tracks view, the mix (offline renders through the worklet, the track mixer), scrubbing, copies, clips and trims, mute and solo, and saving the mix as FLAC or MIDI.
7. **MIDI.** Input, the MIDI panel, mapping by moving a control, and the OP-1 preset.
8. **The rest.** The starter tapes, Revert's Everything, and a full parity pass in both themes and at phone width.

## fluid

fluid had what the port needed: signals, memos, effects, scopes with context, keyed lists, `if` and `match`, typed events with modifiers (`@wheel.nonpassive.prevent`), SVG, and listeners on `window`. Two things would make it smoother, and one thing bit the port; none of them blocked it.

- **A closure in a variable isn't reactive.** `html!` decides an attribute is reactive by its syntax (`title={ move || .. }`), so `title={ label }` with `label` a closure doesn't compile: `AttrValue` isn't implemented for closures. Implementing it for `F: FnMut() -> V` would let shared closures be passed around; until then each attribute writes its own `move ||`.
- **Callbacks outside a scope lose the context.** A timer, animation frame or async task runs outside any scope, so `use_context` there finds nothing. `Context::current()` taken while building and `ctx.run(..)` in the callback restore it; a `fluid::spawn_local` and timer helpers that do this would make it the default. The port captures the `&'static` stores instead, which needs neither.
- **A `Ref` held through an `if let` panics on a write.** `get()` and `get_untracked()` return a `Ref` borrowing the signal's value. In `if let Some(home) = &*signal.get_untracked() { .. }` that `Ref` lives until the end of the `if let`, so a body that writes the same signal panics ("a signal was written while a Ref from get() was alive"). Take the value out first (`let awaited = signal.get_untracked().clone();`, or `*signal.get_untracked()` for a `Copy` value) and match on that.
