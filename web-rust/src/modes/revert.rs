//! Revert, as web-react's `modes/revert.tsx`: Shift + Delete opens it from
//! anywhere. The green knob picks what to put back, and Delete puts it back
//! on a second press, as does a tile double-clicked, and Revert closes. Any
//! other pad closes it first, then does what it does.

use std::rc::Rc;

use super::base::{arrow_pads, save_pad, seek_knob};
use super::{Bindings, Callback, Knob, PadBinding, PadSlot, Rich, ScreenTile};
use crate::icons::Icon;
use crate::logic::math::turn_page;
use crate::logic::modules::initial_modules;
use crate::logic::starter::{INITIAL_LEVEL_STEP, INITIAL_VOLUME_STEP};
use crate::logic::swing::STRAIGHT;
use crate::logic::timing::{DEFAULT_TIMING, METERS};
use crate::state::App;
use crate::state::keymap::Tool;
use crate::state::view::ScreenView;
use crate::store::storage;

/// The tiles a page of Revert holds.
const PER_PAGE: usize = 12;

struct RevertOption {
  id: &'static str,
  label: &'static str,
  detail: String,
  icon: Icon,
  run: Rc<dyn Fn()>,
}

/// Everything the Device keeps (tapes and tracks, the take, saved
/// instruments and play styles, pad and chord bindings) is dropped, and the
/// page starts over as new. The page's theme is its own, and stays.
fn erase_everything() {
  storage::remove_prefixed("studio.");
  let _ = gloo_utils::window().location().reload();
}

/// What Revert can put back, a tile each: the sounds' edits, the pads and
/// chords as built in, and the modules, tempo and levels as they start.
fn revert_options(a: &'static App) -> Vec<RevertOption> {
  let option = |id, label, detail: String, icon, run: Rc<dyn Fn()>| RevertOption {
    id,
    label,
    detail,
    icon,
    run,
  };
  vec![
    option(
      "sound",
      "This sound",
      format!(
        "{}'s settings",
        a.sound.preset.with(|preset| preset.name.clone())
      ),
      Icon::Lucide("SlidersHorizontal"),
      Rc::new(move || a.sound.revert_sound()),
    ),
    option(
      "sounds",
      "All sounds",
      "Every instrument's settings".into(),
      Icon::Lucide("Layers"),
      Rc::new(move || a.sound.revert_all_sounds()),
    ),
    option(
      "pads",
      "Instrument pads",
      "The built-in instruments on the pads".into(),
      Icon::Lucide("LayoutGrid"),
      Rc::new(move || a.library.reset_pads()),
    ),
    option(
      "chords",
      "Chord pads",
      "The built-in chords, played as blocks".into(),
      Icon::Lucide("Music4"),
      Rc::new(move || a.chords.reset_pad_chords()),
    ),
    option(
      "modules",
      "Modules",
      format!("{}'s ADSR, LFO and FX, off", a.lanes.modules_owner()),
      Icon::Device("Adsr"),
      Rc::new(move || a.lanes.set_modules(initial_modules())),
    ),
    option(
      "tempo",
      "Tempo",
      format!(
        "{} BPM in {}, straight",
        DEFAULT_TIMING.bpm,
        DEFAULT_TIMING.meter.label()
      ),
      Icon::Lucide("Metronome"),
      Rc::new(move || {
        a.transport.set_bpm(DEFAULT_TIMING.bpm);
        a.transport.set_meter(
          METERS
            .iter()
            .position(|meter| *meter == DEFAULT_TIMING.meter)
            .unwrap_or(0),
        );
        a.transport.set_swing(STRAIGHT);
      }),
    ),
    option(
      "levels",
      "Levels",
      format!(
        "Level {}%, volume {}%",
        INITIAL_LEVEL_STEP * 10,
        INITIAL_VOLUME_STEP * 10
      ),
      Icon::Lucide("Volume2"),
      Rc::new(move || a.output.reset_levels()),
    ),
    option(
      "everything",
      "Everything",
      "Erases tapes, saved sounds and settings".into(),
      Icon::Lucide("RotateCcw"),
      Rc::new(erase_everything),
    ),
  ]
}

