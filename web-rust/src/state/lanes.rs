//! The session as lanes, as web-react's `LanesProvider`: the take (with its
//! pattern and modules) and the open tape's tracks, one of them focused,
//! whose modules the live sound plays through and the module knobs set.

use std::rc::Rc;

use fluid::Signal;

use super::app;
use super::view::ScreenView;
use crate::logic::modules::{ModuleId, ModuleSettings, module_values};
use crate::logic::starter::Tape;
use crate::logic::timing::Take;
use crate::logic::tracks::{Track, set_modules, track_modules, track_take};

/// The take, shown on the tracks view as a potential track.
pub const TAKE_ID: &str = "session-take";

pub fn is_take(lane: &Track) -> bool {
  lane.id == TAKE_ID
}

pub struct Lanes {
  /// The lane the blue knob picked, kept across views so the roll edits the
  /// picked track; the piano roll and the drum grid start on the take.
  pub focus_index: Rc<Signal<usize>>,
}

impl Lanes {
  pub fn new() -> Self {
    Self {
      focus_index: Rc::new(Signal::new(0)),
    }
  }

  /// Plays the live sound through the focused lane's modules whenever they
  /// change.
  pub fn install(&'static self) {
    let modules = fluid::create_memo(move || self.modules());
    fluid::create_effect(move || {
      let values = modules.with(module_values);
      fluid::untrack(|| app().engine.set_master_params(&values));
    });
  }

  pub fn view_changed(&self, view: ScreenView) {
    if matches!(view, ScreenView::Roll | ScreenView::DrumGrid) {
      self.focus_index.set_if_changed(0);
    }
  }

  pub fn take(&self) -> Option<Take> {
    app().session.session.with(|session| session.take.clone())
  }

  pub fn tapes(&self) -> Vec<Tape> {
    app().session.session.with(|session| session.tapes.clone())
  }

  /// The open tape's index.
  pub fn tape_index(&self) -> usize {
    app().session.session.with(|session| {
      session
        .tapes
        .iter()
        .position(|tape| tape.id == session.tape)
        .unwrap_or(0)
    })
  }

  pub fn current_tape(&self) -> Option<Tape> {
    let index = self.tape_index();
    app()
      .session
      .session
      .with(|session| session.tapes.get(index).cloned())
  }

  pub fn tracks(&self) -> Vec<Track> {
    app()
      .session
      .session
      .with(|session| session.tracks().to_vec())
  }

  pub fn track_count(&self) -> usize {
    app().session.session.with(|session| session.tracks().len())
  }

  /// The take as a potential track, named for the instrument playing now.
  /// It has no mute or solo.
  pub fn take_lane(&self) -> Track {
    let a = app();
    let timing = a.transport.timing();
    Track {
      id: TAKE_ID.into(),
      name: "Take".into(),
      color: "#f4f3ef".into(),
      preset_id: a.sound.preset_id(),
      sound: fluid::untrack(|| a.engine.sound()),
      modules: None,
      source: None,
      take: self.take().unwrap_or_else(|| Take::empty(timing.bpm)),
      take_target: None,
      timing,
      follow_tape: None,
      start: 0.,
      volume: 1.,
      muted: false,
      soloed: false,
      loop_: None,
      repeats: None,
      copies: None,
    }
  }

  pub fn lanes(&self) -> Vec<Track> {
    std::iter::once(self.take_lane())
      .chain(self.tracks())
      .collect()
  }

  pub fn lane_count(&self) -> usize {
    self.track_count() + 1
  }

  pub fn focus_index(&self) -> usize {
    self.focus_index.value().min(self.lane_count() - 1)
  }

  pub fn set_focus_index(&self, index: usize) {
    self.focus_index.set(index);
  }

  /// The focused lane: the take, or a track.
  pub fn focused_lane(&self) -> Track {
    match self.focus_index() {
      0 => self.take_lane(),
      index => app()
        .session
        .session
        .with(|session| session.tracks()[index - 1].clone()),
    }
  }

  /// Whether the focused lane is the take.
  pub fn take_focused(&self) -> bool {
    self.focus_index() == 0
  }

  /// The tracks view's pick, and the track it is (the take isn't one).
  pub fn picked_lane(&self) -> Option<Track> {
    (app().views.view() == ScreenView::Tracks).then(|| self.focused_lane())
  }

