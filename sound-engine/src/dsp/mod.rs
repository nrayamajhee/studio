//! The DSP building blocks, ported from web-react's `app/lib/physical/dsp`.
//!
//! Numbers follow the TypeScript engine: arithmetic in `f64` (JavaScript's
//! number), storage in `f32` wherever it keeps a `Float32Array`, so the two
//! engines render the same samples.

pub mod adsr;
pub mod delay_line;
pub mod fdn;
pub mod filters;
pub mod generators;
pub mod math;
pub mod modal;
pub mod nonlinear;
pub mod peak_limiter;
pub mod phase_delay;
pub mod svf;
