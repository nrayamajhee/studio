//! The tracks view's timeline (its span, zoom and pan) and editing the
//! tracks on it: sliding, repeating, clipping and trimming, mute and solo,
//! as web-react's `TracksProvider`.

use std::cell::RefCell;
use std::rc::Rc;

use fluid::{Memo, Signal};

use super::app;
use super::lanes::is_take;
use super::sound::preset_for_target;
use super::transport::{MAX_BPM, MIN_BPM};
use super::view::ScreenView;
use crate::logic::js::round;
use crate::logic::math::position_label;
use crate::logic::presets::DevicePreset;
use crate::logic::swing::Swing;
use crate::logic::tracks::{
  Track, TrackClip, TrackCopy, TrackLoop, clip_of, cut_to_loop, follows_tape, grid_steps, loop_on,
  loop_step, max_repeats, pass_of, placed_copies, set_copies, settle_copies, take_beats,
  take_beats_at, track_bpm, track_modules, with_modules,
};

/// How many times Shift + red stretches the tracks' timeline across the
/// lanes; it stops where a bar fills them.
const TRACK_ZOOMS: [f64; 15] = [
  1., 1.5, 2., 3., 4., 6., 8., 12., 16., 24., 32., 48., 64., 96., 128.,
];

pub struct Tracks {
  zoom_step: Rc<Signal<usize>>,
  pan_from: Rc<Signal<f64>>,
  /// While a clip is trimmed (an edge dragged, or Shift turning its knobs)
  /// the timeline keeps its length, so the lanes don't rescale under the
  /// edit; letting go fits it again.
  drag_span: Rc<Signal<Option<f64>>>,
  knob_span: Rc<Signal<Option<f64>>>,
  /// The copy picked with Shift + ↓ ↑: its track, and which.
  copy_pick: Rc<Signal<(String, usize)>>,
  /// Each lane's clip, recomputed as the lanes or tempo change.
  clips: RefCell<Option<Memo<Vec<TrackClip>>>>,
}

impl Tracks {
  pub fn new() -> Self {
    Self {
      zoom_step: Rc::new(Signal::new(0)),
      pan_from: Rc::new(Signal::new(0.)),
      drag_span: Rc::new(Signal::new(None)),
      knob_span: Rc::new(Signal::new(None)),
      copy_pick: Rc::new(Signal::new((String::new(), 0))),
      clips: RefCell::new(None),
    }
  }

  pub fn install(&'static self) {
    *self.clips.borrow_mut() = Some(fluid::create_memo(move || {
      let bpm = app().transport.bpm.value();
      app()
        .lanes
        .lanes()
        .iter()
        .map(|lane| clip_of(lane, bpm))
        .collect()
    }));
    // Shift turning a clipped track's edges holds the timeline's length.
    let clip_knobs = fluid::create_memo(move || {
      app().views.view() == ScreenView::Tracks
        && app().shift.shift()
        && app()
          .lanes
          .picked_track()
          .is_some_and(|track| loop_on(&track).is_some())
    });
    fluid::create_effect(move || {
      let on = clip_knobs.value();
      let span = fluid::untrack(|| self.fit_span());
      self.knob_span.set_if_changed(on.then_some(span));
    });
    // The Synth view with a track picked shows and sets the track's own
    // sound: opening it puts the track's instrument and settings on the
    // keys, and each change made there is kept with the track.
    let synth_track = fluid::create_memo(move || {
      let a = app();
      (a.views.view() == ScreenView::Synth && !a.lanes.take_focused())
        .then(|| a.lanes.focused_lane().id)
    });
    let opened = synth_track.clone();
    fluid::create_effect(move || {
      if opened.with(Option::is_some) {
        fluid::untrack(|| self.open_track_sound());
      }
    });
    fluid::create_effect(move || {
      let a = app();
      let _ = a.sound.values();
      if synth_track.with(Option::is_some) {
        fluid::untrack(|| self.keep_track_sound());
      }
    });
  }

  fn synth_track(&self) -> Option<Track> {
    let a = app();
    (a.views.view() == ScreenView::Synth && !a.lanes.take_focused()).then(|| a.lanes.focused_lane())
  }

