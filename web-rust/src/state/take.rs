//! The piano roll's take: arming it, scrolling and scrubbing it in time,
//! and where it shows in pitch, as web-react's `TakeProvider`.

use std::future::Future;
use std::pin::Pin;
use std::rc::Rc;

use fluid::Signal;
use web_sys::AudioBuffer;

use super::app;
use super::performance::F3_MIDI;
use super::scrub::{Render, Scrub};
use super::view::ScreenView;
use crate::logic::timing::Take;

/// C0 to C10, the range of the studio's piano roll, two octaves of it in
/// view at a time, a lane a semitone.
pub const ROLL_LOW: i32 = 12;
pub const ROLL_HIGH: i32 = 132;
pub const ROLL_LANES: i32 = 25;
/// The highest the view's lowest note goes.
pub const ROLL_TOP: i32 = ROLL_HIGH - ROLL_LANES + 1;
/// The highest MIDI note.
const MIDI_TOP: i32 = 127;

const NAMES: [&str; 12] = [
  "C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B",
];

pub fn roll_note(midi: i32) -> String {
  format!(
    "{}{}",
    NAMES[midi.rem_euclid(12) as usize],
    midi.div_euclid(12) - 1
  )
}

fn clamp_roll_low(low: i32) -> i32 {
  low.clamp(ROLL_LOW, ROLL_TOP)
}

pub struct TakeStore {
  /// The roll's lowest note in view, once scrolled; until then it follows
  /// the keys.
  scrolled_low: Rc<Signal<Option<i32>>>,
  /// Record arms a take on the roll and Play starts it, like a tape deck.
  armed: Rc<Signal<bool>>,
  scrub: Scrub,
}

impl TakeStore {
  pub fn new() -> Self {
    Self {
      scrolled_low: Rc::new(Signal::new(None)),
      armed: Rc::new(Signal::new(false)),
      scrub: Scrub::whole(),
    }
  }

  pub fn install(&'static self) {
    // Stopped, the roll scrolls; otherwise the scrub stops.
    let scrolls = fluid::create_memo(move || self.roll_scrolls());
    fluid::create_effect(move || {
      if !scrolls.value() {
        self.scrub.stop();
      }
    });
  }

  /// It stays armed only while the roll is showing.
  pub fn view_changed(&self, view: ScreenView) {
    if view != ScreenView::Roll {
      self.armed.set_if_changed(false);
    }
  }

  pub fn record_armed(&self) -> bool {
    self.armed.value() && app().views.view() == ScreenView::Roll
  }

  pub fn roll_low(&self) -> i32 {
    let octave = app().sound.octave.value();
    clamp_roll_low(
      self
        .scrolled_low
        .value()
        .unwrap_or(F3_MIDI - 1 + 12 * octave),
    )
  }

  pub fn roll_range(&self) -> String {
    let low = self.roll_low();
    format!("{}–{}", roll_note(low), roll_note(low + ROLL_LANES - 1))
  }

  /// The blue knob moves the roll an octave a detent, keeping its semitone.
  pub fn roll_octave(&self) -> usize {
    ((self.roll_low() - ROLL_LOW) / 12) as usize
  }

  pub fn roll_octaves(&self) -> usize {
    ((ROLL_TOP - ROLL_LOW) / 12 + 1) as usize
  }

  pub fn set_roll_octave(&self, step: usize) {
    let (low, octave) = fluid::untrack(|| (self.roll_low(), self.roll_octave()));
    self.scrolled_low.set(Some(clamp_roll_low(
      low + 12 * (step as i32 - octave as i32),
    )));
  }

  pub fn scroll_roll_pitch(&self, semitones: i32) {
    let low = fluid::untrack(|| self.roll_low());
    self.scrolled_low.set(Some(clamp_roll_low(low + semitones)));
  }

  fn take(&self) -> Option<Take> {
    app().session.session.with(|session| session.take.clone())
  }

  fn pitches(&self) -> Option<(i32, i32)> {
    app().session.session.with(|session| {
      let take = session.take.as_ref()?;
      let low = take.notes.iter().map(|note| note.note).min()?;
      let high = take.notes.iter().map(|note| note.note).max()?;
      Some((low, high))
    })
  }

  /// The take's notes, low to high, as the status shows them.
  pub fn take_notes(&self) -> Option<String> {
    self
      .pitches()
      .map(|(low, high)| format!("{}–{}", roll_note(low), roll_note(high)))
  }

  pub fn transpose_step(&self) -> usize {
    self
      .pitches()
      .map_or(0, |(low, _)| (low - ROLL_LOW).max(0) as usize)
  }

  pub fn transpose_steps(&self) -> usize {
    let span = self.pitches().map_or(0, |(low, high)| high - low);
    ((MIDI_TOP - span - ROLL_LOW + 1).max(2)) as usize
  }

  /// Moves every note of the take so its lowest is `step` semitones above
  /// the roll's bottom, and scrolls the roll after them if they leave it.
  pub fn transpose_take(&self, step: usize) {
    let a = app();
    let (take, pitches, recording, roll_low) = fluid::untrack(|| {
      (
        self.take(),
        self.pitches(),
        a.transport.recording(),
        self.roll_low(),
      )
    });
    let (Some(mut take), Some((low, high))) = (take, pitches) else {
      return;
    };
    if recording {
      return;
    }
    let shift = (MIDI_TOP - high).min((ROLL_LOW - low).max(ROLL_LOW + step as i32 - low));
    if shift == 0 {
      return;
    }
    for note in &mut take.notes {
      note.note += shift;
    }
    fluid::batch(|| {
      a.session.set_take(Some(take));
      let (low, high) = (low + shift, high + shift);
      if low < roll_low {
        self.scrolled_low.set(Some(clamp_roll_low(low)));
      } else if high > roll_low + ROLL_LANES - 1 {
        self
          .scrolled_low
          .set(Some(clamp_roll_low(high - ROLL_LANES + 1)));
      }
    });
  }

