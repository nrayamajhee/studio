//! The engine's side of the AudioWorklet: one `Engine` behind plain C-ABI
//! exports, which `processor.js` calls. There is no wasm-bindgen glue, since
//! the worklet scope has no `fetch`, `importScripts` or `TextDecoder` to
//! load it with; processor.js instantiates the module itself and passes
//! events as JSON text written into `text`.

// The exports are called from JavaScript, never from Rust, with the pointer
// `worklet_new` returned; marking them `unsafe` would change nothing there.
#![allow(clippy::not_unsafe_ptr_arg_deref)]

use sound_engine::engine::{Engine, Overrides};

/// The most frames one call renders; a render quantum is 128.
const MAX_FRAMES: usize = 2048;

pub struct Worklet {
  engine: Engine,
  left: Vec<f32>,
  right: Vec<f32>,
  /// Events in, as JSON, and warnings out, one per line.
  text: Vec<u8>,
}

/// # Safety
/// Every export takes the pointer `worklet_new` returned, and processor.js
/// calls them one at a time from the audio thread.
unsafe fn worklet<'a>(pointer: *mut Worklet) -> &'a mut Worklet {
  unsafe { &mut *pointer }
}

#[unsafe(no_mangle)]
pub extern "C" fn worklet_new(sample_rate: f64) -> *mut Worklet {
  Box::into_raw(Box::new(Worklet {
    engine: Engine::new(sample_rate),
    left: vec![0.; MAX_FRAMES],
    right: vec![0.; MAX_FRAMES],
    text: Vec::new(),
  }))
}

/// Makes room for `len` bytes of text and returns where they go.
#[unsafe(no_mangle)]
pub extern "C" fn worklet_text(pointer: *mut Worklet, len: usize) -> *mut u8 {
  let worklet = unsafe { worklet(pointer) };
  worklet.text.resize(len, 0);
  worklet.text.as_mut_ptr()
}

/// Starts the engine over at the params written as JSON into the text
/// (by owner, as an offline render sets one up), before anything plays.
#[unsafe(no_mangle)]
pub extern "C" fn worklet_overrides(pointer: *mut Worklet) {
  let worklet = unsafe { worklet(pointer) };
  let overrides: Overrides = std::str::from_utf8(&worklet.text)
    .ok()
    .and_then(|json| serde_json::from_str(json).ok())
    .unwrap_or_default();
  worklet.engine = Engine::with_overrides(worklet.engine.fs, &overrides);
}

/// Queues the events written as JSON into the text.
#[unsafe(no_mangle)]
pub extern "C" fn worklet_schedule(pointer: *mut Worklet) {
  let worklet = unsafe { worklet(pointer) };
  match std::str::from_utf8(&worklet.text) {
    Ok(json) => worklet.engine.schedule_json(json),
    Err(_) => worklet.engine.schedule_json("[]"),
  }
}

/// Renders `frames` (at most 2048) from `frame` on the context's clock into
/// the left and right buffers.
#[unsafe(no_mangle)]
pub extern "C" fn worklet_render(pointer: *mut Worklet, frame: f64, frames: usize) {
  let worklet = unsafe { worklet(pointer) };
  let frames = frames.min(MAX_FRAMES);
  // Event times are AudioContext seconds, so the engine's frame counter
  // follows the context's clock even if the node started mid-stream.
  worklet.engine.frame = frame;
  worklet
    .engine
    .render(&mut worklet.left[..frames], &mut worklet.right[..frames]);
}

#[unsafe(no_mangle)]
pub extern "C" fn worklet_left(pointer: *mut Worklet) -> *const f32 {
  unsafe { worklet(pointer) }.left.as_ptr()
}

#[unsafe(no_mangle)]
pub extern "C" fn worklet_right(pointer: *mut Worklet) -> *const f32 {
  unsafe { worklet(pointer) }.right.as_ptr()
}

#[unsafe(no_mangle)]
pub extern "C" fn worklet_active_voices(pointer: *mut Worklet) -> u32 {
  unsafe { worklet(pointer) }.engine.active_voices() as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn worklet_reverb_awake(pointer: *mut Worklet) -> u32 {
  u32::from(unsafe { worklet(pointer) }.engine.stats().reverb_awake)
}

/// Writes the warnings since the last call into the text, one per line,
/// and returns its length; read it from `worklet_text(pointer, length)`.
#[unsafe(no_mangle)]
pub extern "C" fn worklet_warnings(pointer: *mut Worklet) -> usize {
  let worklet = unsafe { worklet(pointer) };
  let warnings = worklet.engine.drain_warnings();
  worklet.text.clear();
  worklet
    .text
    .extend_from_slice(warnings.join("\n").as_bytes());
  worklet.text.len()
}
