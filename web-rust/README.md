# web-rust

The Device in Rust: a [Trunk](https://trunkrs.dev) app compiled to WebAssembly, its UI made with [fluid](https://github.com/nrayamajhee/fluid), the signals-and-`html!` library [wgpu-test](https://github.com/nrayamajhee/wgpu-test) uses. It is the first step of the [monorepo plan](../docs/development/monorepo.md): the Device's shell, screen and keybed, played with the pointer or the home row, in the light and dark themes. It makes no sound yet; that comes from the `sound-engine` crate.

## Setup

```bash
rustup target add wasm32-unknown-unknown
cargo install trunk --locked
```

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

- **Unit tests** (keymap, note names, the fit; natively): `cargo test`
- **Lint**: `cargo clippy --target wasm32-unknown-unknown`
- **Format**: `cargo fmt` (check with `cargo fmt --check`)

## Layout

- `src/device.rs`: the state, as fluid signals: theme, octave, held keys, Shift, the last note and the zoom.
- `src/input.rs`: the browser listeners that write to it: keys, resize, blur and the system theme.
- `src/ui/`: the page, built with `html!`. Effects (`#{ |signals| ... }`) redraw only the attributes and text bound to the signals they name.
- `src/keymap.rs`, `src/notes.rs`: plain Rust with no web-sys types, so `cargo test` runs them without a browser.
- `src/main.css`: web-react's theme tokens as plain CSS, with the same 400 ms `--theme-mix` cross-fade.

## Keys

The home row plays the keybed as it does in web-react: white keys F3–B4 along `A S D F G H J K L ; '`, black keys on the row above (`W E R`, `Y U`, `O P [`). Shift moves the row's last five keys up to C5–E5, and `↑` `↓` shift the keybed an octave, three either way.
