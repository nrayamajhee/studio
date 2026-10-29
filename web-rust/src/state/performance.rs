//! Playing the keybed: held keys and the notes they light, and the chord
//! pads that turn a key into a chord in the play style, as web-react's
//! `PerformanceProvider` and `playChord`.

use std::cell::{Cell, RefCell};
use std::collections::{BTreeMap, BTreeSet};
use std::rc::Rc;

use fluid::Signal;
use gloo_timers::callback::Timeout;

use super::app;
use super::clock::{delay, now};
use super::view::ScreenView;
use crate::logic::chords::{Chord, chord_by_id};
use crate::logic::play_styles::{
  PlayStyle, PlayStyleOption, Strike, Sweep, play_style_options, rhythm, steps_of, style_edited,
};
use crate::logic::progressions::{Progression, progression_take};
use crate::logic::swing::{swing_on, swing_time};

/// The keybed's first key, F3.
pub const F3_MIDI: i32 = 53;

/// A held key: the semitones it lights and the chord player it started.
struct HeldKey {
  semitones: Vec<i32>,
  player: Rc<ChordPlayer>,
}

/// Playing the keybed, as web-react's `PerformanceProvider` and `playChord`:
/// the keys held and the semitones they light, the chord pad latched, and a
/// progression waiting for its home note.
///
/// [`Performance::press_key`] plays a key, as a note or, with a chord pad
/// active, as that chord in the play style (each through a [`ChordPlayer`]);
/// the next key after a progression's Save becomes its home note, writing the
/// progression as the take. The rest let keys go, latch or drop chords, and
/// read and pick the play style.
pub struct Performance {
  /// A chord latches on a click; its hotkey holds it while down.
  pub chord: Rc<Signal<Option<usize>>>,
  pub lit_notes: Rc<Signal<BTreeSet<i32>>>,
  held: RefCell<BTreeMap<i32, HeldKey>>,
  /// A progression waiting for its home note: the next key played sets it.
  pub home_for: Rc<Signal<Option<Progression>>>,
}

impl Performance {
  /// No keys held, no chord latched.
  pub fn new() -> Self {
    Self {
      chord: Rc::new(Signal::new(None)),
      lit_notes: Rc::new(Signal::new(BTreeSet::new())),
      held: RefCell::default(),
      home_for: Rc::new(Signal::new(None)),
    }
  }

