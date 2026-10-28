//! Parameters as the Device shows and turns them: web-react's
//! `patches/format.ts` and the module grouping of `patches/params.ts`, over
//! sound-engine's patch data.

use sound_engine::patches::{self, ParamSpec, Patch};

use super::js::{round, to_fixed};

/// Maps `t` ∈ [0, 1] across the param's range, geometrically for log params.
pub fn from_unit(spec: &ParamSpec, t: f64) -> f64 {
  if is_log(spec) {
    spec.min * (spec.max / spec.min).powf(t)
  } else {
    spec.min + (spec.max - spec.min) * t
  }
}

pub fn to_unit(spec: &ParamSpec, value: f64) -> f64 {
  let position = if is_log(spec) {
    (value / spec.min).ln() / (spec.max / spec.min).ln()
  } else {
    (value - spec.min) / (spec.max - spec.min)
  };
  position.clamp(0., 1.)
}

fn is_log(spec: &ParamSpec) -> bool {
  spec.scale.as_deref() == Some("log") && spec.min > 0.
}

pub fn step_to_value(spec: &ParamSpec, step: usize, steps: usize) -> f64 {
  from_unit(spec, step as f64 / (steps as f64 - 1.))
}

pub fn value_to_step(spec: &ParamSpec, value: f64, steps: usize) -> usize {
  round(to_unit(spec, value) * (steps as f64 - 1.)) as usize
}

/// A param's value as the screen shows it.
pub fn format_param(spec: &ParamSpec, value: f64) -> String {
  if let Some(options) = &spec.options {
    let index = round(value);
    return if index >= 0. {
      options.get(index as usize).cloned().unwrap_or_default()
    } else {
      String::new()
    };
  }
  match spec.unit.as_deref() {
    Some("Hz") if value >= 1000. => format!(
      "{} kHz",
      to_fixed(value / 1000., if value >= 10000. { 0 } else { 1 })
    ),
    Some("Hz") if value < 10. => format!("{} Hz", to_fixed(value, 1)),
    Some("Hz") => format!("{} Hz", round(value)),
    Some("s") if value < 1. => format!("{} ms", round(value * 1000.)),
    Some("s") => format!("{} s", to_fixed(value, 2)),
    Some("ms") => format!("{} ms", round(value)),
    Some("°") => format!("{}°", round(value)),
    Some("×") => format!("{}×", to_fixed(value, 2)),
    Some("st") => format!(
      "{}{} st",
      if value > 0. { "+" } else { "" },
      to_fixed(value, 1)
    ),
    // A fraction of something physical (a string's length), not the knob's
    // travel.
    Some("%") => format!("{}%", round(value * 100.)),
    Some("oct") => format!("{} oct", to_fixed(value, 1)),
    Some("cents") => format!("{} ¢", to_fixed(value, 1)),
    Some("dB") => format!("{} dB", to_fixed(value, 1)),
    _ => format!("{}%", round(100. * to_unit(spec, value))),
  }
}

/// The engine's models, as web-react's patches name their family.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Family {
  String,
  Bore,
  Bowed,
  Drums,
  Oscillator,
  Reed,
  Bar,
}

pub fn family(patch: &Patch) -> Family {
  match patch {
    Patch::String(_) => Family::String,
    Patch::Bore(_) => Family::Bore,
    Patch::Bowed(_) => Family::Bowed,
    Patch::Drums(_) => Family::Drums,
    Patch::Oscillator(_) => Family::Oscillator,
    Patch::Reed(_) => Family::Reed,
    Patch::Bar(_) => Family::Bar,
  }
}

/// An instrument's or kit's patch by its id. Every target the Device names
/// has one.
pub fn patch(id: &str) -> &'static Patch {
  let data = patches::data();
  patches::bus_index(id)
    .map(|index| &data.patches[index])
    .unwrap_or(&data.patches[0])
}

/// A master param (the ADSR, LFO, FX, reverb and volume over every
/// instrument).
pub fn master_param(id: &str) -> Option<&'static ParamSpec> {
  patches::data().master.iter().find(|spec| spec.id == id)
}

const MODULE_LABELS: [(&str, &str); 8] = [
  ("exciter", "Exciter"),
  ("resonator", "Resonator"),
  ("filter", "Filter"),
  ("body", "Body"),
  ("output", "Output"),
  ("envelope", "Envelope"),
  ("vibrato", "Vibrato"),
  ("master", "Master"),
];

/// The envelope is named after what it drives: the breath, the bow, the
/// bellows, a string's damper, the oscillator's gate.
fn envelope_label(family: Family) -> &'static str {
  match family {
    Family::String => "Damper",
    Family::Bore => "Breath",
    Family::Bowed => "Bow",
    Family::Reed => "Bellows",
    Family::Oscillator => "Gate",
    Family::Bar | Family::Drums => "Envelope",
  }
}

