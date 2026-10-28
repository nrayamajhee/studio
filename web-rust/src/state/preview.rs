//! The hidden player the pickers audition on, as web-react's
//! `PreviewProvider` and `usePreviewTake`: a progression on the keys'
//! instrument, switching as it does, or a beat on its kit; played once
//! through on the audio clock, never on the take or the tracks, and paused
//! and picked up again with Play.

use std::cell::RefCell;
use std::rc::Rc;

use fluid::Signal;
use gloo_timers::callback::Interval;

use super::app;
use crate::logic::presets::{find_preset, is_kit};
use crate::logic::timing::Take;

/// Notes are sent this far ahead on the audio clock, topped up every
/// `TICK_MS`; the first waits `LEAD` for its notes to arrive.
const LOOKAHEAD: f64 = 0.12;
const TICK_MS: u32 = 25;
const LEAD: f64 = 0.05;

/// The instrument a preview plays on.
#[derive(Clone, Debug, PartialEq)]
pub struct PreviewSound {
  pub target: String,
  pub octave: i32,
}

/// A note struck (with its velocity) or let go (`None`), in seconds from
/// the take's start.
struct Cue {
  at: f64,
  note: i32,
  velocity: Option<f64>,
}

struct Run {
  _timer: Interval,
  sound: PreviewSound,
  cues: Vec<Cue>,
  next: usize,
  /// Where on the take it starts (s), and where the take's top falls on
  /// the audio clock.
  from: f64,
  origin: f64,
  /// Notes struck and not yet let go: when on the audio clock, and how
  /// hard.
  sounding: Vec<(i32, f64, f64)>,
}

/// The take's notes from `from` (s): one already sounding there is struck
/// again on it. A note let go and struck at the same moment is let go
/// first, so it speaks again.
fn cues_of(take: &Take, from: f64) -> Vec<Cue> {
  let mut cues: Vec<Cue> = take
    .notes
    .iter()
    .flat_map(|note| {
      let end = (note.start + note.duration) / 1000.;
      if end <= from {
        return Vec::new();
      }
      vec![
        Cue {
          at: (note.start / 1000.).max(from),
          note: note.note,
          velocity: Some(note.velocity),
        },
        Cue {
          at: end,
          note: note.note,
          velocity: None,
        },
      ]
    })
    .collect();
  cues.sort_by(|a, b| {
    a.at
      .total_cmp(&b.at)
      .then(b.velocity.is_none().cmp(&a.velocity.is_none()))
  });
  cues
}

pub struct Preview {
  pub playing: Rc<Signal<bool>>,
  run: RefCell<Option<Run>>,
  /// The preview held, playing or paused: what it was played as, where Play
  /// picks it up (s), and whether it plays on the keys' instrument.
  cued: Rc<Signal<Option<(String, f64, bool)>>>,
}

impl Preview {
  pub fn new() -> Self {
    Self {
      playing: Rc::new(Signal::new(false)),
      run: RefCell::new(None),
      cued: Rc::new(Signal::new(None)),
    }
  }

  pub fn install(&'static self) {
    // A preview of notes follows the keys' instrument as it changes.
    let keys = fluid::create_memo(move || self.keys_sound());
    fluid::create_effect(move || {
      let sound = keys.cloned();
      let on_keys = self
        .cued
        .with_untracked(|cued| cued.as_ref().is_some_and(|cued| cued.2));
      if on_keys {
        self.set_sound(sound);
      }
    });
  }

  /// A preview belongs to the view that played it: leaving stops it.
  pub fn view_changed(&self) {
    self.stop();
  }

  /// The instrument the keys play; a kit would play the notes as drums, so
  /// they're heard on the piano.
  fn keys_sound(&self) -> PreviewSound {
    let preset = app().sound.preset();
    let preset = if is_kit(&preset.target) {
      find_preset("piano").clone()
    } else {
      preset
    };
    PreviewSound {
      target: preset.target,
      octave: preset.octave,
    }
  }

  /// The id of the preview held, playing or paused.
  pub fn cued(&self) -> Option<String> {
    self
      .cued
      .with(|cued| cued.as_ref().map(|cued| cued.0.clone()))
  }

