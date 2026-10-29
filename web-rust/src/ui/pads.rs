//! The three rows of twelve pads, as web-react's `PadButtons`, `DevicePad`
//! and `Pad`: each does what the view binds it to, from a click, its key or
//! its ⌘ shortcut, and shows the key that presses it.
//!
//! ```text
//! Play  Stop  Record Save   Tapes  Synth  ADSR LFO FX Chords Style Tempo
//! Clip  Mute  ↑      Delete Tracks Roll   preset 1–3      chord 1–3
//! Shift ←     ↓      →      Instr. Grid   preset 4–6      chord 4–6
//! ```

use std::rc::Rc;

use fluid::Signal;
use fluid_macro::html;
use web_sys::{Element, KeyboardEvent, MouseEvent, PointerEvent};

use super::{blur_active, is_mac};
use crate::logic::modules::ModuleId;
use crate::modes::{self, PadBinding, PadSlot};
use crate::state::app;
use crate::state::keymap::{Control, Tool, hotkey_label};

/// The red knob's colour, for a pad's accent.
const RED: &str = "var(--color-synth-red)";
/// The green knob's colour.
const GREEN: &str = "var(--color-synth-green)";
/// The blue knob's colour, the chord pads' accent.
const BLUE: &str = "var(--color-synth-blue)";
/// A pad's own green, where it has no accent.
const PLAIN: &str = "#4ba078";

/// Which pad: one a mode binds by slot, an instrument or chord pad, or
/// Shift.
#[derive(Clone, Copy, PartialEq)]
enum Kind {
  /// A pad a mode binds by slot.
  Slot(PadSlot),
  /// An instrument pad.
  Instrument(usize),
  /// A chord pad.
  Chord(usize),
  /// Shift.
  Shift,
}

/// A pad as the grid lays it out: which it is, its key, its ⌘ shortcut and its
/// accent colour.
struct Spec {
  kind: Kind,
  /// The key that presses it, shown on its keycap and pressed in while
  /// held.
  control: Control,
  /// A ⌘ shortcut's keycap letter, shown when the pad has no key of its
  /// own.
  command: Option<&'static str>,
  accent: &'static str,
}

/// A tool's pad, in `accent`.
const fn tool(tool: Tool, accent: &'static str) -> Spec {
  Spec {
    kind: Kind::Slot(PadSlot::Tool(tool)),
    control: Control::Tool(tool),
    command: None,
    accent,
  }
}

/// An arrow pad, pressed by `control`.
const fn slot(slot: PadSlot, control: Control) -> Spec {
  Spec {
    kind: Kind::Slot(slot),
    control,
    command: None,
    accent: RED,
  }
}

/// Instrument pad `index`.
const fn instrument(index: usize) -> Spec {
  Spec {
    kind: Kind::Instrument(index),
    control: Control::Instrument(index),
    command: None,
    accent: RED,
  }
}

/// Chord pad `index`.
const fn chord(index: usize) -> Spec {
  Spec {
    kind: Kind::Chord(index),
    control: Control::Chord(index),
    command: None,
    accent: BLUE,
  }
}

/// The 36 pads, three rows of twelve, as the Device lays them out.
const PADS: [Spec; 36] = [
  tool(Tool::Play, PLAIN),
  tool(Tool::Stop, RED),
  tool(Tool::Record, RED),
  // No key of its own: ⌘S presses it.
  Spec {
    command: Some("S"),
    ..tool(Tool::Save, RED)
  },
  tool(Tool::Tapes, RED),
  tool(Tool::Synth, RED),
  tool(Tool::Module(ModuleId::Adsr), RED),
  tool(Tool::Module(ModuleId::Lfo), RED),
  tool(Tool::Module(ModuleId::Fx), RED),
  tool(Tool::Chords, RED),
  tool(Tool::PlayStyle, RED),
  tool(Tool::Metronome, GREEN),
  tool(Tool::Clip, RED),
  tool(Tool::Mute, RED),
  slot(PadSlot::Up, Control::Pick(-1)),
  Spec {
    command: Some("⌫"),
    ..tool(Tool::Delete, RED)
  },
  tool(Tool::Tracks, RED),
  tool(Tool::Roll, RED),
  instrument(0),
  instrument(1),
  instrument(2),
  chord(0),
  chord(1),
  chord(2),
  // No colour: a modifier, not a state. Latched, it stays pressed in, as
  // it looks while its key is held.
  Spec {
    kind: Kind::Shift,
    control: Control::Shift,
    command: None,
    accent: PLAIN,
  },
  slot(PadSlot::Left, Control::Step(-1)),
  slot(PadSlot::Down, Control::Pick(1)),
  slot(PadSlot::Right, Control::Step(1)),
  tool(Tool::Instruments, RED),
  tool(Tool::DrumGrid, RED),
  instrument(3),
  instrument(4),
  instrument(5),
  chord(3),
  chord(4),
  chord(5),
];