  /// The chord each chord pad plays.
  pub fn pad_chords(&self) -> Vec<&'static Chord> {
    app()
      .chords
      .pad_chords
      .with(|ids| ids.iter().map(|id| chord_by_id(id)).collect())
  }

  /// The chord the keys play: a held key's, else the latched one.
  pub fn active_chord(&self) -> Option<usize> {
    app()
      .hotkeys
      .held
      .with(|held| held.chord)
      .or(self.chord.value())
  }

  /// The play style the chord pads play in.
  pub fn play_style(&self) -> PlayStyle {
    app().chords.play_style.cloned()
  }

  /// Every play style to pick from: the built-in patterns, then the saved ones.
  pub fn play_styles(&self) -> Vec<PlayStyleOption> {
    app()
      .chords
      .saved_styles
      .with(|saved| play_style_options(saved))
  }

  /// The play style picked: the saved one it was picked as, or (if that's
  /// gone) its built-in pattern.
  pub fn play_style_index(&self) -> usize {
    let style = self.play_style();
    let styles = self.play_styles();
    let saved = style
      .saved
      .as_ref()
      .and_then(|saved| styles.iter().position(|option| &option.id == saved));
    saved
      .or_else(|| styles.iter().position(|option| option.id == style.id))
      .unwrap_or(0)
  }

  /// The rate or strum moved off what the picked play style plays.
  pub fn play_style_edited(&self) -> bool {
    let styles = self.play_styles();
    style_edited(&self.play_style(), &styles[self.play_style_index()])
  }

  /// Publishes the semitones the held keys light.
  fn sync_lit_notes(&self) {
    let lit: BTreeSet<i32> = self
      .held
      .borrow()
      .values()
      .flat_map(|held| held.semitones.iter().copied())
      .collect();
    self.lit_notes.set_if_changed(lit);
  }

  /// Writes `progression` from the home note `home` as the take, and shows it
  /// on the roll.
  fn write_progression(&self, progression: &Progression, home: i32) {
    let a = app();
    let timing = a.transport.timing_now();
    let style = fluid::untrack(|| self.play_style());
    fluid::batch(|| {
      self.home_for.set(None);
      a.session
        .set_take(Some(progression_take(progression, home, &timing, &style)));
      a.views.set_view(ScreenView::Roll);
      a.feedback
        .show_notice(format!("Loaded {} as the take", progression.name));
    });
  }

  /// Plays a key: its note, or with a chord active the chord built on it,
  /// in the play style. MIDI plays at its own velocity; the keybed has none.
  pub fn press_key(&self, root: i32, chord: Option<usize>, velocity: f64) {
    if self.held.borrow().contains_key(&root) {
      return;
    }
    let a = app();
    a.views.leave_revert();
    a.engine.unlock();
    if fluid::untrack(|| a.transport.tap_mode()) {
      a.transport.tap_note();
    }
    let (intervals, octave, style, drum_grid) = fluid::untrack(|| {
      let intervals: Vec<i32> = match chord {
        Some(chord) => self.pad_chords()[chord].intervals.to_vec(),
        None => vec![0],
      };
      (
        intervals,
        a.sound.octave.value(),
        self.play_style(),
        a.views.view() == ScreenView::DrumGrid,
      )
    });
    let semitones: Vec<i32> = intervals.iter().map(|interval| root + interval).collect();
    let midis: Vec<i32> = semitones
      .iter()
      .map(|semitone| F3_MIDI + semitone + 12 * octave)
      .collect();
    // Taken out first: writing it lets the signal go.
    let awaited = self.home_for.get_untracked().clone();
    if let Some(progression) = awaited {
      self.write_progression(&progression, F3_MIDI + root + 12 * octave);
    }
    // A chord plays in the play style; the drum grid takes it as a block.
    let style = if chord.is_none() || drum_grid {
      PlayStyle::default()
    } else {
      style
    };
    let player = ChordPlayer::play(&midis, style, velocity);
    self
      .held
      .borrow_mut()
      .insert(root, HeldKey { semitones, player });
    self.sync_lit_notes();
    a.grid.notes_played(&midis);
  }

  /// Lets go of the key `root`, and whatever its chord still sounds.
  pub fn release_key(&self, root: i32) {
    let Some(held) = self.held.borrow_mut().remove(&root) else {
      return;
    };
    held.player.stop();
    self.sync_lit_notes();
  }

  /// The window lost focus or the page hid: held keys let go, if any.
  pub fn let_go(&self) {
    if !self.held.borrow().is_empty() {
      self.release_all();
    }
  }

  /// Lets go of every key, and anything still sounding.
  pub fn release_all(&self) {
    let held: Vec<HeldKey> = std::mem::take(&mut *self.held.borrow_mut())
      .into_values()
      .collect();
    for key in held {
      key.player.stop();
    }
    app().engine.all_notes_off();
    self.lit_notes.set_if_changed(BTreeSet::new());
  }

  /// Latches chord pad `index`, or drops it if it's the one latched.
  pub fn toggle_chord(&self, index: usize) {
    self.chord.update(|chord| {
      *chord = if *chord == Some(index) {
        None
      } else {
        Some(index)
      };
    });
  }

  /// Drops the latched chord.
  pub fn drop_chord(&self) {
    self.chord.set_if_changed(None);
  }

  /// Picking a play style plays it at its own rate and strum.
  pub fn pick_play_style(&self, index: usize) {
    let styles = fluid::untrack(|| self.play_styles());
    let style = styles[index.min(styles.len() - 1)].style.clone();
    app().chords.set_play_style(|current| *current = style);
  }

  /// Waits for a key to set `progression`'s home note, or with `None` stops
  /// waiting.
  pub fn await_home(&self, progression: Option<Progression>) {
    self.home_for.set(progression);
  }
}

