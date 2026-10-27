---
order = 5
---

# Monorepo plan

Studio becomes a monorepo of four sibling folders. There is no monorepo tool: no npm workspaces, no Cargo workspace at the root, no Nx or Turbo. Each folder is a self-contained project with its own manifest, lockfile, build and checks, and the root only holds what they share.

```text
studio/
├── README.md, AGENTS.md   the whole repo: what each folder is, how to run it
├── docs/                  the docs, shared; web-react serves them at /docs
├── web-react/             the current React Router app, moved as is
├── web-rust/              the Device in Rust: a Trunk-built wasm app, UI in fluid
├── sound-engine/          Rust crate: everything latency critical, on the audio thread
└── editor/                Rust backend: axum, PostgreSQL through sqlx
```

## How the parts fit

```text
web-react ─┐                       ┌─► editor (axum + sqlx) ─► PostgreSQL
           ├─ HTTP / JSON (tapes) ─┘
web-rust ──┤
           └─ wasm ─► sound-engine ─► AudioWorklet (DSP) + Web Audio nodes
```

- **web-react** stays the shipping app until web-rust catches up with it. It keeps its own TypeScript engine (`app/lib/physical`), so nothing in it depends on the Rust crates.
- **web-rust** is the UI only. It handles the DOM, input and state, and asks sound-engine for every sound. It never touches an `AudioContext` itself.
- **sound-engine** owns the audio graph. web-rust takes it as a path dependency (`sound-engine = { path = "../sound-engine" }`), so the two build into one wasm module and need no JS glue between them.
- **editor** is the backend both front ends save to: tapes, tracks, presets and user progressions as rows in PostgreSQL, served as JSON.

## web-rust

A Trunk app (`trunk serve` on port `8080`), built to `web-rust/dist`. Its UI uses [fluid](https://github.com/nrayamajhee/fluid), the library [wgpu-test](https://github.com/nrayamajhee/wgpu-test) uses. fluid works like Solid: signals, effects that track the signals they read, and an `html!` macro that builds real DOM elements once and updates only the attributes and text bound to signals.

- **State** is a `Device` of `Rc<Signal<_>>`s: theme, preset, octave, held keys and pads, chords, knob values. The UI and the keyboard listeners write to it, and fluid effects redraw the parts that read it.
- **Pure logic** (keymap, note names, octave range) has no web-sys types, so `cargo test` runs it natively.
- **Port order**, following the React app's parts: the home page and the Device's main view (this first step: the knobs, grilles, scope screen, all 36 pads with their keys, the presets, chords and keybed), then the screen's other views (instruments, synth, ADSR, LFO, FX, tempo), play styles and progressions, drum grid, piano roll, tracks and tapes, and MIDI last.
- **Look**: Tailwind, built by Trunk's own `tailwind-css` pipeline (no npm), from web-react's theme tokens copied into `web-rust/src/tailwind.css`, with the same class strings as web-react's components. The [design rules](./design-rules.md) hold for both apps.

## sound-engine

A Rust library crate that compiles to wasm and splits the work by what the browser can do best.

- **Web Audio nodes for what they're good at.** Wrap the native, hardware-accelerated nodes behind small Rust types over `web-sys`: `GainNode` for master and bus volume, `BiquadFilterNode` for tone, `ConvolverNode` for the reverb's impulse, `DynamicsCompressorNode` for the limiter, `StereoPannerNode`, `DelayNode` for the ping-pong delay, `AnalyserNode` for the oscilloscope, and `AudioParam` automation (`setTargetAtTime`, `linearRampToValueAtTime`) for envelopes and knob moves. The browser runs these off the main thread in native code.
- **An AudioWorklet for what they can't do.** The physical models (strings, blown, bowed, drums, free reeds, tuned percussion; see [Physical modeling](../synth/physical-modeling/overview.md)) and voice allocation run in a Rust `AudioWorkletProcessor`, rendering 128-frame blocks with no allocation, locks or JS calls in `process`.
- **Control without the main thread in the way.** Note on/off, parameter changes and the sequencer's events go from the UI to the worklet through a lock-free ring buffer in a `SharedArrayBuffer`, so a busy UI frame never delays a note. The sequencer's clock runs on the audio thread for sample-accurate timing. Messages through `port.postMessage` are the fallback where cross-origin isolation (needed for `SharedArrayBuffer`) isn't available.
- **Testable natively.** The DSP core is plain Rust over `&mut [f32]` buffers, behind a `web` feature that adds the web-sys bindings, so `cargo test` and benchmarks run without a browser, the way `npm run test:unit` checks the TypeScript DSP today.
- **Port order**: the worklet host and ring buffer with one oscillator voice, then the master chain (ADSR, LFO, FX, limiter), then the models one family at a time, each checked against the TypeScript engine's output in `web-react` before it replaces it.

Open question: the worklet loads its wasm from a separate module, so Trunk needs a second build target (a `rel="rust"` link with `data-type="worker"`, or a `wasm-pack` step in a Trunk hook). Settle this in the first sound-engine change.

## editor

The backend: a Rust binary on axum and tokio, with PostgreSQL through sqlx.

- **Layout**: `src/main.rs` (config from env, pool, router), `src/routes/` (one module per resource), `src/models/`, `migrations/` (sqlx migrations, run on start with `sqlx::migrate!`).
- **Data**: users, tapes, tracks (with their notes as JSONB), presets and progressions; the shapes follow what `web-react`'s stores keep in `localStorage` today, so a tape can move from the browser to the server unchanged.
- **API**: JSON over `/api/*`, CORS for the two front ends in development, and static serving of `web-rust/dist` in production so one binary can host the Rust app.
- **Checks**: sqlx's compile-time checked queries (`query!`), with `cargo sqlx prepare` committing `.sqlx/` so CI builds without a database. A `docker-compose.yml` in `editor/` starts PostgreSQL for development.

## Steps

1. **web-rust** (done): the Trunk app with fluid and Tailwind: the home page and the Device's main view, matching web-react's in both themes and every size, and playing the same: keys, chords, octave, presets, knobs and the pads' keys.
2. **Move the React app to `web-react/`** with `git mv`, so history follows the files: `app`, `public`, `scripts`, `.storybook`, `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `react-router.config.ts`, `eslint.config.js`, `vitest.shims.d.ts`, `.prettierrc`, `.prettierignore`, `Dockerfile` and `.dockerignore`. Then:
   - `docs/` and `README.md` stay at the root. In `docs.server.ts`, the globs `"/README.md"` and `"/docs/**/*.md"` become relative (`"../../../../docs/**/*.md"`), and `vite.config.ts` sets `server.fs.allow: [".."]` so Vite may read them.
   - `public/docs/` (the screenshots and diagrams) and `public/screenshot.png` stay in `web-react/public`; the README's image path becomes `web-react/public/screenshot.png`.
   - The docs' links to the code (`app/...`) become `web-react/app/...`, and their commands gain a `cd web-react`.
   - The `.agents/skills` and `.claude/skills` link stay at the root.
3. **sound-engine**: the crate, its worklet host and the first voice, wired into web-rust so the keybed makes sound.
4. **editor**: the axum app, its first migration (tapes and tracks), and the save and load routes; then web-react and web-rust save tapes to it.
5. **CI**: one job per folder, each running only its own checks (`npm` checks in `web-react`, `cargo fmt --check`, `cargo clippy` and `cargo test` in each Rust crate, `trunk build` in `web-rust`), filtered by changed paths.
