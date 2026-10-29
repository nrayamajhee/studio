//! The system volume (the white knob) and the synth's level (the red one),
//! as web-react's `OutputProvider`.

use std::rc::Rc;

use fluid::Signal;

use super::app;
use super::feedback::ScreenOverlay;
use crate::logic::presets::KNOB_STEPS;
use crate::logic::starter::{INITIAL_LEVEL_STEP, INITIAL_VOLUME_STEP};

/// A knob step as a level from 0 to 1.
fn amount(step: usize) -> f64 {
  step as f64 / (KNOB_STEPS - 1) as f64
}

/// The two output knobs, as web-react's `OutputProvider`: the system volume
/// (white, after the clipper) and the synth's level (red, into it), each a knob
/// step. Setting either sends it to the engine and shows its level over the
/// screen; [`Output::reset_levels`] puts both back where a first visit starts.
pub struct Output {
  pub volume_step: Rc<Signal<usize>>,
  pub level_step: Rc<Signal<usize>>,
}

impl Output {
  /// Both knobs where a first visit starts.
  pub fn new() -> Self {
    Self {
      volume_step: Rc::new(Signal::new(INITIAL_VOLUME_STEP)),
      level_step: Rc::new(Signal::new(INITIAL_LEVEL_STEP)),
    }
  }

  /// Sends the starting levels, held until the engine starts.
  pub fn install(&self) {
    let engine = &app().engine;
    engine.set_volume(amount(INITIAL_VOLUME_STEP));
    engine.set_level(amount(INITIAL_LEVEL_STEP));
  }

  /// Shows `label`'s level over the screen while it changes.
  fn show_level(&self, label: &str, step: usize) {
    app().feedback.show_overlay(ScreenOverlay {
      label: label.into(),
      value: Some(amount(step)),
      display: Some(format!("{}%", step * 10)),
    });
  }

  /// The system volume, after the clipper.
  pub fn set_volume(&self, step: usize) {
    self.volume_step.set(step);
    app().engine.set_volume(amount(step));
    self.show_level("Volume", step);
  }

  /// The synth's level before the clipper.
  pub fn set_level(&self, step: usize) {
    self.level_step.set(step);
    app().engine.set_level(amount(step));
    self.show_level("Level", step);
  }

  /// Both knobs back where a first visit starts, sent to the engine without an
  /// overlay.
  pub fn reset_levels(&self) {
    let engine = &app().engine;
    fluid::batch(|| {
      self.level_step.set(INITIAL_LEVEL_STEP);
      self.volume_step.set(INITIAL_VOLUME_STEP);
    });
    engine.set_level(amount(INITIAL_LEVEL_STEP));
    engine.set_volume(amount(INITIAL_VOLUME_STEP));
  }
}
