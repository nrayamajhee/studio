//! The ADSR, LFO or FX of the focused lane, as web-react's
//! `modes/module.tsx`: the four knobs set its params, in knob order,
//! switching it on. Shift + Delete puts it back as it starts, off: the
//! picked track's, or the take's, though not over the piano roll or drum
//! grid.

use super::base::{DeleteJob, delete_pad};
use super::synth::resettable;
use super::{Bindings, Callback, Knob, KnobBinding, PadSlot, ScreenBadge, ScreenReadout};
use crate::logic::modules::{ModuleId, initial_modules, knob_display, knob_value};
use crate::state::App;
use crate::state::keymap::Tool;
use crate::state::lanes::is_take;

/// Binds the module view for `id`: the four knobs set its params, switching it
/// on, and Shift + Delete resets it.
fn mode_of(a: &'static App, b: &mut Bindings, id: ModuleId) {
  let modules = a.lanes.modules();
  let owner_label = a.lanes.modules_owner();
  let module = id.module();
  let focused = a.lanes.focused_lane();
  let track = (!is_take(&focused)).then_some(focused);
  let owner = track
    .as_ref()
    .map_or("the take".to_owned(), |track| track.name.clone());
  let steps = modules.steps.get(id).clone();
  for (index, which) in Knob::ALL.into_iter().enumerate() {
    let knob = &module.knobs[index];
    let step = steps[index];
    b.set_knob(
      which,
      KnobBinding {
        label: knob.spec.label.clone(),
        value_label: Some(knob_display(knob, step)),
        step: step as f64,
        steps: knob.steps,
        on_change: Callback::new(move |next: f64| {
          a.lanes.set_module_step(id, index, next as usize)
        }),
        fine: false,
      },
    );
  }
  let reset = resettable(a).then(|| {
    let label = module.label;
    let owner = owner.clone();
    DeleteJob::new(
      format!("Reset {owner}'s {label}"),
      format!(
        "reset:{}:{}",
        track.as_ref().map_or("take", |track| track.id.as_str()),
        id.key()
      ),
      format!("Press again to reset {owner}'s {label}"),
      move || {
        let mut next = fluid::untrack(|| a.lanes.modules());
        *next.on.get_mut(id) = false;
        *next.steps.get_mut(id) = initial_modules().steps.get(id).clone();
        a.lanes.set_modules(next);
        a.feedback.show_notice(format!("Reset {owner}'s {label}"));
      },
    )
  });
  b.set_pad(PadSlot::Tool(Tool::Delete), delete_pad(a, None, reset));

  let lfo = ModuleId::Lfo.module();
  let screen = &mut b.screen;
  screen.title = format!("{} · {owner_label}", module.label);
  screen.unsaved = false;
  screen.readouts = module
    .knobs
    .iter()
    .zip(&steps)
    .map(|(knob, &step)| ScreenReadout {
      label: knob.spec.label.clone(),
      display: knob_display(knob, step),
      amount: if knob.spec.id == "adsr.sustain" {
        knob_value(knob, step)
      } else {
        step as f64 / (knob.steps - 1) as f64
      },
    })
    .collect();
  screen.lfo_shape = modules.steps.lfo[2];
  screen.lfo_rate = knob_value(&lfo.knobs[0], modules.steps.lfo[0]);
  // On/off, centred along the bottom.
  screen.badge = Some(ScreenBadge {
    label: module.label.into(),
    on: Some(*modules.on.get(id)),
  });
}

/// Binds the ADSR view.
pub fn adsr(a: &'static App, b: &mut Bindings) {
  mode_of(a, b, ModuleId::Adsr);
}

/// Binds the LFO view.
pub fn lfo(a: &'static App, b: &mut Bindings) {
  mode_of(a, b, ModuleId::Lfo);
}

/// Binds the FX view.
pub fn fx(a: &'static App, b: &mut Bindings) {
  mode_of(a, b, ModuleId::Fx);
}
