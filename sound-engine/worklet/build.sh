#!/bin/sh
# Builds the worklet (the engine as a bare wasm module) and copies it with
# its processor into the given folder as sound-worklet.wasm and
# sound-worklet.js. web-rust's Trunk hook runs it into its staging folder:
#   sound-engine/worklet/build.sh <out-dir>
set -eu
here=$(cd "$(dirname "$0")" && pwd)
out=${1:?usage: build.sh <out-dir>}
cargo build --manifest-path "$here/Cargo.toml" --release --target wasm32-unknown-unknown
mkdir -p "$out"
cp "$here/target/wasm32-unknown-unknown/release/sound_worklet.wasm" "$out/sound-worklet.wasm"
cp "$here/processor.js" "$out/sound-worklet.js"
