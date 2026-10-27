//! Browser listeners that write to the [`Device`]: the keyboard, the
//! window's focus and the system theme.

use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;

use fluid::add_event_and_forget;
use gloo_utils::window;
use wasm_bindgen::JsCast;
use web_sys::KeyboardEvent;

use crate::device::{Device, system_dark_query};
use crate::keymap;
use crate::pads::{self, Job, PADS};

/// Runs a pad's job, from its key or the pointer. A key holds Shift or a
/// chord while down; the pointer latches them.
pub fn press_pad(device: &Device, pad: usize, from_key: bool) {
  // The latched chord's own key lets go of it, and holds nothing.
  if let Job::Chord(chord) = PADS[pad].job
    && from_key
    && *device.latched_chord.get() == Some(chord)
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

pub fn listen(device: &Rc<Device>) {
  let window = window();
  // The keybed semitone each held key started, by its code, so a key lets go
  // of the note it played even if Shift was let go first.
  let pressed = Rc::new(RefCell::new(HashMap::<String, u8>::new()));

  {
    let device = device.clone();
    let pressed = pressed.clone();
    add_event_and_forget(&window, "keydown", move |event| {
      let Some(event) = event.dyn_ref::<KeyboardEvent>() else {
        return;
      };
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
          press_pad(&device, pad, true);
        }
      }
    });
  }

  {
    let device = device.clone();
    let pressed = pressed.clone();
    add_event_and_forget(&window, "keyup", move |event| {
      let Some(event) = event.dyn_ref::<KeyboardEvent>() else {
        return;
      };
      let code = event.code();
      if let Some(semitone) = pressed.borrow_mut().remove(&code) {
        device.release(semitone);
      } else if let Some(pad) = pads::pad_for(&code) {
        device.hold_pad(pad, false);
        match PADS[pad].job {
          Job::Shift => device.shift_key.set(false),
          Job::Chord(chord) => device.release_chord(chord),
          _ => {}
        }
      }
    });
  }

  // Keys let go while the page is in the background never send a keyup.
  {
    let device = device.clone();
    add_event_and_forget(&window, "blur", move |_| {
      pressed.borrow_mut().clear();
      device.shift_key.set(false);
      device.chord_key.set(None);
      device.release_all();
    });
  }

  if let Some(query) = system_dark_query() {
    let device = device.clone();
    let matches = query.clone();
    add_event_and_forget(&query, "change", move |_| {
      device.system_dark.set(matches.matches());
    });
  }
}
