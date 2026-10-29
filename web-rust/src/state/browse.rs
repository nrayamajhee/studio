//! The tile pickers' highlighted tiles, and the green knob's resting place
//! where it has nothing to move, as web-react's `ModeProvider` keeps them.

use std::rc::Rc;

use fluid::Signal;

use crate::logic::presets::PresetPaging;

/// Where each picker's highlight rests, kept while its view is closed so it
/// opens where it was left, as web-react's `ModeProvider`: the save view's
/// icon, the instrument (and whether instruments page by model or band), the
/// chord, play style, progression and drum beat, and the revert option.
/// `idle_seek` is where the green knob rests in views it moves nothing in.
pub struct Browse {
  pub icon_index: Rc<Signal<usize>>,
  pub preset_index: Rc<Signal<usize>>,
  /// Whether the instruments are paged by model or by band.
  pub preset_paging: Rc<Signal<PresetPaging>>,
  pub chord_index: Rc<Signal<usize>>,
  pub style_index: Rc<Signal<usize>>,
  pub progression_index: Rc<Signal<usize>>,
  pub beat_index: Rc<Signal<usize>>,
  pub revert_index: Rc<Signal<usize>>,
  pub idle_seek: Rc<Signal<usize>>,
}

impl Browse {
  /// Every highlight on the first tile, instruments paged by model.
  pub fn new() -> Self {
    let zero = || Rc::new(Signal::new(0));
    Self {
      icon_index: zero(),
      preset_index: zero(),
      preset_paging: Rc::new(Signal::new(PresetPaging::Model)),
      chord_index: zero(),
      style_index: zero(),
      progression_index: zero(),
      beat_index: zero(),
      revert_index: zero(),
      idle_seek: zero(),
    }
  }
}