  fn open_track_sound(&self) {
    let Some(opened) = self.synth_track() else {
      return;
    };
    let a = app();
    let presets = a.sound.presets();
    let preset = presets
      .iter()
      .find(|preset| preset.id == opened.preset_id)
      .cloned()
      .or_else(|| preset_for_target(&opened.sound.target).cloned());
    if let Some(preset) = preset {
      let values = opened
        .sound
        .overrides
        .get(&opened.sound.target)
        .cloned()
        .unwrap_or_default();
      a.sound.play_with(&preset, &values);
    }
  }

  fn keep_track_sound(&self) {
    let Some(kept) = self.synth_track() else {
      return;
    };
    let a = app();
    if a.sound.preset_id() != kept.preset_id {
      return;
    }
    let target = kept.sound.target.clone();
    let live = a
      .engine
      .sound()
      .overrides
      .get(&target)
      .cloned()
      .unwrap_or_default();
    let own = kept
      .sound
      .overrides
      .get(&target)
      .cloned()
      .unwrap_or_default();
    let same = live.len() == own.len() && live.iter().all(|(id, value)| own.get(id) == Some(value));
    if !same {
      a.lanes.update_track(&kept.id, |track| {
        track.sound.overrides.insert(target, live);
      });
    }
  }

  /// Each lane's clip at the tempo.
  pub fn clips(&self) -> Vec<TrackClip> {
    self
      .clips
      .borrow()
      .as_ref()
      .map(Memo::cloned)
      .unwrap_or_default()
  }

  /// A timeline at least four bars long that ends on the bar after the last
  /// lane's last copy.
  fn fit_span(&self) -> f64 {
    let bar_beats = f64::from(app().transport.bar_beats());
    let pattern = app().grid.pattern_clip().map_or(0., |clip| clip.length);
    let mut bars = 4f64.max((pattern / bar_beats).ceil());
    for clip in self.clips() {
      if let Some(last) = clip.copies.last() {
        bars = bars.max(
          ((last.start + clip.offset + clip.length * f64::from(last.repeats)) / bar_beats).ceil(),
        );
      }
    }
    bar_beats * bars
  }

  pub fn track_span(&self) -> f64 {
    self
      .fit_span()
      .max(self.drag_span.value().unwrap_or(0.))
      .max(self.knob_span.value().unwrap_or(0.))
  }

  pub fn track_zooms(&self) -> Vec<f64> {
    let span = self.track_span();
    let bar_beats = f64::from(app().transport.bar_beats());
    TRACK_ZOOMS
      .iter()
      .copied()
      .filter(|&zoom| zoom == 1. || span / zoom >= bar_beats)
      .collect()
  }

  pub fn track_zoom(&self) -> f64 {
    let zooms = self.track_zooms();
    zooms[self.zoom_step.value().min(zooms.len() - 1)]
  }

  pub fn track_window(&self) -> f64 {
    self.track_span() / self.track_zoom()
  }

  pub fn track_from(&self) -> f64 {
    let span = self.track_span();
    self
      .pan_from
      .value()
      .max(0.)
      .min(span - self.track_window())
  }

  /// Shift + blue pans the zoomed lanes a beat a step.
  pub fn pan_steps(&self) -> usize {
    ((self.track_span() - self.track_window()).ceil() as usize + 1).max(2)
  }

  pub fn pan_tracks(&self, beats: f64) {
    let (from, span, window) =
      fluid::untrack(|| (self.track_from(), self.track_span(), self.track_window()));
    self.pan_from.set((from + beats).max(0.).min(span - window));
  }

  pub fn scroll_tracks(&self, step: f64) {
    let (span, window) = fluid::untrack(|| (self.track_span(), self.track_window()));
    self.pan_from.set(step.min(span - window));
  }

  /// Zooms about the middle of what the lanes show.
  pub fn zoom_tracks(&self, step: usize) {
    let (zooms, from, window, span) = fluid::untrack(|| {
      (
        self.track_zooms(),
        self.track_from(),
        self.track_window(),
        self.track_span(),
      )
    });
    let zoom = zooms[step.min(zooms.len() - 1)];
    fluid::batch(|| {
      self.zoom_step.set(step);
      self.pan_from.set(from + window / 2. - span / zoom / 2.);
    });
  }

