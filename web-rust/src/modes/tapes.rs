//! The tapes, a tape a tile, as web-react's `modes/tapes.tsx`: the green
//! knob and the arrows open a tape (the red and blue knobs set nothing
//! here), Play plays its tracks, Save starts an empty tape at the tempo
//! playing now and Delete removes the open one. A tile double-clicked opens
//! its tape and closes the tapes onto its tracks.

use std::rc::Rc;

use super::base::{DeleteJob, arrow_pads, delete_pad, idle_knob, mix_pads, save_pad, seek_knob};
use super::{Bindings, Callback, GAP, Knob, PadSlot, Rich, ScreenTile};
use crate::icons::Icon;
use crate::logic::js;
use crate::logic::math::plural;
use crate::state::App;
use crate::state::keymap::Tool;
use crate::state::view::ScreenView;

/// Leaving a tape stops its mix and puts the tracks view back at its start.
fn leave_tape(a: &'static App) {
  a.mix.rewind();
  a.lanes.set_focus_index(0);
  a.tracks.reset_timeline();
}

/// Opens the tape at `index`, with its tempo and time signature.
fn pick_tape(a: &'static App, index: i64) {
  let (tapes, open) = fluid::untrack(|| {
    a.session
      .session
      .with(|session| (session.tapes.clone(), session.tape.clone()))
  });
  let Some(next) = tapes.get(index.clamp(0, tapes.len() as i64 - 1).max(0) as usize) else {
    return;
  };
  if next.id == open {
    return;
  }
  leave_tape(a);
  a.session.open_tape(&next.id);
  a.transport.apply_tape_timing(next);
}

/// Binds the tapes: the green knob and the arrows open a tape, Play plays its
/// tracks, Save starts an empty tape and Delete removes the open one.
pub fn mode(a: &'static App, b: &mut Bindings) {
  let tapes = a.lanes.tapes();
  let tape_index = a.lanes.tape_index();
  let current = a.lanes.current_tape();

  b.set_knob(
    Knob::Green,
    seek_knob(
      current
        .as_ref()
        .map_or(String::new(), |tape| tape.name.clone()),
      tape_index as f64,
      tapes.len().max(2),
      Callback::new(move |index: f64| pick_tape(a, index as i64)),
    ),
  );
  b.set_knob(Knob::Red, idle_knob(b.knob(Knob::Red)));
  b.set_knob(Knob::Blue, idle_knob(b.knob(Knob::Blue)));
  mix_pads(b, a);
  b.set_pad(
    PadSlot::Tool(Tool::Save),
    save_pad(
      a,
      "New tape",
      Some(Icon::Lucide("Plus")),
      Some(Rc::new(move || {
        leave_tape(a);
        let (bpm, timing, swing) = fluid::untrack(|| {
          (
            a.transport.bpm.value(),
            a.transport.timing(),
            a.transport.swing.value(),
          )
        });
        let started = a.session.new_tape(bpm, timing.meter, swing);
        a.feedback.show_notice(format!("Started {}", started.name));
      })),
    ),
  );
  let trash = current.as_ref().map(|tape| {
    let (id, name) = (tape.id.clone(), tape.name.clone());
    DeleteJob::new(
      format!("Delete {name}"),
      format!("delete:{id}"),
      format!("Press again to delete {name}"),
      move || {
        leave_tape(a);
        if let Some(opened) = a.session.delete_tape(&id) {
          a.transport.apply_tape_timing(&opened);
        }
        a.feedback.show_notice(format!("Deleted {name}"));
      },
    )
  });
  b.set_pad(
    PadSlot::Tool(Tool::Delete),
    delete_pad(a, trash.map(|job| (job, true)), None),
  );
  arrow_pads(
    b,
    a,
    ["Previous tape".into(), "Next tape".into()],
    move |direction| pick_tape(a, tape_index as i64 + i64::from(direction)),
  );

  let screen = &mut b.screen;
  screen.title = "Tapes".into();
  screen.unsaved = false;
  screen.status = Rich::new().seek(format!("{}/{}", tape_index + 1, tapes.len()));
  screen.footer = (
    Rich::text(current.as_ref().map_or(String::new(), |tape| {
      format!(
        "{}{GAP}{} BPM{GAP}{}",
        plural(tape.tracks.len(), "track"),
        js::number(tape.bpm),
        tape.meter.label()
      )
    })),
    Rich::new()
      .pad("Save", Icon::Lucide("Plus"))
      .hint(" new tape"),
  );
  screen.tiles = tapes
    .iter()
    .map(|tape| ScreenTile {
      id: tape.id.clone(),
      label: tape.name.clone(),
      icon: Icon::Device("TapeDeck"),
      badge: None,
    })
    .collect();
  screen.selected = tape_index;
  screen.on_select = Some(Callback::new(move |index: usize| {
    pick_tape(a, index as i64)
  }));
  screen.on_activate = Some(Callback::new(move |index: usize| {
    pick_tape(a, index as i64);
    a.views.set_view(ScreenView::Tracks);
  }));
}
