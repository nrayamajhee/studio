//! The docs sidebar's folded folders, by path, kept in `localStorage` under
//! web-react's key so they stay folded from page to page and visit to visit.

use std::rc::Rc;

use fluid::Signal;
use gloo_utils::window;

/// Where the sidebar's folded folders are kept, as web-react keeps them.
pub const DOCS_COLLAPSED_KEY: &str = "studio.docsCollapsed";

thread_local! {
  static COLLAPSED: Rc<Signal<Vec<String>>> = Rc::new(Signal::new(read()));
}

/// The folded folders, as a signal.
pub fn collapsed() -> Rc<Signal<Vec<String>>> {
  COLLAPSED.with(Rc::clone)
}

/// Folds exactly the folders in `next`, and keeps them.
pub fn set_collapsed(next: Vec<String>) {
  // Storage can be unavailable (private mode); the change still applies.
  if let (Ok(Some(storage)), Ok(json)) = (window().local_storage(), serde_json::to_string(&next)) {
    let _ = storage.set_item(DOCS_COLLAPSED_KEY, &json);
  }
  collapsed().set(next);
}

/// The folded folders kept.
fn read() -> Vec<String> {
  window()
    .local_storage()
    .ok()
    .flatten()
    .and_then(|storage| storage.get_item(DOCS_COLLAPSED_KEY).ok().flatten())
    .and_then(|json| serde_json::from_str(&json).ok())
    .unwrap_or_default()
}
