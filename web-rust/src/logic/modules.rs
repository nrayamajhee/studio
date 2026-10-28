//! The three global modules the Device layers over every instrument (the
//! ADSR, LFO and FX), as web-react's `deviceEngine.ts` and `modules.ts`
//! define them, and the settings the take and each track keep for them.

use std::sync::OnceLock;

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use sound_engine::patches::ParamSpec;

use super::params::{LFO_SHAPES, format_param, master_param, step_to_value, value_to_step};
use super::presets::{KNOB_STEPS, Values};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ModuleId {
  Adsr,
  Lfo,
  Fx,
}

pub const MODULE_IDS: [ModuleId; 3] = [ModuleId::Adsr, ModuleId::Lfo, ModuleId::Fx];

impl ModuleId {
  pub fn key(self) -> &'static str {
    match self {
      Self::Adsr => "adsr",
      Self::Lfo => "lfo",
      Self::Fx => "fx",
    }
  }

  pub fn index(self) -> usize {
    self as usize
  }

  pub fn module(self) -> &'static DeviceModule {
    &device_modules()[self.index()]
  }
}

/// A module's knob: a master param, with the Device's label and the knob's
/// starting value as its default. The engine's own default (no effect) is
/// what "off" sends.
#[derive(Clone, Debug)]
pub struct ModuleKnob {
  pub spec: ParamSpec,
  pub steps: usize,
  /// The lowest step's value when it isn't on the scale: a true 0 ms
  /// attack, or the shortest release that doesn't click.
  pub floor: Option<f64>,
  /// Named steps, for knobs that pick rather than set (LFO shape and
  /// target).
  pub options: Option<Vec<&'static str>>,
}

#[derive(Clone, Debug)]
pub struct DeviceModule {
  pub id: ModuleId,
  pub label: &'static str,
  pub title: &'static str,
  /// White, green, red and blue knob, in that order.
  pub knobs: Vec<ModuleKnob>,
}

#[derive(Default)]
struct KnobOptions {
  steps: Option<usize>,
  options: Option<Vec<&'static str>>,
  min: Option<f64>,
  max: Option<f64>,
  floor: Option<f64>,
}

fn knob(id: &str, label: &str, start: f64, options: KnobOptions) -> ModuleKnob {
  let spec = master_param(id).unwrap_or_else(|| panic!("Missing master param {id}"));
  ModuleKnob {
    spec: ParamSpec {
      label: label.into(),
      default: start,
      min: options.min.unwrap_or(spec.min),
      max: options.max.unwrap_or(spec.max),
      ..spec.clone()
    },
    steps: options.steps.unwrap_or(KNOB_STEPS),
    floor: options.floor,
    options: options.options,
  }
}

/// The ADSR, LFO and FX, in [`MODULE_IDS`] order. Each knob's start sits
/// on a knob step (0, 200 ms, 50%, 200 ms for the ADSR; 5 Hz for the LFO).
pub fn device_modules() -> &'static [DeviceModule; 3] {
  static MODULES: OnceLock<[DeviceModule; 3]> = OnceLock::new();
  MODULES.get_or_init(|| {
    [
      DeviceModule {
        id: ModuleId::Adsr,
        label: "ADSR",
        title: "ADSR envelope",
        knobs: vec![
          knob(
            "adsr.attack",
            "Attack",
            0.001,
            KnobOptions {
              floor: Some(0.),
              ..KnobOptions::default()
            },
          ),
          knob("adsr.decay", "Decay", 0.2, KnobOptions::default()),
          knob("adsr.sustain", "Sustain", 0.5, KnobOptions::default()),
          // A release under ~3 ms cuts dark notes off with a click; 5 ms is
          // the lowest step, with margin. The rest keep the 10 ms–4 s
          // scale, with 200 ms on a step.
          knob(
            "adsr.release",
            "Release",
            0.2,
            KnobOptions {
              min: Some(0.01),
              floor: Some(0.005),
              ..KnobOptions::default()
            },
          ),
        ],
      },
      DeviceModule {
        id: ModuleId::Lfo,
        label: "LFO",
        title: "LFO",
        knobs: vec![
          knob("lfo.rate", "Rate", 5., KnobOptions::default()),
          knob("lfo.depth", "Depth", 0.5, KnobOptions::default()),
          knob(
            "lfo.shape",
            "Shape",
            0.,
            KnobOptions {
              steps: Some(LFO_SHAPES.len()),
              options: Some(LFO_SHAPES.to_vec()),
              ..KnobOptions::default()
            },
          ),
          knob(
            "lfo.target",
            "Target",
            0.,
            KnobOptions {
              steps: Some(4),
              options: Some(vec!["Pitch", "Volume", "Filter", "Pan"]),
              ..KnobOptions::default()
            },
          ),
        ],
      },
      DeviceModule {
        id: ModuleId::Fx,
        label: "FX",
        title: "Effects",
        knobs: vec![
          knob("fx.drive", "Drive", 0., KnobOptions::default()),
          knob("fx.chorus", "Chorus", 0., KnobOptions::default()),
          knob("fx.delay", "Delay", 0., KnobOptions::default()),
          // Up to twice the engine's reverb, so the default sits mid-knob.
          knob(
            "reverb.return",
            "Reverb",
            0.35,
            KnobOptions {
              max: Some(0.7),
              ..KnobOptions::default()
            },
          ),
        ],
      },
    ]
  })
}

/// Each module's on/off, or its knobs' steps, by module.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct PerModule<T> {
  pub adsr: T,
  pub lfo: T,
  pub fx: T,
}

