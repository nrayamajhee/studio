//! The preset library, as web-react's `modes/instruments.tsx`: by model or
//! (the green knob) by band, after the favorites and before the saved
//! presets. The red knob (or ← →) picks a page and the blue one a preset on
//! it, which the keys and anything playing sound on while the library is
//! open, without picking it. Pressing a pad twice binds it there, the
//! library staying open for the next. Mute stars the preset; Delete removes
//! a highlighted saved preset; built-in ones can't be deleted.

use std::rc::Rc;

use super::base::{
  DeleteJob, Entry, Picker, arrow_pads, delete_pad, list_favorites, pad_name, pad_preset, shelf_at,
  shelf_knobs, shelf_pager, shelf_step,
};
use super::{Bindings, Callback, Knob, KnobBinding, PadSlot, Rich, ScreenTile, SelectedBy};
use crate::icons::Icon;
use crate::logic::presets::{DevicePreset, PresetPaging, device_presets, page_of, preset_pages};
use crate::state::App;
use crate::state::keymap::Tool;
use crate::store::favorites::FavoriteKind;

/// The presets as a picker's entries, filed by model or band.
fn entries(presets: &[DevicePreset], paging: PresetPaging) -> Vec<Entry> {
  presets
    .iter()
    .map(|preset| Entry {
      id: preset.id.clone(),
      name: preset.name.clone(),
      category: page_of(preset, paging).into(),
    })
    .collect()
}

