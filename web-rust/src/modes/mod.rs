//! What every control does in each view, as web-react's `modes/`: each
//! view is a mode of the same hardware that rebinds what it changes of the
//! base bindings. [`install`] resolves them into one memo, recomputed
//! whenever anything it reads changes, so the knobs, pads and screen draw
//! from it and a press runs the handler as it is now.

mod base;
mod scope;

use std::collections::HashMap;
use std::fmt;
use std::rc::Rc;

use fluid::Memo;

use crate::icons::Icon;
use crate::logic::presets::DevicePreset;
use crate::logic::timing::Timing;
use crate::logic::tracks::TrackClip;
use crate::state::App;
use crate::state::keymap::{Control, Tool};
use crate::state::view::ScreenView;

/// A handler in a binding. Bindings compare by how they look, so two
/// handlers always compare equal; a press reads the bindings afresh, so it
/// always runs the one current.
pub struct Callback<A, R = ()>(pub Rc<dyn Fn(A) -> R>);

impl<A, R> Callback<A, R> {
  pub fn new(f: impl Fn(A) -> R + 'static) -> Self {
    Self(Rc::new(f))
  }

  pub fn call(&self, value: A) -> R {
    (self.0)(value)
  }
}

impl<A, R> Clone for Callback<A, R> {
  fn clone(&self) -> Self {
    Self(self.0.clone())
  }
}

impl<A, R> PartialEq for Callback<A, R> {
  fn eq(&self, _: &Self) -> bool {
    true
  }
}

impl<A, R> fmt::Debug for Callback<A, R> {
  fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
    f.write_str("Callback")
  }
}

pub fn noop<A>() -> Callback<A> {
  Callback::new(|_| {})
}

/// The four knobs, in the order they sit: white and green on the left, red
/// and blue on the right.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Knob {
  Chalk,
  Green,
  Red,
  Blue,
}

impl Knob {
  pub const ALL: [Knob; 4] = [Knob::Chalk, Knob::Green, Knob::Red, Knob::Blue];
}

#[derive(Clone, Debug, PartialEq)]
pub struct KnobBinding {
  pub label: String,
  pub value_label: Option<String>,
  pub step: f64,
  pub steps: usize,
  pub on_change: Callback<f64>,
  /// Continuous rather than in steps (a seek through milliseconds).
  pub fine: bool,
}

/// The pads a mode can rebind: every tool, and the four arrows.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum PadSlot {
  Tool(Tool),
  Left,
  Right,
  Up,
  Down,
}

#[derive(Clone, Debug, PartialEq)]
pub struct PadBinding {
  pub label: String,
  pub icon: Icon,
  /// With `Some`, Shift as a ⌘ shortcut saw it, for Save and Delete.
  pub on_press: Callback<Option<bool>>,
  pub lit: bool,
  /// An LED for a state the pad shows without being pressed; `None` leaves
  /// it without one.
  pub indicator: Option<bool>,
  pub pressed: Option<bool>,
  /// Its keycap shows ⇧: what the pad does now is its Shift job.
  pub shift_legend: bool,
}

impl PadBinding {
  pub fn new(
    label: impl Into<String>,
    icon: Icon,
    on_press: impl Fn(Option<bool>) + 'static,
  ) -> Self {
    Self {
      label: label.into(),
      icon,
      on_press: Callback::new(on_press),
      lit: false,
      indicator: None,
      pressed: None,
      shift_legend: false,
    }
  }

  pub fn lit(self, lit: bool) -> Self {
    Self { lit, ..self }
  }

  pub fn indicator(self, on: bool) -> Self {
    Self {
      indicator: Some(on),
      ..self
    }
  }

  pub fn shift_legend(self, shift_legend: bool) -> Self {
    Self {
      shift_legend,
      ..self
    }
  }
}

/// How a run of the screen's text is coloured: as the knob that sets it,
/// or dimmed as a hint.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Tone {
  Plain,
  /// What the green knob moves through, in green.
  Seek,
  /// What the red knob sets, in red.
  Level,
  /// What the blue knob sets, in blue.
  Value,
  /// What to press, a little dimmer.
  Hint,
}

#[derive(Clone, Debug, PartialEq)]
pub enum Piece {
  Text(Tone, String),
  /// A pad's icon in an outlined badge, for hints that point at the pad.
  Pad {
    label: String,
    icon: Icon,
  },
}

/// A line of the screen's text, its runs in their colours.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Rich(pub Vec<Piece>);

impl Rich {
  pub fn new() -> Self {
    Self::default()
  }

  pub fn text(text: impl Into<String>) -> Self {
    Self::new().plain(text)
  }

  fn push(mut self, tone: Tone, text: impl Into<String>) -> Self {
    let text = text.into();
    if !text.is_empty() {
      self.0.push(Piece::Text(tone, text));
    }
    self
  }

  pub fn plain(self, text: impl Into<String>) -> Self {
    self.push(Tone::Plain, text)
  }

  pub fn seek(self, text: impl Into<String>) -> Self {
    self.push(Tone::Seek, text)
  }