/// A chord playing in a play style until it is stopped, which releases
/// whatever still sounds. A pattern keeps going round while held, each note
/// lasting its step, or a pulse's strike half of it, and an accented
/// rhythm's strikes louder or softer. The timing is read every step, so a
/// new tempo or swing takes hold at once.
pub struct ChordPlayer {
  notes: Vec<i32>,
  style: PlayStyle,
  velocity: f64,
  sounding: RefCell<Vec<i32>>,
  /// The step's timer, and timers for notes still to come.
  timers: RefCell<Vec<Timeout>>,
  /// A rhythm's strike: its sweep's notes still to come, and its end.
  struck: RefCell<Vec<Timeout>>,
  /// Where the next step falls straight (ms since the chord started).
  straight: Cell<f64>,
  count: Cell<usize>,
  next: Cell<f64>,
  stopped: Cell<bool>,
}

impl ChordPlayer {
  /// Starts `midis` in `style` at `velocity`, low to high.
  fn play(midis: &[i32], style: PlayStyle, velocity: f64) -> Rc<Self> {
    let mut notes = midis.to_vec();
    notes.sort_unstable();
    let player = Rc::new(Self {
      notes,
      style,
      velocity,
      sounding: RefCell::default(),
      timers: RefCell::default(),
      struck: RefCell::default(),
      straight: Cell::new(0.),
      count: Cell::new(0),
      next: Cell::new(now()),
      stopped: Cell::new(false),
    });
    player.start();
    player
  }

  /// Sounds `midi` at the player's velocity times `level`, capturing it for a
  /// take being recorded.
  fn on(&self, midi: i32, level: f64) {
    let a = app();
    let velocity = (self.velocity * level).min(1.);
    a.engine.note_on(midi, velocity);
    a.transport
      .capture(a.engine.take_note(midi), true, velocity);
    self.sounding.borrow_mut().push(midi);
  }

  /// Lets go of `midi`, if it's sounding.
  fn off(&self, midi: i32) {
    let mut sounding = self.sounding.borrow_mut();
    let Some(at) = sounding.iter().position(|note| *note == midi) else {
      return;
    };
    sounding.remove(at);
    drop(sounding);
    let a = app();
    a.engine.note_off(midi);
    a.transport.capture(a.engine.take_note(midi), false, 0.);
  }

  /// Lets go of every note sounding.
  fn let_go_all(&self) {
    let sounding = self.sounding.borrow().clone();
    for midi in sounding {
      self.off(midi);
    }
  }

  /// How long the step about to play lasts, swung, moving the straight time
  /// on.
  fn next_step(&self) -> f64 {
    let timing = app().transport.timing_now();
    let beat = timing.beat_ms();
    let from = self.straight.get();
    let straight = from + beat / f64::from(self.style.per_beat);
    self.straight.set(straight);
    match swing_on(timing.swing, self.style.per_beat) {
      Some(swing) => swing_time(straight, beat, swing) - swing_time(from, beat, swing),
      None => straight - from,
    }
  }

  /// A step's length, straight, at the tempo now (ms).
  fn step_ms(&self) -> f64 {
    app().transport.timing_now().beat_ms() / f64::from(self.style.per_beat)
  }

  /// Schedules `then` after `step` from the last step, or from now after a
  /// stall (a hidden tab) rather than catching up.
  fn again(self: &Rc<Self>, step: f64, then: fn(&Rc<Self>)) {
    self.next.set((self.next.get() + step).max(now()));
    let me = self.clone();
    let timer = Timeout::new(delay(self.next.get() - now()), move || {
      if !me.stopped.get() {
        then(&me);
      }
    });
    let mut timers = self.timers.borrow_mut();
    if timers.is_empty() {
      timers.push(timer);
    } else {
      timers[0] = timer;
    }
  }

