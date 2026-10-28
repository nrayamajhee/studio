//! The scope, the main screen's view, as web-react's `Oscilloscope`.

use std::cell::{Cell, RefCell};
use std::rc::Rc;

use fluid_macro::html;
use gloo_utils::window;
use wasm_bindgen::JsCast;
use wasm_bindgen::prelude::*;
use web_sys::{AnalyserNode, CanvasRenderingContext2d, Element, HtmlCanvasElement};

use crate::state::app;

const GRID_ALPHA: f64 = 0.16;

/// The live output's waveform, as web-react's Oscilloscope draws it:
/// triggered on a rising zero crossing so periodic tones stand still, and a
/// flat line until audio starts. The trace and its centre line take the
/// canvas's CSS colour, so they follow the theme.
pub fn scope() -> Element {
  let canvas = html! {
    canvas aria-hidden="true" class="h-[160px] w-full text-screen-ink" {}
  };
  if let Ok(element) = canvas.clone().dyn_into::<HtmlCanvasElement>()
    && let Ok(Some(context)) = element.get_context("2d")
    && let Ok(context) = context.dyn_into::<CanvasRenderingContext2d>()
  {
    animate(move |samples| draw(&element, &context, app().engine.analyser(), samples));
  }
  canvas
}

/// The callback each animation frame asks for the next with.
pub type Frame = Rc<RefCell<Option<Closure<dyn FnMut()>>>>;

/// Runs `frame` on every animation frame until the current scope is
/// disposed, with a buffer it can keep samples in.
pub fn animate(mut frame: impl FnMut(&mut Vec<f32>) + 'static) {
  let next: Frame = Rc::default();
  // The frame asked for last, so leaving the page can call it off.
  let asked = Rc::new(Cell::new(0));
  let again = next.clone();
  let mut samples = Vec::new();
  *next.borrow_mut() = Some(Closure::new({
    let asked = asked.clone();
    move || {
      if let Some(callback) = again.borrow().as_ref() {
        asked.set(
          window()
            .request_animation_frame(callback.as_ref().unchecked_ref())
            .unwrap_or(0),
        );
      }
      frame(&mut samples);
    }
  }));
  if let Some(callback) = next.borrow().as_ref() {
    asked.set(
      window()
        .request_animation_frame(callback.as_ref().unchecked_ref())
        .unwrap_or(0),
    );
  }
  fluid::on_cleanup(move || {
    let _ = window().cancel_animation_frame(asked.get());
    drop(next.borrow_mut().take());
  });
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
