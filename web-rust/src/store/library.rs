//! The preset library, as web-react's `presetStore.ts`: saved presets,
//! which preset each of the six instrument pads plays (and plays with
//! Shift), and the param edits made to each preset since it was picked.

use std::rc::Rc;

use fluid::Signal;
use indexmap::IndexMap;
use serde::Serialize;
use serde_json::Value;

use super::session::now;
use super::storage::{load, save};
use crate::logic::params::{Family, family, patch};
use crate::logic::presets::{
  DevicePreset, PRESET_CATEGORIES, Values, device_presets, preset_category,
};
use crate::logic::tracks::base36;

pub const PRESETS_KEY: &str = "studio.instruments";
/// Pad bindings stored under an older layout are dropped once, so every pad
/// starts on its built-in pair.
const PADS_VERSION: u32 = 3;
pub const INSTRUMENT_PADS: usize = 6;

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetLibrary {
  pub instruments: Vec<DevicePreset>,
  pub buttons: Vec<String>,
  pub shift_buttons: Vec<String>,
  /// Param changes made to each preset since it was picked, by preset id,
  /// kept apart from the preset itself so Reset can drop them.
  pub edits: IndexMap<String, Values>,
}

/// What the pads play at first, and with Shift a relative from the same
/// family, as the built-in presets place themselves.
fn pad_list(shift: bool) -> Vec<String> {
  (0..INSTRUMENT_PADS)
    .map(|pad| {
      device_presets()
        .iter()
        .find(|preset| if shift { preset.shift_pad } else { preset.pad } == Some(pad))
        .map_or_else(String::new, |preset| preset.id.clone())
    })
    .collect()
}

impl Default for PresetLibrary {
  fn default() -> Self {
    Self {
      instruments: Vec::new(),
      buttons: pad_list(false),
      shift_buttons: pad_list(true),
      edits: IndexMap::new(),
    }
  }
}

/// Ids older saved presets may hold for what is now the vibrato module,
/// with how each value carries over.
fn moved_to_vibrato(family: Family, id: &str) -> Option<(&'static str, bool)> {
  // `true` where the value was a fraction of the loop's length, now cents.
  match (family, id) {
    (Family::Bore | Family::Reed, "exciter.vibrato") => Some(("vibrato.level", false)),
    (Family::Bore | Family::Bowed | Family::Reed, "resonator.vibratoRate") => {
      Some(("vibrato.rate", false))
    }
    (Family::Bore, "resonator.pitchVibrato") | (Family::Bowed, "exciter.vibrato") => {
      Some(("vibrato.pitch", true))
    }
    _ => None,
  }
}

/// A wind or bow's vibrato depth as it used to be set, a fraction of the
/// loop's length, in cents.
fn ratio_to_cents(ratio: f64) -> f64 {
  1200. * (1. + ratio).log2()
}

/// Saved values with their ids brought up to date; a moved one never
/// replaces one already under its new id.
pub fn migrate_params(family: Family, values: &Values) -> Values {
  if family == Family::Drums {
    return values.clone();
  }
  let mut next = Values::new();
  for (id, &value) in values {
    // Briefly, the vibrato's params were lfo.*, the master LFO's ids.
    let target = moved_to_vibrato(family, id)
      .map(|(target, cents)| (target.to_owned(), cents))
      .or_else(|| {
        id.strip_prefix("lfo.")
          .map(|rest| (format!("vibrato.{rest}"), false))
      });
    match target {
      None => {
        next.insert(id.clone(), value);
      }
      Some((target, cents)) if !values.contains_key(&target) => {
        next.insert(target, if cents { ratio_to_cents(value) } else { value });
      }
      Some(_) => {}
    }
  }
  next
}

/// Numbers by id from a stored object, anything else dropped.
fn numbers(value: &Value) -> Values {
  value
    .as_object()
    .map(|fields| {
      fields
        .iter()
        .filter_map(|(id, value)| value.as_f64().map(|value| (id.clone(), value)))
        .collect()
    })
    .unwrap_or_default()
}

