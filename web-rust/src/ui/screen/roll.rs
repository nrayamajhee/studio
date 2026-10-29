//! The take as a piano roll, as web-react's `PianoRoll`: the keys stand
//! along the left, high notes at the top, each C named on its key, and the
//! keys are now. Recording, notes run out of them to the right as they are
//! played, in red; otherwise what's coming lies to the right and moves left
//! into them, green as it plays. Lines for the meter scroll with them: bars
//! brighter than beats.

use std::cell::Cell;
use std::collections::BTreeSet;
use std::rc::Rc;

use fluid_macro::html;
use gloo_utils::window;
use wasm_bindgen::JsCast;
use web_sys::{CanvasRenderingContext2d, Element, HtmlCanvasElement, WheelEvent};

use super::scope::animate;
use crate::logic::timing::DEFAULT_TIMING;
use crate::modes;
use crate::state::app;
use crate::state::take::{ROLL_LANES, roll_note};
use crate::state::transport::TransportState;

/// Two bars of history beside the keys.
const ROLL_BARS: f64 = 2.;
/// How wide the keys down the roll's left are (px).
const KEYS_WIDTH: f64 = 30.;
/// The black keys' share of the keys' width, at the side facing the notes.
const BLACK_DEPTH: f64 = 0.55;
/// The font the roll's note names are drawn in.
const LABEL_FONT: &str = "ui-monospace, SFMono-Regular, Menlo, monospace";

/// Whether a MIDI note is a black key.
fn is_black(midi: i32) -> bool {
  matches!(midi.rem_euclid(12), 1 | 3 | 6 | 8 | 10)
}

/// Where the view is: its timing, the time on the keys line when scrolled
/// back, and its lowest note.
fn placing() -> (crate::logic::timing::Timing, Option<f64>, i32) {
  let bindings = modes::current();
  let screen = &bindings.screen;
  (
    screen.timing.unwrap_or(DEFAULT_TIMING),
    screen.roll_position,
    screen.roll_low.unwrap_or(52),
  )
}

/// Each wheel move goes the way it mostly points. Sideways (the roll is
/// stopped), the notes follow it, a roll's width of travel scrolling its
/// whole span of time; up and down, a lane of travel moves a semitone, and
/// turning back starts afresh.
fn wheel(event: &WheelEvent, element: &HtmlCanvasElement, travel: &Cell<f64>) {
  event.prevent_default();
  let bindings = modes::current();
  let screen = &bindings.screen;
  if event.delta_x().abs() > event.delta_y().abs() {
    let span = ROLL_BARS * screen.timing.unwrap_or(DEFAULT_TIMING).bar_ms();
    let reach = f64::from(element.client_width()) - KEYS_WIDTH;
    if let Some(scroll) = &screen.on_roll_scroll {
      scroll.call((event.delta_x() / reach) * span);
    }
    return;
  }
  let Some(pitch) = &screen.on_roll_pitch else {
    return;
  };
  if event.delta_y() == 0. {
    return;
  }
  if event.delta_y().signum() != travel.get().signum() || travel.get() == 0. {
    travel.set(0.);
  }
  travel.set(travel.get() + event.delta_y());
  let lane = f64::from(element.client_height()) / f64::from(ROLL_LANES);
  let semitones = (travel.get() / lane).trunc();
  if semitones == 0. {
    return;
  }
  travel.set(travel.get() - semitones * lane);
  pitch.call(-(semitones as i32));
}