  pub fn level(self, text: impl Into<String>) -> Self {
    self.push(Tone::Level, text)
  }

  pub fn value(self, text: impl Into<String>) -> Self {
    self.push(Tone::Value, text)
  }

  pub fn hint(self, text: impl Into<String>) -> Self {
    self.push(Tone::Hint, text)
  }

  /// The setting the red knob picked (red) and its value, set by the blue
  /// knob (blue).
  pub fn selection(self, label: impl Into<String>, value: impl Into<String>) -> Self {
    self.level(label).plain(" ").value(value)
  }

  pub fn pad(mut self, label: impl Into<String>, icon: Icon) -> Self {
    self.0.push(Piece::Pad {
      label: label.into(),
      icon,
    });
    self
  }

  pub fn then(mut self, other: Rich) -> Self {
    self.0.extend(other.0);
    self
  }

  pub fn is_empty(&self) -> bool {
    self.0.is_empty()
  }
}

/// What parts the items of a footer: two spaces, which don't collapse.
pub const GAP: &str = "\u{a0}\u{a0}";

/// A caption along the bottom of the screen; with `on`, a switch's name
/// and then On or Off in a pill.
#[derive(Clone, Debug, PartialEq)]
pub struct ScreenBadge {
  pub label: String,
  pub on: Option<bool>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PagerColor {
  Red,
  Green,
  Ink,
}

/// A view with pages: the one it is on, the knob that turns them, and the
/// arrows either side of it that turn them too.
#[derive(Clone, Debug, PartialEq)]
pub struct ScreenPager {
  pub pages: Vec<String>,
  pub at: usize,
  pub color: PagerColor,
  pub on_pick: Callback<usize>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ScreenTile {
  pub id: String,
  pub label: String,
  pub icon: Icon,
  /// Small caption on the tile, e.g. the pads a preset is bound to.
  pub badge: Option<String>,
}

/// One module knob's reading, in knob order. A knob with nothing to set
/// has an empty label, and reads as a dim dash.
#[derive(Clone, Debug, PartialEq)]
pub struct ScreenReadout {
  pub label: String,
  pub display: String,
  /// 0–1: the knob position (the level, for the ADSR's sustain).
  pub amount: f64,
}

/// A row of the tracks view.
#[derive(Clone, Debug, PartialEq)]
pub struct ScreenTrack {
  pub id: String,
  pub name: String,
  /// The preset that plays it.
  pub detail: String,
  pub color: String,
  pub clip: TrackClip,
  /// On the picked row, the copy the arrows move.
  pub copy: Option<usize>,
  pub volume: f64,
  pub muted: bool,
  pub soloed: bool,
  pub audible: bool,
  /// The take shown as a potential track: no mute or solo.
  pub potential: bool,
  /// On the take's row, the drum grid's pattern, drawn over its notes.
  pub pattern: Option<TrackClip>,
}

/// A row of the drum grid: a piece of the kit.
#[derive(Clone, Debug, PartialEq)]
pub struct StepRow {
  pub id: String,
  pub label: String,
  pub icon: Icon,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum SelectedBy {
  #[default]
  Green,
  Blue,
}

/// What the screen shows in a view.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct ScreenBinding {
  /// Leads the top line, or the footer where a pager or `status_left`
  /// holds the top's left.
  pub title: String,
  /// The preset in the title has edits that aren't saved.
  pub unsaved: bool,
  pub status: Rich,
  pub status_left: Option<Rich>,
  pub footer: (Rich, Rich),
  /// On/off or a hint, along the bottom in place of the footer.
  pub badge: Option<ScreenBadge>,
  pub pager: Option<ScreenPager>,
  pub tiles: Vec<ScreenTile>,
  pub selected: usize,
  pub selected_by: SelectedBy,
  pub on_select: Option<Callback<usize>>,
  /// A tile double-clicked: does what Save would with it.
  pub on_activate: Option<Callback<usize>>,
  pub readouts: Vec<ScreenReadout>,
  pub lfo_shape: usize,
  pub lfo_rate: f64,
  /// Tempo, meter and grid for the tempo view and the roll; the beat the
  /// metronome is on.
  pub timing: Option<Timing>,
  pub beat: Option<usize>,
  pub on_bpm: Option<Callback<f64>>,
  /// The synth view's graph of the page showing, and what it shows for
  /// screen readers.
  pub synth_scene: Option<crate::logic::synth_graphs::GraphScene>,
  pub synth_label: String,
  pub tracks: Vec<ScreenTrack>,
  pub track_span: f64,
  pub bar_beats: u32,
  pub track_zoom: f64,
  pub track_from: f64,
  pub on_pan_tracks: Option<Callback<f64>>,
  /// Dragging a track's clip edge: which row, the start edge or not, and
  /// where on the timeline (beats).
  pub on_loop_edge: Option<Callback<(usize, bool, f64)>>,
  pub on_loop_edge_drag: Option<Callback<bool>>,
  pub on_select_copy: Option<Callback<(usize, usize)>>,
  pub roll_position: Option<f64>,
  pub roll_low: Option<i32>,
  pub on_roll_scroll: Option<Callback<f64>>,
  pub on_roll_pitch: Option<Callback<i32>>,
  pub step_rows: Vec<StepRow>,
  pub step_count: u32,
  pub steps_per_beat: u32,
  pub steps_per_bar: u32,
  pub step_hits: std::collections::BTreeSet<(usize, u32)>,
  pub step_recording: bool,
  pub on_toggle_step: Option<Callback<(usize, u32)>>,
  pub on_move_step: Option<Callback<i64>>,
}

/// What every control does now.
#[derive(Clone, Debug, PartialEq)]
pub struct Bindings {
  pub knobs: [KnobBinding; 4],
  pub pads: HashMap<PadSlot, PadBinding>,
  pub instrument_pads: Vec<PadBinding>,
  pub chord_pads: Vec<PadBinding>,
  pub screen: ScreenBinding,
  /// A key played, by the note it sounds, before it plays: true when the
  /// mode takes it for a job of its own, so it doesn't sound.
  pub key_press: Option<Callback<i32, bool>>,
  /// A sound the view plays for now without picking it (the instrument
  /// being browsed).
  pub preview_sound: Option<DevicePreset>,
}

impl Bindings {
  pub fn knob(&self, knob: Knob) -> &KnobBinding {
    &self.knobs[knob as usize]
  }