fn preset_of(value: &Value) -> Option<DevicePreset> {
  let mut preset: DevicePreset = serde_json::from_value(value.clone()).ok()?;
  sound_engine::patches::bus_index(&preset.target)?;
  if let Some(overrides) = value
    .get("overrides")
    .filter(|overrides| overrides.is_object())
  {
    preset.overrides = Some(migrate_params(
      family(patch(&preset.target)),
      &numbers(overrides),
    ));
  }
  Some(preset)
}

fn read() -> PresetLibrary {
  let defaults = PresetLibrary::default();
  let Some(stored) = load(PRESETS_KEY) else {
    return defaults;
  };
  let instruments: Vec<DevicePreset> = stored
    .get("instruments")
    .and_then(Value::as_array)
    .map(|items| items.iter().filter_map(preset_of).collect())
    .unwrap_or_default();
  let known = |id: &str| {
    device_presets().iter().any(|preset| preset.id == id)
      || instruments.iter().any(|preset| preset.id == id)
  };
  let current = stored.get("padsVersion").and_then(Value::as_u64) == Some(u64::from(PADS_VERSION));
  let pads = |field: &str, fallback: &[String]| -> Vec<String> {
    fallback
      .iter()
      .enumerate()
      .map(|(i, fallback)| {
        current
          .then(|| {
            stored
              .get(field)
              .and_then(|ids| ids.get(i))
              .and_then(Value::as_str)
          })
          .flatten()
          .filter(|id| known(id))
          .map_or_else(|| fallback.clone(), str::to_owned)
      })
      .collect()
  };
  let buttons = pads("buttons", &defaults.buttons);
  let shift_buttons = pads("shiftButtons", &defaults.shift_buttons);
  // Only finite values for params the preset's instrument has.
  let mut edits = IndexMap::new();
  for preset in device_presets().iter().chain(&instruments) {
    let Some(raw) = stored
      .get("edits")
      .and_then(|edits| edits.get(&preset.id))
      .filter(|raw| raw.is_object())
    else {
      continue;
    };
    let target = patch(&preset.target);
    let clean: Values = migrate_params(family(target), &numbers(raw))
      .into_iter()
      .filter(|(id, value)| {
        value.is_finite() && target.base().params.iter().any(|spec| &spec.id == id)
      })
      .collect();
    if !clean.is_empty() {
      edits.insert(preset.id.clone(), clean);
    }
  }
  PresetLibrary {
    instruments,
    buttons,
    shift_buttons,
    edits,
  }
}

/// The library as web-react stores it: pads still on their default preset
/// as null, so they follow later changes to the defaults.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Stored<'a> {
  instruments: &'a [DevicePreset],
  buttons: Vec<Option<&'a str>>,
  shift_buttons: Vec<Option<&'a str>>,
  edits: &'a IndexMap<String, Values>,
  pads_version: u32,
}

fn write(library: &PresetLibrary) {
  let defaults = PresetLibrary::default();
  let stored = |ids: &'_ [String], fallback: &[String]| -> Vec<Option<String>> {
    ids
      .iter()
      .zip(fallback)
      .map(|(id, fallback)| (id != fallback).then(|| id.clone()))
      .collect()
  };
  let buttons = stored(&library.buttons, &defaults.buttons);
  let shift_buttons = stored(&library.shift_buttons, &defaults.shift_buttons);
  save(
    PRESETS_KEY,
    &Stored {
      instruments: &library.instruments,
      buttons: buttons.iter().map(Option::as_deref).collect(),
      shift_buttons: shift_buttons.iter().map(Option::as_deref).collect(),
      edits: &library.edits,
      pads_version: PADS_VERSION,
    },
  );
}

/// Every preset by family, then the saved ones.
pub fn all_presets(library: &PresetLibrary) -> Vec<DevicePreset> {
  let all: Vec<&DevicePreset> = device_presets()
    .iter()
    .chain(&library.instruments)
    .collect();
  PRESET_CATEGORIES
    .iter()
    .flat_map(|category| {
      all
        .iter()
        .filter(move |preset| preset_category(preset) == *category)
        .map(|preset| (*preset).clone())
    })
    .collect()
}

