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

- **web-react** stays the shipping app until web-rust catches up with it. It keeps its own TypeScript engine (`web-react/app/lib/physical`), so nothing in it depends on the Rust crates.
- **web-rust** is the UI only. It handles the DOM, input and state, and asks sound-engine for every sound. It never touches an `AudioContext` itself.
- **sound-engine** owns the audio. web-rust takes it as a path dependency with its `web` feature (`sound-engine = { path = "../sound-engine", features = ["web"] }`) for the host, which builds the audio graph and sends events; the engine itself is a second wasm module, `sound-engine/worklet`, which runs on the audio thread.
- **editor** is the backend both front ends save to: tapes, tracks, presets and user progressions as rows in PostgreSQL, served as JSON.

## web-rust

A Trunk app (`trunk serve` on port `8080`), built to `web-rust/dist`. Its UI uses [fluid](https://github.com/nrayamajhee/fluid), the library [wgpu-test](https://github.com/nrayamajhee/wgpu-test) uses. fluid works like Solid: signals, effects that track the signals they read, and an `html!` macro that builds real DOM elements once and updates only the attributes and text bound to signals.

- **State** is a `Device` of `Rc<Signal<_>>`s: theme, preset, octave, held keys and pads, chords, knob values. The UI and the keyboard listeners write to it, and fluid effects redraw the parts that read it.
- **Pure logic** (keymap, note names, octave range) has no web-sys types, so `cargo test` runs it natively.
- **Port order** ([the plan](./web-rust-port.md)), following the React app's parts: the home page and the Device's main view (this first step: the knobs, grilles, scope screen, all 36 pads with their keys, the presets, chords and keybed), then the screen's other views (instruments, synth, ADSR, LFO, FX, tempo), play styles and progressions, drum grid, piano roll, tracks and tapes, and MIDI last.
- **Look**: Tailwind, built by Trunk's own `tailwind-css` pipeline (no npm), from web-react's theme tokens copied into `web-rust/src/tailwind.css`, with the same class strings as web-react's components. The [design rules](./design-rules.md) hold for both apps.

## sound-engine

A Rust library crate: web-react's physical-modeling engine (`app/lib/physical`), ported line for line, and the Web Audio host that runs it. See its [README](../../sound-engine/README.md).

- **An AudioWorklet for the models.** The physical models (strings, blown, bowed, drums, free reeds, tuned percussion; see [Physical modeling](../synth/physical-modeling/overview.md)), voice allocation, the reverb and the master stage run in an `AudioWorkletProcessor`, rendering 128-frame blocks with no allocation, locks or JS calls in `process`. The worklet's module is a separate crate (`sound-engine/worklet`), a bare wasm module with C-ABI exports that the hand-written `processor.js` instantiates, since a worklet has no `fetch`, `importScripts` or `TextDecoder` for wasm-bindgen's glue. web-rust's Trunk build runs its `build.sh` from a `post_build` hook.
- **Web Audio nodes after it**, as web-react has them: a `DynamicsCompressorNode` limiter, the `AnalyserNode` the scope draws, and a `GainNode` for the system volume, which the browser runs in native code. The host (the `web` feature) builds this graph, starts it on the first gesture and sends events.
- **Events** are web-react's `EngineEvent`s as JSON, posted to the worklet's port, so one list plays through both engines; the engine places each at its exact frame. A lock-free ring buffer in a `SharedArrayBuffer` (which needs cross-origin isolation) can replace the port later if a busy main thread delays notes.
- **Testable natively.** The engine is plain Rust over `&mut [f32]` buffers, so `cargo test` runs it without a browser, and a parity check plays the same events through the TypeScript engine and this one: they match bit for bit on most cases and within the last bit of a `pow` or `exp` on the rest.
- **Later**: moving parts that native nodes do well (a `ConvolverNode` reverb, a `DelayNode` ping-pong, `BiquadFilterNode` tone) out of the worklet, once web-rust no longer needs to match web-react's output to the sample.

## editor

The backend: a Rust binary on axum and tokio, with PostgreSQL through sqlx.

- **Layout**: `src/main.rs` (config from env, pool, router), `src/routes/` (one module per resource), `src/models/`, `migrations/` (sqlx migrations, run on start with `sqlx::migrate!`).
- **Data**: users, tapes, tracks (with their notes as JSONB), presets and progressions; the shapes follow what `web-react`'s stores keep in `localStorage` today, so a tape can move from the browser to the server unchanged.
- **API**: JSON over `/api/*`, CORS for the two front ends in development, and static serving of `web-rust/dist` in production so one binary can host the Rust app.
- **Checks**: sqlx's compile-time checked queries (`query!`), with `cargo sqlx prepare` committing `.sqlx/` so CI builds without a database. A `docker-compose.yml` in `editor/` starts PostgreSQL for development.

## Steps

1. **web-rust** (done): the Trunk app with fluid and Tailwind: the home page and the Device's main view, matching web-react's in both themes and every size, and playing the same: keys, chords, octave, presets, knobs and the pads' keys. Its footer opens the docs (rendered from this folder at build time), the crates' Rust docs and the Debug panel, and its `Dockerfile` builds it and serves it with nginx.
2. **web-react** (done): the React app moved to `web-react/` with `git mv`, so history follows the files: `app`, `public`, `scripts`, `.storybook`, `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `react-router.config.ts`, `eslint.config.js`, `vitest.shims.d.ts`, `.prettierrc`, `.prettierignore`, `Dockerfile` and `.dockerignore`. Then:
   - `docs/` and `README.md` stay at the root. `docs.server.ts` globs them relatively (`"../../../../docs/**/*.md"`) and keys them by their repo paths, and `vite.config.ts` sets `server.fs.allow: [".."]` so Vite may read them.
   - `public/docs/` (the screenshots and diagrams) and `public/screenshot.png` stay in `web-react/public`, and the docs' images point there; web-rust's build copies them from there too.
   - The docs' links to the code (`app/...`) became `web-react/app/...`, and their commands run from `web-react`.
   - web-rust's `export-presets.tsx` moved to `web-react/scripts/`, since it imports React; sound-engine's scripts stay put and run from `web-react` (`npx tsx ../sound-engine/scripts/parity.ts`).
   - The Dockerfile builds from the repo's root, with `web-react/Dockerfile.dockerignore` keeping the context to `web-react/`, `docs/` and `README.md`.
   - The `.agents/skills` and `.claude/skills` link stay at the root.
3. **sound-engine** (done): the engine ported whole, its worklet and host, and web-rust playing through it: notes, chords, presets, knobs and the scope.
4. **editor**: the axum app, its first migration (tapes and tracks), and the save and load routes; then web-react and web-rust save tapes to it.
5. **CI**: one job per folder, each running only its own checks (`npm` checks in `web-react`, `cargo fmt --check`, `cargo clippy` and `cargo test` in each Rust crate, `trunk build` in `web-rust`), filtered by changed paths.
