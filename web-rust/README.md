# web-rust

The Device in Rust: a [Trunk](https://trunkrs.dev) app compiled to WebAssembly, its UI made with [fluid](https://github.com/nrayamajhee/fluid), the signals-and-`html!` library [wgpu-test](https://github.com/nrayamajhee/wgpu-test) uses, and styled with Tailwind. It is the first step of the [monorepo plan](../docs/development/monorepo.md).

It is the whole Device, ported from web-react: the home page and every view of the Device, with the same Tailwind classes and theme tokens, so it looks the same in both themes and at every size, phone width included. It plays the same too. Every knob, pad and key is bound per view as web-react binds it, with Shift's second jobs, notices, prompts and second presses. There's the instrument library (by model or band, saved sounds, favorites, pads bound to any of them), chords, play styles, progressions and drum beats with their previews. The synth view has its pages and graphs, alongside the ADSR, LFO and FX and the tempo with tap tempo, swing and the metronome. Takes record on the piano roll and patterns in the drum grid. Tapes hold tracks, mixed, scrubbed, copied, clipped, muted and soloed, and saved as FLAC or MIDI. MIDI keyboards and controllers play it, mapped by moving them or, on an OP-1, from the start. It keeps what web-react keeps in `localStorage`, under the same keys and in the same JSON, so a session reads the same in either app.

It sounds the same as well. The [sound-engine](../sound-engine/README.md) crate runs web-react's physical models, ported to Rust, in an AudioWorklet, and the Device sends it what web-react's does: every note and chord, hits and previews scheduled on the audio clock, the metronome's ticks, every parameter and knob turn, the level into the clipper and the volume after it. Tracks are rendered offline through the same worklet and mixed and scrubbed with Web Audio nodes, as web-react's are. The scope draws the output. Audio starts on the first press, click or key, as browsers require.

The footer's links work as web-react's do. **Docs** opens the docs at `/docs`: the repo's README and every file under `docs/`, rendered from their markdown at build time, with web-react's sidebar, paper and dark screenshots, and links between docs that move in place. **Rust docs** opens rustdoc's pages for this crate, sound-engine, its worklet and fluid, private items included, at `/rust-doc/`. **Debug** (or ⌘D, Ctrl D) opens web-react's Debug panel over the page, here with web-rust's state: the Device's, the docs' folded folders, the theme and the sound engine's, which says whether it started, and if not, why, with its voices, load and warnings.

## Setup

```bash
rustup target add wasm32-unknown-unknown
cargo install trunk --locked
```

Trunk downloads the Tailwind CLI itself, at the version `Trunk.toml` pins; there is no npm step. The crate is in the repo's Cargo workspace with sound-engine and its worklet (`Cargo.toml` at the root), so they share one lockfile and one `target/` folder there. Two hooks in `Trunk.toml` add to the output beside the app. Before every build, `trunk serve`'s included, `../sound-engine/worklet/build.sh` builds the AudioWorklet's engine, so the page never runs a stale engine and one that doesn't compile stops the build. After it, `scripts/rust-doc.sh` builds the Rust docs. `trunk serve` rebuilds when either crate, the workspace's manifest or lockfile, or the docs change.

## Development

```bash
cd web-rust
trunk serve
```

Serves the app on port `8080` (`http://localhost:8080`) and rebuilds it on every change. Trunk reads `Trunk.toml` only when it starts, so restart `trunk serve` after `Trunk.toml` changes (a pull that adds a hook, say); until then it builds without it. If the Device stays silent, the Debug panel's `studio.engine` (and the console) says why.

## Build

```bash
trunk build --release
```

Writes the app to `web-rust/dist`, with the worklet's `sound-worklet.js` and `sound-worklet.wasm`, the Rust docs in `rust-doc/` and the docs' images (from `web-react/public/`) in `public/`. The app routes `/` and `/docs/...` itself, so a server for it sends `index.html` for any path that isn't a file, as `nginx.conf` does.

## Docker

The image builds the app with Trunk and serves it with nginx on `$PORT`, 8080 unless the host sets it. Build it from the repo's root, which holds everything it reads (the crates and their workspace, `docs/`, the README and the docs' images):