/// Binds the instruments: the green knob pages by model or band, the red and
/// blue (and ← →) pick a page and a preset, which plays without being picked; a
/// pad pressed twice binds it, Mute stars it and Delete removes a saved one.
pub fn mode(a: &'static App, b: &mut Bindings) {
  let paging = a.browse.preset_paging.value();
  let presets = Rc::new(preset_pages(&a.sound.presets(), paging));
  let by_band = paging == PresetPaging::Band;
  let picker = Picker::new(
    a,
    FavoriteKind::Instruments,
    entries(&presets, paging),
    a.browse.preset_index.value(),
    Callback::new(move |index| a.browse.preset_index.set(index)),
    None,
    None,
  );
  let index = picker.index;
  let chosen = presets[picker.chosen().entry].clone();
  let chosen_page = picker.chosen().page.clone();
  let select = picker.select();
  let (shelf, at) = shelf_at(&picker.shelves, index);

  // Repaging keeps the pick: where it was among the favorites, or else on
  // its page in the new order.
  let repage = {
    let chosen = chosen.clone();
    move |next: PresetPaging| {
      if next == paging {
        return;
      }
      let items = preset_pages(&a.sound.presets(), next);
      let entries = entries(&items, next);
      let favorites = a
        .favorites
        .favorites
        .with(|favorites| favorites.instruments.clone());
      let relisted = list_favorites(&entries, &favorites, FavoriteKind::Instruments);
      let on = |page: &str| {
        relisted
          .iter()
          .position(|listed| entries[listed.entry].id == chosen.id && listed.page == page)
      };
      let to = on(&chosen_page).or_else(|| on(page_of(&chosen, next)));
      fluid::batch(|| {
        a.browse.preset_paging.set(next);
        a.browse.preset_index.set(to.unwrap_or(0));
      });
    }
  };
  b.set_knob(
    Knob::Green,
    KnobBinding {
      label: "Pages".into(),
      value_label: Some(if by_band { "By band" } else { "By model" }.into()),
      step: if by_band { 1. } else { 0. },
      steps: 2,
      on_change: Callback::new(move |step: f64| {
        repage(if step > 0. {
          PresetPaging::Band
        } else {
          PresetPaging::Model
        })
      }),
      fine: false,
    },
  );
  let (red, blue) = shelf_knobs(&picker.shelves, index, &chosen.name, select.clone());
  b.set_knob(Knob::Red, red);
  b.set_knob(Knob::Blue, blue);

  // Deleting the preset playing falls back to its built-in. The pick stays
  // where it was, on the one after.
  let trash = chosen.user.then(|| {
    let trash = chosen.clone();
    let listed = picker.listed.clone();
    let entries = picker.entries.clone();
    let forget = {
      let favorites = picker.favorites.clone();
      move |id: &str| {
        if favorites.iter().any(|favorite| favorite == id) {
          a.favorites.toggle(FavoriteKind::Instruments, id);
        }
      }
    };
    DeleteJob::new(
      format!("Delete {}", trash.name),
      format!("delete:{}", trash.id),
      format!("Press again to delete {}", trash.name),
      move || {
        forget(&trash.id);
        a.library.delete_preset(&trash.id);
        a.feedback.show_notice(format!("Deleted {}", trash.name));
        let is_trash = |listed: &super::base::Listed| entries[listed.entry].id == trash.id;
        let before = listed[..index].iter().filter(|l| is_trash(l)).count();
        let left = listed.iter().filter(|l| !is_trash(l)).count();
        a.browse
          .preset_index
          .set((index - before).min(left.saturating_sub(1)));
        if a.sound.preset_id() == trash.id {
          let builtin = device_presets()
            .iter()
            .find(|preset| preset.target == trash.target)
            .unwrap_or(&device_presets()[0]);
          a.sound.select_preset(builtin);
        }
      },
    )
  });
  b.set_pad(
    PadSlot::Tool(Tool::Delete),
    delete_pad(a, trash.map(|job| (job, true)), None),
  );
  b.set_pad(PadSlot::Tool(Tool::Mute), picker.mute(a));
  let shelves = picker.shelves.clone();
  let step_select = select.clone();
  arrow_pads(
    b,
    a,
    if by_band {
      ["Previous band".into(), "Next band".into()]
    } else {
      ["Previous model".into(), "Next model".into()]
    },
    move |direction| shelf_step(&shelves, at, &step_select, direction),
  );

  let shift = a.shift.shift();
  for (pad, binding) in b.instrument_pads.iter_mut().enumerate() {
    let name = pad_name(a, pad);
    let bound = pad_preset(a, pad).map_or("empty".to_owned(), |preset| preset.name);
    let chosen = chosen.clone();
    binding.label = format!("Bind to {} ({bound})", name.to_lowercase());
    binding.on_press = Callback::new(move |_| {
      if !a.feedback.confirm(
        &format!("bind:{pad}"),
        &format!("Press again to bind to {}", name.to_lowercase()),
      ) {
        return;
      }
      a.library.bind_pad(pad, &chosen.id, shift);
      a.feedback.show_notice(format!("{name} → {}", chosen.name));
    });
  }
  b.preview_sound = Some(chosen.clone());

  let library = a.library.library.cloned();
  let screen = &mut b.screen;
  screen.title = "Instruments".into();
  screen.unsaved = false;
  screen.pager = Some(shelf_pager(&picker.shelves, at, select.clone()));
  screen.footer = (
    Rich::new().value(chosen.name.clone()),
    Rich::new().hint("Press a pad twice to bind"),
  );
  screen.tiles = picker.listed[shelf.start..shelf.start + shelf.count]
    .iter()
    .map(|listed| {
      let candidate = &presets[listed.entry];
      let pads = |ids: &[String], prefix: &str| -> Vec<String> {
        ids
          .iter()
          .enumerate()
          .filter(|(_, id)| **id == candidate.id)
          .map(|(pad, _)| format!("{prefix}{}", pad + 1))
          .collect()
      };
      let badges: Vec<String> = picker
        .star(listed)
        .into_iter()
        .chain(pads(&library.buttons, ""))
        .chain(pads(&library.shift_buttons, "⇧"))
        .collect();
      ScreenTile {
        id: candidate.id.clone(),
        label: candidate.name.clone(),
        icon: Icon::Preset(candidate.icon.clone()),
        badge: (!badges.is_empty()).then(|| badges.join(" ")),
      }
    })
    .collect();
  screen.selected = index - shelf.start;
  screen.selected_by = SelectedBy::Blue;
  let start = shelf.start;
  screen.on_select = Some(Callback::new(move |tile: usize| select.call(start + tile)));
}