pub struct LibraryStore {
  pub library: Rc<Signal<PresetLibrary>>,
}

impl LibraryStore {
  pub fn load() -> Self {
    Self {
      library: Rc::new(Signal::new(read())),
    }
  }

  fn update<R>(&self, change: impl FnOnce(&mut PresetLibrary) -> R) -> R {
    self.library.update(|library| {
      let result = change(library);
      write(library);
      result
    })
  }

  /// `name`, or with a number when another preset already has it.
  fn free_name(&self, name: &str, except: Option<&str>) -> String {
    let taken: Vec<String> = self.library.with_untracked(|library| {
      all_presets(library)
        .into_iter()
        .filter(|preset| Some(preset.id.as_str()) != except)
        .map(|preset| preset.name)
        .collect()
    });
    if !taken.iter().any(|taken| taken == name) {
      return name.into();
    }
    let mut n = 2;
    while taken.contains(&format!("{name} {n}")) {
      n += 1;
    }
    format!("{name} {n}")
  }

  /// Saves the base preset's instrument with the given param values, named
  /// `name` (how it sounds, e.g. "Pluck · LFO") or the next free numbered
  /// name.
  pub fn save_preset(
    &self,
    base: &DevicePreset,
    values: Values,
    icon: &str,
    name: &str,
  ) -> DevicePreset {
    let preset = DevicePreset {
      id: format!("user-{}", base36(now() as u64)),
      name: self.free_name(name, None),
      icon: icon.into(),
      user: true,
      overrides: Some(values),
      ..base.clone()
    };
    self.update(|library| library.instruments.push(preset.clone()));
    preset
  }

  pub fn update_preset(
    &self,
    preset: &DevicePreset,
    values: Values,
    icon: &str,
    name: &str,
  ) -> DevicePreset {
    let next = DevicePreset {
      name: self.free_name(name, Some(&preset.id)),
      icon: icon.into(),
      overrides: Some(values),
      ..preset.clone()
    };
    self.update(|library| {
      for saved in &mut library.instruments {
        if saved.id == preset.id {
          *saved = next.clone();
        }
      }
    });
    next
  }

  pub fn edits(&self, preset_id: &str) -> Option<Values> {
    self
      .library
      .with_untracked(|library| library.edits.get(preset_id).cloned())
  }

  /// Records one param change, or with `None` drops it (back to the
  /// preset's own value). A preset's edits move to the end, as web-react's
  /// spread puts them.
  pub fn set_edit(&self, preset_id: &str, param_id: &str, value: Option<f64>) {
    self.update(|library| {
      let mut rest = library.edits.shift_remove(preset_id).unwrap_or_default();
      rest.shift_remove(param_id);
      if let Some(value) = value {
        rest.insert(param_id.into(), value);
      }
      if !rest.is_empty() {
        library.edits.insert(preset_id.into(), rest);
      }
    });
  }

  /// Sets a preset's edits all at once (a track's own settings), dropping
  /// any it had.
  pub fn replace_edits(&self, preset_id: &str, edits: Values) {
    self.update(|library| {
      library.edits.shift_remove(preset_id);
      if !edits.is_empty() {
        library.edits.insert(preset_id.into(), edits);
      }
    });
  }

  pub fn clear_edits(&self, preset_id: &str) {
    self.update(|library| {
      library.edits.shift_remove(preset_id);
    });
  }

  /// Drops every preset's edits, so each sounds as it was built or saved.
  pub fn clear_all_edits(&self) {
    self.update(|library| library.edits.clear());
  }

  /// Puts every pad, and its Shift alternate, back on its built-in preset.
  pub fn reset_pads(&self) {
    self.update(|library| {
      let defaults = PresetLibrary::default();
      library.buttons = defaults.buttons;
      library.shift_buttons = defaults.shift_buttons;
    });
  }

