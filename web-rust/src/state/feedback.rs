//! Notices, prompts, the level overlay and second-press confirmations on
//! the Device's screen, and freezing it while the mix saves, as web-react's
//! `FeedbackProvider`.

use std::cell::{Cell, RefCell};
use std::rc::Rc;

use fluid::Signal;
use gloo_timers::callback::Timeout;

/// How long a footer notice, a prompt and an armed second press last (ms).
const NOTICE_MS: u32 = 1800;
/// How long the level overlay stays after the last change (ms).
const OVERLAY_MS: u32 = 1200;

/// A level shown over the current view, e.g. the volume while it changes.
/// Without a value it is a message alone, e.g. asking for a second press.
#[derive(Clone, Debug, PartialEq)]
pub struct ScreenOverlay {
  pub label: String,
  /// 0–1.
  pub value: Option<f64>,
  pub display: Option<String>,
}

/// A value that shows for a while after the last `show`, e.g. a footer
/// notice or the level overlay while a knob turns.
pub struct Momentary<T: 'static> {
  pub value: Rc<Signal<Option<T>>>,
  timer: RefCell<Option<Timeout>>,
  ms: u32,
}

impl<T: Clone + 'static> Momentary<T> {
  /// Hidden, showing each value for `ms` after it's shown.
  fn new(ms: u32) -> Self {
    Self {
      value: Rc::new(Signal::new(None)),
      timer: RefCell::new(None),
      ms,
    }
  }

  /// The value showing, if any, tracked.
  pub fn get(&self) -> Option<T> {
    self.value.cloned()
  }

  /// Shows `next`, restarting the time it stays for.
  pub fn show(&self, next: T) {
    self.value.set(Some(next));
    let value = self.value.clone();
    *self.timer.borrow_mut() = Some(Timeout::new(self.ms, move || value.set(None)));
  }

  /// Hides the value now, and stops its timer.
  pub fn hide(&self) {
    self.timer.borrow_mut().take();
    if self.value.with_untracked(Option::is_some) {
      self.value.set(None);
    }
  }
}

/// What the screen says back, as web-react's `FeedbackProvider`: the level
/// overlay while a knob turns, footer notices, prompts over the screen, second
/// presses waiting to be confirmed, and the progress overlay that freezes the
/// Device while the mix saves.
///
/// [`Feedback::show_notice`], [`Feedback::show_prompt`] and
/// [`Feedback::show_overlay`] show a message for a while; [`Feedback::confirm`]
/// arms a press that acts only when pressed again; [`Feedback::set_busy`] and
/// [`Feedback::show_progress`] freeze the Device and say how far the save has
/// got.
pub struct Feedback {
  pub overlay: Momentary<ScreenOverlay>,
  pub notice: Momentary<String>,
  /// What needs attention shows over the screen, like the volume: "Press
  /// again to…" for as long as the second press counts, and what to do
  /// first when a press can't act.
  pub prompt: Momentary<String>,
  /// A press that acts only on a second press (delete, bind, revert…),
  /// armed while its prompt shows.
  pub pending: Momentary<String>,
  busy: Cell<bool>,
  /// While the mix saves, the Device freezes under an overlay of its
  /// progress.
  pub progress: Rc<Signal<Option<ScreenOverlay>>>,
}

impl Feedback {
  /// Nothing showing, and not busy.
  pub fn new() -> Self {
    Self {
      overlay: Momentary::new(OVERLAY_MS),
      notice: Momentary::new(NOTICE_MS),
      prompt: Momentary::new(NOTICE_MS),
      pending: Momentary::new(NOTICE_MS),
      busy: Cell::new(false),
      progress: Rc::new(Signal::new(None)),
    }
  }

  /// Shows `message` in the footer for a while, clearing any prompt.
  pub fn show_notice(&self, message: impl Into<String>) {
    fluid::batch(|| {
      self.prompt.hide();
      self.notice.show(message.into());
    });
  }

  /// Shows `message` over the screen for a while.
  pub fn show_prompt(&self, message: impl Into<String>) {
    self.prompt.show(message.into());
  }

  /// Shows a level over the screen while it changes.
  pub fn show_overlay(&self, overlay: ScreenOverlay) {
    self.overlay.show(overlay);
  }

  /// Whether `key` is armed for its second press.
  pub fn is_pending(&self, key: &str) -> bool {
    self
      .pending
      .value
      .with(|pending| pending.as_deref() == Some(key))
  }

  /// True on the second press of `key` while it is armed; otherwise arms it
  /// and asks for that press.
  pub fn confirm(&self, key: &str, message: &str) -> bool {
    if self
      .pending
      .value
      .with_untracked(|pending| pending.as_deref() == Some(key))
    {
      self.pending.hide();
      return true;
    }
    fluid::batch(|| {
      self.pending.show(key.into());
      self.show_prompt(message);
    });
    false
  }

  /// Whether the mix is saving, when every press is ignored.
  pub fn is_busy(&self) -> bool {
    self.busy.get()
  }

  /// Freezes the Device while the mix saves, or thaws it and clears the
  /// progress.
  pub fn set_busy(&self, busy: bool) {
    self.busy.set(busy);
    if !busy {
      self.progress.set(None);
    }
  }

  /// Shows how far the save has got, `done` from 0 to 1.
  pub fn show_progress(&self, done: f64) {
    self.progress.set(Some(ScreenOverlay {
      label: "Saving".into(),
      value: Some(done),
      display: Some(format!("{}%", crate::logic::js::round(done * 100.))),
    }));
  }
}
