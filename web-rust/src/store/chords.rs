//! The chord pads' chords and how they play them, as web-react's
//! `chordStore.ts`: which chord each pad plays, the play style, and the
//! play styles saved from the Device.

use std::rc::Rc;

use fluid::Signal;
use serde_json::Value;

use super::session::now;
use super::storage::{load, load_as, save};
use crate::logic::chords::{DEFAULT_PAD_CHORDS, is_chord};
use crate::logic::play_styles::{PlayStyle, SavedPlayStyle, play_style_spec};
use crate::logic::tracks::base36;

/// Where the chord pads' chords are kept: six chord ids, in pad order.
pub const PAD_CHORDS_KEY: &str = "studio.padChords";
/// Where the play style is kept.
pub const PLAY_STYLE_KEY: &str = "studio.playStyle";
/// Where the play styles saved from the Device are kept.
pub const PLAY_STYLES_KEY: &str = "studio.playStyles";

/// The chord pads' built-in chords.
fn default_chords() -> Vec<String> {
  DEFAULT_PAD_CHORDS
    .iter()
    .map(|id| (*id).to_owned())
    .collect()
}

/// The chord pads' chords as kept, each one that isn't a chord (or missing)
/// back on its built-in one.
fn read_chords() -> Vec<String> {
  let Some(Value::Array(stored)) = load(PAD_CHORDS_KEY) else {
    return default_chords();
  };
  // Four chords, from before there were six, go on the rightmost four
  // pads, the most played.
  let chords: Vec<Option<&str>> = if stored.len() == 4 {
    [None, None]
      .into_iter()
      .chain(stored.iter().map(Value::as_str))
      .collect()
  } else {
    stored.iter().map(Value::as_str).collect()
  };
  DEFAULT_PAD_CHORDS
    .iter()
    .enumerate()
    .map(|(i, fallback)| {
      chords
        .get(i)
        .copied()
        .flatten()
        .filter(|id| is_chord(id))
        .unwrap_or(fallback)
        .to_owned()
    })
    .collect()
}

/// The chord pads, as web-react's `chordStore.ts`: which chord each pad plays,
/// the play style they play in, and the play styles saved from the Device, each
/// kept in `localStorage` whenever it changes.
///
/// Its methods set a pad's chord or put them all back, set the play style, and
/// save, update or delete saved play styles.
pub struct ChordStore {
  /// Which chord each chord pad plays, by chord id.
  pub pad_chords: Rc<Signal<Vec<String>>>,
  pub play_style: Rc<Signal<PlayStyle>>,
  pub saved_styles: Rc<Signal<Vec<SavedPlayStyle>>>,
}

impl ChordStore {
  /// Reads what was kept, falling back to the built-in chords and the block
  /// style for anything missing or invalid.
  pub fn load() -> Self {
    let saved = match load(PLAY_STYLES_KEY) {
      Some(Value::Array(items)) => items
        .into_iter()
        .filter_map(|item| serde_json::from_value::<SavedPlayStyle>(item).ok())
        .filter(SavedPlayStyle::is_valid)
        .collect(),
      _ => Vec::new(),
    };
    Self {
      pad_chords: Rc::new(Signal::new(read_chords())),
      play_style: Rc::new(Signal::new(
        load_as::<PlayStyle>(PLAY_STYLE_KEY)
          .filter(PlayStyle::is_valid)
          .unwrap_or_default(),
      )),
      saved_styles: Rc::new(Signal::new(saved)),
    }
  }

  /// Changes the pads' chords and keeps them.
  fn set_chords(&self, change: impl FnOnce(&mut Vec<String>)) {
    self.pad_chords.update(|chords| {
      change(chords);
      save(PAD_CHORDS_KEY, chords);
    });
  }

  /// Puts every chord pad back on its built-in chord, played as a block.
  pub fn reset_pad_chords(&self) {
    self.set_chords(|chords| *chords = default_chords());
    self.set_play_style(|style| {
      *style = PlayStyle::default();
    });
  }

  /// Puts chord `id` on pad `index`.
  pub fn set_pad_chord(&self, index: usize, id: &str) {
    self.set_chords(|chords| {
      if let Some(slot) = chords.get_mut(index) {
        *slot = id.into();
      }
    });
  }

  /// Changes the play style and keeps it.
  pub fn set_play_style(&self, change: impl FnOnce(&mut PlayStyle)) {
    self.play_style.update(|style| {
      change(style);
      save(PLAY_STYLE_KEY, style);
    });
  }

  /// Changes the saved play styles and keeps them.
  fn write_saved(&self, change: impl FnOnce(&mut Vec<SavedPlayStyle>)) {
    self.saved_styles.update(|saved| {
      change(saved);
      save(PLAY_STYLES_KEY, saved);
    });
  }

  /// Saves `style` as a new play style, named for its pattern with the next
  /// free number ("Strum 2"), and plays it as that.
  pub fn save_play_style(&self, style: &PlayStyle) -> SavedPlayStyle {
    let base = play_style_spec(&style.id).name;
    let taken: Vec<String> = self
      .saved_styles
      .with_untracked(|saved| saved.iter().map(|saved| saved.name.clone()).collect());
    let mut n = 2;
    while taken.contains(&format!("{base} {n}")) {
      n += 1;
    }
    let made = SavedPlayStyle {
      id: format!("style-{}", base36(now() as u64)),
      name: format!("{base} {n}"),
      pattern: style.id.clone(),
      per_beat: style.per_beat,
      strum: style.strum,
    };
    self.write_saved(|saved| saved.push(made.clone()));
    self.set_play_style(|style| style.saved = Some(made.id.clone()));
    made
  }

  /// Stores `style`'s rate and strum in the saved play style it is.
  pub fn update_play_style(&self, style: &PlayStyle) {
    self.write_saved(|saved| {
      for candidate in saved.iter_mut() {
        if Some(&candidate.id) == style.saved.as_ref() {
          candidate.per_beat = style.per_beat;
          candidate.strum = style.strum;
        }
      }
    });
  }

  /// Removes a saved play style; playing it falls back to its pattern.
  pub fn delete_play_style(&self, id: &str) {
    self.write_saved(|saved| saved.retain(|candidate| candidate.id != id));
    if self
      .play_style
      .with_untracked(|style| style.saved.as_deref() == Some(id))
    {
      self.set_play_style(|style| style.saved = None);
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::store::storage;

  #[test]
  fn four_old_chords_go_on_the_right() {
    storage::clear();
    save(PAD_CHORDS_KEY, &["maj", "min", "nope", "7"]);
    assert_eq!(
      ChordStore::load().pad_chords.cloned(),
      vec!["sus4", "maj7", "maj", "min", "min", "7"]
    );
  }

  #[test]
  fn saved_styles_take_the_next_number() {
    storage::clear();
    let store = ChordStore::load();
    let strum = PlayStyle {
      id: "strum".into(),
      ..PlayStyle::default()
    };
    assert_eq!(store.save_play_style(&strum).name, "Strum 2");
    let second = store.save_play_style(&strum);
    assert_eq!(second.name, "Strum 3");
    assert_eq!(store.play_style.cloned().saved, Some(second.id.clone()));
    assert_eq!(ChordStore::load().saved_styles.cloned().len(), 2);
    store.delete_play_style(&second.id);
    assert_eq!(store.play_style.cloned().saved, None);
  }
}
