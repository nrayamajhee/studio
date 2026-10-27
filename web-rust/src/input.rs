//! Browser listeners that write to the [`Device`]: the keyboard, the
//! window's focus and the system theme.

use std::cell::RefCell;
use std::collections::HashMap;

use fluid::{ListenerOptions, listen};
use gloo_utils::window;
use web_sys::{Event, KeyboardEvent};

use crate::device::{Device, system_dark_query};
use crate::keymap;
use crate::pads::{self, Job, PADS};

/// Runs a pad's job, from its key or the pointer. A key holds Shift or a
/// chord while down; the pointer latches them.
pub fn press_pad(device: &Device, pad: usize, from_key: bool) {
  // The latched chord's own key lets go of it, and holds nothing.
  if let Job::Chord(chord) = PADS[pad].job
    && from_key
    && device.latched_chord.value() == Some(chord)
  {
    device.latched_chord.set(None);
    return;
  }
  device.hold_pad(pad, true);
  match PADS[pad].job {
    Job::Octave(by) => device.step_octave(by),
    Job::Preset(preset) => device.select_preset(preset),
    Job::Shift if from_key => device.shift_key.set(true),
    Job::Shift => device.toggle_latch(),
    Job::Chord(chord) if from_key => device.hold_chord(chord),
    Job::Chord(chord) => device.toggle_chord(chord),
    Job::None => {}
  }
}

pub fn listen_to_page(device: &'static Device) {
  let window = window();
  // The keybed semitone each held key started, by its code, so a key lets go
  // of the note it played even if Shift was let go first.
  let pressed: &'static RefCell<HashMap<String, u8>> = Box::leak(Box::default());

  listen(
    &window,
    "keydown",
    ListenerOptions::new(),
    move |event: KeyboardEvent| {
      if event.meta_key() || event.ctrl_key() || event.alt_key() {
        return;
      }
      let code = event.code();
      if let Some(semitone) = keymap::note_for(&code) {
        event.prevent_default();
        if event.repeat() {
          return;
        }
        let semitone = if device.shift() {
          keymap::shifted(semitone)
        } else {
          semitone
        };
        pressed.borrow_mut().insert(code, semitone);
        device.press(semitone);
      } else if let Some(pad) = pads::pad_for(&code) {
        event.prevent_default();
        if !event.repeat() {
          press_pad(device, pad, true);
        }
      }
    },
  )
  .forget();

  listen(
    &window,
    "keyup",
    ListenerOptions::new(),
    move |event: KeyboardEvent| {
      let code = event.code();
      let semitone = pressed.borrow_mut().remove(&code);
      if let Some(semitone) = semitone {
        device.release(semitone);
      } else if let Some(pad) = pads::pad_for(&code) {
        device.hold_pad(pad, false);
        match PADS[pad].job {
          Job::Shift => device.shift_key.set(false),
          Job::Chord(chord) => device.release_chord(chord),
          _ => {}
        }
      }
    },
  )
  .forget();

  // Keys let go while the page is in the background never send a keyup.
  listen(&window, "blur", ListenerOptions::new(), move |_: Event| {
    pressed.borrow_mut().clear();
    fluid::batch(|| {
      device.shift_key.set_if_changed(false);
      device.chord_key.set_if_changed(None);
      device.release_all();
    });
  })
  .forget();

  if let Some(query) = system_dark_query() {
    let matches = query.clone();
    listen(&query, "change", ListenerOptions::new(), move |_: Event| {
      device.system_dark.set(matches.matches());
    })
    .forget();
  }
}