  /// Binds a preset to a pad, or with `shift` to the pad's Shift
  /// alternate.
  pub fn bind_pad(&self, pad: usize, preset_id: &str, shift: bool) {
    self.update(|library| {
      let pads = if shift {
        &mut library.shift_buttons
      } else {
        &mut library.buttons
      };
      if let Some(slot) = pads.get_mut(pad) {
        *slot = preset_id.into();
      }
    });
  }

  /// Swaps a pad's preset and its Shift alternate, so the alternate shows
  /// first.
  pub fn swap_pad(&self, pad: usize) {
    self.update(|library| {
      if pad < INSTRUMENT_PADS {
        std::mem::swap(&mut library.buttons[pad], &mut library.shift_buttons[pad]);
      }
    });
  }

  /// Removes a saved preset with its edits; pads bound to it go back to
  /// their defaults. Built-in presets are never removed.
  pub fn delete_preset(&self, preset_id: &str) {
    if !self.library.with_untracked(|library| {
      library
        .instruments
        .iter()
        .any(|preset| preset.id == preset_id)
    }) {
      return;
    }
    self.update(|library| {
      let defaults = PresetLibrary::default();
      library.instruments.retain(|preset| preset.id != preset_id);
      for (pads, fallback) in [
        (&mut library.buttons, &defaults.buttons),
        (&mut library.shift_buttons, &defaults.shift_buttons),
      ] {
        for (id, fallback) in pads.iter_mut().zip(fallback) {
          if id == preset_id {
            *id = fallback.clone();
          }
        }
      }
      library.edits.shift_remove(preset_id);
    });
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::logic::presets::find_preset;
  use crate::store::storage;

  #[test]
  fn pads_start_on_their_built_ins() {
    let library = PresetLibrary::default();
    assert_eq!(
      library.buttons,
      vec![
        "piano",
        "electricFinger",
        "violin",
        "rockDrums",
        "drums808",
        "madal"
      ]
    );
    assert_eq!(
      library.shift_buttons,
      vec![
        "oscillator",
        "uprightBass",
        "flute",
        "jazzDrums",
        "drums909",
        "tabla"
      ]
    );
  }

  #[test]
  fn saves_binds_and_deletes() {
    storage::clear();
    let store = LibraryStore::load();
    let saved = store.save_preset(find_preset("piano"), Values::new(), "star", "Grand piano");
    assert_eq!(saved.name, "Grand piano 2");
    store.bind_pad(0, &saved.id, false);
    store.set_edit(&saved.id, "exciter.hardness", Some(0.5));
    let stored = storage::load(PRESETS_KEY).unwrap();
    assert_eq!(stored["buttons"][0], saved.id.as_str());
    assert!(stored["buttons"][1].is_null());
    assert_eq!(stored["padsVersion"], 3);
    let reloaded = LibraryStore::load().library.cloned();
    assert_eq!(reloaded.buttons[0], saved.id);
    assert!(reloaded.instruments[0].user);
    store.delete_preset(&saved.id);
    let library = store.library.cloned();
    assert_eq!(library.buttons[0], "piano");
    assert!(library.edits.is_empty());
  }

  #[test]
  fn old_vibrato_ids_migrate() {
    let mut values = Values::new();
    values.insert("exciter.vibrato".into(), 0.01);
    values.insert("lfo.rate".into(), 4.);
    values.insert("exciter.pressure".into(), 0.5);
    let next = migrate_params(Family::Bowed, &values);
    assert!((next["vibrato.pitch"] - 1200. * 1.01f64.log2()).abs() < 1e-9);
    assert_eq!(next["vibrato.rate"], 4.);
    assert_eq!(next["exciter.pressure"], 0.5);
  }

  #[test]
  fn all_presets_group_by_family() {
    let all = all_presets(&PresetLibrary::default());
    assert_eq!(all.len(), 35);
    assert_eq!(all[0].id, "piano");
    assert_eq!(preset_category(&all[34]), "Oscillator");
  }
}
