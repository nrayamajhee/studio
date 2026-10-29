//! Shift: held on its key, or latched by a click until it is used, as
//! web-react's `ShiftProvider`.

use std::rc::Rc;

use fluid::Signal;

use super::app;

/// Shift, as web-react's `ShiftProvider`: on while its key is held, or latched
/// by a click until the next press uses it. [`Shift::shift`] says whether it's
/// on either way; the latch toggles and releases.
pub struct Shift {
  pub latched: Rc<Signal<bool>>,
}

impl Shift {
  /// Shift off and unlatched.
  pub fn new() -> Self {
    Self {
      latched: Rc::new(Signal::new(false)),
    }
  }

  /// Whether Shift is on, from its key or its latch.
  pub fn shift(&self) -> bool {
    self.latched.value() || app().hotkeys.held.with(|held| held.shift)
  }

  /// Latches Shift, or unlatches it.
  pub fn toggle_latch(&self) {
    self.latched.update(|latched| *latched = !*latched);
  }

  /// Lets go of the latch, once a press has used it.
  pub fn release(&self) {
    self.latched.set_if_changed(false);
  }
}
