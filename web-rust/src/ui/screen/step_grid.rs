//! The drum grid, as web-react's `StepGrid`: a row a piece, its icon in a
//! narrow column, then the steps running left to right; each beat's first
//! step a little brighter and each bar's set off by a line. The head (where
//! keys set hits, or where the loop plays) is a green column over the
//! steps, red while recording, read every frame; the page shown follows it.

use std::cell::Cell;
use std::collections::BTreeSet;
use std::rc::Rc;

use fluid::Signal;
use fluid_macro::html;
use wasm_bindgen::JsCast;
use web_sys::{Element, HtmlElement, PointerEvent, WheelEvent};

use super::scope::animate;
use crate::modes::{self, StepRow};
use crate::state::app;
use crate::ui::markup;

/// Up to this many steps show at once, in whole bars (or whole beats when a
/// bar alone has more); the page follows the head.
const STEPS_PER_PAGE: u32 = 32;
/// Wheel travel (px) that moves the head one step.
const WHEEL_PER_STEP: f64 = 40.;

#[derive(Clone, PartialEq)]
struct Look {
  rows: Vec<StepRow>,
  steps: u32,
  per_beat: u32,
  bar_steps: u32,
  hits: BTreeSet<(usize, u32)>,
  recording: bool,
}

fn page_steps(per_beat: u32, bar_steps: u32) -> u32 {
  if bar_steps <= STEPS_PER_PAGE {
    bar_steps * (STEPS_PER_PAGE / bar_steps)
  } else {
    per_beat * (STEPS_PER_PAGE / per_beat)
  }
}

/// A wheel event's travel in pixels, whatever unit the browser reports.
pub fn wheel_pixels(event: &WheelEvent, delta: f64, page: f64) -> f64 {
  match event.delta_mode() {
    WheelEvent::DOM_DELTA_LINE => delta * 16.,
    WheelEvent::DOM_DELTA_PAGE => delta * page,
    _ => delta,
  }
}

fn toggle(row: usize, step: u32) {
  if let Some(on_toggle) = &modes::current().screen.on_toggle_step {
    on_toggle.call((row, step));
  }
}

fn rows(look: &Look, shown: u32, page: u32) -> Vec<Element> {
  let columns = page.min(look.steps - shown * page);
  look
    .rows
    .iter()
    .enumerate()
    .map(|(r, row)| {
      let cells: Vec<Element> = (0..columns)
        .map(|c| {
          let step = shown * page + c;
          let fill = if look.hits.contains(&(r, step)) {
            "before:bg-screen-ink"
          } else if step.is_multiple_of(look.per_beat) {
            "before:bg-screen-ink/13"
          } else {
            "before:bg-screen-ink/7"
          };
          let bar = if step.is_multiple_of(look.bar_steps) {
            " shadow-[inset_1px_0_color-mix(in_srgb,var(--color-screen-ink)_30%,transparent)]"
          } else {
            ""
          };
          html! {
            span
            class={ format!("relative min-h-0 cursor-pointer before:absolute before:inset-px before:rounded-[2px] {fill}{bar}") }
            @pointerdown.prevent={ move |_: PointerEvent| toggle(r, step) }
            {}
          }
        })
        .collect();
      html! {
        div class="grid min-h-0 grid-cols-[30px_repeat(var(--columns),minmax(0,1fr))]" {
          span
          class="grid min-h-0 place-items-center overflow-hidden text-[10px] leading-none font-semibold tracking-[0.04em] text-screen-ink/70 first-letter:uppercase [&_svg]:size-[14px]"
          title={ row.label.as_str() }
          { { markup(&row.icon.markup()) } }
          { cells }
        }
      }
    })
    .collect()
}

pub fn step_grid() -> Element {
  let look = fluid::create_memo(|| {
    modes::with(|bindings| {
      let screen = &bindings.screen;
      Look {
        rows: screen.step_rows.clone(),
        steps: screen.step_count,
        per_beat: screen.steps_per_beat.max(1),
        bar_steps: screen.steps_per_bar.max(1),
        hits: screen.step_hits.clone(),
        recording: screen.step_recording,
      }
    })
  });
  let page = Rc::new(Signal::new(0u32));
  let shown = {
    let (look, page) = (look.clone(), page.clone());
    fluid::create_memo(move || {
      let look = look.cloned();
      let steps = page_steps(look.per_beat, look.bar_steps);
      let shown = page
        .value()
        .min(look.steps.div_ceil(steps).saturating_sub(1));
      (look, shown, steps)
    })
  };
  let style = {
    let shown = shown.clone();
    move || {
      shown.with(|(look, at, steps)| {
        format!(
          "--columns: {}; grid-template-rows: repeat({}, minmax(0, 1fr));",
          (*steps).min(look.steps - at * steps),
          look.rows.len()
        )
      })
    }
  };
  let body = {
    let shown = shown.clone();
    fluid::show(
      move || shown.cloned(),
      |(look, at, steps)| {
        let head = if look.recording {
          "bg-synth-red/30 shadow-[inset_0_0_0_1.5px_var(--color-synth-red)]"
        } else {
          "bg-synth-green/30 shadow-[inset_0_0_0_1.5px_var(--color-synth-green)]"
        };
        let fragment = gloo_utils::document().create_document_fragment();
        for row in rows(&look, at, steps) {
          let _ = fragment.append_child(&row);
        }
        let head = html! {
          span
          class={ format!("pointer-events-none absolute -top-[2px] -bottom-[2px] left-[calc(30px_+_var(--head,0)_*_(100%_-_30px)_/_var(--columns))] w-[calc((100%_-_30px)_/_var(--columns))] rounded-[3px] {head}") }
          aria-hidden="true"
          {}
        };
        let _ = fragment.append_child(&head);
        fragment
      },
    )
  };
  let travel = Rc::new(Cell::new(0f64));
  let grid = html! {
    div
    class="absolute top-[30px] right-[20px] bottom-[30px] left-[20px] m-0 grid gap-[2px] font-screen"
    role="group"
    aria-label="Drum grid"
    style={ move || style() }
    @wheel.nonpassive.prevent={ move |event: WheelEvent| {
      let Some(element) = event.current_target().and_then(|target| target.dyn_into::<Element>().ok()) else {
        return;
      };
      let sideways = event.delta_x().abs() > event.delta_y().abs();
      let pixels = wheel_pixels(
        &event,
        if sideways { event.delta_x() } else { event.delta_y() },
        f64::from(element.client_width()),
      );
      let bindings = modes::current();
      let Some(on_move) = &bindings.screen.on_move_step else {
        return;
      };
      if pixels == 0. {
        return;
      }
      if pixels.signum() != travel.get().signum() || travel.get() == 0. {
        travel.set(0.);
      }
      travel.set(travel.get() + pixels);
      let notches = (travel.get() / WHEEL_PER_STEP).trunc();
      if notches == 0. {
        return;
      }
      travel.set(travel.get() - notches * WHEEL_PER_STEP);
      on_move.call(notches as i64);
    } }
    { { body } }
  };
  if let Some(element) = grid.dyn_ref::<HtmlElement>().cloned() {
    animate(move |_| {
      let head = app().grid.get_step_head();
      let steps = fluid::untrack(|| shown.with(|(_, _, steps)| *steps));
      let at = head / steps;
      page.set_if_changed(at);
      let _ = element
        .style()
        .set_property("--head", &(head - at * steps).to_string());
    });
  }
  grid
}
