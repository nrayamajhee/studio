//! A gear-edged knob, as web-react's `Knob`: drag it sideways or scroll to
//! step it, click to step it on (wrapping round). Its mark points from −135°
//! at the first step to +135° at the last.

use std::cell::{Cell, RefCell};
use std::rc::Rc;

use fluid::{Context, add_event_and_forget};
use fluid_macro::html;
use wasm_bindgen::prelude::*;
use web_sys::{Element, PointerEvent, WheelEvent};

use super::keep_focus;

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

fn gear_edge() -> String {
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
}

struct Drag {
  pointer: i32,
  x: f64,
  step: usize,
  moved: bool,
}

pub fn knob(ctx: &Context, knob: Knob) -> Result<Element, JsValue> {
  let knob = Rc::new(knob);
  let style = format!("--knob-color:{};--knob-mark:{}", knob.colour, knob.mark);
  let element = html! {
    button
    class="group relative inline-flex size-(--size) cursor-ew-resize touch-none items-center justify-center rounded-[50%] drop-shadow-knob select-none [--size:var(--knob-size,68px)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#2f7de1] focus-visible:outline-solid"
    style={ &style }
    {}
  };
  let cap = html! {
    span class="flex size-full items-center justify-center bg-(--knob-color) bg-[radial-gradient(circle,rgb(0_0_0/0)_72%,rgb(0_0_0/0.22)_88%,rgb(0_0_0/0.34)_100%)] transition-transform duration-200 ease-[ease] motion-reduce:transition-none" {
      span class="flex size-[calc(var(--size)*52/68)] justify-center rounded-[50%] bg-(--knob-color) bg-[radial-gradient(circle_at_38%_30%,rgb(255_255_255/0.42),rgb(255_255_255/0)_55%),radial-gradient(circle,rgb(0_0_0/0)_70%,rgb(0_0_0/0.12))] shadow-[0_0_0_1.5px_rgb(0_0_0/0.14),0_1px_2px_rgb(0_0_0/0.25)] group-active:brightness-95" {
        span class="mt-[calc(var(--size)*5/68)] h-[calc(var(--size)*14/68)] w-[calc(var(--size)*4/68)] rounded-[2px] bg-(--knob-mark)" {}
      }
    }
  };
  element.append_child(&cap)?;

  {
    let knob = knob.clone();
    let element = element.clone();
    let edge = gear_edge();
    ctx.create_effect(move || {
      let (step, steps) = (knob.step)();
      let angle = -135. + 270. / (steps.max(2) - 1) as f64 * step as f64;
      let _ = cap.set_attribute(
        "style",
        &format!("clip-path:{edge};transform:rotate({angle}deg)"),
      );
      let _ = element.set_attribute("aria-label", &(knob.label)());
    });
  }

  let set = {
    let knob = knob.clone();
    move |next: f64| {
      let (step, steps) = (knob.step)();
      let next = next.clamp(0., (steps - 1) as f64) as usize;
      if next != step {
        (knob.set)(next);
      }
    }
  };
  let set = Rc::new(set);
  let drag: Rc<RefCell<Option<Drag>>> = Rc::default();
  let dragged = Rc::new(Cell::new(false));

  {
    let knob = knob.clone();
    let drag = drag.clone();
    let target = element.clone();
    add_event_and_forget(&element, "pointerdown", move |event| {
      let Some(event) = event.dyn_ref::<PointerEvent>() else {
        return;
      };
      if event.button() != 0 {
        return;
      }
      let _ = target.set_pointer_capture(event.pointer_id());
      *drag.borrow_mut() = Some(Drag {
        pointer: event.pointer_id(),
        x: event.client_x() as f64,
        step: (knob.step)().0,
        moved: false,
      });
    });
  }
  {
    let drag = drag.clone();
    let set = set.clone();
    add_event_and_forget(&element, "pointermove", move |event| {
      let Some(event) = event.dyn_ref::<PointerEvent>() else {
        return;
      };
      let next = {
        let mut drag = drag.borrow_mut();
        let Some(start) = drag
          .as_mut()
          .filter(|start| start.pointer == event.pointer_id())
        else {
          return;
        };
        let distance = event.client_x() as f64 - start.x;
        if distance.abs() >= 4. {
          start.moved = true;
        }
        start.step as f64 + (distance / DRAG_STEP).trunc()
      };
      set(next);
    });
  }
  {
    let drag = drag.clone();
    let dragged = dragged.clone();
    add_event_and_forget(&element, "pointerup", move |_| {
      dragged.set(drag.borrow().as_ref().is_some_and(|start| start.moved));
      *drag.borrow_mut() = None;
    });
  }
  {
    let drag = drag.clone();
    add_event_and_forget(&element, "pointercancel", move |_| {
      *drag.borrow_mut() = None;
    });
  }
  {
    let knob = knob.clone();
    add_event_and_forget(&element, "click", move |_| {
      if dragged.replace(false) {
        return;
      }
      let (step, steps) = (knob.step)();
      (knob.set)((step + 1) % steps);
    });
  }
  {
    let travel = Cell::new(0.);
    add_event_and_forget(&element, "wheel", move |event| {
      let Some(event) = event.dyn_ref::<WheelEvent>() else {
        return;
      };
      event.prevent_default();
      let notch =
        event.delta_mode() != WheelEvent::DOM_DELTA_PIXEL || event.delta_y().abs() >= WHEEL_STEP;
      travel.set(if notch {
        -event.delta_y().signum() * WHEEL_STEP
      } else {
        travel.get() - event.delta_y()
      });
      let detents = (travel.get() / WHEEL_STEP).trunc();
      if detents == 0. {
        return;
      }
      travel.set(travel.get() - detents * WHEEL_STEP);
      let (step, _) = (knob.step)();
      set(step as f64 + detents);
    });
  }
  keep_focus(&element);
  Ok(element)
}