  pub fn reset_timeline(&self) {
    fluid::batch(|| {
      self.zoom_step.set(0);
      self.pan_from.set(0.);
    });
  }

  pub fn set_dragging(&self, dragging: bool) {
    let span = fluid::untrack(|| self.track_span());
    self.drag_span.set(dragging.then_some(span));
  }

  fn bpm(&self) -> f64 {
    app().transport.bpm.value()
  }

  fn track(&self) -> Option<Track> {
    app().lanes.picked_track()
  }

  /// The picked track's copies as they play.
  pub fn copies(&self) -> Vec<TrackCopy> {
    self
      .track()
      .map(|track| placed_copies(&track, self.bpm()))
      .unwrap_or_default()
  }

  /// The copy the arrows, Shift + green and Delete act on: picked with
  /// Shift + ↓ ↑, and the first again whenever another track is picked.
  pub fn copy_index(&self) -> usize {
    let Some(track) = self.track() else {
      return 0;
    };
    let (id, index) = self.copy_pick.cloned();
    if id == track.id {
      index.min(self.copies().len().saturating_sub(1))
    } else {
      0
    }
  }

  pub fn copy(&self) -> Option<TrackCopy> {
    self.copies().get(self.copy_index()).copied()
  }

  fn pass_beats(&self, track: &Track) -> f64 {
    let bpm = self.bpm();
    pass_of(track, bpm).length / (60_000. / bpm)
  }

  /// Keeps the picked track's copies, settled so none overlap: one that
  /// grows or slides later pushes those after it along.
  fn set_copies(&self, track: &Track, next: &[TrackCopy]) {
    let settled = settle_copies(next, fluid::untrack(|| self.pass_beats(track)));
    app()
      .lanes
      .update_track(&track.id, |track| set_copies(track, &settled));
  }

  /// Moves the picked copy to `start`, but never before the one ahead of it
  /// ends (or the timeline starts).
  pub fn slide_to(&self, start: f64) {
    let (track, copies, index) =
      fluid::untrack(|| (self.track(), self.copies(), self.copy_index()));
    let Some(track) = track else {
      return;
    };
    if copies.get(index).is_none() {
      return;
    }
    let pass = fluid::untrack(|| self.pass_beats(&track));
    let earliest = if index > 0 {
      let ahead = copies[index - 1];
      ahead.start + pass * f64::from(ahead.repeats)
    } else {
      0.
    };
    let mut next = copies;
    next[index].start = earliest.max(start);
    self.set_copies(&track, &next);
  }

  /// The arrows slide the picked copy along the timeline by bars.
  pub fn slide_track(&self, beats: f64) {
    if let Some(copy) = fluid::untrack(|| self.copy()) {
      self.slide_to(copy.start + beats);
    }
  }

  /// Shift and the arrows play the picked copy once more or once less,
  /// back to back: at least once, and for at most an hour.
  pub fn repeat_track(&self, direction: i32) {
    let (track, copies, index) =
      fluid::untrack(|| (self.track(), self.copies(), self.copy_index()));
    let (Some(track), Some(copy)) = (track, copies.get(index).copied()) else {
      return;
    };
    let most = max_repeats(&track, fluid::untrack(|| self.bpm()));
    let repeats = (copy.repeats as i64 + i64::from(direction))
      .max(1)
      .min(i64::from(most)) as u32;
    let mut next = copies;
    next[index].repeats = repeats;
    self.set_copies(&track, &next);
  }

  /// Shift + ↓ picks the next copy of the picked track, or past the last
  /// adds one right after it, repeating as often; Shift + ↑ the one before.
  pub fn step_copy(&self, direction: i32) {
    let (track, copies, index) =
      fluid::untrack(|| (self.track(), self.copies(), self.copy_index()));
    let (Some(track), Some(copy)) = (track, copies.get(index).copied()) else {
      return;
    };
    fluid::batch(|| {
      if direction > 0 && index == copies.len() - 1 {
        let pass = fluid::untrack(|| self.pass_beats(&track));
        let mut next = copies.clone();
        next.push(TrackCopy {
          start: copy.start + pass * f64::from(copy.repeats),
          repeats: copy.repeats,
        });
        self.set_copies(&track, &next);
        app()
          .feedback
          .show_notice(format!("Copied {} ({})", track.name, copies.len() + 1));
      }
      self.copy_pick.set((
        track.id.clone(),
        (index as i64 + i64::from(direction)).max(0) as usize,
      ));
    });
  }