/// Pads that keep Revert open: its own (Delete, ← and →) and those that do
/// nothing here.
fn keeps_revert(slot: PadSlot) -> bool {
  matches!(
    slot,
    PadSlot::Tool(Tool::Delete | Tool::Mute | Tool::Clip) | PadSlot::Left | PadSlot::Right
  )
}

fn closing(a: &'static App, pad: &mut PadBinding) {
  let press = pad.on_press.clone();
  pad.on_press = Callback::new(move |shifted| {
    a.views.leave_revert();
    press.call(shifted);
  });
}

fn revert(a: &'static App, option: &RevertOption) {
  (option.run)();
  a.feedback
    .show_notice(format!("Reverted {}", option.label.to_lowercase()));
  a.views.leave_revert();
}

pub fn mode(a: &'static App, b: &mut Bindings) {
  let shift = a.shift.shift();
  let options = Rc::new(revert_options(a));
  let count = options.len();
  let index = a.browse.revert_index.value().min(count - 1);
  let option = &options[index];

  for (slot, pad) in b.pads.iter_mut() {
    if !keeps_revert(*slot) {
      closing(a, pad);
    }
  }
  for pad in b.instrument_pads.iter_mut().chain(b.chord_pads.iter_mut()) {
    closing(a, pad);
  }
  b.set_knob(
    Knob::Green,
    seek_knob(
      option.label.into(),
      index as f64,
      count,
      Callback::new(move |step: f64| a.browse.revert_index.set((step as usize).min(count - 1))),
    ),
  );
  let mut save = save_pad(a, "Close revert", None, None);
  closing(a, &mut save);
  b.set_pad(PadSlot::Tool(Tool::Save), save);
  let label = option.label.to_lowercase();
  let picked = options.clone();
  b.set_pad(
    PadSlot::Tool(Tool::Delete),
    PadBinding::new(
      if shift {
        "Close revert".into()
      } else {
        format!("Revert {label}")
      },
      Icon::Lucide("RotateCcw"),
      move |shifted: Option<bool>| {
        if shifted.unwrap_or(shift) {
          a.views.set_view(ScreenView::Scope);
          return;
        }
        let option = &picked[index];
        if a.feedback.confirm(
          &format!("revert:{}", option.id),
          &format!("Press Revert again to revert {label}"),
        ) {
          revert(a, option);
        }
      },
    )
    .lit(true)
    .shift_legend(shift),
  );
  arrow_pads(
    b,
    a,
    ["Previous page".into(), "Next page".into()],
    move |direction| {
      a.browse
        .revert_index
        .update(|index| *index = turn_page(*index, direction, PER_PAGE, count))
    },
  );

  let screen = &mut b.screen;
  screen.title = "Revert".into();
  screen.unsaved = false;
  screen.status = Rich::new()
    .pad("Shift", Icon::Lucide("ArrowUp"))
    .pad("Delete", Icon::Lucide("RotateCcw"))
    .hint(" to close");
  screen.footer = (
    Rich::text(option.detail.clone()),
    Rich::new()
      .hint("Press ")
      .pad("Delete", Icon::Lucide("RotateCcw"))
      .hint(" twice to revert"),
  );
  screen.tiles = options
    .iter()
    .map(|option| ScreenTile {
      id: option.id.into(),
      label: option.label.into(),
      icon: option.icon.clone(),
      badge: None,
    })
    .collect();
  screen.selected = index;
  screen.on_select = Some(Callback::new(move |index: usize| {
    a.browse.revert_index.set(index)
  }));
  screen.on_activate = Some(Callback::new(move |index: usize| {
    a.browse.revert_index.set(index);
    revert(a, &options[index]);
  }));
}
