//! What has been recorded, as web-react's `sessionStore.ts`: the working
//! take with its ADSR, LFO and FX, the drum grid's pattern, and the tapes
//! whose tracks were kept from them, each under its own `localStorage` key
//! so a reload keeps them.

use std::rc::Rc;

use fluid::Signal;
use serde_json::Value;

use super::storage::{self, load, remove, save};
use crate::logic::modules::{ModuleSettings, initial_modules};
use crate::logic::pattern::DrumPattern;
use crate::logic::starter::{Tape, starter_tapes};
use crate::logic::swing::{STRAIGHT, Swing};
use crate::logic::timing::{DEFAULT_TIMING, Meter, Take};
use crate::logic::tracks::{Track, base36};

pub const TAKE_KEY: &str = "studio.take";
pub const MODULES_KEY: &str = "studio.takeModules";
pub const PATTERN_KEY: &str = "studio.pattern";
/// Where the take kept the tracks it was loaded from; dropped on first
/// read.
const SOURCE_KEYS: [&str; 2] = ["studio.takeSource", "studio.stepsSource"];
pub const TAPES_KEY: &str = "studio.tapes";
pub const TAPE_KEY: &str = "studio.tape";
/// Where the tracks were kept before there were tapes; they become the
/// first.
const TRACKS_KEY: &str = "studio.tracks";
/// Where the take and tracks used to be kept together; split into their
/// keys on first read.
const LEGACY_KEY: &str = "studio.session";

#[derive(Clone, Debug, PartialEq)]
pub struct Session {
  pub take: Option<Take>,
  pub modules: ModuleSettings,
  pub pattern: DrumPattern,
  pub tapes: Vec<Tape>,
  /// The open tape's id.
  pub tape: String,
}

impl Session {
  /// The open tape's tracks.
  pub fn tracks(&self) -> &[Track] {
    self
      .tapes
      .iter()
      .find(|tape| tape.id == self.tape)
      .map_or(&[], |tape| &tape.tracks)
  }

  pub fn open_tape(&self) -> Option<&Tape> {
    self.tapes.iter().find(|tape| tape.id == self.tape)
  }
}

fn take_of(value: Option<Value>) -> Option<Take> {
  let take: Take = serde_json::from_value(value?).ok()?;
  let finite = take.length.is_finite()
    && take.bpm.is_finite()
    && take
      .notes
      .iter()
      .all(|note| note.start.is_finite() && note.duration.is_finite() && note.velocity.is_finite());
  finite.then_some(take)
}

fn track_of(value: Value) -> Option<Track> {
  let track: Track = serde_json::from_value(value).ok()?;
  let valid = track.modules.as_ref().is_none_or(ModuleSettings::is_valid)
    && track.timing.swing.is_none_or(|swing| swing.is_valid())
    && track.repeats.is_none_or(|repeats| repeats >= 1)
    && track.copies.iter().flatten().all(|copy| copy.repeats >= 1);
  valid.then_some(track)
}

/// Anything that doesn't look like a track is dropped.
fn tracks_of(value: Option<Value>) -> Vec<Track> {
  match value {
    Some(Value::Array(items)) => items.into_iter().filter_map(track_of).collect(),
    _ => Vec::new(),
  }
}

fn tape_of(mut value: Value) -> Option<Tape> {
  let tracks = tracks_of(value.get_mut("tracks").map(Value::take));
  if let Some(fields) = value.as_object_mut() {
    fields.insert("tracks".into(), Value::Array(Vec::new()));
  }
  let tape: Tape = serde_json::from_value(value).ok()?;
  tape
    .swing
    .is_none_or(|swing| swing.is_valid())
    .then_some(Tape { tracks, ..tape })
}

/// `Date.now()`, for new ids.
pub fn now() -> f64 {
  #[cfg(target_arch = "wasm32")]
  {
    js_sys::Date::now()
  }
  #[cfg(not(target_arch = "wasm32"))]
  {
    std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .map_or(0., |since| since.as_millis() as f64)
  }
}

fn tape_id() -> String {
  format!("tape-{}", base36(now() as u64))
}

/// The next "Tape n" after the highest number taken.
fn next_name(tapes: &[Tape]) -> String {
  let highest = tapes
    .iter()
    .filter_map(|tape| tape.name.strip_prefix("Tape "))
    .filter(|number| !number.is_empty() && number.bytes().all(|byte| byte.is_ascii_digit()))
    .filter_map(|number| number.parse::<u64>().ok())
    .max()
    .unwrap_or(0);
  format!("Tape {}", highest + 1)
}

