//! Shift: held on its key, or latched by a click until it is used, as
//! web-react's `ShiftProvider`.

use std::rc::Rc;

use fluid::Signal;

use super::app;

pub struct Shift {
  pub latched: Rc<Signal<bool>>,
}

impl Shift {
  pub fn new() -> Self {
    Self {
      latched: Rc::new(Signal::new(false)),
    }
  }

  /// Whether Shift is on, from its key or its latch.
  pub fn shift(&self) -> bool {
    self.latched.value() || app().hotkeys.held.with(|held| held.shift)
  }

  pub fn toggle_latch(&self) {
    self.latched.update(|latched| *latched = !*latched);
  }

  pub fn release(&self) {
    self.latched.set_if_changed(false);
  }
}
