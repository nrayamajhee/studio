//! The Device's keyboard, as web-react's `HotkeyProvider`: every mapped key
//! that is down (any number at once, by `KeyboardEvent.code`, and MIDI
//! pads), published as a signal for drawing, and each press and release
//! handed to the Device as it happens.

use std::cell::RefCell;
use std::rc::Rc;

use fluid::Signal;
use indexmap::IndexMap;

use super::app;
use super::keymap::Control;

/// The keys held right now.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct HeldKeys {
  /// Controls whose keys are down, in the order they went down.
  pub controls: Vec<Control>,
  /// The chord key pressed most recently that is still down.
  pub chord: Option<usize>,
  pub shift: bool,
}

impl HeldKeys {
  /// Whether `control`'s key is down (and not ignored).
  pub fn is_held(&self, control: Control) -> bool {
    self.controls.contains(&control)
  }
}

/// A key that's down: the control it presses, and whether it stopped counting
/// as held (see [`HotkeyEvent::ignore`]).
#[derive(Clone, Copy)]
struct Down {
  control: Control,
  ignored: bool,
}

/// A press or release, with the keys down at that moment (this one
/// included, on a press), read before anything redraws, so a chord key and
/// a note key pressed together agree.
pub struct HotkeyEvent<'a> {
  pub control: Control,
  pub down: bool,
  pub held: HeldKeys,
  code: &'a str,
}

impl HotkeyEvent<'_> {
  /// Stops this key counting as held until it comes up, e.g. when pressing
  /// it releases a latch instead.
  pub fn ignore(&self) {
    let hotkeys = &app().hotkeys;
    if let Some(down) = hotkeys.keys.borrow_mut().get_mut(self.code) {
      down.ignored = true;
    }
  }
}

/// The keys down right now, as web-react's `HotkeyProvider`: each by its
/// `KeyboardEvent.code` (or a MIDI pad's), in the order they went down.
///
/// [`Hotkeys::press`] and [`Hotkeys::release`] hand each change to the Device
/// as it happens ([`crate::state::App::hotkey`]), with what's held at that
/// moment, then publish what's held as [`Hotkeys::held`] for drawing.
/// [`Hotkeys::release_all`] lets go of everything when the page loses focus.
pub struct Hotkeys {
  keys: RefCell<IndexMap<String, Down>>,
  pub held: Rc<Signal<HeldKeys>>,
}

/// What's held, from the keys down: their controls (ignored keys left out), the
/// latest chord key and whether Shift is down.
fn summarize(keys: &IndexMap<String, Down>) -> HeldKeys {
  let controls: Vec<Control> = keys
    .values()
    .filter(|down| !down.ignored)
    .map(|down| down.control)
    .collect();
  let chord = controls
    .iter()
    .filter_map(|control| match control {
      Control::Chord(index) => Some(*index),
      _ => None,
    })
    .next_back();
  HeldKeys {
    shift: controls.contains(&Control::Shift),
    controls,
    chord,
  }
}

impl Hotkeys {
  /// No keys down.
  pub fn new() -> Self {
    Self {
      keys: RefCell::default(),
      held: Rc::new(Signal::new(HeldKeys::default())),
    }
  }

  /// Hands a press or release of `code` to the Device.
  fn emit(&self, code: &str, control: Control, down: bool) {
    let held = summarize(&self.keys.borrow());
    app().hotkey(&HotkeyEvent {
      control,
      down,
      held,
      code,
    });
  }

  /// Publishes what's held, if it changed.
  fn publish(&self) {
    self.held.set_if_changed(summarize(&self.keys.borrow()));
  }

  /// A key went down: the Device hears it, unless it was already down (a
  /// key repeating).
  pub fn press(&self, code: &str, control: Control) {
    if self.keys.borrow().contains_key(code) {
      return;
    }
    self.keys.borrow_mut().insert(
      code.into(),
      Down {
        control,
        ignored: false,
      },
    );
    fluid::batch(|| {
      self.emit(code, control, true);
      self.publish();
    });
  }

  /// A key came up: the Device hears it, if it was down.
  pub fn release(&self, code: &str) {
    let Some(down) = self.keys.borrow_mut().shift_remove(code) else {
      return;
    };
    fluid::batch(|| {
      self.emit(code, down.control, false);
      self.publish();
    });
  }

  /// Whether the key `code` is down.
  pub fn is_down(&self, code: &str) -> bool {
    self.keys.borrow().contains_key(code)
  }

  /// Lets go of everything, telling the Device, so no note is left
  /// sounding.
  pub fn release_all(&self) {
    if self.keys.borrow().is_empty() {
      return;
    }
    let down: Vec<(String, Down)> = self.keys.borrow_mut().drain(..).collect();
    fluid::batch(|| {
      for (code, entry) in down {
        self.emit(&code, entry.control, false);
      }
      self.publish();
    });
  }
}
