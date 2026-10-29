//! The instrument playing: its preset, edited params and octave shift, as
//! web-react's `SoundProvider`.

use std::rc::Rc;

use fluid::Signal;
use sound_engine::patches::{ParamSpec, Patch};

use super::app;
use crate::logic::params::{
  family, format_param, module_label, module_ordered, patch, step_to_value, value_to_step,
};
use crate::logic::presets::{
  DevicePreset, KNOB_STEPS, Values, clamp_octave, device_presets, find_preset, is_kit,
  preset_values,
};
use crate::logic::synth_pages::{SynthPage, synth_pages};
use crate::store::library::all_presets;

/// The preset a first visit plays.
const INITIAL_PRESET: &str = "piano";

/// A param with named choices (the oscillator's wave) steps through them.
pub fn steps_of(spec: &ParamSpec) -> usize {
  spec.options.as_ref().map_or(KNOB_STEPS, Vec::len)
}

/// A param's name away from its page: its label, led by its module where
/// another module has the same one (the filter's Resonance, the body's).
pub fn param_name(patch: &Patch, specs: &[&ParamSpec], spec: &ParamSpec) -> String {
  let shared = specs
    .iter()
    .any(|other| !std::ptr::eq(*other, spec) && other.label == spec.label);
  if shared {
    format!(
      "{} {}",
      module_label(family(patch), &spec.section),
      spec.label
    )
  } else {
    spec.label.clone()
  }
}

/// The instrument playing, as web-react's `SoundProvider`: its preset, the
/// param the red knob has picked, the keybed's octave shift, and the Synth
/// screen's page and the block its overview has picked.
///
/// Its methods read the preset as the views need it (its patch, params in
/// module order, values with edits, the picked param's name and display, the
/// synth pages) and change it: pick, preview, step or adopt a preset, turn a
/// param (kept as an edit in the library), shift the octave, and revert one
/// sound's edits or every sound's.
pub struct SoundStore {
  pub preset: Rc<Signal<DevicePreset>>,
  pub param_index: Rc<Signal<usize>>,
  pub octave: Rc<Signal<i32>>,
  /// The Synth screen's page, and the block the overview has picked; kept
  /// by module so they carry over to the next instrument when it has them.
  pub page_id: Rc<Signal<&'static str>>,
  pub chain_pick: Rc<Signal<&'static str>>,
}

impl SoundStore {
  /// The piano, its first param picked, no octave shift, the synth on its
  /// overview.
  pub fn new() -> Self {
    Self {
      preset: Rc::new(Signal::new(find_preset(INITIAL_PRESET).clone())),
      param_index: Rc::new(Signal::new(0)),
      octave: Rc::new(Signal::new(0)),
      page_id: Rc::new(Signal::new("chain")),
      chain_pick: Rc::new(Signal::new("exciter")),
    }
  }

  /// Loads the first preset, with its kept edits, into the engine.
  pub fn install(&self) {
    let initial = find_preset(INITIAL_PRESET);
    app()
      .engine
      .load_preset(initial, app().library.edits(&initial.id).as_ref());
  }

  /// Every preset by family, then the saved ones.
  pub fn presets(&self) -> Vec<DevicePreset> {
    app().library.library.with(all_presets)
  }

  /// The preset playing, tracked.
  pub fn preset(&self) -> DevicePreset {
    self.preset.cloned()
  }

  /// The id of the preset playing, tracked.
  pub fn preset_id(&self) -> String {
    self.preset.with(|preset| preset.id.clone())
  }

  /// The edits made to the preset since it was picked.
  pub fn edits(&self) -> Option<Values> {
    let id = self.preset_id();
    app()
      .library
      .library
      .with(|library| library.edits.get(&id).cloned())
  }

  /// The preset's own values plus any edits made since it was picked.
  pub fn values(&self) -> Values {
    let mut values = self.preset.with(preset_values);
    for (id, value) in self.edits().into_iter().flatten() {
      values.insert(id, value);
    }
    values
  }

