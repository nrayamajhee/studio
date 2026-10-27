//! The Device's sound: web-react's physical-modeling engine
//! (`app/lib/physical`) in Rust. `worklet/` builds it into the module the
//! AudioWorklet runs; with the `web` feature this crate is also the main
//! thread's host (`host`), which starts the worklet and sends it events.

// The port follows the TypeScript line by line, so it keeps its index loops
// and its `Math.max(lo, Math.min(hi, x))`, which, unlike `clamp`, turns NaN
// into a bound.
#![allow(
  clippy::manual_clamp,
  clippy::needless_range_loop,
  clippy::large_enum_variant
)]

pub mod dsp;
pub mod engine;
#[cfg(feature = "web")]
pub mod host;
pub mod messages;
pub mod models;
pub mod patches;
