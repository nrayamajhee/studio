//! The screen in its main view, the scope: the octave and the level on the
//! top line, the output's trace across the middle, and the sound and the
//! parameter the knobs set in the footer, each in its knob's colour. The
//! volume or level shows over it for a moment as its knob turns.

use fluid_macro::html;
use web_sys::Element;

use crate::device::{KNOB_STEPS, device, octave_label};

pub fn screen() -> Element {
  let device = device();
  html! {
    div class="mt-[calc(var(--spacing-inset)_-_var(--spacing-bezel))] aspect-[var(--screen-aspect,2.39)] min-w-0 rounded-[12px] border-t-[1.5px] border-b-[1.5px] border-t-screen-edge border-b-screen-lip bg-screen p-[8px] shadow-screen" {
      div class="relative flex h-full items-center rounded-[4px] px-[20px] text-screen-ink" {
        div class="absolute top-[9px] right-[20px] left-[20px] flex items-baseline justify-between gap-[16px] font-screen text-[14px] leading-[18px] font-medium tracking-[0.08em] whitespace-nowrap text-screen-ink/60 first-letter:uppercase" {
          span class="min-w-0 truncate" { #text{ |device| octave_label(device.octave.value()) } }
          span class="shrink-0" {
            span class="text-synth-red" { "Level " #text{ |device| device.level.value() * 10 } "%" }
          }
        }
        { scope() }
        div class="absolute right-[20px] bottom-[9px] left-[20px] flex items-baseline justify-between gap-[16px] font-screen text-[12px] leading-[15px] font-medium tracking-[0.08em] whitespace-nowrap text-screen-ink/60 first-letter:uppercase" {
          span class="min-w-0 truncate" {
            span aria-live="polite" { #text{ |device| device.current().name } }
            if |device| device.unsaved.value() { { unsaved_mark() } }
            "\u{a0}\u{a0}"
            #text{ |device| device.current().engine }
          }
          span class="shrink-0" {
            span class="text-synth-green" { #text{ |device| device.param().0.name } }
            " "
            span class="text-synth-blue" {
              #text{ |device| {
                let (param, step) = device.param();
                param.values[step]
              } }
            }
          }
        }
        if |device| device.overlay.value().is_some() { { overlay() } }
      }
    }
  }
}

// TODO: the trace stays flat until the sound-engine crate gives the scope an
// AnalyserNode to draw, as web-react's Oscilloscope does before audio starts.
fn scope() -> Element {
  html! {
    div aria-hidden="true" class="h-[160px] w-full text-screen-ink" {
      svg width="100%" height="100%" {
        line x1="0" y1="50%" x2="100%" y2="50%" stroke="currentColor" stroke-opacity="0.16" stroke-dasharray="3 5" {}
        line x1="0" y1="50%" x2="100%" y2="50%" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" {}
      }
    }
  }
}

/// An asterisk after the title, as editors mark a file with changes.
fn unsaved_mark() -> Element {
  html! {
    span class="ml-[2px] inline-grid place-items-center align-top text-screen-ink/75" title="Unsaved changes" {
      svg width="0.9em" height="0.9em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" {
        path d="M12 5v14" {}
        path d="m18.065 8.496-12.125 7" {}
        path d="m5.94 8.504 12.125 7" {}
      }
      span class="sr-only" { "Unsaved" }
    }
  }
}

/// The level meter over the screen: its name and value over a bar.
fn overlay() -> Element {
  let device = device();
  html! {
    div aria-hidden="true" class="pointer-events-none absolute inset-0 z-2 grid animate-[overlay-in_120ms_ease-out] place-items-center rounded-[inherit] bg-screen/55" {
      div class="flex w-[62%] flex-col gap-[10px] rounded-[10px] border border-screen-ink/18 bg-screen/92 px-[18px] pt-[14px] pb-[16px]" {
        div class="flex justify-between font-screen text-[14px] leading-[18px] font-semibold tracking-[0.08em] first-letter:uppercase" {
          span { #text{ |device| device.overlay.value().map_or("", |(label, _)| label) } }
          span { #text{ |device| device.overlay.value().map_or(0, |(_, step)| step * 10) } "%" }
        }
        div class="relative h-[12px] overflow-hidden rounded-[3px] bg-screen-ink/12" {
          div
          class="h-full bg-screen-ink transition-[width] duration-160 ease-[ease-out]"
          style={ move || format!("width: {}%", device.overlay.value().map_or(0, |(_, step)| step * 100 / (KNOB_STEPS - 1))) }
          {}
        }
      }
    }
  }
}
