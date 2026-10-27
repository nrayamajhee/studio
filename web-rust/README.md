# web-rust

The Device in Rust: a [Trunk](https://trunkrs.dev) app compiled to WebAssembly, its UI made with [fluid](https://github.com/nrayamajhee/fluid), the signals-and-`html!` library [wgpu-test](https://github.com/nrayamajhee/wgpu-test) uses, and styled with Tailwind. It is the first step of the [monorepo plan](../docs/development/monorepo.md).

It has web-react's home page and the Device's main view, with the same Tailwind classes and theme tokens, so it looks the same in both themes and at every size. It plays the same too: the keybed from the pointer (sliding from key to key) or the home row, the chord pads (a key holds a chord, a click latches it), the octave arrows, the six presets with their parameters and kit pieces, the four knobs (drag, scroll or click) with the level overlay and the unsaved mark, and every pad's key. The other pads keep their icons and labels until their views are ported. It makes no sound yet, and the scope stays flat; sound comes from the `sound-engine` crate.

## Setup

```bash
rustup target add wasm32-unknown-unknown
cargo install trunk --locked
```

Trunk downloads the Tailwind CLI itself, at the version `Trunk.toml` pins; there is no npm step.

## Development

```bash
cd web-rust
trunk serve
```

Serves the app on port `8080` (`http://localhost:8080`) and rebuilds it on every change.

## Build

```bash
trunk build --release
```

Writes the app to `web-rust/dist`.

## Checks

- **Unit tests** (keymap, pads, notes, presets, grille; natively): `cargo test`
- **Lint**: `cargo clippy --target wasm32-unknown-unknown`
- **Format**: `cargo fmt` (check with `cargo fmt --check`)

## Layout

- `src/device.rs`: the state, as fluid signals: theme, preset, octave, held keys and pads, Shift, chords, knob values and the level overlay.
- `src/input.rs`: the browser listeners that write to it: keys, blur and the system theme.
- `src/ui/`: the page, built with `html!`, one module per part as web-react has one component: the sky, the knobs, grilles, screen, pads and keybed, and the corner buttons. Effects (`#{ |signals| ... }`) redraw only the attributes and text bound to the signals they name.
- `src/keymap.rs`, `src/notes.rs`, `src/pads.rs`: plain Rust with no web-sys types, so `cargo test` runs them without a browser.
- `src/presets.rs`, `src/icons.rs`: the six presets (every parameter with the display of each knob step, and each kit's pieces) and the pads' icons, taken from what web-react renders.
- `src/tailwind.css`: Tailwind's entry, with web-react's theme tokens and page styles. Tailwind scans `src/**/*.rs` for classes, so write every class out whole, never pieced together.

## Keys

The same as web-react's. The home row plays the keybed: white keys F3–B4 along `A S D F G H J K L ; '`, black keys on the row above (`W E R`, `Y U`, `O P [`), and Shift moves the row's last five keys up to C5–E5. The arrows move the octave, as far as the preset reaches. `1`–`6` pick the presets, `7 8 9 0 - =` hold the chords, and the rest of the pads' keys press them in.
