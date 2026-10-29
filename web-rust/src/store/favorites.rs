//! The pickers that keep favorites, and each one's starred items, by id, in
//! the order starred, as web-react's `favoritesStore.ts`. They lead their
//! picker, on a page of their own.

use std::rc::Rc;

use fluid::Signal;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::storage::{load, save};

/// A picker that keeps favorites.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FavoriteKind {
  /// The instruments.
  Instruments,
  /// The chord palette.
  Chords,
  /// The play styles.
  PlayStyles,
  /// The progressions.
  Progressions,
  /// The drum beats.
  Beats,
}

/// Each picker's starred items by id, in the order starred, as web-react keeps
/// them under [`FAVORITES_KEY`].
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Favorites {
  pub instruments: Vec<String>,
  pub chords: Vec<String>,
  pub play_styles: Vec<String>,
  pub progressions: Vec<String>,
  pub beats: Vec<String>,
}

impl Favorites {
  /// `kind`'s starred ids.
  pub fn get(&self, kind: FavoriteKind) -> &Vec<String> {
    match kind {
      FavoriteKind::Instruments => &self.instruments,
      FavoriteKind::Chords => &self.chords,
      FavoriteKind::PlayStyles => &self.play_styles,
      FavoriteKind::Progressions => &self.progressions,
      FavoriteKind::Beats => &self.beats,
    }
  }

  /// `kind`'s starred ids, to change.
  fn get_mut(&mut self, kind: FavoriteKind) -> &mut Vec<String> {
    match kind {
      FavoriteKind::Instruments => &mut self.instruments,
      FavoriteKind::Chords => &mut self.chords,
      FavoriteKind::PlayStyles => &mut self.play_styles,
      FavoriteKind::Progressions => &mut self.progressions,
      FavoriteKind::Beats => &mut self.beats,
    }
  }
}

/// Where the favorites are kept.
pub const FAVORITES_KEY: &str = "studio.favorites";

/// Nishan's Picks, a page of their own after the favorites that can't be
/// changed.
pub fn nishans_picks(kind: FavoriteKind) -> &'static [&'static str] {
  match kind {
    FavoriteKind::Instruments | FavoriteKind::Chords => &[],
    FavoriteKind::PlayStyles => &[
      "block",
      "pulse",
      "accentPulse",
      "accentDownUp",
      "folkStrum",
      "upDown",
      "alberti",
    ],
    FavoriteKind::Progressions => &["fastCar", "suspended", "bornInTheUsa", "homecoming"],
    FavoriteKind::Beats => &[
      "newJackSwing",
      "madalNewJackSwing",
      "sixteenthHats",
      "madalKickKickHat",
      "loFi",
    ],
  }
}

/// The ids in a stored list, anything else dropped.
fn ids(value: Option<&Value>) -> Vec<String> {
  match value {
    Some(Value::Array(items)) => items
      .iter()
      .filter_map(|id| id.as_str().map(str::to_owned))
      .collect(),
    _ => Vec::new(),
  }
}

/// The favorites as kept, each picker's empty where nothing (valid) was.
fn read() -> Favorites {
  let Some(stored) = load(FAVORITES_KEY).filter(|stored| !stored.is_null()) else {
    return Favorites::default();
  };
  Favorites {
    instruments: ids(stored.get("instruments")),
    chords: ids(stored.get("chords")),
    play_styles: ids(stored.get("playStyles")),
    progressions: ids(stored.get("progressions")),
    beats: ids(stored.get("beats")),
  }
}

/// The favorites, as web-react's `favoritesStore.ts`: each picker's starred
/// items, kept in `localStorage` whenever they change.
/// [`FavoritesStore::toggle`] stars or unstars an item.
pub struct FavoritesStore {
  pub favorites: Rc<Signal<Favorites>>,
}

impl FavoritesStore {
  /// Reads the favorites kept.
  pub fn load() -> Self {
    Self {
      favorites: Rc::new(Signal::new(read())),
    }
  }

  /// Stars an item, or lets a starred one go; returns its picker's
  /// favorites as they are now.
  pub fn toggle(&self, kind: FavoriteKind, id: &str) -> Vec<String> {
    self.favorites.update(|favorites| {
      let list = favorites.get_mut(kind);
      match list.iter().position(|candidate| candidate == id) {
        Some(at) => {
          list.remove(at);
        }
        None => list.push(id.into()),
      }
      save(FAVORITES_KEY, favorites);
      favorites.get(kind).clone()
    })
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::store::storage;

  #[test]
  fn stars_in_the_order_starred() {
    storage::clear();
    let store = FavoritesStore::load();
    store.toggle(FavoriteKind::Beats, "loFi");
    assert_eq!(
      store.toggle(FavoriteKind::Beats, "boomTss"),
      vec!["loFi", "boomTss"]
    );
    assert_eq!(store.toggle(FavoriteKind::Beats, "loFi"), vec!["boomTss"]);
    assert_eq!(
      storage::raw(FAVORITES_KEY).as_deref(),
      Some(
        r#"{"instruments":[],"chords":[],"playStyles":[],"progressions":[],"beats":["boomTss"]}"#
      )
    );
    assert_eq!(
      FavoritesStore::load().favorites.cloned().beats,
      vec!["boomTss"]
    );
  }
}