  fn top_up(&self) {
    let engine = &app().engine;
    let mut guard = self.run.borrow_mut();
    let Some(run) = guard.as_mut() else {
      return;
    };
    let now = engine.now();
    // Until the engine runs, timed notes would all land at once: the take
    // waits for it.
    if !engine.ready() {
      run.origin = now + LEAD - run.from;
      return;
    }
    // After a stall (a hidden tab) carry on from now rather than catch up.
    if let Some(due) = run.cues.get(run.next)
      && run.origin + due.at < now
    {
      run.origin = now + LEAD - due.at;
    }
    while let Some(cue) = run.cues.get(run.next) {
      let time = run.origin + cue.at;
      if time >= now + LOOKAHEAD {
        return;
      }
      engine.note_at(
        &run.sound.target,
        run.sound.octave,
        cue.note,
        cue.velocity,
        time,
      );
      match cue.velocity {
        Some(velocity) => run.sounding.push((cue.note, time, velocity)),
        None => {
          if let Some(at) = run.sounding.iter().position(|held| held.0 == cue.note) {
            run.sounding.remove(at);
          }
        }
      }
      run.next += 1;
    }
    *guard = None;
    drop(guard);
    self.playing.set(false);
  }

  /// Lets go of what it struck, returning where on the take it was (s), or
  /// `None` if it wasn't playing.
  fn halt(&self) -> Option<f64> {
    let run = self.run.borrow_mut().take()?;
    let engine = &app().engine;
    let now = engine.now();
    for &(note, time, _) in &run.sounding {
      engine.note_at(
        &run.sound.target,
        run.sound.octave,
        note,
        None,
        time.max(now),
      );
    }
    self.playing.set(false);
    Some(run.from.max(now - run.origin))
  }

  /// Carries on on another instrument: what is sounding is let go on the
  /// old one and struck again on the new.
  fn set_sound(&self, sound: PreviewSound) {
    let mut guard = self.run.borrow_mut();
    let Some(run) = guard.as_mut() else {
      return;
    };
    let engine = &app().engine;
    let now = engine.now();
    for held in &mut run.sounding {
      held.1 = held.1.max(now);
      engine.note_at(&run.sound.target, run.sound.octave, held.0, None, held.1);
      engine.note_at(&sound.target, sound.octave, held.0, Some(held.2), held.1);
    }
    run.sound = sound;
  }

  /// Plays `take` as `id` on `sound`, or without one on the keys'
  /// instrument: from where it paused if it is the one held (unless
  /// `fresh`), else from the top. One thing plays at a time, so it pauses
  /// the take, the drum grid and the tracks; and not while a take records.
  pub fn play(&'static self, id: &str, take: &Take, sound: Option<PreviewSound>, fresh: bool) {
    let a = app();
    if fluid::untrack(|| a.transport.recording()) {
      return;
    }
    a.transport.pause_take();
    if fluid::untrack(|| a.grid.pattern_running()) {
      a.grid.stop_pattern();
    }
    a.mix.pause();
    let from = self
      .cued
      .with_untracked(|cued| match cued {
        Some((cued, at, _)) if !fresh && cued == id => Some(*at),
        _ => None,
      })
      .unwrap_or(0.);
    let on_keys = sound.is_none();
    let sound = sound.unwrap_or_else(|| fluid::untrack(|| self.keys_sound()));
    self.halt();
    a.engine.unlock();
    let engine = &a.engine;
    *self.run.borrow_mut() = Some(Run {
      _timer: Interval::new(TICK_MS, move || self.top_up()),
      sound,
      cues: cues_of(take, from),
      next: 0,
      from,
      origin: engine.now() + LEAD - from,
      sounding: Vec::new(),
    });
    fluid::batch(|| {
      self.playing.set(true);
      // Played through, it starts from the top again.
      self.cued.set(Some((id.into(), 0., on_keys)));
    });
    self.top_up();
  }

  pub fn pause(&self) {
    if let Some(at) = self.halt() {
      self.cued.update(|cued| {
        if let Some(cued) = cued {
          cued.1 = at;
        }
      });
    }
  }

  pub fn stop(&self) {
    self.halt();
    self.cued.set_if_changed(None);
  }
}