  /// A copy clicked in a lane: picks its track, and that copy.
  pub fn pick_copy(&self, index: usize, copy: usize) {
    if index == 0 {
      return;
    }
    let Some(clicked) = fluid::untrack(|| app().lanes.tracks().get(index - 1).cloned()) else {
      return;
    };
    fluid::batch(|| {
      app().lanes.set_focus_index(index);
      self.copy_pick.set((clicked.id, copy));
    });
  }

  /// Takes the picked copy out, picking the one before it; the last copy
  /// left is the track.
  pub fn delete_copy(&self) {
    let (track, copies, index) =
      fluid::untrack(|| (self.track(), self.copies(), self.copy_index()));
    let Some(track) = track else {
      return;
    };
    if copies.len() < 2 {
      return;
    }
    let next: Vec<TrackCopy> = copies
      .iter()
      .enumerate()
      .filter(|(i, _)| *i != index)
      .map(|(_, copy)| *copy)
      .collect();
    fluid::batch(|| {
      self.set_copies(&track, &next);
      self
        .copy_pick
        .set((track.id.clone(), index.saturating_sub(1)));
    });
  }

  /// Dragging a clipped track's edge trims its loop, a grid step at a time
  /// (finer than the knobs); it picks that track too.
  pub fn drag_loop_edge(&self, index: usize, start_edge: bool, beats: f64) {
    if index == 0 {
      return;
    }
    let (dragged, bpm) =
      fluid::untrack(|| (app().lanes.tracks().get(index - 1).cloned(), self.bpm()));
    let Some(dragged) = dragged else {
      return;
    };
    let Some(TrackLoop { start, end, .. }) = loop_on(&dragged) else {
      return;
    };
    let unit = 1. / f64::from(grid_steps(&dragged));
    let reach = take_beats(&dragged);
    let at = reach.min((round(take_beats_at(&dragged, bpm, beats) / unit) * unit).max(0.));
    let next = if start_edge {
      TrackLoop {
        start: at.min(end - unit).max(0.),
        end,
        on: true,
      }
    } else {
      TrackLoop {
        start,
        end: at.max(start + unit),
        on: true,
      }
    };
    fluid::batch(|| {
      app().lanes.set_focus_index(index);
      app()
        .lanes
        .update_track(&dragged.id, |track| track.loop_ = Some(next));
    });
  }

  /// The picked track's loop while it plays.
  pub fn track_loop(&self) -> Option<TrackLoop> {
    self.track().and_then(|track| loop_on(&track))
  }

  /// What a loop's edges move by, in the take's beats.
  pub fn loop_unit(&self) -> f64 {
    self.track().map_or(1., |track| loop_step(&track))
  }

  pub fn loop_steps(&self) -> usize {
    let reach = self.track().map_or(0., |track| take_beats(&track));
    ((reach / self.loop_unit()).ceil() as usize + 1).max(2)
  }

  /// Shift turns the red and blue knobs over to the clip's edges, a step at
  /// a time: red its start, blue its end.
  pub fn set_loop_edge(&self, start_edge: bool, step: usize) {
    let (track, unit) = fluid::untrack(|| (self.track(), self.loop_unit()));
    let Some(track) = track else {
      return;
    };
    let Some(current) = loop_on(&track) else {
      return;
    };
    let at = (step as f64 * unit).min(take_beats(&track));
    let next = if start_edge {
      TrackLoop {
        start: at.min(current.end - unit).max(0.),
        ..current
      }
    } else {
      TrackLoop {
        end: at.max(current.start + unit),
        ..current
      }
    };
    app()
      .lanes
      .update_track(&track.id, |track| track.loop_ = Some(next));
  }

  pub fn loop_label(&self, beats: f64) -> String {
    let bar_beats = app().transport.bar_beats();
    match self.track() {
      Some(track) => position_label(beats, track.timing.meter.beats, grid_steps(&track)),
      None => position_label(beats, bar_beats, 4),
    }
  }

