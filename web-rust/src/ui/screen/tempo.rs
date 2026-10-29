//! The tempo view, as web-react's `DeviceScreen` draws it: the tempo in
//! green, as the green knob sets it, over a light per beat.

use std::cell::{Cell, RefCell};
use std::rc::Rc;

use fluid::Signal;
use fluid_macro::html;
use wasm_bindgen::JsCast;
use web_sys::{Element, HtmlInputElement, KeyboardEvent, PointerEvent};

use crate::logic::js::number;
use crate::logic::timing::DEFAULT_TIMING;
use crate::modes;
use crate::ui::blur_active;

/// Pixels of sideways drag per beat per minute.
const BPM_DRAG: f64 = 4.;

/// The tempo field: the number, big.
const FIELD: &str = "-my-[8px] h-[88px] w-[calc(3ch_+_28px)] rounded-[18px] border-2 px-[12px] text-center text-synth-green tabular-nums outline-none [corner-shape:squircle]";

/// What the field shows: the tempo, whether it can be set, and whether it
/// is being typed in (then the tempo doesn't redraw it).
#[derive(Clone, PartialEq)]
enum Field {
  /// The tempo, which can't be set here.
  Shown(f64),
  /// The tempo, which can be dragged or clicked to type.
  Settable(f64),
  /// Being typed in.
  Editing,
}

/// Sets the tempo, as the bindings do.
fn set_bpm(bpm: f64) {
  if let Some(on_bpm) = &modes::current().screen.on_bpm {
    on_bpm.call(bpm);
  }
}

/// A drag on the tempo: its pointer, and where it started (x and tempo).
struct Drag {
  pointer: i32,
  x: f64,
  bpm: f64,
}

/// The typed tempo: Enter or a click away sets it; Esc leaves it as it was.
fn input(bpm: f64, editing: Rc<Signal<bool>>) -> Element {
  let cancelled = Rc::new(Cell::new(false));
  let field = html! {
    input
    class={ format!("{FIELD} border-synth-green") }
    aria-label="Tempo in BPM"
    inputmode="numeric"
    maxlength="3"
    value={ number(bpm) }
    @input={ |event: web_sys::Event| {
      if let Some(input) = event.current_target().and_then(|target| target.dyn_into::<HtmlInputElement>().ok()) {
        let digits: String = input.value().chars().filter(char::is_ascii_digit).collect();
        if digits != input.value() {
          input.set_value(&digits);
        }
      }
    } }
    @keydown={ {
      let cancelled = cancelled.clone();
      move |event: KeyboardEvent| {
        if event.key() == "Escape" {
          cancelled.set(true);
        }
        if (event.key() == "Enter" || event.key() == "Escape")
          && let Some(input) = event.current_target().and_then(|target| target.dyn_into::<web_sys::HtmlElement>().ok())
        {
          let _ = input.blur();
        }
      }
    } }
    @blur={ move |event: web_sys::FocusEvent| {
      let typed = event
        .current_target()
        .and_then(|target| target.dyn_into::<HtmlInputElement>().ok())
        .and_then(|input| input.value().parse::<i64>().ok());
      editing.set(false);
      if !cancelled.get() && let Some(typed) = typed {
        set_bpm(typed as f64);
      }
    } }
    {}
  };
  // Focused and selected once it is in the page.
  let focus = field.clone();
  gloo_timers::callback::Timeout::new(0, move || {
    if let Some(input) = focus.dyn_ref::<HtmlInputElement>() {
      let _ = input.focus();
      input.select();
    }
  })
  .forget();
  field
}

