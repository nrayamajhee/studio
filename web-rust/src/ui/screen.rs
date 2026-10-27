//! The screen in its main view, the scope: the octave and the level on the
//! top line, the output's trace across the middle, and the sound and the
//! parameter the knobs set in the footer, each in its knob's colour. The
//! volume or level shows over it for a moment as its knob turns.

use std::rc::Rc;

use fluid::Context;
use fluid_macro::html;
use wasm_bindgen::prelude::*;
use web_sys::Element;

use crate::device::{Device, KNOB_STEPS, octave_label, unsaved};
use crate::icons;
use crate::presets::PRESETS;

// TODO: the trace stays flat until the sound-engine crate gives the scope an
// AnalyserNode to draw, as web-react's Oscilloscope does before audio starts.
const SCOPE: &str = r#"<svg width="100%" height="100%" aria-hidden="true"><line x1="0" y1="50%" x2="100%" y2="50%" stroke="currentColor" stroke-opacity="0.16" stroke-dasharray="3 5"></line><line x1="1.25" y1="50%" x2="calc(100% - 1.25px)" y2="50%" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"></line></svg>"#;

/// An asterisk after the title, as editors mark a file with changes. The
/// icon is sized on the SVG itself: Tailwind's scanner drops a
/// `[&_svg]:size-[0.9em]` class written in this file.
fn unsaved_mark() -> String {
  let icon = icons::ASTERISK.replacen(
    r#"width="24" height="24""#,
    r#"width="0.9em" height="0.9em""#,
    1,
  );
  format!(
    r#"<span class="ml-[2px] inline-grid place-items-center align-top text-screen-ink/75" title="Unsaved changes">{icon}<span class="sr-only">Unsaved</span></span>"#
  )
}

pub fn screen(ctx: &Context, device: &Rc<Device>) -> Result<Element, JsValue> {
  let preset = device.preset.clone();
  let octave = device.octave.clone();
  let level = device.level.clone();
  let selected = device.selected.clone();
  let values = device.values.clone();
  let screen = html! {
    div class="mt-[calc(var(--spacing-inset)_-_var(--spacing-bezel))] aspect-[var(--screen-aspect,2.39)] min-w-0 rounded-[12px] border-t-[1.5px] border-b-[1.5px] border-t-screen-edge border-b-screen-lip bg-screen p-[8px] shadow-screen" {
      div class="relative flex h-full items-center rounded-[4px] px-[20px] text-screen-ink" {
        div class="absolute top-[9px] right-[20px] left-[20px] flex items-baseline justify-between gap-[16px] font-screen text-[14px] leading-[18px] font-medium tracking-[0.08em] whitespace-nowrap text-screen-ink/60 first-letter:uppercase" {
          span class="min-w-0 truncate" { #{ |octave| octave_label(*octave.get()) } }
          span class="shrink-0" {
            span class="text-synth-red" { #{ |level| format!("Level {}%", *level.get() * 10) } }
          }
        }
        div class="h-[160px] w-full text-screen-ink" {}
        div class="absolute right-[20px] bottom-[9px] left-[20px] flex items-baseline justify-between gap-[16px] font-screen text-[12px] leading-[15px] font-medium tracking-[0.08em] whitespace-nowrap text-screen-ink/60 first-letter:uppercase" {
          span class="min-w-0 truncate" {
            span { #{ |preset| PRESETS[*preset.get()].name } }
            #{ |values, preset| if unsaved(*preset.get(), &values.get()) { unsaved_mark() } else { String::new() } }
            #{ |preset| format!("&nbsp;&nbsp;{}", PRESETS[*preset.get()].engine) }
          }
          span class="shrink-0" {
            span class="text-synth-green" { #{ |preset, selected| PRESETS[*preset.get()].params[*selected.get()].name } }
            " "
            span class="text-synth-blue" {
              #{ |preset, selected, values| {
                let (preset, selected) = (*preset.get(), *selected.get());
                PRESETS[preset].params[selected].values[values.get()[preset][selected]]
              } }
            }
          }
        }
      }
    }
  };
  if let Some(scope) = screen.query_selector(".h-\\[160px\\]")? {
    scope.set_inner_html(SCOPE);
    scope.set_attribute("aria-hidden", "true")?;
  }
  if let Some(title) = screen.query_selector(".truncate > span")? {
    title.set_attribute("aria-live", "polite")?;
  }

  if let Some(glass) = screen.first_element_child() {
    super::append(&glass, [overlay(ctx, device)?])?;
  }
  Ok(screen)
}

/// The level meter over the screen: its name and value over a bar.
fn overlay(ctx: &Context, device: &Rc<Device>) -> Result<Element, JsValue> {
  let overlay = device.overlay.clone();
  let element = html! {
    div class=#{ |overlay| if overlay.get().is_some() { OVERLAY } else { "hidden" } } {
      div class="flex w-[62%] flex-col gap-[10px] rounded-[10px] border border-screen-ink/18 bg-screen/92 px-[18px] pt-[14px] pb-[16px]" {
        div class="flex justify-between font-screen text-[14px] leading-[18px] font-semibold tracking-[0.08em] first-letter:uppercase" {
          #{ |overlay| overlay.get().map_or("", |(label, _)| label) }
          #{ |overlay| overlay.get().map_or(String::new(), |(_, step)| format!("{}%", step * 10)) }
        }
        div class="relative h-[12px] overflow-hidden rounded-[3px] bg-screen-ink/12" {
          div
          class="h-full bg-screen-ink transition-[width] duration-160 ease-[ease-out]"
          style=#{ |overlay| &format!("width: {}%", overlay.get().map_or(0, |(_, step)| step * 100 / (KNOB_STEPS - 1))) }
          {}
        }
      }
    }
  };
  element.set_attribute("aria-hidden", "true")?;
  Ok(element)
}

const OVERLAY: &str = "pointer-events-none absolute inset-0 z-2 grid animate-[overlay-in_120ms_ease-out] place-items-center rounded-[inherit] bg-screen/55";
