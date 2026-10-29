//! The chord palette, as web-react's `modes/chords.tsx`: by kind, after the
//! favorites. The red knob (or ← →) picks a page and the blue one a chord
//! on it, and pressing a chord pad twice sets it to that chord, the palette
//! staying open for the next. Mute stars the chord.

use super::base::{
  Entry, Picker, arrow_pads, idle_knob, shelf_at, shelf_knobs, shelf_pager, shelf_step,
};
use super::{Bindings, Callback, Knob, PadSlot, Rich, ScreenTile, SelectedBy};
use crate::icons::Icon;
use crate::logic::chords::{chord_by_id, chord_group, palette};
use crate::state::App;
use crate::state::keymap::Tool;
use crate::store::favorites::FavoriteKind;

/// Binds the chord palette: the red and blue knobs (and ← →) pick a page and a
/// chord, a chord pad pressed twice takes it, and Mute stars it.
pub fn mode(a: &'static App, b: &mut Bindings) {
  let entries = palette()
    .map(|chord| Entry {
      id: chord.id.into(),
      name: chord.name.into(),
      category: chord_group(chord.id).into(),
    })
    .collect();
  let picker = Picker::new(
    a,
    FavoriteKind::Chords,
    entries,
    a.browse.chord_index.value(),
    Callback::new(move |index| a.browse.chord_index.set(index)),
    None,
    None,
  );
  let index = picker.index;
  let chosen = chord_by_id(&picker.chosen_entry().id);
  let select = picker.select();
  let (shelf, at) = shelf_at(&picker.shelves, index);

  b.set_knob(Knob::Green, idle_knob(b.knob(Knob::Green)));
  let (red, blue) = shelf_knobs(&picker.shelves, index, chosen.name, select.clone());
  b.set_knob(Knob::Red, red);
  b.set_knob(Knob::Blue, blue);
  b.set_pad(PadSlot::Tool(Tool::Mute), picker.mute(a));
  let shelves = picker.shelves.clone();
  let step_select = select.clone();
  arrow_pads(
    b,
    a,
    ["Previous kind".into(), "Next kind".into()],
    move |direction| shelf_step(&shelves, at, &step_select, direction),
  );
  for (pad, binding) in b.chord_pads.iter_mut().enumerate() {
    binding.label = format!("Set chord {} to {}", pad + 1, chosen.name);
    binding.on_press = Callback::new(move |_| {
      if !a.feedback.confirm(
        &format!("chord:{pad}"),
        &format!("Press again to set chord {} to {}", pad + 1, chosen.name),
      ) {
        return;
      }
      a.chords.set_pad_chord(pad, chosen.id);
      a.feedback
        .show_notice(format!("Chord {} → {}", pad + 1, chosen.name));
    });
  }

  let screen = &mut b.screen;
  screen.title = "Chords".into();
  screen.unsaved = false;
  screen.pager = Some(shelf_pager(&picker.shelves, at, select.clone()));
  screen.footer = (
    Rich::new().value(chosen.name),
    Rich::new().hint("Press a chord pad twice to set"),
  );
  screen.tiles = picker.listed[shelf.start..shelf.start + shelf.count]
    .iter()
    .map(|listed| {
      let chord = chord_by_id(&picker.entry(listed).id);
      ScreenTile {
        id: chord.id.into(),
        label: chord.name.into(),
        icon: Icon::Label(chord.label.into()),
        badge: picker.star(listed),
      }
    })
    .collect();
  screen.selected = index - shelf.start;
  screen.selected_by = SelectedBy::Blue;
  let start = shelf.start;
  screen.on_select = Some(Callback::new(move |tile: usize| select.call(start + tile)));
}
