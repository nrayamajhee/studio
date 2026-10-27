//! The three rows of twelve pads, as web-react's `Pad`: a keycap legend in
//! the top-right corner, an LED top-left on the pads with a state to show,
//! pressed in while held from the pointer or its key, and lit in its accent
//! while its job is on (a chord pad's chord).

use fluid_macro::html;
use web_sys::{Element, PointerEvent};

use super::{blur_active, markup};
use crate::device::{Device, device};
use crate::icons;
use crate::input::press_pad;
use crate::pads::{CHORDS, Job, PADS, Pad};
use crate::presets::PRESETS;

pub fn pads() -> Element {
  let pads: Vec<Element> = PADS
    .iter()
    .enumerate()
    .map(|(index, spec)| pad(index, spec))
    .collect();
  html! {
    div role="group" aria-label="Pads" class="grid grid-cols-[repeat(12,68px)] gap-inset" {
      { pads }
    }
  }
}

/// ⌘ on a Mac, Ctrl elsewhere, as the Save pad's legend shows.
fn command_legend() -> &'static str {
  if super::is_mac() { "⌘S" } else { "Ctrl S" }
}

/// What the pad does now, as its label and tooltip say.
fn label(device: &Device, spec: &Pad) -> String {
  match spec.job {
    Job::Preset(at) if device.preset.value() == at => format!("{} (playing)", PRESETS[at].name),
    Job::Preset(at) => format!("Switch to {}", PRESETS[at].name),
    Job::Chord(chord) if device.latched_chord.value() == Some(chord) => {
      format!("Let go of {} chords", CHORDS[chord].name)
    }
    Job::Chord(chord) => format!("Play {} chords on the keys", CHORDS[chord].name),
    Job::Shift if device.latched.value() => "Let go of Shift (latched)".to_string(),
    _ => spec.label.to_string(),
  }
}

fn pad(index: usize, spec: &'static Pad) -> Element {
  let device = device();
  let legend = spec.legend.unwrap_or_else(command_legend);
  // Pressed in while held, from the pointer, its key or a latched Shift; lit
  // in its accent while its chord plays. A memo, so the pad's classes only
  // change when its own state does.
  let state = fluid::create_memo(move || {
    let held = device.held_pads.with(|held| held.contains(&index))
      || (spec.job == Job::Shift && device.shift());
    let lit = matches!(spec.job, Job::Chord(chord) if device.active_chord.value() == Some(chord));
    (lit, held)
  });
  let led = spec.led.then(|| {
    html! {
      span
      aria-hidden="true"
      class="absolute top-[9px] left-[9px] size-[7px] rounded-[50%]"
      class:"bg-(--pad-accent) shadow-[0_0_6px_var(--pad-accent)]"=#{ |device| spec.job == Job::Preset(device.preset.value()) }
      class:"bg-current/25"=#{ |device| spec.job != Job::Preset(device.preset.value()) }
      {}
    }
  });
  html! {
    button
    class="relative inline-flex size-[68px] cursor-pointer touch-manipulation items-center justify-center rounded-[12px] text-center select-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#2f7de1] focus-visible:outline-solid"
    class:"text-pad-ink"=#{ |state| !state.value().0 }
    class:"text-white"=#{ |state| state.value().0 }
    class:"bg-pad shadow-pad"=#{ |state| state.value() == (false, false) }
    class:"bg-pad-held shadow-pad-held"=#{ |state| state.value() == (false, true) }
    class:"bg-(--pad-accent) shadow-pad-lit"=#{ |state| state.value() == (true, false) }
    class:"bg-[color-mix(in_srgb,var(--pad-accent),#000000_12%)] shadow-pad-lit-held"=#{ |state| state.value() == (true, true) }
    style={ format!("--pad-accent:{}", spec.accent) }
    aria-label={ move || label(device, spec) }
    title={ move || format!("{} ({legend})", label(device, spec)) }
    aria-pressed={ move || match spec.job {
      Job::Chord(chord) => Some(if device.active_chord.value() == Some(chord) { "true" } else { "false" }),
      _ => None,
    } }
    aria-keyshortcuts={ legend }
    @pointerdown={ move |event: PointerEvent| if event.button() == 0 { press_pad(device, index, false) } }
    @pointerup={ move |_| device.hold_pad(index, false) }
    @pointercancel={ move |_| device.hold_pad(index, false) }
    @pointerleave={ move |_| device.hold_pad(index, false) }
    @mousedown.prevent={ |_| blur_active() }
    {
      { led }
      kbd aria-hidden="true" class="absolute top-[6px] right-[6px] grid h-[13px] min-w-[13px] place-items-center rounded-[4px] border border-current/35 px-[3px] text-[8px] leading-none font-semibold [font-family:inherit]" {
        { legend }
      }
      span aria-hidden="true" class="grid place-items-center text-[15px] leading-none font-bold tracking-[0.01em] [&_svg]:size-[22px]" {
        { markup(icons::PADS[index]) }
      }
    }
  }
}
