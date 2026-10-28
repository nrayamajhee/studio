//! The drum grid, as web-react's `DrumGridProvider` and `useStepPlayer`:
//! the kit playing, a row a piece, on the tempo's meter. Stopped, keys set
//! or clear their piece at the head (the green knob); Play loops the
//! pattern, and Record loops it and lands each tap on the nearest step.

use std::cell::{Cell, RefCell};
use std::collections::BTreeSet;
use std::rc::Rc;

use fluid::Signal;
use gloo_timers::callback::Interval;

use super::app;
use super::view::{MainView, ScreenView};
use crate::logic::pattern::{
  DrumPattern, STEP_RESOLUTIONS, add_hit, carry_pattern, hit_step, hits_at, kit_rows,
  pattern_steps, pattern_take, take_pattern, toggle_hit,
};
use crate::logic::presets::{DevicePreset, find_preset, is_kit, key_piece};
use crate::logic::progressions::KEY_VELOCITY;
use crate::logic::swing::{Swing, swing_on, swing_time};
use crate::logic::timing::Meter;
use crate::logic::tracks::{
  ClipNote, TrackClip, TrackCopy, TrackSource, track_modules, track_source, track_take,
};

/// Hits are scheduled this far ahead on the audio clock, topped up every
/// `TICK_MS`, so a busy page never makes them late; the first step waits
/// `LEAD` for its hits to arrive.
const LOOKAHEAD: f64 = 0.12;
const TICK_MS: u32 = 25;
const LEAD: f64 = 0.05;

/// What the step player reads on every top-up.
struct StepSource {
  pattern: DrumPattern,
  kit: String,
  meter: Meter,
  bpm: f64,
  swing: Swing,
}

/// How late a step of the pattern plays through the swing (s): none
/// straight, or on a triplet grid.
fn late_by(source: &StepSource, step: u32) -> f64 {
  let Some(swung) = swing_on(Some(source.swing), source.pattern.per_beat) else {
    return 0.;
  };
  let at = f64::from(step) * 60_000. / source.bpm / f64::from(source.pattern.per_beat);
  (swing_time(at, 60_000. / source.bpm, swung) - at) / 1000.
}

#[derive(Clone, Copy)]
struct Scheduled {
  /// The pattern's step, and its count since the loop started.
  step: u32,
  count: u64,
  time: f64,
}

struct Run {
  _timer: Interval,
  next: u64,
  next_time: f64,
  recent: Vec<Scheduled>,
  /// Hits a tap already played, so the loop skips them once.
  played: Vec<(String, u64)>,
}

pub struct DrumGrid {
  step_cursor: Rc<Signal<u32>>,
  /// The head, as the stopped grid keeps it, read outside redraws.
  head: Cell<u32>,
  step_recording: Rc<Signal<bool>>,
  running: Rc<Signal<bool>>,
  run: RefCell<Option<Run>>,
  /// The instrument the drum grid swapped for a drum kit, put back when it
  /// closes, so the piano roll and keys don't stay on drums.
  before: RefCell<Option<DevicePreset>>,
}

impl DrumGrid {
  pub fn new() -> Self {
    Self {
      step_cursor: Rc::new(Signal::new(0)),
      head: Cell::new(0),
      step_recording: Rc::new(Signal::new(false)),
      running: Rc::new(Signal::new(false)),
      run: RefCell::new(None),
      before: RefCell::new(None),
    }
  }

  pub fn install(&'static self) {
    // The pattern goes with the kit picked: written for another, its hits
    // move to the pieces or strokes that play them here.
    fluid::create_effect(move || {
      let kit = app().sound.step_kit();
      let written = app()
        .session
        .session
        .with(|session| session.pattern.kit.clone());
      if let Some(kit) = kit
        && written.as_deref() != Some(kit.as_str())
      {
        fluid::untrack(|| {
          app()
            .session
            .set_pattern(|pattern| carry_pattern(pattern, &kit))
        });
      }
    });
    // The pattern stays live while the drum grid is the main view; leaving
    // it stops the loop and puts the instrument back.
    fluid::create_effect(move || {
      let live = app().views.main_view.value() == MainView::DrumGrid;
      if !live {
        fluid::untrack(|| self.leave());
      }
    });
    fluid::create_effect(move || {
      let head = self.step_head();
      self.head.set(head);
    });
  }

