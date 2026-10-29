//! The Device's logic as plain Rust, ported from web-react's modules of the
//! same names, with no web-sys or fluid types, so `cargo test` runs it
//! natively.

pub mod beats;
pub mod chords;
pub mod export;
pub mod flac;
pub mod js;
pub mod math;
pub mod modules;
pub mod params;
#[cfg(test)]
mod parity;
pub mod pattern;
pub mod play_styles;
pub mod presets;
pub mod progressions;
pub mod starter;
pub mod swing;
pub mod synth_graphs;
pub mod synth_pages;
pub mod timing;
pub mod tracks;
