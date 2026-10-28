//! The keybed, as web-react's `Keybed` and `Key`: two octaves of keys from
//! F3, shifted by the octave arrows, played with the pointer or the home
//! row. Each key shows its letter over its note, or with a kit the piece it
//! strikes; the view may take a key for a job of its own instead of
//! playing it.

use std::cell::RefCell;
use std::collections::HashMap;

use fluid_macro::html;
use web_sys::{Element, KeyboardEvent, PointerEvent};

use super::blur_active;
use crate::icons::{Icon, piece_name};
use crate::logic::presets::{is_kit, key_piece};
use crate::modes;
use crate::state::app;
use crate::state::hotkeys::HeldKeys;
use crate::state::keymap::{Control, hotkey_label, shifted_note};
use crate::state::performance::F3_MIDI;

const WHITE_KEYS: [i32; 14] = [0, 2, 4, 6, 7, 9, 11, 12, 14, 16, 18, 19, 21, 23];
const BLACK_KEYS: [i32; 10] = [1, 3, 5, 8, 10, 13, 15, 17, 20, 22];
const NAMES: [&str; 12] = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];
/// The keybed has no velocity; every press plays mezzo-forte.
const KEY_VELOCITY: f64 = 0.8;

fn octave_of(midi: i32) -> i32 {
  midi.div_euclid(12) - 1
}

/// The name a screen reader says: `F sharp 3`.
fn spoken(midi: i32) -> String {
  format!(
    "{} {}",
    NAMES[midi.rem_euclid(12) as usize].replace('#', " sharp"),
    octave_of(midi)
  )
}

/// The name engraved on a key: every C carries its octave, the rest only
/// their letter.
fn engraved(midi: i32) -> String {
  match NAMES[midi.rem_euclid(12) as usize] {
    "C" => format!("C{}", octave_of(midi)),
    name => name.replace('#', "♯"),
  }
}

/// A key's note as it sounds.
fn note_of(semitone: i32) -> i32 {
  F3_MIDI + semitone + 12 * app().sound.octave.value()
}

thread_local! {
  /// The note each held piano key started, by its unshifted semitone.
  static KEY_NOTES: RefCell<HashMap<usize, i32>> = RefCell::default();
}

/// A piano key pressed or let go. With Shift the home row's last keys play
/// past B4; a key lets go of whichever note it started, even if Shift is
/// let go first.
pub fn note_key(semitone: usize, down: bool, held: &HeldKeys) {
  let a = app();
  if down {
    let shifted = if fluid::untrack(|| a.shift.shift()) {
      shifted_note(semitone)
    } else {
      semitone
    } as i32;
    KEY_NOTES.with(|notes| notes.borrow_mut().insert(semitone, shifted));
    if modes::key_press(fluid::untrack(|| note_of(shifted))) {
      return;
    }
    let chord = held.chord.or(*a.performance.chord.get_untracked());
    a.performance.press_key(shifted, chord, KEY_VELOCITY);
    return;
  }
  let started = KEY_NOTES.with(|notes| notes.borrow_mut().remove(&semitone));
  a.performance
    .release_key(started.unwrap_or(semitone as i32));
}

/// Fourteen white keys 4px apart fill the well's 915px inside an inset
/// gutter. Black keys come last, so they sit on top of the white ones.
pub fn keybed() -> Element {
  let keys: Vec<Element> = WHITE_KEYS
    .iter()
    .enumerate()
    .map(|(slot, &semitone)| key(semitone, slot, false))
    .chain(BLACK_KEYS.iter().map(|&semitone| {
      let slot = WHITE_KEYS
        .iter()
        .position(|white| *white == semitone - 1)
        .unwrap_or(0)
        + 1;
      key(semitone, slot, true)
    }))
    .collect();
  html! {
    div class="-mb-bezel flex justify-center rounded-t-[18px] bg-keybed px-inset pb-inset shadow-keybed [--black-key-height:150px] [--black-key-width:37px] [--key-pitch:calc(var(--white-key-width)_+_4px)] [--white-key-height:247px] [--white-key-width:calc((915px_-_13_*_4px)_/_14)]" {
      div role="group" aria-label="Piano keys" data-focus-group="keys" data-focus-order="columns" class="relative h-[247px] w-[915px]" {
        { keys }
      }
    }
  }
}

/// What a key shows: its spoken label and its face.
#[derive(Clone, PartialEq)]
struct Look {
  label: String,
  face: String,
}

fn look(semitone: i32) -> Look {
  let midi = note_of(semitone);
  let target = app().sound.preset.with(|preset| preset.target.clone());
  if is_kit(&target) {
    let piece = key_piece(&target, midi);
    Look {
      label: format!("{} ({})", piece_name(piece), spoken(midi)),
      face: Icon::Piece(piece.into()).markup(),
    }
  } else {
    Look {
      label: spoken(midi),
      face: Icon::Text(engraved(midi)).markup(),
    }
  }
}

