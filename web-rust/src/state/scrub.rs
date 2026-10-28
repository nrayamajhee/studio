//! Scrubbing a rendered take or mix at the drag's speed, as web-react's
//! `useScrub` and `useMixScrub`: what is scrubbed is rendered once, the
//! first time it is scrubbed after it changes (a window of it either side
//! of the scrub, for the mix), and moves while it renders are silent.

use std::cell::{Cell, RefCell};
use std::future::Future;
use std::pin::Pin;
use std::rc::Rc;

use sound_engine::host::Scrubber;
use wasm_bindgen_futures::spawn_local;
use web_sys::AudioBuffer;

use super::app;
use super::clock::now;

/// Moves this far apart (ms) are separate drags: the speed is taken over at
/// most this long, so a single knob detent plays its stretch audibly.
const GAP_MS: f64 = 250.;

/// What renders the audio for a window from `start` to `end` ms.
pub type Render = Box<dyn Fn(f64, f64) -> Pin<Box<dyn Future<Output = Option<AudioBuffer>>>>>;

struct Window {
  key: String,
  start: f64,
  end: f64,
  scrubber: Rc<RefCell<Option<Scrubber>>>,
}

pub struct Scrub {
  rendered: RefCell<Option<Window>>,
  last_move: Cell<f64>,
  /// Where the last scroll left it (ms), ahead of the render it schedules,
  /// so quick wheel moves add up.
  cursor: Cell<f64>,
  /// How much either side of the scrub is built at a time; none builds the
  /// whole of it.
  window: Option<f64>,
}

impl Scrub {
  /// A take's scrub: rendered whole.
  pub fn whole() -> Self {
    Self::new(None)
  }

  /// The mix's: 30 s either side of the scrub.
  pub fn windowed() -> Self {
    Self::new(Some(30_000.))
  }

  fn new(window: Option<f64>) -> Self {
    Self {
      rendered: RefCell::new(None),
      last_move: Cell::new(0.),
      cursor: Cell::new(0.),
      window,
    }
  }

  /// The drag moved from `from` to `to` (ms); `key` names everything that
  /// shapes the sound, so a change renders it again.
  fn play(&self, key: &str, from: f64, to: f64, render: &Render) {
    let stale = match &*self.rendered.borrow() {
      None => true,
      Some(window) => window.key != key || to < window.start || to > window.end,
    };
    if stale {
      if let Some(window) = self.rendered.borrow_mut().take()
        && let Some(scrubber) = window.scrubber.borrow().as_ref()
      {
        scrubber.stop();
      }
      let (start, end) = match self.window {
        Some(window) => ((to - window).max(0.), to + window),
        None => (0., f64::INFINITY),
      };
      let scrubber: Rc<RefCell<Option<Scrubber>>> = Rc::default();
      *self.rendered.borrow_mut() = Some(Window {
        key: key.into(),
        start,
        end,
        scrubber: scrubber.clone(),
      });
      app().engine.unlock();
      let rendering = render(start, end);
      spawn_local(async move {
        if let Some(buffer) = rendering.await {
          *scrubber.borrow_mut() = app().engine.scrubber(&buffer);
        }
      });
    }
    let at = now();
    let elapsed = GAP_MS.min(at - self.last_move.get());
    self.last_move.set(at);
    if let Some(window) = self.rendered.borrow().as_ref()
      && let Some(scrubber) = window.scrubber.borrow().as_ref()
    {
      scrubber.move_to(
        (from - window.start) / 1000.,
        (to - window.start) / 1000.,
        (to - from) / elapsed,
      );
    }
  }

  pub fn stop(&self) {
    if let Some(window) = self.rendered.borrow().as_ref()
      && let Some(scrubber) = window.scrubber.borrow().as_ref()
    {
      scrubber.stop();
    }
  }

  fn from(&self, at: f64) -> f64 {
    if now() - self.last_move.get() < GAP_MS {
      self.cursor.get()
    } else {
      at
    }
  }

  /// Scrolls to `to` from where it is (`at`, unless a scroll is still
  /// landing).
  pub fn scroll_to(&self, key: &str, to: f64, at: f64, render: &Render) {
    let start = self.from(at);
    self.cursor.set(to);
    self.play(key, start, to, render);
  }

  /// Scrolls by `ms` within [low, high]; returns where it lands.
  pub fn scroll_by(
    &self,
    key: &str,
    ms: f64,
    at: f64,
    low: f64,
    high: f64,
    render: &Render,
  ) -> f64 {
    let to = (self.from(at) + ms).max(low).min(high);
    self.scroll_to(key, to, at, render);
    to
  }
}
