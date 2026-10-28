//! Drum beats (Shift + Drum grid), as web-react's `modes/beats.tsx`: by
//! style, after the favorites. The red knob (or ← →) picks a page and the
//! blue one a beat. Picking a beat puts its kit on the keys (the instrument
//! pads keep what they're bound to). A tile tapped, or Play, plays it on
//! the preview, on its kit at the tempo; Play again pauses it. Save loads
//! it into the drum grid on that kit, setting the time signature to its own
//! and the tape's swing to its, if it has one (a preview plays with it
//! too), and opens the grid to play or keep it; so does a tile
//! double-clicked. Mute stars it.

use std::rc::Rc;

use super::base::{
  Entry, Picker, arrow_pads, idle_knob, preview_pads, save_pad, shelf_at, shelf_knobs, shelf_pager,
  shelf_step,
};
use super::{Bindings, Callback, Knob, PadSlot, Rich, ScreenTile, SelectedBy};
use crate::icons::Icon;
use crate::logic::beats::{DrumBeat, beat_pattern, beat_preview, drum_beats};
use crate::logic::presets::{DevicePreset, device_presets};
use crate::logic::swing::{swing_on, swung_take};
use crate::logic::timing::METERS;
use crate::state::App;
use crate::state::keymap::Tool;
use crate::state::preview::PreviewSound;
use crate::state::view::ScreenView;
use crate::store::favorites::FavoriteKind;

fn kit_preset(kit: &str) -> &'static DevicePreset {
  device_presets()
    .iter()
    .find(|preset| preset.target == kit)
    .unwrap_or(&device_presets()[0])
}

fn put_kit(a: &'static App, beat: &DrumBeat) {
  let kit = kit_preset(&beat.kit);
  if a.sound.preset_id() != kit.id {
    a.sound.select_preset(kit);
  }
}

fn audition(a: &'static App, beat: &DrumBeat) {
  let (bpm, swing) = fluid::untrack(|| (a.transport.bpm.value(), a.transport.swing.value()));
  let swung = swung_take(
    beat_preview(beat, bpm),
    swing_on(Some(beat.swing.unwrap_or(swing)), beat.per_beat),
  );
  a.preview.play(
    &beat.id,
    &swung,
    Some(PreviewSound {
      target: beat.kit.clone(),
      octave: 0,
    }),
    false,
  );
}

fn load(a: &'static App, index: usize, beat: &DrumBeat) {
  a.browse.beat_index.set(index);
  put_kit(a, beat);
  a.session.set_pattern(|_| beat_pattern(beat));
  if let Some(meter) = METERS.iter().position(|meter| *meter == beat.meter) {
    a.transport.set_meter(meter);
  }
  if let Some(swing) = beat.swing {
    a.transport.set_swing(swing);
  }
  a.views.set_view(ScreenView::DrumGrid);
  a.feedback.show_notice(match beat.swing {
    Some(swing) => format!("{} in the drum grid, swing {}%", beat.name, swing.amount),
    None => format!("{} in the drum grid", beat.name),
  });
}

pub fn mode(a: &'static App, b: &mut Bindings) {
  let all = drum_beats();
  let entries = all
    .iter()
    .map(|beat| Entry {
      id: beat.id.clone(),
      name: beat.name.clone(),
      category: beat.style.clone(),
    })
    .collect();
  let picker = Picker::new(
    a,
    FavoriteKind::Beats,
    entries,
    a.browse.beat_index.value(),
    Callback::new(move |index| a.browse.beat_index.set(index)),
    None,
    Some(Callback::new(move |entry: usize| put_kit(a, &all[entry]))),
  );
  let index = picker.index;
  let chosen = &all[picker.chosen().entry];
  let select = picker.select();
  let (shelf, at) = shelf_at(&picker.shelves, index);
  let listed = picker.listed.clone();
  let beat_at = Rc::new(move |index: usize| &all[listed[index].entry]);

  // A tile tapped plays, or pauses, as Play does.
  let tap = {
    let select = select.clone();
    let beat_at = beat_at.clone();
    move |index: usize| {
      select.call(index);
      let beat = beat_at(index);
      if a.preview.playing.value() && a.preview.cued().as_ref() == Some(&beat.id) {
        a.preview.pause();
      } else {
        audition(a, beat);
      }
    }
  };

  b.set_knob(Knob::Green, idle_knob(b.knob(Knob::Green)));
  let (red, blue) = shelf_knobs(&picker.shelves, index, &chosen.name, select.clone());
  b.set_knob(Knob::Red, red);
  b.set_knob(Knob::Blue, blue);
  b.set_pad(
    PadSlot::Tool(Tool::Save),
    save_pad(
      a,
      &format!("Load {} into the drum grid", chosen.name),
      None,
      Some(Rc::new(move || load(a, index, chosen))),
    ),
  );
  b.set_pad(PadSlot::Tool(Tool::Mute), picker.mute(a));
  preview_pads(b, a, &chosen.name, move || audition(a, chosen));
  let shelves = picker.shelves.clone();
  let step_select = select.clone();
  arrow_pads(
    b,
    a,
    ["Previous style".into(), "Next style".into()],
    move |direction| shelf_step(&shelves, at, &step_select, direction),
  );

  let screen = &mut b.screen;
  screen.title = "Beats".into();
  screen.unsaved = false;
  screen.pager = Some(shelf_pager(&picker.shelves, at, select));
  screen.footer = (
    Rich::new()
      .value(chosen.name.clone())
      .plain(format!(" on the {}", kit_preset(&chosen.kit).name)),
    Rich::new().hint("Save to load it into the drum grid"),
  );
  screen.tiles = picker.listed[shelf.start..shelf.start + shelf.count]
    .iter()
    .map(|listed| {
      let beat = &all[listed.entry];
      ScreenTile {
        id: beat.id.clone(),
        label: beat.name.clone(),
        icon: Icon::Label(beat.meter.label()),
        badge: picker.star(listed),
      }
    })
    .collect();
  screen.selected = index - shelf.start;
  screen.selected_by = SelectedBy::Blue;
  let start = shelf.start;
  screen.on_select = Some(Callback::new(move |tile: usize| tap(start + tile)));
  screen.on_activate = Some(Callback::new(move |tile: usize| {
    load(a, start + tile, beat_at(start + tile))
  }));
}