  /// The patch the preset plays.
  pub fn patch(&self) -> &'static Patch {
    self.preset.with(|preset| patch(&preset.target))
  }

  /// The instrument's params in module order, as the red knob picks them.
  pub fn specs(&self) -> Vec<&'static ParamSpec> {
    module_ordered(self.patch())
  }

  /// The param the red knob has picked.
  pub fn selected(&self) -> &'static ParamSpec {
    let specs = self.specs();
    specs[self.param_index.value().min(specs.len() - 1)]
  }

  /// The picked param's value, edited or the preset's own.
  pub fn selected_value(&self) -> f64 {
    let selected = self.selected();
    self
      .values()
      .get(&selected.id)
      .copied()
      .unwrap_or(selected.default)
  }

  /// The picked param's name, as the screen shows it.
  pub fn selected_name(&self) -> String {
    param_name(self.patch(), &self.specs(), self.selected())
  }

  /// The picked param's value as text, in its units.
  pub fn selected_display(&self) -> String {
    format_param(self.selected(), self.selected_value())
  }

  /// How many steps the picked param's knob has.
  pub fn value_steps(&self) -> usize {
    steps_of(self.selected())
  }

  /// The Synth screen: its pages (the overview, then a module each).
  pub fn pages(&self) -> Vec<SynthPage> {
    let patch = self.patch();
    synth_pages(&patch.base().params, family(patch))
  }

  /// The Synth screen's page index, by the page kept (the overview if the
  /// instrument hasn't it).
  pub fn page_index(&self) -> usize {
    let page = self.page_id.value();
    self
      .pages()
      .iter()
      .position(|candidate| candidate.id == page)
      .unwrap_or(0)
  }

  /// The Synth screen's page showing.
  pub fn page(&self) -> SynthPage {
    let pages = self.pages();
    pages[self.page_index().min(pages.len() - 1)].clone()
  }

  /// The block the overview has picked, or the first module.
  pub fn chain_pick(&self) -> &'static str {
    let pick = self.chain_pick.value();
    let pages = self.pages();
    if pages.iter().any(|page| page.id == pick) {
      pick
    } else {
      pages[1].id
    }
  }

  /// Shows the Synth screen's page at `index`.
  pub fn show_page(&self, index: usize) {
    let pages = self.pages();
    self.page_id.set(pages[index.min(pages.len() - 1)].id);
  }

  /// Picks the overview's block `id`.
  pub fn pick_block(&self, id: &'static str) {
    self.chain_pick.set(id);
  }

  /// The octave as the screen shows it: `OCT ±0`, `OCT +1`, `OCT −2`.
  pub fn octave_label(&self) -> String {
    let octave = self.octave.value();
    let sign = match octave {
      1.. => '+',
      ..=-1 => '−',
      0 => '±',
    };
    format!("OCT {sign}{}", octave.unsigned_abs())
  }

  /// The kit the drum grid plays, while one is picked.
  pub fn step_kit(&self) -> Option<String> {
    self
      .preset
      .with(|preset| is_kit(&preset.target).then(|| preset.target.clone()))
  }

  /// Turning back to the preset's own step restores its exact value and
  /// drops the edit. The param becomes the selected one, so the main screen
  /// shows what was last turned.
  pub fn set_param_step(&self, spec: &'static ParamSpec, step: usize) {
    let steps = steps_of(spec);
    let preset = self.preset.cloned();
    let own = preset_values(&preset)
      .get(&spec.id)
      .copied()
      .unwrap_or(spec.default);
    let original = step == value_to_step(spec, own, steps);
    let value = if original {
      own
    } else {
      step_to_value(spec, step, steps)
    };
    app().engine.set_value(&spec.id, value);
    let index = fluid::untrack(|| {
      self
        .specs()
        .iter()
        .position(|candidate| std::ptr::eq(*candidate, spec))
    });
    fluid::batch(|| {
      app().library.set_edit(
        &preset.id,
        &spec.id,
        if original { None } else { Some(value) },
      );
      self.param_index.set(index.unwrap_or(0));
    });
  }

  /// Keeps the selected param when the next instrument has it too, and the
  /// octave shift as far as the next one's range allows.
  pub fn select_preset(&self, next: &DevicePreset) {
    let edits = app().library.edits(&next.id);
    self.select_preset_with(next, edits.as_ref());
  }

  /// Picks `next` and loads it with `edits` into the engine.
  fn select_preset_with(&self, next: &DevicePreset, edits: Option<&Values>) {
    let engine = &app().engine;
    engine.unlock();
    engine.load_preset(next, edits);
    let selected = fluid::untrack(|| self.selected().id.clone());
    let next_specs = module_ordered(patch(&next.target));
    fluid::batch(|| {
      self.preset.set(next.clone());
      self
        .octave
        .update(|octave| *octave = clamp_octave(*octave, next));
      self.param_index.set(
        next_specs
          .iter()
          .position(|spec| spec.id == selected)
          .unwrap_or(0),
      );
    });
  }

  /// Plays `next` (a preset being browsed) without picking it, or with
  /// `None` the one picked again.
  pub fn preview_preset(&self, next: Option<&DevicePreset>) {
    let picked = self.preset.get_untracked().clone();
    let playing = next.unwrap_or(&picked);
    let edits = app().library.edits(&playing.id);
    app().engine.load_preset(playing, edits.as_ref());
  }

  /// Picks `next` with `values` (a track's own settings), kept as its edits
  /// so the Synth screen shows and turns them.
  pub fn play_with(&self, next: &DevicePreset, values: &Values) {
    let own = preset_values(next);
    let params = &patch(&next.target).base().params;
    let edits: Values = values
      .iter()
      .filter(|(id, value)| {
        params.iter().any(|spec| &spec.id == *id) && own.get(*id) != Some(value)
      })
      .map(|(id, value)| (id.clone(), *value))
      .collect();
    app().library.replace_edits(&next.id, edits);
    let edits = app().library.edits(&next.id);
    self.select_preset_with(next, edits.as_ref());
  }

  /// Saving bakes the edits into the saved preset, so the one it came from
  /// goes back to its own values.
  pub fn adopt_preset(&self, saved: &DevicePreset) {
    app().engine.load_preset(saved, None);
    self.preset.set(saved.clone());
  }

  /// Shift and the arrows step through every preset, round and round.
  pub fn step_preset(&self, direction: i32) {
    let presets = fluid::untrack(|| self.presets());
    let id = self.preset.with_untracked(|preset| preset.id.clone());
    let at = presets
      .iter()
      .position(|preset| preset.id == id)
      .map_or(-1, |at| at as i32);
    let count = presets.len() as i32;
    let next = &presets[(at + direction).rem_euclid(count) as usize];
    self.select_preset(next);
  }

  /// Shifts the keybed an octave up or down, as far as the preset reaches.
  pub fn shift_octave(&self, direction: i32) {
    let preset = self.preset.get_untracked().clone();
    self
      .octave
      .update(|octave| *octave = clamp_octave(*octave + direction, &preset));
  }

  /// Picks the param at `index`, in module order.
  pub fn select_param(&self, index: usize) {
    self.param_index.set(index);
  }

  /// Turns the picked param to `step`.
  pub fn set_selected_value(&self, step: usize) {
    let selected = fluid::untrack(|| self.selected());
    self.set_param_step(selected, step);
  }

  /// Drops the preset's edits, back to its own values.
  pub fn revert_sound(&self) {
    let preset = self.preset.get_untracked().clone();
    app().library.clear_edits(&preset.id);
    app().engine.load_preset(&preset, None);
  }

  /// Drops every preset's edits.
  pub fn revert_all_sounds(&self) {
    let preset = self.preset.get_untracked().clone();
    app().library.clear_all_edits();
    app().engine.load_preset(&preset, None);
  }
}

/// A built-in preset playing `target`, for a track whose preset is gone.
pub fn preset_for_target(target: &str) -> Option<&'static DevicePreset> {
  device_presets()
    .iter()
    .find(|preset| preset.target == target)
}