// Each black key centres on the 4px gap before white key --slot.
const WHITE: &str = "absolute top-0 left-[calc(var(--slot)_*_var(--key-pitch))] inline-flex h-[var(--white-key-height,210px)] w-[var(--white-key-width,50px)] cursor-pointer touch-none items-center justify-center rounded-b-[8px] text-center text-[#5f5d57] select-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#2f7de1] focus-visible:outline-solid";
const BLACK: &str = "absolute top-0 left-[calc(var(--slot)_*_var(--key-pitch)_-_2px_-_var(--black-key-width)_/_2)] z-2 inline-flex h-[var(--black-key-height,128px)] w-[var(--black-key-width,30px)] cursor-pointer touch-none items-center justify-center rounded-b-[6px] text-center text-white/72 select-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#2f7de1] focus-visible:outline-solid";

fn key(semitone: i32, slot: usize, black: bool) -> Element {
  let a = app();
  let legend = hotkey_label(Control::Note(semitone as usize));
  let lit = fluid::create_memo(move || a.performance.lit_notes.with(|lit| lit.contains(&semitone)));
  let shown = fluid::create_memo(move || look(semitone));
  let (labels, hotkey, note) = if black {
    (
      "pointer-events-none absolute right-0 bottom-[16px] left-0 flex flex-col items-center gap-[5px] leading-none",
      "grid h-[16px] min-w-[16px] place-items-center rounded-[5px] border border-current/35 px-[3px] text-[10px] font-semibold [font-family:inherit]",
      "text-[10px] font-bold tracking-[0.01em] [&_svg]:block [&_svg]:size-[16px]",
    )
  } else {
    (
      "pointer-events-none absolute right-0 bottom-[16px] left-0 flex flex-col items-center gap-[6px] leading-none",
      "grid h-[18px] min-w-[18px] place-items-center rounded-[5px] border border-current/35 px-[4px] text-[10px] font-semibold [font-family:inherit]",
      "text-[13px] font-bold tracking-[0.01em] [&_svg]:block [&_svg]:size-[18px]",
    )
  };
  // Whether the pointer is what holds this key, so hovering off a key held
  // from the keyboard leaves it sounding.
  let pointer_held = std::rc::Rc::new(std::cell::Cell::new(false));
  let press = move || {
    if !modes::key_press(fluid::untrack(|| note_of(semitone))) {
      let chord = fluid::untrack(|| a.performance.active_chord());
      a.performance.press_key(semitone, chord, KEY_VELOCITY);
    }
  };
  let pointer_press = {
    let held = pointer_held.clone();
    move || {
      held.set(true);
      press();
    }
  };
  let pointer_release = {
    let held = pointer_held;
    move || {
      if held.replace(false) {
        a.performance.release_key(semitone);
      }
    }
  };
  let (enter_press, (leave, up, cancel)) = (
    pointer_press.clone(),
    (
      pointer_release.clone(),
      pointer_release.clone(),
      pointer_release,
    ),
  );
  let face = {
    let shown = shown.clone();
    fluid::show(
      move || shown.with(|look| look.face.clone()),
      |face| super::markup(&face),
    )
  };
  html! {
    button
    type="button"
    class={ if black { BLACK } else { WHITE } }
    class:"bg-key-white shadow-key-white"=#{ |lit| !black && !lit.value() }
    class:"bg-key-white-lit shadow-key-white-lit"=#{ |lit| !black && lit.value() }
    class:"bg-key-black shadow-key-black"=#{ |lit| black && !lit.value() }
    class:"bg-key-black-lit shadow-key-black-lit"=#{ |lit| black && lit.value() }
    style={ format!("--slot:{slot}") }
    aria-label={ move || shown.with(|look| look.label.clone()) }
    aria-keyshortcuts={ legend.as_str() }
    // Held down, the pointer slides from key to key, playing each one it
    // enters. Touch captures its pointer by default, so it lets go to slide
    // too.
    @pointerdown={ move |event: PointerEvent| {
      if event.button() != 0 {
        return;
      }
      if let Some(key) = event.current_target().and_then(|target| wasm_bindgen::JsCast::dyn_into::<Element>(target).ok())
        && key.has_pointer_capture(event.pointer_id())
      {
        let _ = key.release_pointer_capture(event.pointer_id());
      }
      pointer_press();
    } }
    @pointerenter={ move |event: PointerEvent| if event.buttons() & 1 == 1 { enter_press() } }
    @pointerleave={ move |_| leave() }
    @pointerup={ move |_| up() }
    @pointercancel={ move |_| cancel() }
    @keydown={ move |event: KeyboardEvent| if event.key() == "Enter" {
      event.prevent_default();
      if !event.repeat() { press() }
    } }
    @keyup={ move |event: KeyboardEvent| if event.key() == "Enter" {
      event.prevent_default();
      a.performance.release_key(semitone);
    } }
    @blur={ move |_| a.performance.release_key(semitone) }
    @mousedown.prevent={ |_| blur_active() }
    {
      span aria-hidden="true" class={ labels } {
        kbd class={ hotkey } { { legend.clone() } }
        span class={ note } { { face } }
      }
    }
  }
}
