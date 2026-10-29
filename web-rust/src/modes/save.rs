//! The icon picker Save opens from the synth parameters, as web-react's
//! `modes/save.tsx`: the green knob picks an icon, then Save keeps the sound
//! as a new preset, or a pad saves it there.

use std::rc::Rc;

use super::base::{arrow_pads, pad_name, pad_preset, save_pad, seek_knob, sound_name};
use super::{Bindings, Callback, Knob, PadSlot, Rich, ScreenTile};
use crate::icons::{Icon, preset_icon_keys};
use crate::logic::math::{icon_label, turn_page};
use crate::logic::presets::DevicePreset;
use crate::state::App;
use crate::state::keymap::Tool;
use crate::state::view::ScreenView;

/// The tiles a page of the icons holds.
pub const PER_PAGE: usize = 48;

/// The icons a saved preset can wear, in the order the picker shows them.
fn icon_choices() -> Vec<&'static str> {
  preset_icon_keys().collect()
}

/// Where an icon sits among the choices (the first, if it isn't one).
pub fn preset_icon_index(icon: &str) -> usize {
  preset_icon_keys().position(|key| key == icon).unwrap_or(0)
}

/// Saving bakes the edits into the saved preset, so the one it came from
/// goes back to its own values.
fn finish_save(a: &'static App, saved: &DevicePreset, message: String) {
  a.sound.adopt_preset(saved);
  a.views.set_view(ScreenView::Scope);
  a.feedback.show_notice(message);
}

/// Saving onto the pad that already holds this saved preset overwrites it;
/// anything else becomes a new preset bound to that pad.
fn save_to_pad(a: &'static App, pad: usize) {
  fluid::untrack(|| {
    let shift = a.shift.shift();
    let preset = a.sound.preset();
    let values = a.sound.values();
    let icon = icon_choices()[a.browse.icon_index.value()];
    let bound = a.library.library.with(|library| {
      let pads = if shift {
        &library.shift_buttons
      } else {
        &library.buttons
      };
      pads.get(pad).cloned().unwrap_or_default()
    });
    let name = sound_name(a);
    let saved = if preset.user && bound == preset.id {
      a.library.update_preset(&preset, values, icon, &name)
    } else {
      a.library.save_preset(&preset, values, icon, &name)
    };
    a.library.bind_pad(pad, &saved.id, shift);
    a.library.clear_edits(&preset.id);
    finish_save(
      a,
      &saved,
      format!(
        "Saved {} to {}",
        saved.name,
        pad_name(a, pad).to_lowercase()
      ),
    );
  });
}

/// Binds the save view: the green knob picks an icon, Save keeps the sound as a
/// new preset (or over the saved one), and a pad saves it there.
pub fn mode(a: &'static App, b: &mut Bindings) {
  let choices = icon_choices();
  let count = choices.len();
  let icon_index = a.browse.icon_index.value().min(count - 1);

  b.set_knob(
    Knob::Green,
    seek_knob(
      icon_label(choices[icon_index]),
      icon_index as f64,
      count,
      Callback::new(move |step: f64| a.browse.icon_index.set(step as usize)),
    ),
  );
  b.set_pad(
    PadSlot::Tool(Tool::Save),
    save_pad(
      a,
      "Save instrument",
      None,
      Some(Rc::new(move || {
        let saved = fluid::untrack(|| {
          let preset = a.sound.preset();
          let saved = a.library.save_preset(
            &preset,
            a.sound.values(),
            icon_choices()[icon_index],
            &sound_name(a),
          );
          a.library.clear_edits(&preset.id);
          saved
        });
        finish_save(a, &saved, format!("Saved {}", saved.name));
      })),
    ),
  );
  arrow_pads(
    b,
    a,
    ["Previous page".into(), "Next page".into()],
    move |direction| {
      a.browse
        .icon_index
        .update(|index| *index = turn_page(*index, direction, PER_PAGE, count))
    },
  );
  for (pad, binding) in b.instrument_pads.iter_mut().enumerate() {
    binding.label = format!(
      "Save to {} ({})",
      pad_name(a, pad).to_lowercase(),
      pad_preset(a, pad).map_or("empty".to_owned(), |preset| preset.name)
    );
    binding.on_press = Callback::new(move |_| save_to_pad(a, pad));
  }

  let screen = &mut b.screen;
  screen.status = Rich::new().seek(format!(
    "Icons {}/{}",
    icon_index / PER_PAGE + 1,
    count.div_ceil(PER_PAGE)
  ));
  screen.footer = (
    Rich::new().hint("Pick an icon"),
    Rich::new().hint("Press a pad to save"),
  );
  screen.tiles = choices
    .iter()
    .map(|&icon| ScreenTile {
      id: icon.into(),
      label: icon_label(icon),
      icon: Icon::Preset(icon.into()),
      badge: None,
    })
    .collect();
  screen.selected = icon_index;
  screen.on_select = Some(Callback::new(move |index: usize| {
    a.browse.icon_index.set(index)
  }));
}
