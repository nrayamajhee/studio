//! Browser listeners that write to the [`Device`]: the keyboard, the window's
//! size and focus, and the system theme.

use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;

use fluid::add_event_and_forget;
use gloo_utils::window;
use wasm_bindgen::JsCast;
use web_sys::KeyboardEvent;

use crate::device::{Device, system_dark_query, window_scale};
use crate::keymap::{self, Control};

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
      let Some(control) = keymap::control(&event.code()) else {
        return;
      };
      event.prevent_default();
      if event.repeat() {
        return;
      }
      match control {
        Control::Shift => device.shift.set(true),
        Control::Octave(by) => device.step_octave(by),
        Control::Note(semitone) => {
          let semitone = if *device.shift.get() {
            keymap::shifted(semitone)
          } else {
            semitone
          };
          pressed.borrow_mut().insert(event.code(), semitone);
          device.press(semitone);
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
      match keymap::control(&event.code()) {
        Some(Control::Shift) => device.shift.set(false),
        Some(Control::Note(_)) => {
          if let Some(semitone) = pressed.borrow_mut().remove(&event.code()) {
            device.release(semitone);
          }
        }
        _ => {}
      }
    });
  }

  // Keys let go while the page is in the background never send a keyup.
  {
    let device = device.clone();
    add_event_and_forget(&window, "blur", move |_| {
      pressed.borrow_mut().clear();
      device.shift.set(false);
      device.release_all();
    });
  }

  {
    let device = device.clone();
    add_event_and_forget(&window, "resize", move |_| {
      device.scale.set(window_scale());
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
