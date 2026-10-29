#!/bin/sh
# Builds the Rust API docs, private items included, for web-rust, the sound
# engine (with its host) and its worklet, and fluid, into one tree, and
# copies it to <out-dir>/rust-doc. Trunk's post_build hook runs it, so the
# app serves the docs at /rust-doc/:
#   web-rust/scripts/rust-doc.sh <out-dir>
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
out=${1:?usage: rust-doc.sh <out-dir>}
# Their own target folder in the workspace's, so they never wait on the
# app's wasm build.
target="${CARGO_TARGET_DIR:-$here/../target}/rust-doc"
cargo doc --manifest-path "$here/Cargo.toml" --target-dir "$target" --no-deps \
  --document-private-items -p web-rust -p sound-engine -p sound-worklet -p fluid
rm -rf "$out/rust-doc"
cp -r "$target/doc" "$out/rust-doc"
# rustdoc has no page above the crates; start at the app's.
cat > "$out/rust-doc/index.html" <<'HTML'
<!doctype html>
<meta charset="utf-8" />
<title>Rust docs - Studio</title>
<meta http-equiv="refresh" content="0; url=web_rust/index.html" />
<a href="web_rust/index.html">web_rust</a>
HTML