  pub fn picked_track(&self) -> Option<Track> {
    self.picked_lane().filter(|lane| !is_take(lane))
  }

  /// The focused lane's ADSR, LFO and FX, the take's or a track's own.
  pub fn modules(&self) -> ModuleSettings {
    match self.focus_index() {
      0 => app()
        .session
        .session
        .with(|session| session.modules.clone()),
      index => app()
        .session
        .session
        .with(|session| track_modules(&session.tracks()[index - 1])),
    }
  }

  /// Whose modules the module views set.
  pub fn modules_owner(&self) -> String {
    if self.take_focused() {
      "Take".into()
    } else {
      self.focused_lane().name
    }
  }

  /// ↑ and ↓ on the tracks pick the row above or below, like the blue knob.
  pub fn step_focus(&self, direction: i32) {
    let last = self.lane_count() as i32 - 1;
    self
      .focus_index
      .update(|index| *index = (*index as i32 + direction).clamp(0, last) as usize);
  }

  pub fn set_modules(&self, next: ModuleSettings) {
    let index = fluid::untrack(|| self.focus_index());
    if index == 0 {
      app().session.set_take_modules(next);
    } else {
      self.update_track_at(index - 1, |track| set_modules(track, next));
    }
  }

  /// Turning a module's knob switches the module on so the change is
  /// audible.
  pub fn set_module_step(&self, id: ModuleId, index: usize, step: usize) {
    let mut modules = fluid::untrack(|| self.modules());
    *modules.on.get_mut(id) = true;
    if let Some(slot) = modules.steps.get_mut(id).get_mut(index) {
      *slot = step;
    }
    self.set_modules(modules);
  }

  pub fn toggle_module(&self, id: ModuleId) {
    let mut modules = fluid::untrack(|| self.modules());
    let on = modules.on.get_mut(id);
    *on = !*on;
    self.set_modules(modules);
  }

  fn update_track_at(&self, index: usize, change: impl FnOnce(&mut Track)) {
    app().session.set_tracks(|tracks| {
      if let Some(track) = tracks.get_mut(index) {
        change(track);
      }
    });
  }

  pub fn update_track(&self, id: &str, change: impl FnOnce(&mut Track)) {
    app().session.set_tracks(|tracks| {
      if let Some(track) = tracks.iter_mut().find(|track| track.id == id) {
        change(track);
      }
    });
  }

  /// A kept take or pattern joins the tape as its last track, picked.
  pub fn add_track(&self, track: Track) {
    let count = fluid::untrack(|| self.track_count());
    fluid::batch(|| {
      app().session.set_tracks(|tracks| tracks.push(track));
      self.focus_index.set(count + 1);
    });
  }

  pub fn delete_track(&self, id: &str) {
    let lanes = fluid::untrack(|| self.lane_count());
    fluid::batch(|| {
      app()
        .session
        .set_tracks(|tracks| tracks.retain(|track| track.id != id));
      self
        .focus_index
        .update(|index| *index = (*index).min(lanes.saturating_sub(2)));
    });
  }

  /// Loads a track as the take, with its instrument, effects and time
  /// signature, so the roll shows and plays it as the track does; saving
  /// the take then adds it as a new track, leaving the old one be.
  pub fn load_take(&self, track: &Track) {
    let a = app();
    fluid::batch(|| {
      let presets = fluid::untrack(|| a.sound.presets());
      let current = a.sound.preset.with_untracked(|preset| preset.id.clone());
      if let Some(own) = presets.iter().find(|preset| preset.id == track.preset_id)
        && own.id != current
      {
        a.sound.select_preset(own);
      }
      // The take holds just the track: its drum pattern is cleared too.
      a.session.set_take(Some(track_take(track)));
      a.session.set_pattern(|pattern| {
        let mut pattern = pattern.clone();
        pattern.hits.clear();
        pattern
      });
      a.session.set_take_modules(track_modules(track));
      a.transport.set_meter(track.timing.meter.index());
    });
  }

  pub fn discard_take(&self) {
    fluid::batch(|| {
      app().session.set_take(None);
      app().session.set_pattern(|pattern| {
        let mut pattern = pattern.clone();
        pattern.hits.clear();
        pattern
      });
    });
  }
}