  pub fn set_knob(&mut self, knob: Knob, binding: KnobBinding) {
    self.knobs[knob as usize] = binding;
  }

  pub fn pad(&self, slot: PadSlot) -> &PadBinding {
    &self.pads[&slot]
  }

  pub fn set_pad(&mut self, slot: PadSlot, binding: PadBinding) {
    self.pads.insert(slot, binding);
  }
}

/// The bindings as a memo's value: always new, so whatever reads them
/// recomputes its own part, which then compares as it looks.
#[derive(Clone)]
pub struct Fresh(pub Rc<Bindings>);

impl PartialEq for Fresh {
  fn eq(&self, _: &Self) -> bool {
    false
  }
}

/// A view's mode: what it rebinds of the base bindings.
type Mode = fn(&'static App, &mut Bindings);

fn mode_of(view: ScreenView) -> Mode {
  match view {
    ScreenView::Scope => scope::mode,
    _ => |_, _| {},
  }
}

/// What every control does now: the base bindings, with the current view's
/// mode over them.
fn resolve(app: &'static App) -> Bindings {
  let mut bindings = base::bindings(app);
  mode_of(app.views.view())(app, &mut bindings);
  bindings
}

thread_local! {
  static BINDINGS: std::cell::OnceCell<Memo<Fresh>> = const { std::cell::OnceCell::new() };
}

/// Resolves the bindings into the memo every control reads, and plays the
/// view's preview sound while it has one.
pub fn install(app: &'static App) {
  let memo = fluid::create_memo(move || Fresh(Rc::new(resolve(app))));
  BINDINGS.with(|cell| {
    let _ = cell.set(memo.clone());
  });
  let watched = memo.clone();
  let preview = fluid::create_memo(move || {
    watched.with(|bindings| {
      bindings
        .0
        .preview_sound
        .as_ref()
        .map(|preset| preset.id.clone())
    })
  });
  fluid::create_effect(move || {
    preview.with(|_| ());
    let sound = memo.get_untracked().0.preview_sound.clone();
    fluid::untrack(|| app.sound.preview_preset(sound.as_ref()));
  });
}

fn memo() -> Memo<Fresh> {
  BINDINGS.with(|cell| cell.get().expect("the bindings are installed").clone())
}

/// Reads the bindings, tracked: what a control draws from.
pub fn with<R>(f: impl FnOnce(&Bindings) -> R) -> R {
  memo().with(|bindings| f(&bindings.0))
}

/// The bindings as they are now, untracked: what a press runs.
pub fn current() -> Rc<Bindings> {
  fluid::untrack(|| memo().with(|bindings| bindings.0.clone()))
}

/// Presses the pad a control names, as a click or its key does.
pub fn press(control: Control, shifted: Option<bool>) {
  let bindings = current();
  let binding = match control {
    Control::Tool(tool) => bindings.pads.get(&PadSlot::Tool(tool)),
    Control::Instrument(index) => bindings.instrument_pads.get(index),
    Control::Chord(index) => bindings.chord_pads.get(index),
    Control::Step(direction) => bindings.pads.get(if direction < 0 {
      &PadSlot::Left
    } else {
      &PadSlot::Right
    }),
    Control::Pick(direction) => bindings.pads.get(if direction < 0 {
      &PadSlot::Up
    } else {
      &PadSlot::Down
    }),
    Control::Note(_) | Control::Shift => None,
  };
  if let Some(binding) = binding {
    binding.on_press.call(shifted);
  }
}

/// Whether the mode takes a key played (by the note it sounds) for a job of
/// its own.
pub fn key_press(note: i32) -> bool {
  current()
    .key_press
    .as_ref()
    .is_some_and(|handler| handler.call(note))
}
