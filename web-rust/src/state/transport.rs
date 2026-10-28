//! The tape deck: tempo, metronome, tap tempo, recording and playing the
//! take, as web-react's `useTransport` and `TransportProvider`.

use std::cell::{Cell, RefCell};
use std::collections::HashMap;
use std::rc::Rc;

use fluid::Signal;
use gloo_timers::callback::Timeout;

use super::app;
use super::clock::{delay, now};
use super::view::ScreenView;
use crate::logic::js::round;
use crate::logic::starter::Tape;
use crate::logic::swing::{STRAIGHT, Swing, straighten_notes, swing_on};
use crate::logic::timing::{
  DEFAULT_TIMING, MAX_TAKE_MS, METERS, NoteRecorder, PlayedNote, Take, Timing, timeline,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TransportState {
  Stopped,
  Playing,
  Recording,
}

/// What the screen's piano roll draws: the notes on the take's timeline,
/// where `now` is on it, and what the transport is doing.
#[derive(Clone, Debug)]
pub struct RollFrame {
  pub now: f64,
  pub notes: Vec<PlayedNote>,
  pub state: TransportState,
}

/// The roll's source, read every animation frame: the recording, the
/// playback, or (idle) the whole take. A playback holds its last and next
/// loops too, shifted by a loop, so notes keep scrolling across the seam.
enum Display {
  Recording,
  Playing { start: f64, notes: Vec<PlayedNote> },
  Idle,
}

pub const MIN_BPM: f64 = 1.;
pub const MAX_BPM: f64 = 999.;
/// Tap tempo is first set this long after the first tap, then follows each
/// tap until the window closes and tap mode ends.
const TAP_SET_MS: u32 = 1000;
const TAP_WINDOW_MS: u32 = 4000;
/// The tempo follows the latest gaps, so changing pace mid-window moves it.
const TAPS_AVERAGED: usize = 4;
/// Notes starting this close together (a chord) are one tap.
const CHORD_MS: f64 = 40.;

pub fn clamp_bpm(bpm: f64) -> f64 {
  round(bpm).clamp(MIN_BPM, MAX_BPM)
}

/// The beat from the gaps between taps: the median gap, averaged with the
/// gaps near it so one late tap doesn't skew it, folded by octaves into
/// range. `None` with fewer than two taps.
pub fn tempo_from_taps(taps: &[f64]) -> Option<f64> {
  if taps.len() < 2 {
    return None;
  }
  let mut gaps: Vec<f64> = taps.windows(2).map(|pair| pair[1] - pair[0]).collect();
  gaps.sort_by(f64::total_cmp);
  let median = gaps[gaps.len() / 2];
  let near: Vec<f64> = gaps
    .into_iter()
    .filter(|gap| (gap - median).abs() <= 0.25 * median)
    .collect();
  let mut bpm = 60_000. / (near.iter().sum::<f64>() / near.len() as f64);
  while bpm < MIN_BPM {
    bpm *= 2.;
  }
  while bpm > MAX_BPM {
    bpm /= 2.;
  }
  Some(clamp_bpm(bpm))
}

pub struct Transport {
  pub state: Rc<Signal<TransportState>>,
  pub metronome: Rc<Signal<bool>>,
  pub bpm: Rc<Signal<f64>>,
  pub meter_index: Rc<Signal<usize>>,
  pub swing: Rc<Signal<Swing>>,
  /// The beat in the bar the metronome last clicked.
  beat: Rc<Signal<usize>>,
  /// Counts takes, so a rendered take can tell when it is stale.
  pub take_id: Rc<Signal<u64>>,
  display: RefCell<Display>,
  /// Where the next playback starts on the take (ms).
  play_from: Cell<f64>,
  session: RefCell<Option<NoteRecorder>>,
  pub tapping: Rc<Signal<bool>>,
  pub tap_count: Rc<Signal<usize>>,
  taps: RefCell<Vec<f64>>,
  tap_timer: RefCell<Option<Timeout>>,
  tap_window: RefCell<Option<Timeout>>,
  /// Where the stopped roll is scrolled to (the time on its keys line);
  /// `None` is the start of the take.
  pub roll_position: Rc<Signal<Option<f64>>>,
  /// The tape timing last kept, so only changes are kept.
  tape_timing: Cell<(f64, usize, Swing)>,
}

impl Transport {
  pub fn new() -> Self {
    let meter = METERS
      .iter()
      .position(|meter| *meter == DEFAULT_TIMING.meter)
      .unwrap_or(2);
    Self {
      state: Rc::new(Signal::new(TransportState::Stopped)),
      metronome: Rc::new(Signal::new(false)),
      bpm: Rc::new(Signal::new(DEFAULT_TIMING.bpm)),
      meter_index: Rc::new(Signal::new(meter)),
      swing: Rc::new(Signal::new(STRAIGHT)),
      beat: Rc::new(Signal::new(0)),
      take_id: Rc::new(Signal::new(0)),
      display: RefCell::new(Display::Idle),
      play_from: Cell::new(0.),
      session: RefCell::new(None),
      tapping: Rc::new(Signal::new(false)),
      tap_count: Rc::new(Signal::new(0)),
      taps: RefCell::default(),
      tap_timer: RefCell::default(),
      tap_window: RefCell::default(),
      roll_position: Rc::new(Signal::new(None)),
      tape_timing: Cell::new((DEFAULT_TIMING.bpm, meter, STRAIGHT)),
    }
  }

  /// Starts the metronome, playback and tape-timing effects, and takes the
  /// open tape's timing.
  pub fn install(&'static self) {
    if let Some(tape) = app().session.opened_tape() {
      self.apply_tape_timing(&tape);
    }
    self.tape_timing.set((
      self.bpm.value(),
      self.meter_index.value(),
      self.swing.value(),
    ));
    // Each tape keeps its tempo, time signature and swing: changing them is
    // kept with the tape open.
    fluid::create_effect(move || {
      let timing = (
        self.bpm.value(),
        self.meter_index.value(),
        self.swing.value(),
      );
      if self.tape_timing.get() == timing {
        return;
      }
      self.tape_timing.set(timing);
      fluid::untrack(|| {
        app()
          .session
          .set_tape_timing(timing.0, METERS[timing.1], timing.2)
      });
    });
    fluid::create_effect(move || {
      let (on, _) = (self.metronome.value(), self.state.value());
      if on {
        fluid::untrack(|| self.run_metronome());
      }
    });
    fluid::create_effect(move || {
      let state = self.state.value();
      let take = app().session.session.with(|session| session.take.clone());
      if let (TransportState::Playing, Some(take)) = (state, take) {
        fluid::untrack(|| self.run_playback(take));
      }
    });
    // A take records for an hour at most, then ends itself.
    fluid::create_effect(move || {
      if self.state.value() == TransportState::Recording {
        let timer = Timeout::new(MAX_TAKE_MS as u32, move || self.stop());
        fluid::on_cleanup(move || drop(timer));
      }
    });
  }

  /// Each click schedules the next from the current tempo, so a tempo
  /// change takes effect on the next beat without restarting the bar. The
  /// first beat of each bar is accented.
  fn run_metronome(&'static self) {
    struct Ticker {
      count: Cell<usize>,
      next: Cell<f64>,
      timer: RefCell<Option<Timeout>>,
    }
    fn tick(transport: &'static Transport, ticker: Rc<Ticker>) {
      let at = now();
      let timing = transport.timing_now();
      let beats = timing.meter.beats as usize;
      let count = ticker.count.get();
      app().engine.metronome_tick(count.is_multiple_of(beats));
      transport.beat.set(count % beats);
      ticker.count.set(count + 1);
      // After a stall (a hidden tab) carry on from now rather than catch up.
      ticker
        .next
        .set(ticker.next.get().max(at) + timing.beat_ms());
      let again = ticker.clone();
      let wait = delay(ticker.next.get() - now());
      *ticker.timer.borrow_mut() = Some(Timeout::new(wait, move || tick(transport, again)));
    }
    let ticker = Rc::new(Ticker {
      count: Cell::new(0),
      next: Cell::new(0.),
      timer: RefCell::new(None),
    });
    let first = ticker.clone();
    *ticker.timer.borrow_mut() = Some(Timeout::new(0, move || tick(self, first)));
    fluid::on_cleanup(move || {
      ticker.timer.borrow_mut().take();
    });
  }

  /// Plays the take on timers, looping in whole bars at the tempo and meter
  /// set as each loop starts.
  fn run_playback(&'static self, take: Take) {
    struct Playback {
      timers: RefCell<HashMap<u64, Timeout>>,
      next_id: Cell<u64>,
      voices: RefCell<HashMap<i32, usize>>,
      previous: RefCell<Vec<PlayedNote>>,
      /// The first pass starts where Play was pressed; loops start from the
      /// top.
      from: Cell<f64>,
      take: Take,
      stopped: Cell<bool>,
    }
    impl Playback {
      fn after(self: &Rc<Self>, ms: f64, callback: impl FnOnce(&Rc<Self>) + 'static) {
        let id = self.next_id.get();
        self.next_id.set(id + 1);
        let me = self.clone();
        let timer = Timeout::new(delay(ms), move || {
          me.timers.borrow_mut().remove(&id);
          if !me.stopped.get() {
            callback(&me);
          }
        });
        self.timers.borrow_mut().insert(id, timer);
      }
    }
    fn sound(playback: &Rc<Playback>, note: i32, velocity: f64, start: f64, duration: f64) {
      playback.after(start, move |playback| {
        app().engine.play_note(note, velocity);
        *playback.voices.borrow_mut().entry(note).or_default() += 1;
      });
      playback.after(start + duration, move |playback| {
        let mut voices = playback.voices.borrow_mut();
        let count = voices.entry(note).or_default();
        if *count == 0 {
          return;
        }
        *count -= 1;
        drop(voices);
        app().engine.note_off(note);
      });
    }
    fn run(transport: &'static Transport, playback: &Rc<Playback>) {
      let started = now();
      let line = timeline(Some(&playback.take), &transport.timing_now());
      let span = line.length;
      let offset = playback.from.get().min(span);
      playback.from.set(0.);
      for note in &line.notes {
        let end = note.start + note.duration;
        if end <= offset {
          continue;
        }
        // A note already sounding at the start point picks up from there.
        let at = note.start.max(offset);
        sound(playback, note.note, note.velocity, at - offset, end - at);
      }
      let mut shown = playback.previous.borrow().clone();
      shown.extend(line.notes.iter().copied());
      shown.extend(line.notes.iter().map(|note| PlayedNote {
        start: note.start + span,
        ..*note
      }));
      *transport.display.borrow_mut() = Display::Playing {
        start: started - offset,
        notes: shown,
      };
      *playback.previous.borrow_mut() = line
        .notes
        .iter()
        .map(|note| PlayedNote {
          start: note.start - span,
          ..*note
        })
        .collect();
      playback.after(span - offset, move |playback| run(transport, playback));
    }
    let playback = Rc::new(Playback {
      timers: RefCell::default(),
      next_id: Cell::new(0),
      voices: RefCell::default(),
      previous: RefCell::default(),
      from: Cell::new(self.play_from.get()),
      take,
      stopped: Cell::new(false),
    });
    run(self, &playback);
    fluid::on_cleanup(move || {
      if matches!(*self.display.borrow(), Display::Playing { .. }) {
        *self.display.borrow_mut() = Display::Idle;
      }
      playback.stopped.set(true);
      playback.timers.borrow_mut().clear();
      for (note, count) in playback.voices.borrow_mut().drain() {
        for _ in 0..count {
          app().engine.note_off(note);
        }
      }
    });
  }

  /// The timing as it is now, untracked: what the metronome, playback and
  /// roll read between redraws.
  pub fn timing_now(&self) -> Timing {
    fluid::untrack(|| self.timing())
  }

  /// The piano roll has no grid: takes keep the timing they were played
  /// with, played through the swing.
  pub fn timing(&self) -> Timing {
    Timing {
      bpm: self.bpm.value(),
      meter: METERS[self.meter_index.value()],
      per_beat: 0,
      swing: Some(self.swing.value()),
    }
  }

  pub fn state(&self) -> TransportState {
    self.state.value()
  }

  pub fn recording(&self) -> bool {
    self.state() == TransportState::Recording
  }

  pub fn playing(&self) -> bool {
    self.state() == TransportState::Playing
  }

  pub fn bar_beats(&self) -> u32 {
    METERS[self.meter_index.value()].beats
  }

  /// Tap mode while on the tempo view.
  pub fn tap_mode(&self) -> bool {
    self.tapping.value() && app().views.view() == ScreenView::Tempo
  }

  /// The beat the metronome is on, only while it runs.
  pub fn beat(&self) -> Option<usize> {
    self.metronome.value().then(|| self.beat.value())
  }

  pub fn has_take(&self) -> bool {
    app().session.session.with(|session| session.take.is_some())
  }

  pub fn take_length(&self) -> f64 {
    let timing = self.timing();
    app()
      .session
      .session
      .with(|session| timeline(session.take.as_ref(), &timing).length)
  }

  pub fn toggle_metronome(&self) {
    self.metronome.update(|on| *on = !*on);
  }

  pub fn set_bpm(&self, next: f64) {
    self.bpm.set(clamp_bpm(next));
  }

  pub fn set_meter(&self, index: usize) {
    self.meter_index.set(index);
  }

  pub fn set_swing(&self, next: Swing) {
    self.swing.set(next);
  }

  pub fn apply_tape_timing(&self, tape: &Tape) {
    fluid::batch(|| {
      self.set_bpm(tape.bpm);
      self.set_meter(tape.meter.index());
      self.set_swing(tape.swing.unwrap_or(STRAIGHT));
    });
  }

  /// Tap mode stops the metronome so its clicks don't pull the taps off.
  pub fn start_tapping(&'static self) {
    self.stop_tapping();
    fluid::batch(|| {
      self.metronome.set(false);
      self.tapping.set(true);
    });
  }

  pub fn stop_tapping(&self) {
    self.tap_timer.borrow_mut().take();
    self.tap_window.borrow_mut().take();
    self.taps.borrow_mut().clear();
    fluid::batch(|| {
      self.tap_count.set_if_changed(0);
      self.tapping.set_if_changed(false);
    });
  }

  fn apply_taps(&self) {
    let taps = self.taps.borrow();
    let from = taps.len().saturating_sub(TAPS_AVERAGED + 1);
    if let Some(tempo) = tempo_from_taps(&taps[from..]) {
      drop(taps);
      self.set_bpm(tempo);
    }
  }

  /// A played note in tap mode. A second after the first tap the taps so
  /// far set the tempo, and each tap after that resets it, until four
  /// seconds after the first, when tap mode ends.
  pub fn tap_note(&'static self) {
    if !self.tapping.get_untracked().to_owned() {
      return;
    }
    let at = now();
    let (first, last) = {
      let taps = self.taps.borrow();
      (taps.first().copied(), taps.last().copied())
    };
    if last.is_some_and(|last| at - last < CHORD_MS) {
      return;
    }
    self.taps.borrow_mut().push(at);
    self.tap_count.set(self.taps.borrow().len());
    match first {
      None => {
        *self.tap_timer.borrow_mut() = Some(Timeout::new(TAP_SET_MS, move || self.apply_taps()));
        *self.tap_window.borrow_mut() = Some(Timeout::new(TAP_WINDOW_MS, move || {
          self.apply_taps();
          self.stop_tapping();
        }));
      }
      Some(first) if at - first >= f64::from(TAP_SET_MS) => self.apply_taps(),
      Some(_) => {}
    }
  }

  fn finish_recording(&self) -> Option<Take> {
    let recorder = self.session.borrow_mut().take()?;
    // A take ends at the hour, even if the timer that ends it fires late.
    let at = now().min(recorder.origin + MAX_TAKE_MS);
    let length = at - recorder.origin;
    let played: Vec<PlayedNote> = recorder
      .take(at)
      .into_iter()
      .filter(|note| note.start < length)
      .collect();
    // Kept straight, since the take plays back through the swing: what was
    // played swung comes back as it was.
    let timing = self.timing_now();
    let notes = match swing_on(timing.swing, 0) {
      Some(swing) => straighten_notes(&played, timing.beat_ms(), swing),
      None => played,
    };
    *self.display.borrow_mut() = Display::Idle;
    if notes.is_empty() {
      return None;
    }
    let recorded = Take {
      notes,
      length,
      bpm: timing.bpm,
    };
    fluid::batch(|| {
      app().session.set_take(Some(recorded.clone()));
      self.take_id.update(|id| *id += 1);
    });
    Some(recorded)
  }

  /// Starts a take, returning when it starts (`performance.now` ms), or
  /// ends one.
  pub fn record(&self) -> Option<f64> {
    if self.session.borrow().is_some() {
      fluid::batch(|| {
        self.finish_recording();
        self.state.set(TransportState::Stopped);
      });
      return None;
    }
    let recorder = NoteRecorder::new(now());
    let origin = recorder.origin;
    *self.session.borrow_mut() = Some(recorder);
    *self.display.borrow_mut() = Display::Recording;
    self.state.set(TransportState::Recording);
    Some(origin)
  }

  /// Plays the take from `from` (ms). While recording, the new take is
  /// thrown away and the one before it plays.
  pub fn play(&self, from: f64) {
    if self.session.borrow_mut().take().is_some() {
      *self.display.borrow_mut() = Display::Idle;
    }
    self.play_from.set(from.max(0.));
    let state = if fluid::untrack(|| self.has_take()) {
      TransportState::Playing
    } else {
      TransportState::Stopped
    };
    self.state.set(state);
  }

  /// The take to keep, ending a recording first.
  pub fn keep_take(&self) -> Option<Take> {
    if self.session.borrow().is_none() {
      return app()
        .session
        .session
        .with_untracked(|session| session.take.clone());
    }
    fluid::batch(|| {
      let recorded = self.finish_recording();
      self.state.set(TransportState::Stopped);
      recorded
    })
  }

  pub fn stop(&self) {
    fluid::batch(|| {
      self.finish_recording();
      self.state.set(TransportState::Stopped);
    });
  }

  /// A played note, while recording. Velocity is 0–1.
  pub fn capture(&self, note: i32, on: bool, velocity: f64) {
    if let Some(recorder) = self.session.borrow_mut().as_mut() {
      if on {
        recorder.note_on(note, velocity, now());
      } else {
        recorder.note_off(note, now());
      }
    }
  }

  /// What the roll draws now; reads no signals, for its animation loop.
  pub fn roll(&self) -> RollFrame {
    let at = now();
    match &*self.display.borrow() {
      Display::Recording => {
        if let Some(recorder) = self.session.borrow().as_ref() {
          return RollFrame {
            now: at - recorder.origin,
            notes: recorder.take(at),
            state: TransportState::Recording,
          };
        }
      }
      Display::Playing { start, notes } => {
        return RollFrame {
          now: at - start,
          notes: notes.clone(),
          state: TransportState::Playing,
        };
      }
      Display::Idle => {}
    }
    let timing = self.timing_now();
    let line = app()
      .session
      .session
      .with_untracked(|session| timeline(session.take.as_ref(), &timing));
    RollFrame {
      now: line.length,
      notes: line.notes,
      state: TransportState::Stopped,
    }
  }

  /// Holds the take where it is, so Play resumes there.
  pub fn pause(&self) {
    let at = self.roll().now;
    fluid::batch(|| {
      self.roll_position.set(Some(at));
      self.stop();
    });
  }

  /// One thing plays at a time: the tracks or the drum grid starting pauses
  /// the take, which otherwise plays on in other views.
  pub fn pause_take(&self) {
    if *self.state.get_untracked() == TransportState::Playing {
      self.pause();
    }
  }

  pub fn set_roll_position(&self, position: Option<f64>) {
    self.roll_position.set_if_changed(position);
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn taps_set_the_tempo() {
    assert_eq!(tempo_from_taps(&[0.]), None);
    assert_eq!(tempo_from_taps(&[0., 500., 1000., 1500.]), Some(120.));
    // One late tap doesn't pull it off.
    assert_eq!(
      tempo_from_taps(&[0., 500., 1000., 1700., 2200.]),
      Some(120.)
    );
    assert_eq!(tempo_from_taps(&[0., 10.]), Some(750.));
  }
}