/// The tempo dragged sideways like the knob, or clicked to type it in.
fn button(bpm: f64, editing: Rc<Signal<bool>>) -> Element {
  let drag: Rc<RefCell<Option<Drag>>> = Rc::default();
  let dragged = Rc::new(Cell::new(false));
  html! {
    button
    type="button"
    aria-label={ format!("Tempo: {} BPM", number(bpm)) }
    class={ format!("{FIELD} border-transparent cursor-ew-resize hover:border-screen-ink/20") }
    @mousedown.prevent={ |_| blur_active() }
    @pointerdown={ {
      let (drag, dragged) = (drag.clone(), dragged.clone());
      move |event: PointerEvent| {
        if event.button() != 0 {
          return;
        }
        if let Some(target) = event.current_target().and_then(|target| target.dyn_into::<Element>().ok()) {
          let _ = target.set_pointer_capture(event.pointer_id());
        }
        *drag.borrow_mut() = Some(Drag {
          pointer: event.pointer_id(),
          x: f64::from(event.client_x()),
          bpm,
        });
        dragged.set(false);
      }
    } }
    @pointermove={ {
      let (drag, dragged) = (drag.clone(), dragged.clone());
      move |event: PointerEvent| {
        let drag = drag.borrow();
        let Some(start) = drag.as_ref().filter(|start| start.pointer == event.pointer_id()) else {
          return;
        };
        let distance = f64::from(event.client_x()) - start.x;
        if distance.abs() >= 4. {
          dragged.set(true);
        }
        let next = start.bpm + (distance / BPM_DRAG).trunc();
        if dragged.get() && next != bpm {
          set_bpm(next);
        }
      }
    } }
    @pointerup={ {
      let drag = drag.clone();
      move |_| *drag.borrow_mut() = None
    } }
    @pointercancel={ move |_| *drag.borrow_mut() = None }
    @click={ move |_| {
      if dragged.get() {
        dragged.set(false);
        return;
      }
      editing.set(true);
    } }
    { span { { number(bpm) } } }
  }
}

/// The tempo view: the tempo big in the middle, dragged or typed when it can be
/// set, with the time signature's beats lit as the metronome clicks.
pub fn tempo() -> Element {
  let editing = Rc::new(Signal::new(false));
  let field = {
    let editing = editing.clone();
    fluid::create_memo(move || {
      let (bpm, settable) = modes::with(|bindings| {
        let screen = &bindings.screen;
        (
          screen.timing.unwrap_or(DEFAULT_TIMING).bpm,
          screen.on_bpm.is_some(),
        )
      });
      match (settable, editing.value()) {
        (false, _) => Field::Shown(bpm),
        (true, false) => Field::Settable(bpm),
        (true, true) => Field::Editing,
      }
    })
  };
  let lights = fluid::create_memo(|| {
    modes::with(|bindings| {
      let screen = &bindings.screen;
      (
        screen.timing.unwrap_or(DEFAULT_TIMING).meter.beats,
        screen.beat,
      )
    })
  });
  let shown = fluid::show(
    move || field.cloned(),
    move |field| match field {
      Field::Shown(bpm) => html! { span class="text-synth-green" { { number(bpm) } } },
      Field::Settable(bpm) => button(bpm, editing.clone()),
      Field::Editing => {
        let bpm = modes::current().screen.timing.unwrap_or(DEFAULT_TIMING).bpm;
        input(bpm, editing.clone())
      }
    },
  );
  let beats = fluid::show(
    move || lights.cloned(),
    |(beats, beat)| {
      let lights: Vec<Element> = (0..beats as usize)
        .map(|i| {
          let class = if beat == Some(i) {
            "size-[10px] rounded-[50%] bg-screen-ink"
          } else {
            "size-[10px] rounded-[50%] bg-screen-ink/18"
          };
          html! { span class={ class } {} }
        })
        .collect();
      html! { span class="flex gap-[16px]" aria-hidden="true" { { lights } } }
    },
  );
  html! {
    div class="absolute top-[30px] right-[20px] bottom-[30px] left-[20px] m-0 flex flex-col items-center justify-center gap-[18px] font-screen" {
      span class="flex items-baseline gap-[10px] text-[72px] leading-none font-semibold tabular-nums" {
        // Mirrors the unit, so the number centres over the lights.
        span class="invisible text-[14px] tracking-[0.08em] text-screen-ink/55" aria-hidden="true" { "BPM" }
        { shown }
        span class="text-[14px] tracking-[0.08em] text-screen-ink/55" { "BPM" }
      }
      { beats }
    }
  }
}
