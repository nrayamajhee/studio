//! Notices, prompts, the level overlay and second-press confirmations on
//! the Device's screen, and freezing it while the mix saves, as web-react's
//! `FeedbackProvider`.

use std::cell::{Cell, RefCell};
use std::rc::Rc;

use fluid::Signal;
use gloo_timers::callback::Timeout;

const NOTICE_MS: u32 = 1800;
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
  fn new(ms: u32) -> Self {
    Self {
      value: Rc::new(Signal::new(None)),
      timer: RefCell::new(None),
      ms,
    }
  }

  pub fn get(&self) -> Option<T> {
    self.value.cloned()
  }

  pub fn show(&self, next: T) {
    self.value.set(Some(next));
    let value = self.value.clone();
    *self.timer.borrow_mut() = Some(Timeout::new(self.ms, move || value.set(None)));
  }

  pub fn hide(&self) {
    self.timer.borrow_mut().take();
    if self.value.with_untracked(Option::is_some) {
      self.value.set(None);
    }
  }
}

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

  pub fn show_notice(&self, message: impl Into<String>) {
    fluid::batch(|| {
      self.prompt.hide();
      self.notice.show(message.into());
    });
  }

  pub fn show_prompt(&self, message: impl Into<String>) {
    self.prompt.show(message.into());
  }

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

  pub fn is_busy(&self) -> bool {
    self.busy.get()
  }

  pub fn set_busy(&self, busy: bool) {
    self.busy.set(busy);
    if !busy {
      self.progress.set(None);
    }
  }

  pub fn show_progress(&self, done: f64) {
    self.progress.set(Some(ScreenOverlay {
      label: "Saving".into(),
      value: Some(done),
      display: Some(format!("{}%", crate::logic::js::round(done * 100.))),
    }));
  }
}