  /// Starts the chord the way its style plays: all at once, strummed, rolled,
  /// or stepping through a rhythm or an arpeggio.
  fn start(self: &Rc<Self>) {
    let id = self.style.id.as_str();
    if id == "block" || self.notes.len() < 2 {
      for &midi in &self.notes {
        self.on(midi, 1.);
      }
    } else if rhythm(id).is_some() {
      self.rhythm_tick();
    } else if id == "rollPulse" {
      self.roll_tick();
    } else if id == "strum" || id == "roll" {
      // A roll spreads the chord a step a note rather than a strum's gap.
      let gap = if id == "roll" {
        self.step_ms()
      } else {
        f64::from(self.style.strum)
      };
      for (i, &midi) in self.notes.iter().enumerate() {
        if i == 0 {
          self.on(midi, 1.);
        } else {
          let me = self.clone();
          let timer = Timeout::new(delay(i as f64 * gap), move || {
            if !me.stopped.get() {
              me.on(midi, 1.);
            }
          });
          self.timers.borrow_mut().push(timer);
        }
      }
    } else {
      self.arpeggio_tick();
    }
  }

  /// Plays a rhythm's strikes for this step, and schedules the next.
  fn rhythm_tick(self: &Rc<Self>) {
    let Some(rhythm) = rhythm(&self.style.id) else {
      return;
    };
    let step = self.next_step();
    let count = self.count.get();
    self.count.set(count + 1);
    let at = count as u32 % rhythm.cycle;
    for strike in rhythm.strikes.iter().filter(|strike| strike.at == at) {
      self.strike(strike, step);
    }
    self.again(step, Self::rhythm_tick);
  }

  /// Each strike lets go of the last one, and its end cuts off any note of
  /// its sweep still to come.
  fn strike(self: &Rc<Self>, strike: &Strike, step: f64) {
    self.struck.borrow_mut().clear();
    self.let_go_all();
    let order: Vec<i32> = match strike.sweep {
      Some(Sweep::Falling) => self.notes.iter().rev().copied().collect(),
      _ => self.notes.clone(),
    };
    let gap = if strike.sweep.is_some() {
      f64::from(self.style.strum)
    } else {
      0.
    };
    let level = strike.level;
    for (i, midi) in order.into_iter().enumerate() {
      if i == 0 || gap == 0. {
        self.on(midi, level);
      } else {
        let me = self.clone();
        let timer = Timeout::new(delay(i as f64 * gap), move || {
          if !me.stopped.get() {
            me.on(midi, level);
          }
        });
        self.struck.borrow_mut().push(timer);
      }
    }
    let me = self.clone();
    let end = Timeout::new(delay(strike.hold * step), move || {
      if !me.stopped.get() {
        me.struck.borrow_mut().clear();
        me.let_go_all();
      }
    });
    self.struck.borrow_mut().push(end);
  }

  /// Rolls up a note a step and holds them, then lets go and rolls again.
  fn roll_tick(self: &Rc<Self>) {
    let count = self.count.get();
    self.count.set(count + 1);
    let at = count % self.notes.len();
    if at == 0 {
      self.let_go_all();
    }
    self.on(self.notes[at], 1.);
    let step = self.next_step();
    self.again(step, Self::roll_tick);
  }

  /// Plays the arpeggio's next step, and schedules the one after.
  fn arpeggio_tick(self: &Rc<Self>) {
    let steps = steps_of(&self.style.id, self.notes.len());
    let index = self.count.get();
    self.count.set(index + 1);
    let current = self.sounding.borrow().clone();
    for midi in current {
      self.off(midi);
    }
    for &i in &steps[index % steps.len()] {
      self.on(self.notes[i], 1.);
    }
    let step = self.next_step();
    self.again(step, Self::arpeggio_tick);
  }

  /// Stops the chord: no more steps, and nothing left sounding.
  pub fn stop(&self) {
    self.stopped.set(true);
    self.timers.borrow_mut().clear();
    self.struck.borrow_mut().clear();
    self.let_go_all();
  }
}