```bash
docker build -f web-rust/Dockerfile -t studio-web-rust .
docker run --rm -p 8080:8080 studio-web-rust
```

`Dockerfile.dockerignore` keeps the context to those folders. On Railway, leave the service's root directory unset (the repo's root), set the Dockerfile Path to `/web-rust/Dockerfile`, and watch every path the image is built from, so a change to any of them deploys: `/web-rust/**`, `/sound-engine/**`, `/Cargo.toml`, `/Cargo.lock`, `/docs/**`, `/README.md`, `/web-react/public/docs/**` and `/web-react/public/screenshot.png`. Railway sets `PORT` itself. The Dockerfile has no cache mounts, since Railway's builder refuses any whose id isn't tied to the service.

## Checks

- **Unit tests** (natively): `cargo test`. Besides the logic, stores, keymap, routes, docs and the Debug panel's JSON, it checks the port against web-react's own code. `tests/fixtures.json` holds what web-react's functions give for a spread of inputs (param formatting and knob steps, timelines, chords, progressions, beats and patterns, tracks, modules, presets, the starter tapes, FLAC and MIDI files), and `src/logic/parity.rs` gets the same from the Rust. `tests/graphs.json` holds the synth view's graph for every page of every instrument at three knob steps, and `src/logic/synth_graphs.rs` draws the same. Scripts in `scripts/` write them from web-react's code, as they write `data/*.json`. Run them from `web-react` after changing either side: `npx tsx ../web-rust/scripts/export-fixtures.tsx` (and `export-graphs.tsx`, `export-data.tsx`).
- **Lint**: `cargo clippy --all-targets` (natively, tests included) and `cargo clippy --target wasm32-unknown-unknown`
- **Format**: `cargo fmt` (check with `cargo fmt --check`)
- **Parity with web-react**: with both apps running (web-react's `npm run dev` on `3000` and `trunk serve` on `8080`; set `REACT_URL` and `RUST_URL` to use others), run these from the repo's root. They use Playwright as web-react installs it, or a global one.
  - `node web-rust/scripts/parity/parity.cjs web-rust/scripts/parity/steps/basics.json` plays the same steps in both apps at once and, after every step, compares what each shows: the pads, knobs and keys (labels, state, colours), the screen's text, tiles, graph, drum grid and track rows (laid out, to the pixel), the MIDI panel and `localStorage`. A step that differs is compared again twice, 250 ms apart, so a notice timing out a moment sooner in one app doesn't count. The steps files cover the basics, the pickers, the synth and its modules, the drum grid, the piano roll, the tracks, and MIDI: `midi.json` with `--fake-midi` (a stand-in controller) and `op1.json` with `--fake-midi=OP-1`.
  - `node web-rust/scripts/parity/shots.cjs web-rust/scripts/parity/shots.json` screenshots both after the same steps in both themes and counts the pixels that differ. The cases cover every picker, the synth's pages, the ADSR, LFO and FX, tempo, save, the drum grid, the piano roll, the tracks, the MIDI panel, and the page at phone width (390×844). A case passes with up to 64 pixels apart, what anti-aliasing alone moves (see the [port's record](../docs/development/web-rust-port.md#how-parity-was-checked)). Name cases after the file to shoot only those. The shots and their diffs go to `target/parity-shots/` at the repo's root.

## Layout

The modules follow web-react's, so each has one TypeScript file (or folder) to read against.

- `src/router.rs`: the two pages, the Device at `/` and the docs under `/docs`, as a signal of the path. Links to them move in place with the history, and each page lives in its own scope, disposed when the route leaves it.
- `src/state/`: the Device's state, as web-react's providers hold it: one store per provider (feedback, Shift, the view, transport, output, sound, performance, lanes, drum grid, tracks, mix, scrub, take, preview), each a struct of fluid signals with the provider's methods. They live as long as the page in one `App`, reached with `app()` as a `&'static`, so closures, timers and animation frames use it without cloning. `keymap.rs` and `hotkeys.rs` are web-react's keymap and `HotkeyProvider`.
- `src/store/`: what the Device keeps between visits: the instrument library, chords and play styles, favorites, and the session (the take and the tapes). Each is a signal written to `localStorage` under web-react's key and in its JSON shape whenever it changes.
- `src/logic/`: the Device's logic as plain Rust, a module per web-react module of the same name (params, presets, timing, swing, chords, play styles, progressions, beats, patterns, tracks, modules, the starter tapes, the synth's pages and graphs, FLAC and MIDI export). It has no web-sys or fluid types, so `cargo test` runs it natively.
- `src/modes/`: what every control does in each view, as web-react's `modes/`: `base.rs` and a module per view, each rebinding what it changes of the knobs, pads, keybed and screen. `install` resolves the open view's bindings into one memo the controls draw from, and a press runs the handler as it is now.
- `src/ui/`: the page, built with `html!`, a module per web-react component: the sky, knobs, grilles, pads and keybed, the corner buttons, the MIDI and Debug panels and the docs page. Each part is a function returning its element, placed in its parent as a child (`{ pads() }`). Reactive text is `#text{ .. }`, state classes are `class:".."` toggles, conditional parts are `if`, lists are keyed, and handlers are typed (`@pointerdown={ move |event: PointerEvent| .. }`); only what a signal change touches is redrawn.
- `src/ui/screen/`: the screen, as web-react's `DeviceScreen`, a module per kind of view: tiles with their pager, the module graphs, tempo, the piano roll, the drum grid, the tracks' lanes and the scope. The piano roll and drum grid move their heads every frame, as web-react's do.
- `src/midi.rs`: MIDI input, as web-react's `input/midi.ts`: a controller's keys play the keybed, and the knobs and pads mapped to the Device's turn and press them. A known controller (the OP-1) maps itself the first time it's plugged in.
- `src/input.rs`: the browser listeners (`fluid::listen`): keys, blur and hiding the page, the first gesture that starts audio, and the system theme. `src/chrome.rs` holds the page around the Device: the theme and which panel is open.
- `src/icons.rs`: every icon the Device draws, as React renders it, from `data/icons.json`. `data/` holds web-react's tables (the progressions, the drum beats and the icons), written by `scripts/export-data.tsx`; each instrument's params come from sound-engine's `patches.json`.
- `build.rs`, `src/docs/`: the docs, rendered from markdown with pulldown-cmark at build time; `src/docs/style.rs` holds the classes the HTML gets, where Tailwind finds them.
- `src/tailwind.css`: Tailwind's entry, with web-react's theme tokens and page styles. Tailwind scans `src/**/*.rs` for classes, so write every class out whole, never pieced together.

## Keys

The same as web-react's; [Pads and keybed](../docs/the-device/pads-and-keybed.md) lists every one. The home row plays the keybed: white keys F3–B4 along `A S D F G H J K L ; '`, black keys on the row above (`W E R`, `Y U`, `O P [`), and Shift moves the row's last five keys up to C5–E5. Every pad has its key: Space plays and `` ` `` stops, `.` records, Esc opens the tracks, `I` the instruments, `Z` the synth, `V` the piano roll and `B` the drum grid. `1`–`6` pick the instrument pads, `7 8 9 0 - =` hold the chords, and the arrows move the octave or the page. Held with Shift, the pads do their second jobs. Ctrl S (⌘S on a Mac) saves, Ctrl D (⌘D) opens the Debug panel, and Tab moves between the controls.