/// Draws a frame of the roll: the keys, the beats and bars, the notes, and the
/// keys line where the playhead is.
fn draw(element: &HtmlCanvasElement, context: &CanvasRenderingContext2d) {
  let ratio = match window().device_pixel_ratio() {
    0. => 1.,
    ratio => ratio,
  };
  let width = (f64::from(element.client_width()) * ratio).round();
  let height = (f64::from(element.client_height()) * ratio).round();
  if element.width() != width as u32 || element.height() != height as u32 {
    element.set_width(width as u32);
    element.set_height(height as u32);
  }
  context.clear_rect(0., 0., width, height);
  let Some(style) = window().get_computed_style(element).ok().flatten() else {
    return;
  };
  let property = |name: &str| style.get_property_value(name).unwrap_or_default();
  let ink = property("color");
  let background = property("--color-screen");
  let frame = app().transport.roll();
  let (timing, position, low) = placing();
  let live = frame.now;
  let now = position.unwrap_or(live);
  let color = match frame.state {
    TransportState::Recording => property("--color-synth-red"),
    TransportState::Playing => property("--color-synth-green"),
    TransportState::Stopped => ink.clone(),
  };

  let bottom = low;
  let top = bottom + ROLL_LANES - 1;
  let lane = height / f64::from(ROLL_LANES);
  let lane_top = |midi: i32| height - f64::from(midi - bottom + 1) * lane;
  let keys_width = KEYS_WIDTH * ratio;
  let black_left = keys_width * (1. - BLACK_DEPTH);
  let floor = keys_width + 3. * ratio;
  let reach = width - floor;
  let step = timing.beat_ms();
  let span = ROLL_BARS * timing.bar_ms();
  let recording = frame.state == TransportState::Recording;
  let from = if recording { now - span } else { now };
  let to = if recording { now } else { now + span };
  let x_at = |time: f64| floor + ((if recording { now - time } else { time - now }) / span) * reach;

  // A line on every beat, brighter on each bar's first.
  context.set_fill_style_str(&ink);
  let mut k = (from / step).ceil();
  while k * step <= to {
    context.set_global_alpha(
      if (k as i64).rem_euclid(i64::from(timing.meter.beats)) == 0 {
        0.24
      } else {
        0.09
      },
    );
    context.fill_rect(x_at(k * step).round(), 0., ratio, height);
    k += 1.;
  }

  let mut sounding = BTreeSet::new();
  context.set_fill_style_str(&color);
  for note in &frame.notes {
    let end = note.start + note.duration;
    if note.note < bottom || note.note > top || end < from || note.start > to {
      continue;
    }
    if frame.state != TransportState::Stopped && note.start <= live && end >= live {
      sounding.insert(note.note);
    }
    let left = floor.max(x_at(note.start).min(x_at(end)));
    let right = width.min(x_at(note.start).max(x_at(end)));
    context.set_global_alpha(0.45 + 0.55 * note.velocity);
    context.begin_path();
    let _ = context.round_rect_with_f64(
      left,
      lane_top(note.note) + ratio / 2.,
      ratio.max(right - left),
      lane - ratio,
      ratio,
    );
    context.fill();
  }

  // A white key reaches halfway into each black neighbour's lane.
  for midi in bottom - 1..=top + 1 {
    if is_black(midi) {
      continue;
    }
    let upper = if is_black(midi + 1) {
      lane_top(midi + 1) + lane / 2.
    } else {
      lane_top(midi)
    };
    let lower = if is_black(midi - 1) {
      lane_top(midi - 1) + lane / 2.
    } else {
      lane_top(midi) + lane
    };
    let lit = sounding.contains(&midi);
    context.set_global_alpha(if lit { 1. } else { 0.8 });
    context.set_fill_style_str(if lit { &color } else { &ink });
    context.fill_rect(0., upper + ratio / 2., keys_width, lower - upper - ratio);
  }
  for midi in bottom..=top {
    if !is_black(midi) {
      continue;
    }
    context.set_global_alpha(1.);
    context.set_fill_style_str(if sounding.contains(&midi) {
      &color
    } else {
      &background
    });
    context.fill_rect(black_left, lane_top(midi), keys_width - black_left, lane);
  }

  context.set_global_alpha(0.85);
  context.set_fill_style_str(&background);
  context.set_font(&format!(
    "600 {}px {LABEL_FONT}",
    crate::logic::js::number(8f64.min((lane / ratio) * 1.1) * ratio)
  ));
  context.set_text_align("left");
  context.set_text_baseline("middle");
  let mut midi = bottom.div_euclid(12) * 12 + if bottom.rem_euclid(12) == 0 { 0 } else { 12 };
  while midi <= top {
    let middle = lane_top(midi) + lane * 0.25;
    let _ = context.fill_text(&roll_note(midi), 2. * ratio, middle);
    midi += 12;
  }
  context.set_global_alpha(1.);
}

/// The roll, from under the title down to the footer's line, which holds
/// its labels.
pub fn roll() -> Element {
  let travel = Rc::new(Cell::new(0f64));
  let canvas = html! {
    canvas
    aria-hidden="true"
    class="absolute top-[30px] right-[20px] bottom-[23px] left-[20px] h-[calc(100%_-_53px)] w-[calc(100%_-_40px)] text-screen-ink"
    @wheel.nonpassive={ move |event: WheelEvent| {
      if let Some(element) = event.current_target().and_then(|target| target.dyn_into::<HtmlCanvasElement>().ok()) {
        wheel(&event, &element, &travel);
      }
    } }
    {}
  };
  if let Ok(element) = canvas.clone().dyn_into::<HtmlCanvasElement>()
    && let Ok(Some(context)) = element.get_context("2d")
    && let Ok(context) = context.dyn_into::<CanvasRenderingContext2d>()
  {
    animate(move |_| draw(&element, &context));
  }
  canvas
}