fn empty_tape(tapes: &[Tape], bpm: f64, meter: Meter, swing: Swing) -> Tape {
  Tape {
    id: tape_id(),
    name: next_name(tapes),
    bpm,
    meter,
    swing: Some(swing),
    tracks: Vec::new(),
  }
}

/// The tapes as stored, or on a first visit the starter tapes, or a first
/// tape holding the tracks kept before there were tapes.
fn read_tapes(legacy_tracks: Option<Value>) -> (Vec<Tape>, String) {
  let tapes: Vec<Tape> = match load(TAPES_KEY) {
    Some(Value::Array(items)) => items.into_iter().filter_map(tape_of).collect(),
    _ => Vec::new(),
  };
  if !tapes.is_empty() {
    let open = load(TAPE_KEY)
      .and_then(|open| open.as_str().map(str::to_owned))
      .filter(|open| tapes.iter().any(|tape| &tape.id == open))
      .unwrap_or_else(|| tapes[0].id.clone());
    return (tapes, open);
  }
  let kept = tracks_of(legacy_tracks);
  let first = if kept.is_empty() {
    starter_tapes()
  } else {
    vec![Tape {
      tracks: kept,
      ..empty_tape(&[], DEFAULT_TIMING.bpm, DEFAULT_TIMING.meter, STRAIGHT)
    }]
  };
  save(TAPES_KEY, &first);
  save(TAPE_KEY, &first[0].id);
  remove(TRACKS_KEY);
  let open = first[0].id.clone();
  (first, open)
}

fn read() -> Session {
  let modules = storage::load_as::<ModuleSettings>(MODULES_KEY)
    .filter(ModuleSettings::is_valid)
    .unwrap_or_else(initial_modules);
  let pattern = storage::load_as::<DrumPattern>(PATTERN_KEY)
    .filter(DrumPattern::is_valid)
    .unwrap_or_default();
  for key in SOURCE_KEYS {
    remove(key);
  }
  let (take, legacy_tracks) = match load(LEGACY_KEY) {
    Some(Value::Object(mut legacy)) => {
      let take = take_of(legacy.remove("take"));
      match &take {
        Some(take) => save(TAKE_KEY, take),
        None => save(TAKE_KEY, &Value::Null),
      }
      remove(LEGACY_KEY);
      (take, legacy.remove("tracks"))
    }
    _ => (take_of(load(TAKE_KEY)), load(TRACKS_KEY)),
  };
  let (tapes, tape) = read_tapes(legacy_tracks);
  Session {
    take,
    modules,
    pattern,
    tapes,
    tape,
  }
}

/// The session as a signal, with web-react's setters, each kept as it
/// changes.
pub struct SessionStore {
  pub session: Rc<Signal<Session>>,
}

impl SessionStore {
  pub fn load() -> Self {
    Self {
      session: Rc::new(Signal::new(read())),
    }
  }

  pub fn set_take(&self, take: Option<Take>) {
    match &take {
      Some(take) => save(TAKE_KEY, take),
      None => save(TAKE_KEY, &Value::Null),
    }
    self.session.update(|session| session.take = take);
  }

  pub fn set_take_modules(&self, modules: ModuleSettings) {
    save(MODULES_KEY, &modules);
    self.session.update(|session| session.modules = modules);
  }

  pub fn set_pattern(&self, change: impl FnOnce(&DrumPattern) -> DrumPattern) {
    self.session.update(|session| {
      session.pattern = change(&session.pattern);
      save(PATTERN_KEY, &session.pattern);
    });
  }

  fn set_tapes(&self, change: impl FnOnce(&mut Session)) {
    self.session.update(|session| {
      change(session);
      save(TAPES_KEY, &session.tapes);
      save(TAPE_KEY, &session.tape);
    });
  }

  /// Changes the open tape's tracks.
  pub fn set_tracks(&self, change: impl FnOnce(&mut Vec<Track>)) {
    self.set_tapes(|session| {
      let open = session.tape.clone();
      if let Some(tape) = session.tapes.iter_mut().find(|tape| tape.id == open) {
        change(&mut tape.tracks);
      }
    });
  }

