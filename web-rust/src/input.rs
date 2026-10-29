//! Browser listeners that play the Device, as web-react's
//! `HotkeyProvider`, `useCommandKey` and focus handling do: the keyboard
//! (mapped keys held and let go, ⌘ shortcuts, Tab between controls), the
//! window losing focus, the first gesture that starts audio, and the
//! system theme.

use fluid::{ListenerOptions, listen};
use gloo_utils::{document, window};
use wasm_bindgen::JsCast;
use web_sys::{Element, Event, HtmlElement, KeyboardEvent};

use crate::chrome::{chrome, system_dark_query};
use crate::router::{Page, Router};
use crate::state::app;
use crate::state::keymap::{Control, Tool, control_for};
use crate::ui::focus::{keyboard_focus, move_focus};

/// ⌘D (Ctrl D) opens and closes the Debug panel, in place of a bookmark.
pub const DEBUG_CODE: &str = "KeyD";

/// Typing in a field (the tempo's BPM) isn't playing the Device.
fn typing(event: &KeyboardEvent) -> bool {
  event
    .target()
    .and_then(|target| target.dyn_into::<Element>().ok())
    .and_then(|element| {
      element
        .closest("input, textarea, select, [contenteditable]")
        .ok()
        .flatten()
    })
    .is_some()
}

/// A key went down or up on the page: Tab moves the focus, ⌘ shortcuts save or
/// open the Debug panel, and the Device's keys go to the hotkeys (kept from the
/// browser), unless the focus is in a text field.
fn on_key(event: &KeyboardEvent, down: bool) {
  let hotkeys = &app().hotkeys;
  if typing(event) {
    return;
  }
  let code = event.code();
  if code == "Tab" {
    event.prevent_default();
    if down {
      move_focus(if event.shift_key() { -1 } else { 1 });
    }
    return;
  }
  // Esc lets go of a focused pad first; otherwise it is a hotkey.
  if event.key() == "Escape" && keyboard_focus() {
    if down
      && let Some(active) = document().active_element()
      && let Some(active) = active.dyn_ref::<HtmlElement>()
    {
      let _ = active.blur();
    }
    return;
  }
  if code == "Enter" && keyboard_focus() {
    return;
  }
  // macOS sends no keyups for other keys while ⌘ is held, so let go first.
  if event.key() == "Meta" && down {
    hotkeys.release_all();
    return;
  }
  let Some(control) = control_for(&code) else {
    return;
  };
  if down {
    // Browser shortcuts (⌘ C, Ctrl Tab…) pass through untouched.
    if control != Control::Shift && (event.meta_key() || event.ctrl_key() || event.alt_key()) {
      return;
    }
    event.prevent_default();
    if event.repeat() {
      return;
    }
    hotkeys.press(&code, control);
  } else if hotkeys.is_down(&code) {
    event.prevent_default();
    hotkeys.release(&code);
  }
}

/// ⌘ (Ctrl off a Mac) with S or ⌫ presses Save or Delete in place of what
/// the browser would do, with Shift held its Shift job; ⌘D the Debug
/// panel.
fn on_command(event: &KeyboardEvent) {
  if !(event.meta_key() || event.ctrl_key()) || event.alt_key() {
    return;
  }
  let code = event.code();
  if code == DEBUG_CODE {
    event.prevent_default();
    if !event.repeat() {
      chrome().toggle_debug();
    }
    return;
  }
  let tool = match code.as_str() {
    "KeyS" => Tool::Save,
    "Backspace" => Tool::Delete,
    _ => return,
  };
  event.prevent_default();
  if event.repeat() || app().feedback.is_busy() {
    return;
  }
  let shift = event.shift_key() || fluid::untrack(|| app().shift.shift());
  crate::modes::press(Control::Tool(tool), Some(shift));
}

/// Listens to the page for what plays the Device: the first gesture that starts
/// audio, keys, the window losing focus or the page hiding, and the system
/// theme changing.
pub fn listen_to_page(router: &'static Router) {
  let window = window();
  let home = move || fluid::untrack(|| router.page()) == Page::Home;

  // Browsers keep audio off until a gesture; any on the Device's page
  // starts it (or resumes it), wherever it lands.
  for name in ["pointerup", "keydown", "touchend"] {
    listen(
      &window,
      name,
      ListenerOptions::new().capture(),
      move |_: Event| {
        if home() {
          app().engine.unlock();
        }
      },
    )
    .forget();
  }
  listen(
    &window,
    "keydown",
    ListenerOptions::new(),
    move |event: KeyboardEvent| {
      if !home() {
        return;
      }
      on_command(&event);
      on_key(&event, true);
    },
  )
  .forget();
  listen(
    &window,
    "keyup",
    ListenerOptions::new(),
    move |event: KeyboardEvent| {
      on_key(&event, false);
    },
  )
  .forget();

  // Keys let go while the page is in the background never send a keyup,
  // so everything lets go, and nothing is left sounding.
  let let_go = || {
    let a = app();
    fluid::batch(|| {
      a.hotkeys.release_all();
      a.performance.let_go();
    });
  };
  listen(&window, "blur", ListenerOptions::new(), move |_: Event| {
    let_go()
  })
  .forget();
  listen(
    &document(),
    "visibilitychange",
    ListenerOptions::new(),
    move |_: Event| {
      if document().hidden() {
        let_go();
      }
    },
  )
  .forget();

  if let Some(query) = system_dark_query() {
    let matches = query.clone();
    listen(&query, "change", ListenerOptions::new(), move |_: Event| {
      chrome().system_dark.set(matches.matches());
    })
    .forget();
  }
}
