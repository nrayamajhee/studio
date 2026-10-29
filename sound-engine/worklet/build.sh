#!/bin/sh
# Builds the worklet (the engine as a bare wasm module) with the workspace's
# `worklet` profile and copies it with its processor into the given folder
# as sound-worklet.wasm and sound-worklet.js. web-rust's Trunk hook runs it
# into its staging folder on every build, so a change to the engine always
# reaches the worklet:
#   sound-engine/worklet/build.sh <out-dir>
set -eu
here=$(cd "$(dirname "$0")" && pwd)
out=${1:?usage: build.sh <out-dir>}
# The workspace's target folder, unless CARGO_TARGET_DIR moves it.
target=${CARGO_TARGET_DIR:-$here/../../target}
cargo build --manifest-path "$here/Cargo.toml" -p sound-worklet --profile worklet --target wasm32-unknown-unknown
mkdir -p "$out"
cp "$target/wasm32-unknown-unknown/worklet/sound_worklet.wasm" "$out/sound-worklet.wasm"
cp "$here/processor.js" "$out/sound-worklet.js"
