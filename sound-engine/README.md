# sound-engine

The Device's sound in Rust: web-react's physical-modeling engine (`web-react/app/lib/physical`), ported line for line, running in an AudioWorklet the way web-react runs its own. It is step 3 of the [monorepo plan](../docs/development/monorepo.md), and [web-rust](../web-rust/README.md) plays through it.

Every instrument and kit web-react has is here: the strings (piano, guitars, basses, harp, sitar and the rest), the bowed violin and cello, the bores (flute, saxophone, brass, clarinet), the free reeds, the bars, the oscillator and the eight drum kits, with the shared reverb, the master LFO, FX, ADSR and limiter, and the metronome. It sounds the same as web-react's to the sample: given the same events, its output matches the TypeScript engine's bit for bit on 27 of 34 test cases, and within 2·10⁻⁷ (the last bit of a `pow` or `exp`) on the rest.

## How it runs

```text
main thread                                  audio thread
web-rust ── host::Synth ── JSON events ──►   worklet/processor.js ── sound-worklet.wasm (Engine)
                │                                      │
                └── AudioContext: worklet node ──► limiter ──► analyser ──► volume ──► speakers
```

- **`worklet/`** builds the engine into `sound-worklet.wasm`, a bare module with C-ABI exports and no wasm-bindgen: an AudioWorklet has no `fetch`, `importScripts` or `TextDecoder` to load glue with. `processor.js` instantiates it from the bytes the host passes, renders each 128-frame block into its outputs and posts stats and warnings, as web-react's `processor.worklet.ts` does.
- **`host`** (the `web` feature) is the main thread's side, web-react's `PhysicalSynth`: it starts the AudioContext on the first gesture, loads the worklet, builds the same graph after it (a `DynamicsCompressorNode` limiter, the `AnalyserNode` the scope draws, and a `GainNode` for the system volume), and sends events. Events sent before the worklet is ready wait and play when it is.
- **Events** are web-react's `EngineEvent`s as JSON (`noteOn`, `noteOff`, `hit`, `sustain`, `tick`, `param`, `allNotesOff`, `panic`), so one list plays through both engines. The engine resolves names once, when an event arrives, and applies each at its exact frame.

## Layout

- `src/dsp/`: filters, delay lines, envelopes, oscillators, modal banks, the reverb (FDN) and the limiter, over `&mut [f32]`.
- `src/models/`: the seven physical models and their voices.
- `src/engine/`: the buses, voice allocation, the modules every voice shares (filter, vibrato, master ADSR), the event queue and the `Engine`.
- `src/patches.rs`: the patches and master params, read from `data/patches.json`.
- `src/messages.rs`: the events and stats, in web-react's JSON shape.
- `src/host.rs`: the Web Audio host (`web` feature).
- `worklet/`: the AudioWorklet's crate, its `processor.js` and `build.sh`.

The DSP is plain Rust with no web types, so the engine runs and is tested natively.

## Build

The crate and its worklet are in the repo's Cargo workspace with web-rust (`Cargo.toml` at the root), which holds the release profiles and the `worklet` profile the worklet is built with. web-rust's Trunk build runs `worklet/build.sh` into its output before every build, so `trunk serve` there is all it takes. To build the worklet alone:

```bash
rustup target add wasm32-unknown-unknown
worklet/build.sh <out-dir>   # writes sound-worklet.wasm and sound-worklet.js
```

## Checks

- **Unit tests** (natively): `cargo test`
- **Lint**: `cargo clippy --all-targets`, `cargo clippy --features web --target wasm32-unknown-unknown`, and in `worklet/` `cargo clippy --target wasm32-unknown-unknown`
- **Format**: `cargo fmt` (check with `cargo fmt --check`), here and in `worklet/`
- **Stress**: `cargo run --example stress` plays every patch at 22.05 to 96 kHz with each param at its extremes, in a debug build, so an overflow or a bad index panics.
- **Parity with web-react**: from `web-react`, `npx tsx ../sound-engine/scripts/parity.ts` renders 34 cases (every patch, and the master stage) through the TypeScript engine; then `cargo run --release --example parity` here plays them through this one and prints each case's largest difference.

## Patches

The patches live in web-react (`web-react/app/lib/physical/patches`). After changing one, export them again from `web-react` and run the parity check:

```bash
npx tsx ../sound-engine/scripts/export-patches.ts
```