impl<T> PerModule<T> {
  pub fn get(&self, id: ModuleId) -> &T {
    match id {
      ModuleId::Adsr => &self.adsr,
      ModuleId::Lfo => &self.lfo,
      ModuleId::Fx => &self.fx,
    }
  }

  pub fn get_mut(&mut self, id: ModuleId) -> &mut T {
    match id {
      ModuleId::Adsr => &mut self.adsr,
      ModuleId::Lfo => &mut self.lfo,
      ModuleId::Fx => &mut self.fx,
    }
  }
}

/// The ADSR, LFO and FX as the take or a track has them: each on or off,
/// and its knobs' steps, which are kept while it is off.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ModuleSettings {
  pub on: PerModule<bool>,
  pub steps: PerModule<Vec<usize>>,
}

impl Default for ModuleSettings {
  fn default() -> Self {
    initial_modules()
  }
}

pub fn initial_modules() -> ModuleSettings {
  let steps = |id: ModuleId| {
    id.module()
      .knobs
      .iter()
      .map(|knob| value_to_step(&knob.spec, knob.spec.default, knob.steps))
      .collect()
  };
  ModuleSettings {
    on: PerModule::default(),
    steps: PerModule {
      adsr: steps(ModuleId::Adsr),
      lfo: steps(ModuleId::Lfo),
      fx: steps(ModuleId::Fx),
    },
  }
}

impl ModuleSettings {
  /// Whether it has the shape web-react keeps (`isModules`).
  pub fn is_valid(&self) -> bool {
    MODULE_IDS
      .iter()
      .all(|&id| self.steps.get(id).len() == id.module().knobs.len())
  }
}

pub fn knob_value(knob: &ModuleKnob, step: usize) -> f64 {
  match knob.floor {
    Some(floor) if step == 0 => floor,
    _ => step_to_value(&knob.spec, step, knob.steps),
  }
}

pub fn knob_display(knob: &ModuleKnob, step: usize) -> String {
  match knob.options.as_ref().and_then(|options| options.get(step)) {
    Some(option) => (*option).to_owned(),
    None => format_param(&knob.spec, knob_value(knob, step)),
  }
}

/// The engine's own default for a master param: what leaves the sound
/// alone.
pub fn engine_default(id: &str) -> f64 {
  master_param(id).map_or(0., |spec| spec.default)
}

/// Every module param's value: the knobs' while the module is on, and the
/// engine's default, which leaves the sound alone, while it is off.
pub fn module_values(modules: &ModuleSettings) -> Values {
  let mut values = IndexMap::new();
  for id in MODULE_IDS {
    for (index, knob) in id.module().knobs.iter().enumerate() {
      let value = if *modules.on.get(id) {
        knob_value(knob, modules.steps.get(id).get(index).copied().unwrap_or(0))
      } else {
        engine_default(&knob.spec.id)
      };
      values.insert(knob.spec.id.clone(), value);
    }
  }
  values
}

/// The settings a track saved before it kept its own had baked into its
/// sound: a module is on if any of its params is off the engine's default.
pub fn modules_of(master: Option<&Values>) -> ModuleSettings {
  let empty = Values::new();
  let master = master.unwrap_or(&empty);
  let initial = initial_modules();
  let mut modules = initial.clone();
  for id in MODULE_IDS {
    let knobs = &id.module().knobs;
    let on = knobs.iter().any(|knob| {
      master
        .get(&knob.spec.id)
        .is_some_and(|value| (value - engine_default(&knob.spec.id)).abs() > 1e-9)
    });
    *modules.on.get_mut(id) = on;
    if !on {
      continue;
    }
    *modules.steps.get_mut(id) = knobs
      .iter()
      .enumerate()
      .map(|(index, knob)| match master.get(&knob.spec.id) {
        None => initial.steps.get(id)[index],
        Some(&value) if knob.floor == Some(value) => 0,
        Some(&value) => value_to_step(&knob.spec, value, knob.steps),
      })
      .collect();
  }
  modules
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn knobs_start_on_their_steps() {
    let initial = initial_modules();
    assert_eq!(initial.steps.lfo[2], 0);
    // 200 ms decay and release, 50% sustain and 5 Hz land on steps.
    let adsr = &ModuleId::Adsr.module().knobs;
    assert!((knob_value(&adsr[1], initial.steps.adsr[1]) - 0.2).abs() < 1e-9);
    assert!((knob_value(&adsr[2], initial.steps.adsr[2]) - 0.5).abs() < 1e-9);
    assert!((knob_value(&adsr[3], initial.steps.adsr[3]) - 0.2).abs() < 1e-9);
    let lfo = &ModuleId::Lfo.module().knobs;
    assert!((knob_value(&lfo[0], initial.steps.lfo[0]) - 5.).abs() < 0.05);
  }

  #[test]
  fn modules_round_trip_through_a_sound() {
    let mut modules = initial_modules();
    modules.on.fx = true;
    modules.steps.fx = vec![3, 0, 5, 5];
    let values = module_values(&modules);
    assert_eq!(modules_of(Some(&values)), modules);
    assert_eq!(knob_display(&ModuleId::Lfo.module().knobs[3], 2), "Filter");
  }

  #[test]
  fn json_shape_is_web_reacts() {
    let json = serde_json::to_string(&initial_modules()).unwrap();
    assert!(json.starts_with(r#"{"on":{"adsr":false,"lfo":false,"fx":false},"steps":{"adsr":["#));
  }
}
