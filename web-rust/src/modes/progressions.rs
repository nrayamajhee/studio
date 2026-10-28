//! Chord progressions (Shift + Piano roll), as web-react's
//! `modes/progressions.tsx`: by kind, after the favorites. The red knob (or
//! ← →) picks a page and the blue one a progression. A tile tapped, or
//! Play, plays it on the preview tape in its own key; Play again pauses it.
//! A key played plays it from that note instead, from the top each time.
//! Save waits for the home note: the next key played sets it, and the
//! progression goes onto the tape, a chord a bar at the tempo. Save again
//! lets it go; a tile double-clicked waits for its home note as Save would.
//! Mute stars it.

use std::rc::Rc;

use super::base::{
  Entry, Picker, arrow_pads, idle_knob, preview_pads, save_pad, shelf_at, shelf_knobs, shelf_pager,
  shelf_step,
};
use super::{Bindings, Callback, GAP, Knob, PadSlot, Rich, ScreenTile, SelectedBy};
use crate::icons::Icon;
use crate::logic::progressions::{
  Progression, preview_home, preview_tempo, progression_take, progressions,
};
use crate::logic::swing::{swing_on, swung_take};
use crate::logic::timing::{Take, Timing};
use crate::state::App;
use crate::state::keymap::Tool;
use crate::store::favorites::FavoriteKind;

/// The progression as it would go onto the tape, in the play style and at
/// the tempo, on the keys' instrument. Previews run a little faster than
/// the tape (see `preview_tempo`), swung as the take plays; Save loads the
/// take at the tape's own tempo.
fn preview_of(a: &'static App, progression: &Progression, note: i32) -> Take {
  let timing = a.transport.timing_now();
  let preview = Timing {
    bpm: preview_tempo(timing.bpm),
    ..timing
  };
  let style = fluid::untrack(|| a.performance.play_style());
  swung_take(
    progression_take(progression, note, &preview, &style),
    swing_on(Some(fluid::untrack(|| a.transport.swing.value())), 0),
  )
}

fn audition(a: &'static App, progression: &Progression) {
  a.preview.play(
    &progression.id,
    &preview_of(a, progression, preview_home(progression)),
    None,
    false,
  );
}

pub fn mode(a: &'static App, b: &mut Bindings) {
  let waiting = a.performance.home_for.with(Option::is_some);
  let all = progressions();
  let entries = all
    .iter()
    .map(|progression| Entry {
      id: progression.id.clone(),
      name: progression.name.clone(),
      category: progression.group.clone(),
    })
    .collect();
  // Picking another progression while one waits makes it the one that goes
  // onto the tape.
  let picker = Picker::new(
    a,
    FavoriteKind::Progressions,
    entries,
    a.browse.progression_index.value(),
    Callback::new(move |index| a.browse.progression_index.set(index)),
    None,
    Some(Callback::new(move |entry: usize| {
      if waiting {
        a.performance.await_home(Some(all[entry].clone()));
      }
    })),
  );
  let index = picker.index;
  let chosen = &all[picker.chosen().entry];
  let select = picker.select();
  let (shelf, at) = shelf_at(&picker.shelves, index);
  let taped = a.lanes.take().is_some_and(|take| !take.notes.is_empty());
  let listed = picker.listed.clone();
  let progression_at = move |index: usize| &all[listed[index].entry];

  // A tile tapped plays, or pauses, as Play does.
  let tap = {
    let select = select.clone();
    let progression_at = progression_at.clone();
    move |index: usize| {
      select.call(index);
      let progression = progression_at(index);
      if a.preview.playing.value() && a.preview.cued().as_ref() == Some(&progression.id) {
        a.preview.pause();
      } else {
        audition(a, progression);
      }
    }
  };
  let arm = Rc::new({
    let progression_at = progression_at.clone();
    move |index: usize| {
      a.preview.stop();
      a.browse.progression_index.set(index);
      a.performance
        .await_home(Some(progression_at(index).clone()));
      a.feedback.show_prompt("Play the home note");
    }
  });

  b.set_knob(Knob::Green, idle_knob(b.knob(Knob::Green)));
  let (red, blue) = shelf_knobs(&picker.shelves, index, &chosen.name, select.clone());
  b.set_knob(Knob::Red, red);
  b.set_knob(Knob::Blue, blue);
  let on_save: Rc<dyn Fn()> = {
    let arm = arm.clone();
    Rc::new(move || {
      if waiting {
        a.performance.await_home(None);
      } else {
        arm(index);
      }
    })
  };
  b.set_pad(
    PadSlot::Tool(Tool::Save),
    save_pad(
      a,
      &if waiting {
        "Cancel".into()
      } else {
        format!("Load {} as the take", chosen.name)
      },
      None,
      Some(on_save),
    )
    .lit(waiting),
  );
  b.set_pad(PadSlot::Tool(Tool::Mute), picker.mute(a));
  preview_pads(b, a, &chosen.name, move || audition(a, chosen));
  let shelves = picker.shelves.clone();
  let step_select = select.clone();
  arrow_pads(
    b,
    a,
    ["Previous kind".into(), "Next kind".into()],
    move |direction| shelf_step(&shelves, at, &step_select, direction),
  );

  let screen = &mut b.screen;
  screen.title = "Progressions".into();
  screen.unsaved = false;
  screen.pager = Some(shelf_pager(&picker.shelves, at, select));
  screen.footer = (
    Rich::new().value(chosen.name.clone()),
    Rich::new().hint(if waiting {
      if taped {
        "Play the home note (replaces the take)".into()
      } else {
        "Play the home note".into()
      }
    } else {
      format!("A note plays it from there{GAP}Save to load")
    }),
  );
  screen.tiles = picker.listed[shelf.start..shelf.start + shelf.count]
    .iter()
    .map(|listed| {
      let progression = &all[listed.entry];
      ScreenTile {
        id: progression.id.clone(),
        label: progression.name.clone(),
        icon: Icon::Label(progression.numerals.clone()),
        badge: picker.star(listed),
      }
    })
    .collect();
  screen.selected = index - shelf.start;
  screen.selected_by = SelectedBy::Blue;
  let start = shelf.start;
  screen.on_select = Some(Callback::new(move |tile: usize| tap(start + tile)));
  screen.on_activate = Some(Callback::new(move |tile: usize| arm(start + tile)));
  // While Save waits, the key sets the home note as it always did. The
  // progression from the note as its home, from the top, as a preview of
  // its own (Play and the tiles keep to its key).
  b.key_press = Some(Callback::new(move |note: i32| {
    if waiting {
      return false;
    }
    a.preview.play(
      &format!("{}:from-key", chosen.id),
      &preview_of(a, chosen, note),
      None,
      true,
    );
    true
  }));
}
