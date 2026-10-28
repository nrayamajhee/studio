//! The main screen, as web-react's `modes/scope.tsx`: the live scope. The
//! green knob picks a param and the blue one sets it; the red knob is the
//! synth's level.

use super::base::{param_knob, selection, sound_name};
use super::{Bindings, Callback, Knob, KnobBinding, Rich};
use crate::logic::presets::KNOB_STEPS;
use crate::state::App;

pub fn mode(a: &'static App, b: &mut Bindings) {
  let level = a.output.level_step.value();
  b.set_knob(Knob::Green, param_knob(a));
  b.set_knob(
    Knob::Red,
    KnobBinding {
      label: "Level".into(),
      value_label: Some(format!("{}%", level * 10)),
      step: level as f64,
      steps: KNOB_STEPS,
      on_change: Callback::new(move |step: f64| a.output.set_level(step as usize)),
      fine: false,
    },
  );
  b.screen.status_left = Some(Rich::text(a.sound.octave_label()));
  b.screen.status = Rich::new().level(format!("Level {}%", level * 10));
  b.screen.footer = (Rich::text(sound_name(a)), selection(a));
}
