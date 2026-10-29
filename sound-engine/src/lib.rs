//! The Device's sound: web-react's physical-modeling engine
//! (`web-react/app/lib/physical`) in Rust. `worklet/` builds it into the module
//! the AudioWorklet runs; with the `web` feature this crate is also the main
//! thread's host (`host`), which starts the worklet and sends it events.
//!
//! The main types are re-exported here: the [`Engine`] and what it's made of
//! (each [`Instrument`]'s [`Bus`] and model, its voices' [`VoiceCore`] and
//! [`VoiceChain`], the master's [`MasterLfo`] and [`MasterFx`]), the seven
//! physical models, the DSP blocks they're built from, the events it plays
//! ([`EngineEvent`]), the patches it reads ([`Patch`]) and, with the `web`
//! feature, the host's `Synth`, `Scrubber` and `TrackMixer`.

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

#[doc(inline)]
pub use dsp::adsr::{Adsr, AdsrStages};
#[doc(inline)]
pub use dsp::delay_line::DelayLine;
#[doc(inline)]
pub use dsp::fdn::Fdn;
#[doc(inline)]
pub use dsp::filters::{Biquad, DcBlocker, OnePoleHighpass, OnePoleLowpass};
#[doc(inline)]
pub use dsp::generators::{Follower, Lfo, Noise, Oscillator, Smoother};
#[doc(inline)]
pub use dsp::modal::ModalBank;
#[doc(inline)]
pub use dsp::peak_limiter::PeakLimiter;
#[doc(inline)]
pub use dsp::svf::Svf;
#[doc(inline)]
pub use engine::Engine;
#[doc(inline)]
pub use engine::bus::Bus;
#[doc(inline)]
pub use engine::chain::VoiceChain;
#[doc(inline)]
pub use engine::event_queue::EventQueue;
#[doc(inline)]
pub use engine::instrument::Instrument;
#[doc(inline)]
pub use engine::master_fx::MasterFx;
#[doc(inline)]
pub use engine::master_lfo::MasterLfo;
#[doc(inline)]
pub use engine::modules::{LfoRouting, ModuleSettings};
#[doc(inline)]
pub use engine::param_set::ParamSet;
#[doc(inline)]
pub use engine::voice::{Voice, VoiceCore};
#[cfg(feature = "web")]
#[doc(inline)]
pub use host::{MixTrack, Scrubber, Status, Synth, TrackMixer};
#[doc(inline)]
pub use messages::{EngineEvent, EngineStats};
#[doc(inline)]
pub use models::bar::BarModel;
#[doc(inline)]
pub use models::body::Body;
#[doc(inline)]
pub use models::bore::BoreModel;
#[doc(inline)]
pub use models::bowed::BowedModel;
#[doc(inline)]
pub use models::drums::{DrumModel, Woodblock};
#[doc(inline)]
pub use models::oscillator::OscillatorModel;
#[doc(inline)]
pub use models::reed::ReedModel;
#[doc(inline)]
pub use models::string::StringModel;
#[doc(inline)]
pub use models::string_loop::StringLoop;
#[doc(inline)]
pub use models::waveguide::Waveguide;
#[doc(inline)]
pub use patches::{BasePatch, ParamSpec, Patch, PatchData};