  pub fn open_tape(&self, id: &str) {
    self.set_tapes(|session| session.tape = id.into());
  }

  /// Adds an empty tape at `bpm`, `meter` and `swing` after the others, and
  /// opens it.
  pub fn new_tape(&self, bpm: f64, meter: Meter, swing: Swing) -> Tape {
    let mut made = None;
    self.set_tapes(|session| {
      let tape = empty_tape(&session.tapes, bpm, meter, swing);
      session.tape = tape.id.clone();
      session.tapes.push(tape.clone());
      made = Some(tape);
    });
    made.expect("the tape was made")
  }

  /// Deletes a tape, opening the one after it (or before); deleting the
  /// last leaves a new empty one. Returns the tape now open.
  pub fn delete_tape(&self, id: &str) -> Option<Tape> {
    let (at, open) = self.session.with_untracked(|session| {
      (
        session.tapes.iter().position(|tape| tape.id == id),
        session.tape.clone(),
      )
    });
    let Some(at) = at else {
      return self
        .session
        .with_untracked(|session| session.open_tape().cloned());
    };
    let mut opened = None;
    self.set_tapes(|session| {
      let all = session.tapes.clone();
      session.tapes.remove(at);
      if session.tapes.is_empty() {
        let fresh = empty_tape(&all, DEFAULT_TIMING.bpm, DEFAULT_TIMING.meter, STRAIGHT);
        session.tapes.push(fresh);
      }
      let rest = &session.tapes;
      let next = rest
        .iter()
        .find(|tape| open != id && tape.id == open)
        .unwrap_or(&rest[at.min(rest.len() - 1)])
        .clone();
      session.tape = next.id.clone();
      opened = Some(next);
    });
    opened
  }

  /// Keeps the tempo, time signature and swing with the open tape.
  pub fn set_tape_timing(&self, bpm: f64, meter: Meter, swing: Swing) {
    let same = self
      .session
      .with_untracked(|session| match session.open_tape() {
        None => true,
        Some(open) => {
          let kept = open.swing.unwrap_or(STRAIGHT);
          open.bpm == bpm
            && open.meter == meter
            && kept.amount == swing.amount
            && kept.per_beat == swing.per_beat
        }
      });
    if same {
      return;
    }
    self.set_tapes(|session| {
      let open = session.tape.clone();
      if let Some(tape) = session.tapes.iter_mut().find(|tape| tape.id == open) {
        tape.bpm = bpm;
        tape.meter = meter;
        tape.swing = Some(swing);
      }
    });
  }

  pub fn opened_tape(&self) -> Option<Tape> {
    self
      .session
      .with_untracked(|session| session.open_tape().cloned())
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::logic::timing::FOUR_FOUR;

  #[test]
  fn a_first_visit_opens_the_starters() {
    storage::clear();
    let store = SessionStore::load();
    store.session.with_untracked(|session| {
      assert_eq!(session.tapes.len(), 2);
      assert_eq!(session.tape, "tape-starter-1");
      assert_eq!(session.tracks().len(), 3);
    });
    // Kept, so a reload reads them back as they were.
    let again = SessionStore::load();
    assert_eq!(again.session.cloned(), store.session.cloned());
  }

  #[test]
  fn tapes_come_and_go() {
    storage::clear();
    let store = SessionStore::load();
    let tape = store.new_tape(120., FOUR_FOUR, STRAIGHT);
    assert_eq!(tape.name, "Tape 1");
    assert_eq!(
      store.session.with_untracked(|session| session.tape.clone()),
      tape.id
    );
    let open = store.delete_tape(&tape.id).unwrap();
    assert_eq!(open.id, "tape-starter-2");
    store.delete_tape("tape-starter-1");
    let open = store.delete_tape("tape-starter-2").unwrap();
    assert_eq!(open.name, "Tape 1");
    assert_eq!(
      store.session.with_untracked(|session| session.tapes.len()),
      1
    );
  }

  #[test]
  fn the_take_is_kept() {
    storage::clear();
    let store = SessionStore::load();
    store.set_take(Some(Take::empty(96.)));
    assert_eq!(
      SessionStore::load().session.cloned().take,
      Some(Take::empty(96.))
    );
    store.set_take(None);
    assert_eq!(storage::raw(TAKE_KEY).as_deref(), Some("null"));
  }
}
