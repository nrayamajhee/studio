//! How the chord pads play, as web-react's `modes/playStyle.tsx`: after the
//! favorites, grouped by what holding a chord does, then the saved ones.
//! The red knob (or ← →) picks a page and the blue one a play style on it,
//! which plays it. The green knob sets what that style listens to, its rate
//! or its strum's gap; for a style that listens to both, green is the rate
//! and Shift + green the strum. Save keeps the changes, as a new play style
//! or in the saved one picked; Delete removes a saved one; Mute stars it.

use std::rc::Rc;

use super::base::{
  DeleteJob, Entry, Picker, arrow_pads, delete_pad, idle_knob, save_pad, shelf_at, shelf_knobs,
  shelf_pager, shelf_step,
};
use super::{Bindings, Callback, GAP, Knob, KnobBinding, PadSlot, Rich, ScreenTile, SelectedBy};
use crate::icons::Icon;
use crate::logic::play_styles::{CHORD_RATES, STRUM_GAPS, Setting};
use crate::logic::timing::Timing;
use crate::state::App;
use crate::state::keymap::Tool;
use crate::store::favorites::FavoriteKind;

pub fn mode(a: &'static App, b: &mut Bindings) {
  let shift = a.shift.shift();
  let style = a.performance.play_style();
  let styles = Rc::new(a.performance.play_styles());
  let edited = a.performance.play_style_edited();
  let entries = styles
    .iter()
    .map(|option| Entry {
      id: option.id.clone(),
      name: option.name.clone(),
      category: option.group.into(),
    })
    .collect();
  let picker = Picker::new(
    a,
    FavoriteKind::PlayStyles,
    entries,
    a.browse.style_index.value(),
    Callback::new(move |index| a.browse.style_index.set(index)),
    Some(styles[a.performance.play_style_index()].id.clone()),
    Some(Callback::new(move |entry: usize| {
      a.performance.pick_play_style(entry)
    })),
  );
  let index = picker.index;
  let picked = styles[picker.chosen().entry].clone();
  let select = picker.select();
  let (group, at) = shelf_at(&picker.shelves, index);
  let rate = Timing {
    per_beat: style.per_beat,
    ..a.transport.timing()
  }
  .grid_label();
  let strum = format!("{} ms", style.strum);
  let uses_rate = picked.settings.contains(&Setting::Rate);
  let uses_strum = picked.settings.contains(&Setting::Strum);
  let saved = picked.style.saved.clone();

  let rate_knob = KnobBinding {
    label: "Rate".into(),
    value_label: Some(rate.clone()),
    step: CHORD_RATES
      .iter()
      .position(|&rate| rate == style.per_beat)
      .map_or(-1., |at| at as f64),
    steps: CHORD_RATES.len(),
    on_change: Callback::new(move |index: f64| {
      a.chords
        .set_play_style(|style| style.per_beat = CHORD_RATES[index as usize])
    }),
    fine: false,
  };
  let strum_knob = KnobBinding {
    label: "Strum".into(),
    value_label: Some(strum.clone()),
    step: STRUM_GAPS
      .iter()
      .position(|&gap| gap == style.strum)
      .map_or(-1., |at| at as f64),
    steps: STRUM_GAPS.len(),
    on_change: Callback::new(move |index: f64| {
      a.chords
        .set_play_style(|style| style.strum = STRUM_GAPS[index as usize])
    }),
    fine: false,
  };
  let green = if uses_strum && (shift || !uses_rate) {
    strum_knob
  } else if uses_rate {
    rate_knob
  } else {
    idle_knob(b.knob(Knob::Green))
  };
  let settings: Vec<String> = [
    uses_rate.then(|| format!("Rate {rate}")),
    uses_strum.then(|| format!("{}Strum {strum}", if uses_rate { "⇧ " } else { "" })),
  ]
  .into_iter()
  .flatten()
  .collect();
  b.set_knob(Knob::Green, green);
  let (red, blue) = shelf_knobs(&picker.shelves, index, &picked.name, select.clone());
  b.set_knob(Knob::Red, red);
  b.set_knob(Knob::Blue, blue);

  let on_save: Rc<dyn Fn()> = {
    let picked = picked.clone();
    let saved = saved.is_some();
    Rc::new(move || {
      if !edited {
        a.feedback.show_prompt(if picked.settings.is_empty() {
          format!("{} has nothing to change", picked.name)
        } else {
          "Change its rate or strum first".into()
        });
        return;
      }
      let style = a.performance.play_style();
      if saved {
        a.chords.update_play_style(&style);
        a.feedback.show_notice(format!("Saved {}", picked.name));
      } else {
        let made = a.chords.save_play_style(&style);
        a.feedback.show_notice(format!("Saved {}", made.name));
      }
    })
  };
  b.set_pad(
    PadSlot::Tool(Tool::Save),
    save_pad(
      a,
      &if saved.is_some() {
        format!("Save {}", picked.name)
      } else {
        "Save as a new play style".into()
      },
      None,
      Some(on_save),
    ),
  );
  let trash = saved.map(|saved| {
    let name = picked.name.clone();
    let favorites = picker.favorites.clone();
    DeleteJob::new(
      format!("Delete {name}"),
      format!("delete:{saved}"),
      format!("Press again to delete {name}"),
      move || {
        if favorites.contains(&saved) {
          a.favorites.toggle(FavoriteKind::PlayStyles, &saved);
        }
        a.chords.delete_play_style(&saved);
        a.feedback.show_notice(format!("Deleted {name}"));
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
    ["Previous group".into(), "Next group".into()],
    move |direction| shelf_step(&shelves, at, &step_select, direction),
  );

  let screen = &mut b.screen;
  screen.title = "Play style".into();
  screen.unsaved = edited;
  screen.pager = Some(shelf_pager(&picker.shelves, at, select.clone()));
  // What the green knob sets, in green; nothing for a style that has
  // nothing to set.
  screen.footer = (
    Rich::new().value(picked.name.clone()),
    Rich::new().seek(settings.join(GAP)),
  );
  screen.tiles = picker.listed[group.start..group.start + group.count]
    .iter()
    .map(|listed| {
      let candidate = &styles[listed.entry];
      ScreenTile {
        id: candidate.id.clone(),
        label: candidate.name.clone(),
        icon: Icon::PlayStyle(candidate.style.id.clone()),
        badge: picker.star(listed),
      }
    })
    .collect();
  screen.selected = index - group.start;
  screen.selected_by = SelectedBy::Blue;
  let start = group.start;
  screen.on_select = Some(Callback::new(move |tile: usize| select.call(start + tile)));
}
