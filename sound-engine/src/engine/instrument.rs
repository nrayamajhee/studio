use super::bus::Bus;
use super::modules::{MODEL_ROUTING, OUTPUT_ROUTING};
use super::param_set::Values;
use crate::dsp::adsr::AdsrStages;
use crate::models::bar::BarModel;
use crate::models::bore::BoreModel;
use crate::models::bowed::{self, BowedModel};
use crate::models::drums::DrumModel;
use crate::models::oscillator::{self, OscillatorModel};
use crate::models::reed::{self, ReedModel};
use crate::models::string::StringModel;
use crate::patches::Patch;

/// One of the seven physical models, with its voices.
pub enum Model {
  String(StringModel),
  Bore(BoreModel),
  Bowed(BowedModel),
  Drums(DrumModel),
  Oscillator(OscillatorModel),
  Reed(ReedModel),
  Bar(BarModel),
}

/// Calls the same method on whichever model it is.
macro_rules! each {
  ($model:expr, $m:ident => $body:expr) => {
    match $model {
      Model::String($m) => $body,
      Model::Bore($m) => $body,
      Model::Bowed($m) => $body,
      Model::Drums($m) => $body,
      Model::Oscillator($m) => $body,
      Model::Reed($m) => $body,
      Model::Bar($m) => $body,
    }
  };
}

/// One instrument (or kit): its bus and its model.
pub struct Instrument {
  pub bus: Bus,
  pub model: Model,
}

impl Instrument {
  pub fn new(patch: &'static Patch, fs: f64) -> Self {
    Self::with(patch, fs, None)
  }

  /// An instrument whose params start at `overrides` rather than its
  /// patch's defaults, as an offline render sets it up.
  pub fn with(patch: &'static Patch, fs: f64, overrides: Option<&Values>) -> Self {
    let (routing, base) = match patch {
      Patch::String(p) => (OUTPUT_ROUTING, &p.base),
      Patch::Bore(p) => (MODEL_ROUTING, &p.base),
      Patch::Bowed(p) => (bowed::ROUTING, &p.base),
      Patch::Drums(p) => (MODEL_ROUTING, &p.base),
      Patch::Oscillator(p) => (oscillator::ROUTING, &p.base),
      Patch::Reed(p) => (reed::ROUTING, &p.base),
      Patch::Bar(p) => (OUTPUT_ROUTING, &p.base),
    };
    let bus = Bus::new(base, fs, routing, overrides);
    let mods = &bus.mods;
    let model = match patch {
      Patch::String(p) => Model::String(StringModel::new(p, fs, mods)),
      Patch::Bore(p) => Model::Bore(BoreModel::new(p, fs, mods)),
      Patch::Bowed(p) => Model::Bowed(BowedModel::new(p, fs, mods)),
      Patch::Drums(p) => Model::Drums(DrumModel::new(p, fs, mods)),
      Patch::Oscillator(p) => Model::Oscillator(OscillatorModel::new(p, fs, mods)),
      Patch::Reed(p) => Model::Reed(ReedModel::new(p, fs, mods)),
      Patch::Bar(p) => Model::Bar(BarModel::new(p, fs, mods)),
    };
    let mut instrument = Self { bus, model };
    instrument.apply_params();
    instrument
  }

  pub fn set_param(&mut self, index: usize, value: f64) -> bool {
    if !self.bus.params.set_index(index, value) {
      return false;
    }
    self.apply_params();
    true
  }

  /// After construction and after every param change: the bus, then every
  /// sounding voice's filter target, then the model's own params.
  pub fn apply_params(&mut self) {
    self.bus.apply_params();
    let bus = &self.bus;
    each!(&mut self.model, m => {
      for core in m.voices_mut() {
        if core.busy() {
          let note = core.note;
          core.chain.retarget(note, &bus.mods);
        }
      }
      m.read_params(bus);
    });
  }

  /// The master ADSR: one amplitude envelope over every voice.
  pub fn set_shape(&mut self, stages: AdsrStages) {
    each!(&mut self.model, m => {
      for core in m.voices_mut() {
        core.chain.shape.set_stages(stages);
      }
    });
  }

  pub fn active_voices(&self) -> usize {
    each!(&self.model, m => m.active_voices())
  }

  pub fn note_on(&mut self, note: i32, velocity: f64) {
    let bus = &self.bus;
    match &mut self.model {
      Model::String(m) => m.note_on(bus, note, velocity),
      Model::Bore(m) => m.note_on(bus, note, velocity),
      Model::Bowed(m) => m.note_on(bus, note, velocity),
      Model::Drums(_) => {}
      Model::Oscillator(m) => m.note_on(bus, note, velocity),
      Model::Reed(m) => m.note_on(bus, note, velocity),
      Model::Bar(m) => m.note_on(bus, note, velocity),
    }
  }

  pub fn note_off(&mut self, note: i32) {
    let bus = &self.bus;
    match &mut self.model {
      Model::String(m) => m.note_off(bus, note),
      Model::Bore(m) => m.note_off(bus, note),
      Model::Bowed(m) => m.note_off(note),
      Model::Drums(_) => {}
      Model::Oscillator(m) => m.note_off(note),
      Model::Reed(m) => m.note_off(note),
      Model::Bar(m) => m.note_off(note),
    }
  }

  pub fn sustain(&mut self, down: bool) {
    if let Model::String(m) = &mut self.model {
      m.sustain(&self.bus, down);
    }
  }

  pub fn hit(&mut self, piece: &str, velocity: f64) {
    if let Model::Drums(m) = &mut self.model {
      m.hit(&self.bus, piece, velocity);
    }
  }

  pub fn all_notes_off(&mut self) {
    let bus = &self.bus;
    match &mut self.model {
      Model::String(m) => m.all_notes_off(bus),
      Model::Bore(m) => m.all_notes_off(),
      Model::Bowed(m) => m.all_notes_off(),
      Model::Drums(_) => {}
      Model::Oscillator(m) => m.all_notes_off(),
      Model::Reed(m) => m.all_notes_off(),
      Model::Bar(m) => m.all_notes_off(),
    }
  }

  pub fn panic(&mut self) {
    each!(&mut self.model, m => m.panic());
  }

  pub fn render(&mut self, start: usize, end: usize) {
    if self.active_voices() > 0 {
      let bus = &mut self.bus;
      each!(&mut self.model, m => m.render(bus, start, end));
    }
  }

  pub fn finish(
    &mut self,
    n: usize,
    master_l: &mut [f32],
    master_r: &mut [f32],
    reverb_in: &mut [f32],
  ) {
    if let Model::Drums(m) = &mut self.model {
      m.filter(&mut self.bus, n);
    }
    let active = self.active_voices() > 0;
    if self.bus.finish(n, active, master_l, master_r, reverb_in) {
      each!(&mut self.model, m => m.free_finished());
    }
  }
}