  /// Stopped, the roll shows the whole take and scrolls by beats from its
  /// start to its end. The keys line is the playhead.
  pub fn roll_scrolls(&self) -> bool {
    let a = app();
    a.views.view() == ScreenView::Roll
      && !a.transport.playing()
      && !a.transport.recording()
      && self.roll_end() > 0.
  }

  pub fn roll_end(&self) -> f64 {
    app().transport.take_length()
  }

  pub fn roll_at(&self) -> f64 {
    self
      .roll_end()
      .min(app().transport.roll_position.value().unwrap_or(0.))
  }

  fn beat_length(&self) -> f64 {
    app().transport.timing().beat_ms()
  }

  pub fn roll_steps(&self) -> usize {
    ((self.roll_end() / self.beat_length()).ceil() as usize + 1).max(2)
  }

  pub fn roll_step(&self) -> usize {
    crate::logic::js::round(self.roll_at() / self.beat_length()) as usize
  }

  /// The bar a time falls in, from 1.
  pub fn bar_of(&self, ms: f64) -> usize {
    ((ms / app().transport.timing().bar_ms()).ceil() as usize).max(1)
  }

  /// Everything that shapes the scrubbed take's sound.
  fn scrub_key(&self) -> String {
    let a = app();
    serde_json::to_string(&(
      a.transport.take_id.value(),
      self.take(),
      a.transport.timing(),
      a.sound.preset_id(),
      a.sound.values(),
      a.lanes.modules(),
      a.output.level_step.value(),
    ))
    .unwrap_or_default()
  }

  fn render(&self) -> Render {
    Box::new(
      |_, _| -> Pin<Box<dyn Future<Output = Option<AudioBuffer>>>> {
        let frame = app().transport.roll();
        let sound = app().engine.sound();
        Box::pin(async move { app().engine.render(&frame.notes, frame.now, &sound).await })
      },
    )
  }

  /// Scrolling scrubs the take: it plays at the speed it is scrolled.
  pub fn scroll_roll(&self, ms: f64) {
    let (key, at, end) = fluid::untrack(|| (self.scrub_key(), self.roll_at(), self.roll_end()));
    let to = self.scrub.scroll_by(&key, ms, at, 0., end, &self.render());
    app().transport.set_roll_position(Some(to));
  }

  pub fn scrub_roll_to(&self, step: f64) {
    let (key, at, end, beat) = fluid::untrack(|| {
      (
        self.scrub_key(),
        self.roll_at(),
        self.roll_end(),
        self.beat_length(),
      )
    });
    let to = end.min(step * beat);
    self.scrub.scroll_to(&key, to, at, &self.render());
    app().transport.set_roll_position(Some(to));
  }

  /// Starts the armed take. The tracks play along from the top, lined up
  /// with it.
  fn start_recording(&self) {
    self.armed.set(false);
    if let Some(origin) = app().transport.record() {
      app().mix.follow(origin);
    }
  }

  /// Play and pause in one: plays the take from where the stopped roll is
  /// scrolled to (from the top when it rests at the end), and pauses it
  /// while it plays. Armed, it starts recording; while recording, it ends
  /// the take.
  pub fn toggle_play(&self) {
    let a = app();
    let transport = &a.transport;
    let (recording, armed, playing, position, length) = fluid::untrack(|| {
      (
        transport.recording(),
        self.record_armed(),
        transport.playing(),
        transport.roll_position.value(),
        transport.take_length(),
      )
    });
    if recording {
      transport.stop();
      return;
    }
    if armed {
      a.engine.unlock();
      self.start_recording();
      return;
    }
    if playing {
      transport.pause();
      return;
    }
    a.engine.unlock();
    let from = position.filter(|at| *at < length).unwrap_or(0.);
    fluid::batch(|| {
      transport.set_roll_position(None);
      transport.play(from);
    });
  }

  /// Stops playback, holding like pause; on the roll a second press scrolls
  /// the take back to the top. While recording it ends the take, and while
  /// armed it disarms.
  pub fn stop(&self) {
    let a = app();
    let transport = &a.transport;
    let (recording, armed, playing, view) = fluid::untrack(|| {
      (
        transport.recording(),
        self.record_armed(),
        transport.playing(),
        a.views.view(),
      )
    });
    if recording {
      transport.stop();
    } else if armed {
      self.armed.set(false);
    } else if view == ScreenView::Roll && !playing {
      transport.set_roll_position(None);
    } else if playing {
      transport.pause();
    }
  }

  /// Arms a take, showing the roll, or disarms it; Play then starts it.
  /// While recording it ends the take where it stops.
  pub fn toggle_record(&self) {
    let a = app();
    a.engine.unlock();
    let (recording, armed) = fluid::untrack(|| (a.transport.recording(), self.record_armed()));
    if recording {
      a.transport.stop();
    } else if armed {
      self.armed.set(false);
    } else {
      fluid::batch(|| {
        a.views.set_view(ScreenView::Roll);
        self.armed.set(true);
      });
    }
  }
}