  fn leave(&self) {
    self.stop_player();
    let before = self.before.borrow_mut().take();
    if let Some(before) = before {
      app().sound.select_preset(&before);
    }
  }

  /// Keys land in the pattern only in the drum grid.
  pub fn view_changed(&self, view: ScreenView) {
    if view != ScreenView::DrumGrid {
      self.step_recording.set_if_changed(false);
    }
  }

  fn pattern(&self) -> DrumPattern {
    app()
      .session
      .session
      .with(|session| session.pattern.clone())
  }

  fn meter(&self) -> Meter {
    app().transport.timing().meter
  }

  /// The kit's rows, top to bottom.
  pub fn step_rows(&self) -> Vec<&'static str> {
    app()
      .sound
      .step_kit()
      .map(|kit| kit_rows(&kit))
      .unwrap_or_default()
  }

  pub fn step_count(&self) -> u32 {
    let meter = self.meter();
    app()
      .session
      .session
      .with(|session| pattern_steps(&session.pattern, meter))
  }

  pub fn steps_per_bar(&self) -> u32 {
    self.meter().beats
      * app()
        .session
        .session
        .with(|session| session.pattern.per_beat)
  }

  pub fn per_beat(&self) -> u32 {
    app()
      .session
      .session
      .with(|session| session.pattern.per_beat)
  }

  pub fn step_head(&self) -> u32 {
    self
      .step_cursor
      .value()
      .min(self.step_count().saturating_sub(1))
  }

  /// The pattern's hits as `row:step`, for the grid.
  pub fn step_hits(&self) -> BTreeSet<(usize, u32)> {
    let rows = self.step_rows();
    let count = self.step_count();
    let pattern = self.pattern();
    pattern
      .hits
      .iter()
      .filter_map(|hit| {
        let row = rows.iter().position(|piece| *piece == hit.piece)?;
        let at = hit_step(hit, pattern.per_beat);
        (at >= 0 && (at as u32) < count).then_some((row, at as u32))
      })
      .collect()
  }

  /// The head while the loop plays, else where it rests; read every frame.
  pub fn get_step_head(&self) -> u32 {
    self.position().unwrap_or(self.head.get())
  }

  /// The pattern plays while the drum grid is the main view, whatever
  /// shows over it.
  pub fn pattern_running(&self) -> bool {
    app().views.main_view() == MainView::DrumGrid && self.running.value()
  }

  pub fn recording_pattern(&self) -> bool {
    self.pattern_running() && self.step_recording.value()
  }

  /// The drum pattern, drawn on the take's row over its notes: the take's
  /// other half.
  pub fn pattern_clip(&self) -> Option<TrackClip> {
    let pattern = self.pattern();
    if pattern.hits.is_empty() {
      return None;
    }
    let bpm = app().transport.bpm.value();
    let beat = 60_000. / bpm;
    let kit = app().sound.step_kit().unwrap_or_else(|| "drums".into());
    let drawn = pattern_take(&pattern, &kit, self.meter(), bpm);
    Some(TrackClip {
      length: drawn.length / beat,
      offset: 0.,
      copies: vec![TrackCopy {
        start: 0.,
        repeats: 1,
      }],
      looped: false,
      notes: drawn
        .notes
        .iter()
        .map(|note| ClipNote {
          note: note.note,
          start: note.start / beat,
          length: note.duration / beat,
        })
        .collect(),
    })
  }

  fn source(&self) -> StepSource {
    fluid::untrack(|| {
      let transport = &app().transport;
      StepSource {
        pattern: self.pattern(),
        kit: app().sound.step_kit().unwrap_or_else(|| "drums".into()),
        meter: self.meter(),
        bpm: transport.bpm.value(),
        swing: transport.swing.value(),
      }
    })
  }

  fn top_up(&self) {
    let mut run = self.run.borrow_mut();
    let Some(run) = run.as_mut() else {
      return;
    };
    let source = self.source();
    let steps = u64::from(pattern_steps(&source.pattern, source.meter).max(1));
    let step_time = 60. / source.bpm / f64::from(source.pattern.per_beat);
    let engine = &app().engine;
    let now = engine.now();
    // After a stall (a hidden tab) carry on from now rather than catch up.
    if run.next_time < now {
      run.next_time = now + LEAD;
    }
    while run.next_time < now + LOOKAHEAD {
      let step = (run.next % steps) as u32;
      let time = run.next_time + late_by(&source, step);
      for hit in hits_at(&source.pattern, i64::from(step)) {
        if let Some(at) = run
          .played
          .iter()
          .position(|(piece, count)| *piece == hit.piece && *count == run.next)
        {
          run.played.remove(at);
          continue;
        }
        engine.hit(&source.kit, &hit.piece, hit.velocity, Some(time));
      }
      run.recent.push(Scheduled {
        step,
        count: run.next,
        time,
      });
      run.next += 1;
      run.next_time += step_time;
    }
    run.recent.retain(|scheduled| scheduled.time > now - 1.);
  }

  fn stop_player(&self) {
    self.run.borrow_mut().take();
    self.running.set_if_changed(false);
  }

  /// Starts the loop at `step`.
  fn start_player(&'static self, step: u32) {
    self.stop_player();
    let engine = &app().engine;
    engine.unlock();
    *self.run.borrow_mut() = Some(Run {
      _timer: Interval::new(TICK_MS, move || self.top_up()),
      next: u64::from(step),
      next_time: engine.now() + LEAD,
      recent: Vec::new(),
      played: Vec::new(),
    });
    self.running.set(true);
    self.top_up();
  }

  /// The step playing now on the audio clock, or `None` while stopped.
  pub fn position(&self) -> Option<u32> {
    let run = self.run.borrow();
    let run = run.as_ref()?;
    let now = app().engine.now();
    let at = run.recent.iter().rev().find(|scheduled| scheduled.time <= now);
    at.or(run.recent.first()).map(|scheduled| scheduled.step)
  }

  /// The step nearest a tap made now: a tap a little early lands on the
  /// coming step, which then doesn't play it again.
  fn nearest(&self, piece: &str) -> Option<u32> {
    let source = self.source();
    let mut run = self.run.borrow_mut();
    let run = run.as_mut()?;
    let tapped = app().engine.now();
    let steps = u64::from(pattern_steps(&source.pattern, source.meter).max(1));
    let coming = (run.next % steps) as u32;
    let mut candidates = run.recent.clone();
    candidates.push(Scheduled {
      step: coming,
      count: run.next,
      time: run.next_time + late_by(&source, coming),
    });
    let mut best = candidates[0];
    for candidate in &candidates {
      if (candidate.time - tapped).abs() < (best.time - tapped).abs() {
        best = *candidate;
      }
    }
    if best.count >= run.next {
      run.played.push((piece.into(), best.count));
    }
    Some(best.step)
  }

  /// A key in the drum grid: recording, it lands on the nearest step;
  /// stopped, it sets or clears its piece at the head; playing, it only
  /// plays.
  fn tap_step(&self, piece: &str) {
    let session = &app().session;
    if fluid::untrack(|| self.recording_pattern()) {
      if let Some(at) = self.nearest(piece) {
        session.set_pattern(|pattern| add_hit(pattern, piece, i64::from(at), KEY_VELOCITY));
      }
      return;
    }
    if !fluid::untrack(|| self.pattern_running()) {
      let head = self.head.get();
      session.set_pattern(|pattern| toggle_hit(pattern, piece, i64::from(head), KEY_VELOCITY));
    }
  }

  /// The notes of each key press, as it plays.
  pub fn notes_played(&self, midis: &[i32]) {
    let (view, kit) = fluid::untrack(|| (app().views.view(), app().sound.step_kit()));
    let (ScreenView::DrumGrid, Some(kit)) = (view, kit) else {
      return;
    };
    let mut pieces: Vec<&str> = Vec::new();
    for &midi in midis {
      let piece = key_piece(&kit, midi);
      if !pieces.contains(&piece) {
        pieces.push(piece);
      }
    }
    for piece in pieces {
      self.tap_step(piece);
    }
  }

  /// Moving the stopped head sounds the step it lands on, like scrubbing.
  pub fn move_step_head(&self, to: i64) {
    let count = fluid::untrack(|| self.step_count());
    let at = to.clamp(0, i64::from(count) - 1).max(0) as u32;
    if at == self.head.get() {
      return;
    }
    self.head.set(at);
    self.step_cursor.set(at);
    let (kit, running) = fluid::untrack(|| (app().sound.step_kit(), self.pattern_running()));
    let Some(kit) = kit.filter(|_| !running) else {
      return;
    };
    let engine = &app().engine;
    engine.unlock();
    let pattern = fluid::untrack(|| self.pattern());
    for hit in hits_at(&pattern, i64::from(at)) {
      engine.hit(&kit, &hit.piece, hit.velocity, None);
    }
  }

  pub fn move_step_head_by(&self, steps: i64) {
    self.move_step_head(i64::from(self.head.get()) + steps);
  }

  /// Stopping leaves the head where the loop got to.
  pub fn stop_pattern(&self) {
    let at = self.position();
    fluid::batch(|| {
      self.stop_player();
      self.step_recording.set(false);
      if let Some(at) = at {
        self.step_cursor.set(at);
      }
    });
  }

  pub fn play_pattern(&'static self, recording: bool) {
    self.step_recording.set(recording);
    if self.run.borrow().is_some() {
      return;
    }
    app().transport.pause_take();
    self.start_player(self.head.get());
  }

  /// Clicking a cell sets or clears it, sounding a hit it sets.
  pub fn toggle_step(&self, row: usize, at: u32) {
    let (rows, kit, hits) =
      fluid::untrack(|| (self.step_rows(), app().sound.step_kit(), self.step_hits()));
    let (Some(piece), Some(kit)) = (rows.get(row).copied(), kit) else {
      return;
    };
    if !hits.contains(&(row, at)) {
      let engine = &app().engine;
      engine.unlock();
      engine.hit(&kit, piece, KEY_VELOCITY, None);
    }
    app()
      .session
      .set_pattern(|pattern| toggle_hit(pattern, piece, i64::from(at), KEY_VELOCITY));
  }

  /// A new resolution keeps the head on the same beat.
  pub fn set_step_resolution(&self, index: usize) {
    let per_beat = STEP_RESOLUTIONS[index.min(STEP_RESOLUTIONS.len() - 1)];
    let beat = f64::from(self.head.get()) / f64::from(fluid::untrack(|| self.per_beat()));
    fluid::batch(|| {
      app().session.set_pattern(|pattern| DrumPattern {
        per_beat,
        ..pattern.clone()
      });
      self
        .step_cursor
        .set(crate::logic::js::round(beat * f64::from(per_beat)) as u32);
    });
  }

  pub fn set_step_bars(&self, bars: u32) {
    app().session.set_pattern(|pattern| DrumPattern {
      bars,
      ..pattern.clone()
    });
  }

  pub fn clear_pattern(&self) {
    app().session.set_pattern(|pattern| DrumPattern {
      hits: Vec::new(),
      ..pattern.clone()
    });
  }

  /// Opens the drum grid on a kit: the one playing, or the drum kit. With a
  /// track it made picked it loads the track as the take: its pattern, kit,
  /// ADSR, LFO and FX, grid and time signature.
  pub fn toggle_drum_grid(&self) {
    let a = app();
    if fluid::untrack(|| a.views.view()) == ScreenView::DrumGrid {
      a.views.set_view(ScreenView::Scope);
      return;
    }
    let (focused, take_focused, step_kit, preset, presets) = fluid::untrack(|| {
      (
        a.lanes.focused_lane(),
        a.lanes.take_focused(),
        a.sound.step_kit(),
        a.sound.preset(),
        a.sound.presets(),
      )
    });
    let loading = (!take_focused
      && track_source(&focused) == TrackSource::DrumGrid
      && is_kit(&focused.sound.target))
    .then_some(focused);
    let kit = match &loading {
      Some(track) => presets
        .iter()
        .find(|preset| preset.id == track.preset_id)
        .cloned(),
      None if step_kit.is_some() => None,
      None => Some(find_preset("drums").clone()),
    };
    fluid::batch(|| {
      if let Some(kit) = kit
        && kit.id != preset.id
      {
        if step_kit.is_none() {
          *self.before.borrow_mut() = Some(preset.clone());
        }
        a.sound.select_preset(&kit);
      }
      // The take holds just the track: its notes are cleared too.
      if let Some(track) = &loading {
        a.session
          .set_pattern(|_| take_pattern(&track_take(track), &track.sound.target, &track.timing));
        a.session.set_take(None);
        a.session.set_take_modules(track_modules(track));
        a.transport.set_meter(track.timing.meter.index());
        self.step_cursor.set(0);
        self.head.set(0);
      }
      a.views.set_view(ScreenView::DrumGrid);
    });
  }
}