/// The pads' grid.
pub fn pads() -> Element {
  let pads: Vec<Element> = PADS.iter().map(pad).collect();
  html! {
    div class="grid grid-cols-[repeat(12,68px)] gap-inset" role="group" aria-label="Pads" data-focus-group="pads" data-focus-order="rows" {
      { pads }
    }
  }
}

/// The Shift pad's binding, which no mode rebinds.
fn shift_binding() -> PadBinding {
  let latched = app().shift.latched.value();
  PadBinding::new(
    if latched {
      "Let go of Shift (latched)"
    } else {
      "Latch Shift for the pads' Shift jobs"
    },
    crate::icons::Icon::Lucide("ArrowBigUp"),
    |_| app().shift.toggle_latch(),
  )
}

/// The pad's binding now, tracked.
fn binding(kind: Kind) -> PadBinding {
  match kind {
    Kind::Slot(slot) => modes::with(|bindings| bindings.pad(slot).clone()),
    Kind::Instrument(index) => modes::with(|bindings| bindings.instrument_pads[index].clone()),
    Kind::Chord(index) => modes::with(|bindings| bindings.chord_pads[index].clone()),
    Kind::Shift => shift_binding(),
  }
}

/// Presses the pad as bound now.
fn press(kind: Kind) {
  match kind {
    Kind::Slot(_) | Kind::Instrument(_) | Kind::Chord(_) => {
      let control = PADS
        .iter()
        .find(|spec| spec.kind == kind)
        .map(|spec| spec.control);
      if let Some(control) = control {
        modes::press(control, None);
      }
    }
    Kind::Shift => app().shift.toggle_latch(),
  }
}

/// What a pad shows.
#[derive(Clone, PartialEq)]
struct Look {
  label: String,
  hotkey: String,
  face: String,
  lit: bool,
  pressed: Option<bool>,
  indicator: Option<bool>,
}

