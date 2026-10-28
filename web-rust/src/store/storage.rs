//! `localStorage`, read and written as web-react does: JSON under the same
//! keys, with numbers written as JavaScript writes them (`96`, not `96.0`),
//! so either app reads what the other kept. Natively (in tests) it is an
//! in-memory map.

use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::{Number, Value};

#[cfg(target_arch = "wasm32")]
mod backend {
  fn storage() -> Option<web_sys::Storage> {
    web_sys::window()?.local_storage().ok().flatten()
  }

  pub fn get(key: &str) -> Option<String> {
    storage()?.get_item(key).ok().flatten()
  }

  /// Storage can be unavailable (private mode) or full; the change still
  /// applies in memory.
  pub fn set(key: &str, value: &str) {
    if let Some(storage) = storage() {
      let _ = storage.set_item(key, value);
    }
  }

  pub fn remove(key: &str) {
    if let Some(storage) = storage() {
      let _ = storage.remove_item(key);
    }
  }

  pub fn keys() -> Vec<String> {
    let Some(storage) = storage() else {
      return Vec::new();
    };
    let length = storage.length().unwrap_or(0);
    (0..length)
      .filter_map(|i| storage.key(i).ok().flatten())
      .collect()
  }
}

#[cfg(not(target_arch = "wasm32"))]
mod backend {
  use std::cell::RefCell;
  use std::collections::HashMap;

  thread_local! {
    static ITEMS: RefCell<HashMap<String, String>> = RefCell::default();
  }

  pub fn get(key: &str) -> Option<String> {
    ITEMS.with(|items| items.borrow().get(key).cloned())
  }

  pub fn set(key: &str, value: &str) {
    ITEMS.with(|items| items.borrow_mut().insert(key.into(), value.into()));
  }

  pub fn remove(key: &str) {
    ITEMS.with(|items| items.borrow_mut().remove(key));
  }

  pub fn clear() {
    ITEMS.with(|items| items.borrow_mut().clear());
  }

  pub fn keys() -> Vec<String> {
    ITEMS.with(|items| items.borrow().keys().cloned().collect())
  }
}

#[cfg(not(target_arch = "wasm32"))]
pub use backend::clear;

/// The JSON kept under `key`, if it parses.
pub fn load(key: &str) -> Option<Value> {
  serde_json::from_str(&backend::get(key)?).ok()
}

/// What is kept under `key` as `T`, if it is one.
pub fn load_as<T: DeserializeOwned>(key: &str) -> Option<T> {
  serde_json::from_value(load(key)?).ok()
}

/// The raw text kept under `key`.
pub fn raw(key: &str) -> Option<String> {
  backend::get(key)
}

pub fn save<T: Serialize + ?Sized>(key: &str, value: &T) {
  if let Ok(json) = to_json(value) {
    backend::set(key, &json);
  }
}

pub fn remove(key: &str) {
  backend::remove(key);
}

/// Drops every key starting with `prefix`.
pub fn remove_prefixed(prefix: &str) {
  for key in backend::keys() {
    if key.starts_with(prefix) {
      backend::remove(&key);
    }
  }
}

/// `value` as `JSON.stringify` writes it: whole numbers without a decimal
/// point.
pub fn to_json<T: Serialize + ?Sized>(value: &T) -> serde_json::Result<String> {
  let mut value = serde_json::to_value(value)?;
  js_numbers(&mut value);
  serde_json::to_string(&value)
}

/// Turns whole floats into integers, as JavaScript has one number type.
pub fn js_numbers(value: &mut Value) {
  match value {
    Value::Number(number) => {
      if let Some(float) = number.as_f64()
        && number.is_f64()
        && float.fract() == 0.
        && float.abs() < 9e15
      {
        *number = Number::from(float as i64);
      }
    }
    Value::Array(items) => items.iter_mut().for_each(js_numbers),
    Value::Object(fields) => fields.values_mut().for_each(js_numbers),
    _ => {}
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn numbers_are_written_as_javascript_writes_them() {
    let json = to_json(&serde_json::json!({ "bpm": 96.0, "gain": 0.5, "zero": -0.0 })).unwrap();
    assert_eq!(json, r#"{"bpm":96,"gain":0.5,"zero":0}"#);
  }

  #[test]
  fn keeps_and_reads_back() {
    save("studio.test", &vec![1., 2.5]);
    assert_eq!(raw("studio.test").as_deref(), Some("[1,2.5]"));
    assert_eq!(load_as::<Vec<f64>>("studio.test"), Some(vec![1., 2.5]));
    remove("studio.test");
    assert!(load("studio.test").is_none());
  }
}