pub fn module_label(family: Family, id: &str) -> &'static str {
  if id == "envelope" {
    return envelope_label(family);
  }
  MODULE_LABELS
    .iter()
    .find(|(module, _)| *module == id)
    .map_or("", |(_, label)| label)
}

/// The order the modules act on a note: the signal chain (exciter,
/// resonator, filter, body, output), each modulator after the stage it acts
/// on. The envelope drives the exciter, damps a string's resonator, or gates
/// the oscillator after its filter; everything the vibrato moves happens
/// before the body.
fn module_order(family: Family) -> Vec<&'static str> {
  let envelope_after = match family {
    Family::String => "resonator",
    Family::Oscillator => "filter",
    _ => "exciter",
  };
  let mut order = Vec::new();
  for stage in ["exciter", "resonator", "filter", "body", "output"] {
    order.push(stage);
    if stage == envelope_after {
      order.push("envelope");
    }
    if stage == "filter" {
      order.push("vibrato");
    }
  }
  order
}

/// One of an instrument's modules: its params, in order.
#[derive(Clone, Debug)]
pub struct ParamModule {
  pub id: &'static str,
  pub label: &'static str,
  pub specs: Vec<&'static ParamSpec>,
}

/// An instrument's params grouped by module, in the order they act on a
/// note; modules it doesn't have are left out. The Synth screen gives each
/// its own page.
pub fn param_modules(specs: &'static [ParamSpec], family: Family) -> Vec<ParamModule> {
  module_order(family)
    .into_iter()
    .map(|id| ParamModule {
      id,
      label: module_label(family, id),
      specs: specs.iter().filter(|spec| spec.section == id).collect(),
    })
    .filter(|module| !module.specs.is_empty())
    .collect()
}

/// An instrument's params in module order, as the red knob picks them.
pub fn module_ordered(patch: &'static Patch) -> Vec<&'static ParamSpec> {
  param_modules(&patch.base().params, family(patch))
    .into_iter()
    .flat_map(|module| module.specs)
    .collect()
}

/// In the order of the LFO's shapes.
pub const LFO_SHAPES: [&str; 5] = ["Sine", "Triangle", "Square", "Saw", "Random"];

#[cfg(test)]
mod tests {
  use super::*;

  fn spec(unit: Option<&str>, scale: Option<&str>, min: f64, max: f64) -> ParamSpec {
    ParamSpec {
      id: "x".into(),
      label: "X".into(),
      section: "exciter".into(),
      min,
      max,
      default: min,
      unit: unit.map(Into::into),
      scale: scale.map(Into::into),
      options: None,
    }
  }

  #[test]
  fn formats_like_web_react() {
    let hz = spec(Some("Hz"), Some("log"), 20., 20000.);
    assert_eq!(format_param(&hz, 440.), "440 Hz");
    assert_eq!(format_param(&hz, 1500.), "1.5 kHz");
    assert_eq!(format_param(&hz, 12000.), "12 kHz");
    assert_eq!(format_param(&hz, 5.25), "5.3 Hz");
    let s = spec(Some("s"), Some("log"), 0.001, 4.);
    assert_eq!(format_param(&s, 0.2), "200 ms");
    assert_eq!(format_param(&s, 1.5), "1.50 s");
    let st = spec(Some("st"), None, -12., 12.);
    assert_eq!(format_param(&st, 2.), "+2.0 st");
    assert_eq!(format_param(&st, -0.5), "-0.5 st");
    let plain = spec(None, None, 0., 2.);
    assert_eq!(format_param(&plain, 0.5), "25%");
  }

  #[test]
  fn steps_land_on_values() {
    let s = spec(Some("s"), Some("log"), 0.01, 4.);
    // The master ADSR's 11-step knob lands on 200 ms.
    let step = value_to_step(&s, 0.2, 11);
    assert!((step_to_value(&s, step, 11) - 0.2).abs() < 0.03);
    assert_eq!(value_to_step(&s, 0.01, 11), 0);
    assert_eq!(value_to_step(&s, 4., 11), 10);
  }

  #[test]
  fn modules_follow_the_signal() {
    let piano = patch("piano");
    let modules = param_modules(&piano.base().params, family(piano));
    assert_eq!(modules[0].id, "exciter");
    let ordered = module_ordered(piano);
    assert_eq!(ordered.len(), piano.base().params.len());
    assert_eq!(module_label(Family::Bowed, "envelope"), "Bow");
  }
}