  /// Where a track starts on the timeline, as the footer shows it.
  pub fn start_label(&self, beats: f64) -> String {
    let bar_beats = f64::from(app().transport.bar_beats());
    let bar = (beats / bar_beats).floor() + 1.;
    let within = beats % bar_beats;
    if within != 0. {
      format!("Bar {bar} beat {}", within.floor() + 1.)
    } else {
      format!("Bar {bar}")
    }
  }

  /// The same in short: the bar, and the beat after a dot when it isn't
  /// the first.
  pub fn start_short(&self, beats: f64) -> String {
    let bar_beats = f64::from(app().transport.bar_beats());
    let bar = (beats / bar_beats).floor() + 1.;
    let within = beats % bar_beats;
    if within != 0. {
      format!("{bar}.{}", within.floor() + 1.)
    } else {
      format!("{bar}")
    }
  }

  /// Clips a track to its loop or lets it play whole, keeping the edges; at
  /// first the clip spans the whole take.
  pub fn toggle_clip(&self, clipped: &Track) {
    let next = match clipped.loop_ {
      Some(current) => TrackLoop {
        on: !current.on,
        ..current
      },
      None => TrackLoop {
        start: 0.,
        end: take_beats(clipped),
        on: true,
      },
    };
    app()
      .lanes
      .update_track(&clipped.id, |track| track.loop_ = Some(next));
  }

  /// Trims a clipped track for good to its clip, and a latched Shift lets
  /// go.
  pub fn trim_to_clip(&self, clipped: &Track) {
    let cut = cut_to_loop(clipped, fluid::untrack(|| self.bpm()));
    fluid::batch(|| {
      app().lanes.update_track(&clipped.id, |track| *track = cut);
      app().shift.release();
      app()
        .feedback
        .show_notice(format!("Trimmed {} to its clip", clipped.name));
    });
  }

  /// Sets a track's own tempo, which it plays at from now on: it stops
  /// following the tape's.
  pub fn set_track_tempo(&self, tempoed: &Track, tempo: f64) {
    app().lanes.update_track(&tempoed.id, |track| {
      track.follow_tape = Some(false);
      track.timing.bpm = round(tempo).clamp(MIN_BPM, MAX_BPM);
    });
  }

  /// A track's own swing, which it keeps whatever the tape's.
  pub fn set_track_swing(&self, swung: &Track, swing: Swing) {
    app()
      .lanes
      .update_track(&swung.id, |track| track.timing.swing = Some(swing));
  }

  /// Gives every track the same tempo of its own: `tempo`, the tape's.
  pub fn set_all_track_tempo(&self, tempo: f64) {
    app().session.set_tracks(|tracks| {
      for track in tracks {
        track.follow_tape = Some(false);
        track.timing.bpm = tempo;
      }
    });
  }

  /// Links a track to the tape's tempo, or unlinks it, keeping the speed it
  /// plays at now as its own.
  pub fn toggle_follow_tape(&self, linked: &Track) {
    let bpm = fluid::untrack(|| self.bpm());
    let follows = follows_tape(linked);
    let own = track_bpm(linked, bpm);
    app().lanes.update_track(&linked.id, |track| {
      if follows {
        track.follow_tape = Some(false);
        track.timing.bpm = own;
      } else {
        track.follow_tape = Some(true);
      }
    });
  }

  /// Puts the preset now playing on a track, as it sounds now, through the
  /// track's own ADSR, LFO and FX.
  pub fn set_track_instrument(&self, changed: &Track, preset: &DevicePreset) {
    let sound = with_modules(&app().engine.sound(), &track_modules(changed));
    let take_target = changed
      .take_target
      .clone()
      .unwrap_or_else(|| changed.sound.target.clone());
    app().lanes.update_track(&changed.id, |track| {
      track.name = preset.name.clone();
      track.preset_id = preset.id.clone();
      track.sound = sound;
      track.take_target = Some(take_target);
    });
  }

  /// A track's mute, or with `solo` its solo. The take has neither.
  pub fn toggle_switch(&self, switched: &Track, solo: bool) {
    if is_take(switched) {
      return;
    }
    app().lanes.update_track(&switched.id, |track| {
      if solo {
        track.soloed = !track.soloed;
      } else {
        track.muted = !track.muted;
      }
    });
  }
}
