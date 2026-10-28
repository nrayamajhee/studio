//! The page around the Device: its theme (kept as web-react keeps it, a
//! JSON string under `theme`) and whether the Debug panel is open.

use std::cell::OnceCell;
use std::rc::Rc;

use fluid::Signal;
use gloo_utils::window;

use crate::store::storage;

const THEME_KEY: &str = "theme";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Theme {
  System,
  Light,
  Dark,
}

impl Theme {
  fn stored() -> Self {
    match storage::load(THEME_KEY)
      .as_ref()
      .and_then(|value| value.as_str())
    {
      Some("light") => Self::Light,
      Some("dark") => Self::Dark,
      _ => Self::System,
    }
  }

  pub fn name(self) -> &'static str {
    match self {
      Self::System => "system",
      Self::Light => "light",
      Self::Dark => "dark",
    }
  }

  pub fn is_dark(self, system_dark: bool) -> bool {
    match self {
      Self::System => system_dark,
      Self::Light => false,
      Self::Dark => true,
    }
  }

  /// The theme the toggle switches to: the other one from what shows now,
  /// as web-react's toggle does.
  pub fn next(self, system_dark: bool) -> Self {
    if self.is_dark(system_dark) {
      Self::Light
    } else {
      Self::Dark
    }
  }
}

pub struct Chrome {
  pub theme: Rc<Signal<Theme>>,
  /// Whether the system prefers dark, followed by the `System` theme.
  pub system_dark: Rc<Signal<bool>>,
  /// Whether the Debug panel is open over the page.
  pub debug: Rc<Signal<bool>>,
}

thread_local! {
  static CHROME: OnceCell<&'static Chrome> = const { OnceCell::new() };
}

pub fn chrome() -> &'static Chrome {
  CHROME.with(|chrome| *chrome.get().expect("the chrome is installed first"))
}

impl Chrome {
  pub fn install() -> &'static Chrome {
    let chrome: &'static Chrome = Box::leak(Box::new(Chrome {
      theme: Rc::new(Signal::new(Theme::stored())),
      system_dark: Rc::new(Signal::new(
        system_dark_query().is_some_and(|query| query.matches()),
      )),
      debug: Rc::new(Signal::new(false)),
    }));
    CHROME.with(|cell| {
      let _ = cell.set(chrome);
    });
    chrome
  }

  pub fn cycle_theme(&self) {
    let theme = self.theme.value().next(self.system_dark.value());
    storage::save(THEME_KEY, theme.name());
    self.theme.set(theme);
  }

  pub fn toggle_debug(&self) {
    self.debug.update(|open| *open = !*open);
  }
}

pub fn system_dark_query() -> Option<web_sys::MediaQueryList> {
  window()
    .match_media("(prefers-color-scheme: dark)")
    .ok()
    .flatten()
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn toggle_switches_away_from_what_shows() {
    assert_eq!(Theme::System.next(true), Theme::Light);
    assert_eq!(Theme::System.next(false), Theme::Dark);
    assert_eq!(Theme::Dark.next(false), Theme::Light);
  }
}
