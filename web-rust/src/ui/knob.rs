//! A gear-edged knob, as web-react's `Knob`: drag it sideways or scroll to
//! step it, click to step it on (wrapping round). Its mark points from −135°
//! at the first step to +135° at the last.

use std::cell::Cell;
use std::sync::OnceLock;

use fluid_macro::html;
use wasm_bindgen::JsCast;
use web_sys::{Element, PointerEvent, WheelEvent};

use super::blur_active;

pub struct Knob {
  pub colour: &'static str,
  pub mark: &'static str,
  /// The accessible name, with its value.
  pub label: Box<dyn Fn() -> String>,
  /// The step it's on and how many it has.
  pub step: Box<dyn Fn() -> (usize, usize)>,
  pub set: Box<dyn Fn(usize)>,
}

const TEETH: usize = 36;
/// [radius %, angle offset in degrees] of the four corners of each tooth.
const TOOTH_PROFILE: [(f64, f64); 4] = [(46.5, 0.), (50., 1.5), (50., 5.), (46.5, 6.5)];
/// Horizontal drag distance and trackpad scroll distance (px) per step.
const DRAG_STEP: f64 = 24.;
const WHEEL_STEP: f64 = 50.;

fn gear_edge() -> &'static str {
  static EDGE: OnceLock<String> = OnceLock::new();
  EDGE.get_or_init(|| {
    let corners: Vec<_> = (0..TEETH)
      .flat_map(|tooth| {
        TOOTH_PROFILE.iter().map(move |&(radius, offset)| {
          let angle = (tooth as f64 * 360. / TEETH as f64 + offset).to_radians();
          format!(
            "{:.2}% {:.2}%",
            50. + radius * angle.cos(),
            50. + radius * angle.sin()
          )
        })
      })
      .collect();
    format!("polygon({})", corners.join(", "))
  })
}

#[derive(Clone, Copy)]
struct Drag {
  pointer: i32,
  x: f64,
  step: usize,
  moved: bool,
}

/// A knob's binding and its gesture state. Knobs live as long as the page,
/// so each is leaked once and its handlers capture a `&'static` to it.
struct Control {
  knob: Knob,
  drag: Cell<Option<Drag>>,
  dragged: Cell<bool>,
  travel: Cell<f64>,
}

impl Control {
  fn angle(&self) -> f64 {
    let (step, steps) = (self.knob.step)();
    -135. + 270. / (steps.max(2) - 1) as f64 * step as f64
  }

  fn set(&self, next: f64) {
    let (step, steps) = (self.knob.step)();
    let next = next.clamp(0., (steps - 1) as f64) as usize;
    if next != step {
      (self.knob.set)(next);
    }
  }

  fn pointer_down(&self, event: &PointerEvent) {
    if event.button() != 0 {
      return;
    }
    if let Some(target) = event
      .current_target()
      .and_then(|target| target.dyn_into::<Element>().ok())
    {
      let _ = target.set_pointer_capture(event.pointer_id());
    }
    self.drag.set(Some(Drag {
      pointer: event.pointer_id(),
      x: event.client_x() as f64,
      step: (self.knob.step)().0,
      moved: false,
    }));
  }

  fn pointer_move(&self, event: &PointerEvent) {
    let Some(mut start) = self
      .drag
      .get()
      .filter(|start| start.pointer == event.pointer_id())
    else {
      return;
    };
    let distance = event.client_x() as f64 - start.x;
    if distance.abs() >= 4. {
      start.moved = true;
      self.drag.set(Some(start));
    }
    self.set(start.step as f64 + (distance / DRAG_STEP).trunc());
  }

  fn pointer_up(&self) {
    self
      .dragged
      .set(self.drag.take().is_some_and(|start| start.moved));
  }

  fn click(&self) {
    if self.dragged.replace(false) {
      return;
    }
    let (step, steps) = (self.knob.step)();
    (self.knob.set)((step + 1) % steps);
  }

  fn wheel(&self, event: &WheelEvent) {
    let notch =
      event.delta_mode() != WheelEvent::DOM_DELTA_PIXEL || event.delta_y().abs() >= WHEEL_STEP;
    let travel = if notch {
      -event.delta_y().signum() * WHEEL_STEP
    } else {
      self.travel.get() - event.delta_y()
    };
    let detents = (travel / WHEEL_STEP).trunc();
    self.travel.set(travel - detents * WHEEL_STEP);
    if detents != 0. {
      self.set((self.knob.step)().0 as f64 + detents);
    }
  }
}

pub fn knob(knob: Knob) -> Element {
  let style = format!("--knob-color:{};--knob-mark:{}", knob.colour, knob.mark);
  let control: &'static Control = Box::leak(Box::new(Control {
    knob,
    drag: Cell::new(None),
    dragged: Cell::new(false),
    travel: Cell::new(0.),
  }));
  html! {
    button
    class="group relative inline-flex size-(--size) cursor-ew-resize touch-none items-center justify-center rounded-[50%] drop-shadow-knob select-none [--size:var(--knob-size,68px)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#2f7de1] focus-visible:outline-solid"
    style={ style }
    aria-label={ move || (control.knob.label)() }
    @pointerdown={ move |event: PointerEvent| control.pointer_down(&event) }
    @pointermove={ move |event: PointerEvent| control.pointer_move(&event) }
    @pointerup={ move |_| control.pointer_up() }
    @pointercancel={ move |_| control.drag.set(None) }
    @click={ move |_| control.click() }
    @wheel.nonpassive.prevent={ move |event: WheelEvent| control.wheel(&event) }
    @mousedown.prevent={ |_| blur_active() }
    {
      span
      class="flex size-full items-center justify-center bg-(--knob-color) bg-[radial-gradient(circle,rgb(0_0_0/0)_72%,rgb(0_0_0/0.22)_88%,rgb(0_0_0/0.34)_100%)] transition-transform duration-200 ease-[ease] motion-reduce:transition-none"
      style={ move || format!("clip-path:{};transform:rotate({}deg)", gear_edge(), control.angle()) }
      {
        span class="flex size-[calc(var(--size)*52/68)] justify-center rounded-[50%] bg-(--knob-color) bg-[radial-gradient(circle_at_38%_30%,rgb(255_255_255/0.42),rgb(255_255_255/0)_55%),radial-gradient(circle,rgb(0_0_0/0)_70%,rgb(0_0_0/0.12))] shadow-[0_0_0_1.5px_rgb(0_0_0/0.14),0_1px_2px_rgb(0_0_0/0.25)] group-active:brightness-95" {
          span class="mt-[calc(var(--size)*5/68)] h-[calc(var(--size)*14/68)] w-[calc(var(--size)*4/68)] rounded-[2px] bg-(--knob-mark)" {}
        }
      }
    }
  }
}