/// A pad: its face and label from its binding, its keycap, its LED, and lit or
/// pressed in as its binding and its key say.
fn pad(spec: &'static Spec) -> Element {
  let a = app();
  let look = fluid::create_memo(move || {
    let binding = binding(spec.kind);
    let shift_mark = if binding.shift_legend { "⇧" } else { "" };
    let label = hotkey_label(spec.control);
    let hotkey = if !label.is_empty() {
      format!("{shift_mark}{label}")
    } else if let Some(command) = spec.command {
      format!(
        "{}{shift_mark}{command}",
        if is_mac() { "⌘" } else { "Ctrl " }
      )
    } else {
      String::new()
    };
    Look {
      label: binding.label,
      hotkey,
      face: binding.icon.markup(),
      lit: binding.lit,
      pressed: binding.pressed,
      indicator: binding.indicator,
    }
  });
  // Held from the pointer, or the Enter key while it has focus.
  let down = Rc::new(Signal::new(false));
  let state = {
    let (look, down) = (look.clone(), down.clone());
    fluid::create_memo(move || {
      let held = match spec.kind {
        Kind::Shift => a.shift.shift(),
        _ => a.hotkeys.held.with(|held| held.is_held(spec.control)),
      };
      let lit = look.with(|look| look.lit || look.pressed == Some(true));
      let on = look.with(|look| look.indicator == Some(true));
      (lit, held || down.value(), on)
    })
  };
  let release = {
    let down = down.clone();
    move || {
      down.set_if_changed(false);
    }
  };
  let (release_up, release_cancel, release_leave, release_key, release_blur) = (
    release.clone(),
    release.clone(),
    release.clone(),
    release.clone(),
    release,
  );
  let press_down = down.clone();
  let key_down = down;
  let indicator = {
    let (look, state) = (look.clone(), state.clone());
    fluid::show(
      move || look.with(|look| look.indicator.is_some()),
      move |shown| {
        shown.then(|| {
          html! {
            span
            aria-hidden="true"
            class="absolute top-[9px] left-[9px] size-[7px] rounded-[50%]"
            class:"bg-current/25"=#{ |state| !state.value().2 }
            class:"bg-(--pad-accent) shadow-[0_0_6px_var(--pad-accent)]"=#{ |state| state.value().2 && !state.value().0 }
            class:"bg-white shadow-[0_0_6px_rgb(255_255_255/0.7)]"=#{ |state| state.value().2 && state.value().0 }
            {}
          }
        })
      },
    )
  };
  let hotkey = {
    let look = look.clone();
    fluid::show(
      move || look.with(|look| look.hotkey.clone()),
      |hotkey| {
        (!hotkey.is_empty()).then(|| {
          html! {
            kbd aria-hidden="true" class="absolute top-[6px] right-[6px] grid h-[13px] min-w-[13px] place-items-center rounded-[4px] border border-current/35 px-[3px] text-[8px] leading-none font-semibold [font-family:inherit]" {
              { hotkey }
            }
          }
        })
      },
    )
  };
  let face = {
    let look = look.clone();
    fluid::show(
      move || look.with(|look| look.face.clone()),
      |face| super::markup(&face),
    )
  };
  let (label, title, pressed, shortcut) = (look.clone(), look.clone(), look.clone(), look);
  html! {
    button
    type="button"
    class="relative inline-flex size-[68px] cursor-pointer touch-manipulation items-center justify-center rounded-[12px] text-center select-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#2f7de1] focus-visible:outline-solid"
    class:"text-pad-ink"=#{ |state| !state.value().0 }
    class:"text-white"=#{ |state| state.value().0 }
    class:"bg-pad shadow-pad"=#{ |state| !state.value().0 && !state.value().1 }
    class:"bg-pad-held shadow-pad-held"=#{ |state| !state.value().0 && state.value().1 }
    class:"bg-(--pad-accent) shadow-pad-lit"=#{ |state| state.value().0 && !state.value().1 }
    class:"bg-[color-mix(in_srgb,var(--pad-accent),#000000_12%)] shadow-pad-lit-held"=#{ |state| state.value().0 && state.value().1 }
    style={ format!("--pad-accent:{}", spec.accent) }
    aria-label={ move || label.with(|look| look.label.clone()) }
    title={ move || title.with(|look| if look.hotkey.is_empty() { look.label.clone() } else { format!("{} ({})", look.label, look.hotkey) }) }
    aria-pressed={ move || pressed.with(|look| look.pressed.map(|pressed| if pressed { "true" } else { "false" })) }
    aria-keyshortcuts={ move || shortcut.with(|look| (!look.hotkey.is_empty()).then(|| look.hotkey.clone())) }
    @pointerdown={ move |event: PointerEvent| if event.button() == 0 {
      press_down.set(true);
      press(spec.kind);
    } }
    // Pointer presses already fired on pointerdown; a click with detail 0
    // comes from the keyboard.
    @click={ move |event: MouseEvent| if event.detail() == 0 { press(spec.kind) } }
    @keydown={ move |event: KeyboardEvent| if event.key() == "Enter" && !event.repeat() { key_down.set(true) } }
    @keyup={ move |event: KeyboardEvent| if event.key() == "Enter" { release_key() } }
    @pointerup={ move |_| release_up() }
    @pointercancel={ move |_| release_cancel() }
    @pointerleave={ move |_| release_leave() }
    @blur={ move |_| release_blur() }
    @mousedown.prevent={ |_| blur_active() }
    {
      { indicator }
      { hotkey }
      span aria-hidden="true" class="grid place-items-center text-[15px] leading-none font-bold tracking-[0.01em] [&_svg]:size-[22px]" {
        { face }
      }
    }
  }
}
