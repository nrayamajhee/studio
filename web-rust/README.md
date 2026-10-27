# web-rust

The Device in Rust: a [Trunk](https://trunkrs.dev) app compiled to WebAssembly, its UI made with [fluid](https://github.com/nrayamajhee/fluid), the signals-and-`html!` library [wgpu-test](https://github.com/nrayamajhee/wgpu-test) uses, and styled with Tailwind. It is the first step of the [monorepo plan](../docs/development/monorepo.md).

It has web-react's home page and the Device's main view, with the same Tailwind classes and theme tokens, so it looks the same in both themes and at every size. It plays the same too: the keybed from the pointer (sliding from key to key) or the home row, the chord pads (a key holds a chord, a click latches it), the octave arrows, the six presets with their parameters and kit pieces, the four knobs (drag, scroll or click) with the level overlay and the unsaved mark, and every pad's key. The other pads keep their icons and labels until their views are ported.

It sounds the same as well. The [sound-engine](../sound-engine/README.md) crate runs web-react's physical models, ported to Rust, in an AudioWorklet, and the Device sends it what web-react's does: every note and chord, each preset's parameters when it is picked, every knob turn, the level into the clipper and the volume after it. The scope draws the output. Audio starts on the first press, click or key, as browsers require.

The footer's links work as web-react's do. **Docs** opens the docs at `/docs`: the repo's README and every file under `docs/`, rendered from their markdown at build time, with web-react's sidebar, paper and dark screenshots, and links between docs that move in place. **Rust docs** opens rustdoc's pages for this crate, sound-engine, its worklet and fluid, private items included, at `/rust-doc/`. **Debug** (or ⌘D, Ctrl D) opens web-react's Debug panel over the page, here with web-rust's state: the Device's, the docs' folded folders, the theme and the sound engine's, which says whether it started, and if not, why, with its voices, load and warnings.

## Setup

```bash
rustup target add wasm32-unknown-unknown
cargo install trunk --locked
```

Trunk downloads the Tailwind CLI itself, at the version `Trunk.toml` pins; there is no npm step. Two hooks in `Trunk.toml` add to the output beside the app: the AudioWorklet's engine (`../sound-engine/worklet/build.sh`) and the Rust docs (`scripts/rust-doc.sh`). `trunk serve` rebuilds when either crate or the docs change.

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

The image builds the app with Trunk and serves it with nginx on `$PORT`, 8080 unless the host sets it. Build it from the repo's root, which holds everything it reads (the crates, `docs/`, the README and the docs' images):

```bash
docker build -f web-rust/Dockerfile -t studio-web-rust .
docker run --rm -p 8080:8080 studio-web-rust
```

`Dockerfile.dockerignore` keeps the context to those folders. On Railway, leave the service's root directory unset (the repo's root), set the Dockerfile Path to `/web-rust/Dockerfile`, and watch every path the image is built from, so a change to any of them deploys: `/web-rust/**`, `/sound-engine/**`, `/docs/**`, `/README.md`, `/web-react/public/docs/**` and `/web-react/public/screenshot.png`. Railway sets `PORT` itself. The Dockerfile has no cache mounts, since Railway's builder refuses any whose id isn't tied to the service.

## Checks

- **Unit tests** (keymap, pads, notes, presets, grille, routes, the docs and the Debug panel's JSON; natively): `cargo test`
- **Lint**: `cargo clippy --target wasm32-unknown-unknown`
- **Format**: `cargo fmt` (check with `cargo fmt --check`)

## Layout

- `src/router.rs`: the two pages, the Device at `/` and the docs under `/docs`, as a signal of the path. Links to them move in place with the history, and each page lives in its own scope, disposed when the route leaves it.
- `src/device.rs`: the state, as fluid signals and memos: theme, preset, octave, held keys and pads, Shift, chords, knob values and the level overlay. It lives as long as the page and is shared through fluid's context as a `&'static Device`, so closures capture it without cloning.
- `src/input.rs`: the browser listeners that write to it (`fluid::listen`): keys, blur and hiding the page, and the system theme.
- `src/sound.rs`: what the Device plays, as web-react's `deviceEngine` sends it: the Device's actions call it, and it sends events to sound-engine's host.
- `src/ui/`: the pages, built with `html!`, one module per part as web-react has one component: the sky, the knobs, grilles, screen, pads and keybed, the corner buttons, the Debug panel and the docs page. Each part is a function returning its element, placed in its parent as a child (`{ pads() }`). Reactive text is `#text{ .. }`, state classes are `class:".."` toggles, conditional parts are `if`, and handlers are typed (`@pointerdown={ move |event: PointerEvent| .. }`); only what a signal change touches is redrawn.
- `src/keymap.rs`, `src/notes.rs`, `src/pads.rs`: plain Rust with no web-sys types, so `cargo test` runs them without a browser.
- `src/presets.rs`: the six presets, generated from web-react's code by its `scripts/export-presets.tsx` (run it from `web-react` with `npx tsx`): the instrument each plays, every parameter with the display and value of each knob step, and each kit's pieces.
- `src/icons.rs`: the pads' and pages' icons, taken from what web-react renders.
- `build.rs`, `src/docs/`: the docs, rendered from markdown with pulldown-cmark at build time; `src/docs/style.rs` holds the classes the HTML gets, where Tailwind finds them.
- `src/tailwind.css`: Tailwind's entry, with web-react's theme tokens and page styles. Tailwind scans `src/**/*.rs` for classes, so write every class out whole, never pieced together.

## Keys

The same as web-react's. The home row plays the keybed: white keys F3–B4 along `A S D F G H J K L ; '`, black keys on the row above (`W E R`, `Y U`, `O P [`), and Shift moves the row's last five keys up to C5–E5. The arrows move the octave, as far as the preset reaches. `1`–`6` pick the presets, `7 8 9 0 - =` hold the chords, and the rest of the pads' keys press them in.
