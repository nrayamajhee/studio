//! The screen in its main view, the scope: the octave and the level on the
//! top line, the output's trace across the middle, and the sound and the
//! parameter the knobs set in the footer, each in its knob's colour. The
//! volume or level shows over it for a moment as its knob turns.

use std::cell::RefCell;
use std::rc::Rc;

use fluid_macro::html;
use gloo_utils::window;
use wasm_bindgen::JsCast;
use wasm_bindgen::prelude::*;
use web_sys::{AnalyserNode, CanvasRenderingContext2d, Element, HtmlCanvasElement};

use crate::device::{KNOB_STEPS, device, octave_label};

const GRID_ALPHA: f64 = 0.16;

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

/// The live output's waveform, as web-react's Oscilloscope draws it:
/// triggered on a rising zero crossing so periodic tones stand still, and a
/// flat line until audio starts. The trace and its centre line take the
/// canvas's CSS colour, so they follow the theme.
fn scope() -> Element {
  // Frames run outside the root scope, where the context isn't.
  let device = device();
  let canvas = html! {
    canvas aria-hidden="true" class="h-[160px] w-full text-screen-ink" {}
  };
  if let Ok(element) = canvas.clone().dyn_into::<HtmlCanvasElement>()
    && let Ok(Some(context)) = element.get_context("2d")
    && let Ok(context) = context.dyn_into::<CanvasRenderingContext2d>()
  {
    animate(move |samples| draw(&element, &context, device.sound.analyser(), samples));
  }
  canvas
}

/// The callback each animation frame asks for the next with.
type Frame = Rc<RefCell<Option<Closure<dyn FnMut()>>>>;

/// Runs `frame` on every animation frame for the page's lifetime, with a
/// buffer it can keep samples in.
fn animate(mut frame: impl FnMut(&mut Vec<f32>) + 'static) {
  let next: Frame = Rc::default();
  let again = next.clone();
  let mut samples = Vec::new();
  *next.borrow_mut() = Some(Closure::new(move || {
    if let Some(callback) = again.borrow().as_ref() {
      let _ = window().request_animation_frame(callback.as_ref().unchecked_ref());
    }
    frame(&mut samples);
  }));
  if let Some(callback) = next.borrow().as_ref() {
    let _ = window().request_animation_frame(callback.as_ref().unchecked_ref());
  }
}

fn draw(
  element: &HtmlCanvasElement,
  context: &CanvasRenderingContext2d,
  analyser: Option<AnalyserNode>,
  samples: &mut Vec<f32>,
) {
  let ratio = match window().device_pixel_ratio() {
    0. => 1.,
    ratio => ratio,
  };
  let width = (element.client_width() as f64 * ratio).round();
  let height = (element.client_height() as f64 * ratio).round();
  if element.width() != width as u32 || element.height() != height as u32 {
    element.set_width(width as u32);
    element.set_height(height as u32);
  }
  context.clear_rect(0., 0., width, height);
  let mid = height / 2.;
  let ink = window()
    .get_computed_style(element)
    .ok()
    .flatten()
    .and_then(|style| style.get_property_value("color").ok())
    .unwrap_or_default();

  let dash = js_sys::Array::of2(&(3. * ratio).into(), &(5. * ratio).into());
  let _ = context.set_line_dash(&dash);
  context.set_stroke_style_str(&ink);
  context.set_global_alpha(GRID_ALPHA);
  context.set_line_width(ratio);
  context.begin_path();
  context.move_to(0., mid);
  context.line_to(width, mid);
  context.stroke();
  let _ = context.set_line_dash(&js_sys::Array::new());
  context.set_global_alpha(1.);
  context.set_line_width(2.5 * ratio);
  context.set_line_join("round");
  context.set_line_cap("round");
  context.begin_path();
  let Some(analyser) = analyser else {
    context.move_to(0., mid);
    context.line_to(width, mid);
    context.stroke();
    return;
  };
  samples.resize(analyser.fft_size() as usize, 0.);
  analyser.get_float_time_domain_data(samples);
  let span = samples.len() / 2;
  let start = (1..samples.len() - span)
    .find(|&i| samples[i - 1] < 0. && samples[i] >= 0.)
    .unwrap_or(0);
  for x in 0..width as usize {
    let sample = samples[start + ((x as f64 / width) * span as f64) as usize] as f64;
    let y = mid - (sample * 1.6).clamp(-1., 1.) * mid * 0.9;
    if x == 0 {
      context.move_to(x as f64, y);
    } else {
      context.line_to(x as f64, y);
    }
  }
  context.stroke();
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
