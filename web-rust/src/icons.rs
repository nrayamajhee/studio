//! The Device's icons as SVG markup, set with `set_inner_html` since fluid
//! creates HTML elements only. Lucide icons and the Device's own drawings,
//! as web-react renders them: the pads' and screens' come from
//! `data/icons.json` (see `scripts/export-data.tsx`), the page's own few are
//! here.

use std::collections::HashMap;
use std::sync::OnceLock;

use serde::Deserialize;

/// What a pad, tile or key shows: an icon, or text.
#[derive(Clone, Debug, Default, PartialEq)]
pub enum Icon {
  #[default]
  None,
  /// A lucide icon by name, as React renders `<Play />`.
  Lucide(&'static str),
  /// The same filled with the current colour, as `<Play fill="currentColor" />`.
  Filled(&'static str),
  /// One of the Device's own drawings: Tracks, TapeDeck, Take, PianoRoll,
  /// DrumGrid, Adsr.
  Device(&'static str),
  /// A preset's icon by its key, or the key as text when it isn't one.
  Preset(String),
  /// How a play style plays a chord, as a little piano roll.
  PlayStyle(String),
  /// A drum piece's icon, or for a hand-drum stroke its syllable.
  Piece(String),
  Text(String),
}

#[derive(Deserialize)]
struct Piece {
  name: String,
  icon: Option<String>,
}

#[derive(Deserialize)]
struct Icons {
  lucide: HashMap<String, String>,
  device: HashMap<String, String>,
  presets: Vec<(String, String)>,
  #[serde(rename = "playStyles")]
  play_styles: HashMap<String, String>,
  pieces: HashMap<String, Piece>,
}

fn icons() -> &'static Icons {
  static ICONS: OnceLock<Icons> = OnceLock::new();
  ICONS.get_or_init(|| {
    serde_json::from_str(include_str!("../data/icons.json")).expect("data/icons.json parses")
  })
}

/// The preset icons the Save view offers, in its order.
pub fn preset_icon_keys() -> impl Iterator<Item = &'static str> {
  icons().presets.iter().map(|(key, _)| key.as_str())
}

/// A drum piece's name, as a key shows it with a kit.
pub fn piece_name(piece: &str) -> &'static str {
  icons()
    .pieces
    .get(piece)
    .map_or("", |piece| piece.name.as_str())
}

fn escape(text: &str) -> String {
  text
    .replace('&', "&amp;")
    .replace('<', "&lt;")
    .replace('>', "&gt;")
}

impl Icon {
  /// The icon as markup to set as a node's inner HTML: SVG, or escaped
  /// text.
  pub fn markup(&self) -> String {
    let icons = icons();
    match self {
      Self::None => String::new(),
      Self::Lucide(name) => icons.lucide.get(*name).cloned().unwrap_or_default(),
      Self::Filled(name) => icons
        .lucide
        .get(*name)
        .map(|svg| svg.replacen(r#"fill="none""#, r#"fill="currentColor""#, 1))
        .unwrap_or_default(),
      Self::Device(name) => icons.device.get(*name).cloned().unwrap_or_default(),
      Self::Preset(key) => icons
        .presets
        .iter()
        .find(|(candidate, _)| candidate == key)
        .map_or_else(|| escape(key), |(_, svg)| svg.clone()),
      Self::PlayStyle(id) => icons.play_styles.get(id).cloned().unwrap_or_default(),
      Self::Piece(id) => match icons.pieces.get(id) {
        Some(Piece {
          icon: Some(svg), ..
        }) => svg.clone(),
        Some(piece) => escape(&piece.name),
        None => escape(id),
      },
      Self::Text(text) => escape(text),
    }
  }

  /// Whether it draws nothing.
  pub fn is_none(&self) -> bool {
    matches!(self, Self::None)
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn icons_render_as_react_renders_them() {
    assert!(Icon::Lucide("Play").markup().contains("lucide-play"));
    assert!(
      Icon::Filled("Play")
        .markup()
        .contains(r#"fill="currentColor""#)
    );
    assert!(Icon::Preset("piano".into()).markup().starts_with("<svg"));
    assert_eq!(Icon::Preset("A&B".into()).markup(), "A&amp;B");
    assert_eq!(Icon::Piece("na".into()).markup(), "Na");
    assert!(Icon::Piece("kick".into()).markup().starts_with("<svg"));
    assert!(
      Icon::PlayStyle("alberti".into())
        .markup()
        .starts_with("<svg")
    );
    assert!(Icon::Device("Tracks").markup().starts_with("<svg"));
    assert_eq!(preset_icon_keys().next(), Some("piano"));
    assert_eq!(piece_name("closedHat"), "Closed hat");
  }
}

pub const KEYBOARD_MUSIC: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="M6 8h4"></path><path d="M14 8h.01"></path><path d="M18 8h.01"></path><path d="M2 12h20"></path><path d="M6 12v4"></path><path d="M10 12v4"></path><path d="M14 12v4"></path><path d="M18 12v4"></path></svg>"#;
pub const MOON: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"></path></svg>"#;
pub const SUN: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>"#;

/// Lucide icons for the Debug panel and the docs, as their inner markup;
/// [`crate::ui::icon`] wraps one in its `<svg>` with a class.
pub const ARROW_LEFT: (&str, &str) = (
  "arrow-left",
  r#"<path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path>"#,
);
pub const CHECK: (&str, &str) = ("check", r#"<path d="M20 6 9 17l-5-5"></path>"#);
pub const CHEVRON_RIGHT: (&str, &str) = ("chevron-right", r#"<path d="m9 18 6-6-6-6"></path>"#);
pub const CHEVRONS_DOWN_UP: (&str, &str) = (
  "chevrons-down-up",
  r#"<path d="m7 20 5-5 5 5"></path><path d="m7 4 5 5 5-5"></path>"#,
);
pub const CHEVRONS_UP_DOWN: (&str, &str) = (
  "chevrons-up-down",
  r#"<path d="m7 15 5 5 5-5"></path><path d="m7 9 5-5 5 5"></path>"#,
);
pub const COPY: (&str, &str) = (
  "copy",
  r#"<rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>"#,
);
pub const FILE_TEXT: (&str, &str) = (
  "file-text",
  r#"<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"></path><path d="M14 2v5a1 1 0 0 0 1 1h5"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path>"#,
);
pub const MENU: (&str, &str) = (
  "menu",
  r#"<path d="M4 5h16"></path><path d="M4 12h16"></path><path d="M4 19h16"></path>"#,
);
pub const X: (&str, &str) = (
  "x",
  r#"<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>"#,
);
