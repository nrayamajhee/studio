//! What every control does unless a mode rebinds it, as web-react's
//! `modes/base.tsx`, with the helpers the modes share: the knobs set the
//! volume and the selected param, ↑ and ↓ move the octave (so do ← and →,
//! which with Shift step the preset) and the pads open their views.

use std::collections::HashMap;
use std::rc::Rc;

use super::{
  Bindings, Callback, KnobBinding, PadBinding, PadSlot, PagerColor, Rich, ScreenBinding,
  ScreenPager, noop,
};
use crate::icons::Icon;
use crate::logic::modules::{MODULE_IDS, ModuleId};
use crate::logic::params::value_to_step;
use crate::logic::presets::{DevicePreset, KNOB_STEPS, engine_name, page_of, preset_pages};
use crate::logic::tracks::{TrackSource, track_source};
use crate::state::App;
use crate::state::keymap::Tool;
use crate::state::view::{MainView, ScreenView};
use crate::store::favorites::{FavoriteKind, nishans_picks};

/// A pad with nothing to do in this view: it keeps its icon and says so.
pub fn unused_pad(label: &str, icon: Icon) -> PadBinding {
  PadBinding::new(format!("{label} (not used here)"), icon, |_| {})
}

/// How the sound is made: the model's exciter, then each module layered
/// over it that's on. Saved presets are named after it.
pub fn sound_name(a: &'static App) -> String {
  let modules = a.lanes.modules();
  let target = a.sound.preset.with(|preset| preset.target.clone());
  std::iter::once(engine_name(&target).to_owned())
    .chain(
      MODULE_IDS
        .iter()
        .filter(|&&id| *modules.on.get(id))
        .map(|id| id.module().label.to_owned()),
    )
    .collect::<Vec<_>>()
    .join(" · ")
}

/// The param the knobs edit, in the footer: its name in green, as the knob
/// that picks it, and its value in blue.
pub fn selection(a: &'static App) -> Rich {
  Rich::new()
    .seek(a.sound.selected_name())
    .plain(" ")
    .value(a.sound.selected_display())
}

/// With Shift a pad plays, binds or saves to its alternate.
pub fn pad_name(a: &'static App, pad: usize) -> String {
  format!(
    "{} {}",
    if a.shift.shift() { "Shift pad" } else { "Pad" },
    pad + 1
  )
}

/// The preset a pad plays now, with or without Shift.
pub fn pad_preset(a: &'static App, pad: usize) -> Option<DevicePreset> {
  let shift = a.shift.shift();
  let id = a.library.library.with(|library| {
    let pads = if shift {
      &library.shift_buttons
    } else {
      &library.buttons
    };
    pads.get(pad).cloned().unwrap_or_default()
  });
  a.sound.presets().into_iter().find(|preset| preset.id == id)
}

/// The red knob as the base binds it: it picks the param the blue knob sets, in
/// module order.
pub fn param_knob(a: &'static App) -> KnobBinding {
  let specs = a.sound.specs();
  let count = specs.len();
  KnobBinding {
    label: "Parameter".into(),
    value_label: Some(a.sound.selected_name()),
    step: a.sound.param_index.value().min(count - 1) as f64,
    steps: count.max(2),
    on_change: Callback::new(move |index: f64| {
      a.sound.select_param((index as usize).min(count - 1))
    }),
    fine: false,
  }
}

/// A knob with nothing to set in this view: it stays where it is, so it
/// doesn't jump, and turning it does nothing.
pub fn idle_knob(knob: &KnobBinding) -> KnobBinding {
  KnobBinding {
    label: "Not used here".into(),
    value_label: None,
    step: knob.step,
    steps: knob.steps,
    on_change: noop(),
    fine: false,
  }
}

/// A list's runs of one category, in order: each one's name, where it
/// starts and how many it holds.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Shelf {
  pub name: String,
  pub start: usize,
  pub count: usize,
}

/// The shelves of a list of categories, in the order they come.
pub fn shelves_of<'a>(categories: impl IntoIterator<Item = &'a str>) -> Vec<Shelf> {
  let mut shelves: Vec<Shelf> = Vec::new();
  for (index, name) in categories.into_iter().enumerate() {
    match shelves.last_mut() {
      Some(last) if last.name == name => last.count += 1,
      _ => shelves.push(Shelf {
        name: name.into(),
        start: index,
        count: 1,
      }),
    }
  }
  shelves
}

/// The shelf holding `index`, and its place among the shelves.
pub fn shelf_at(shelves: &[Shelf], index: usize) -> (Shelf, usize) {
  let at = shelves
    .iter()
    .position(|shelf| index >= shelf.start && index < shelf.start + shelf.count)
    .unwrap_or(0);
  (shelves.get(at).cloned().unwrap_or_default(), at)
}

/// Turning a list's category pages: to the next category's first, stopping
/// at either end.
pub fn shelf_step(shelves: &[Shelf], at: usize, select: &Callback<usize>, direction: i32) {
  let to = (at as i64 + i64::from(direction))
    .clamp(0, shelves.len() as i64 - 1)
    .max(0) as usize;
  select.call(shelves.get(to).map_or(0, |shelf| shelf.start));
}

/// The screen's pager for a list by category, in the red of the knob that
/// picks the category.
pub fn shelf_pager(shelves: &[Shelf], at: usize, select: Callback<usize>) -> ScreenPager {
  let starts: Vec<usize> = shelves.iter().map(|shelf| shelf.start).collect();
  ScreenPager {
    pages: shelves.iter().map(|shelf| shelf.name.clone()).collect(),
    at,
    color: PagerColor::Red,
    on_pick: Callback::new(move |page: usize| select.call(starts.get(page).copied().unwrap_or(0))),
  }
}

/// Browsing a list by category: the red knob steps through the categories,
/// landing on each one's first, and the blue one through what is in the
/// current one.
pub fn shelf_knobs(
  shelves: &[Shelf],
  index: usize,
  name: &str,
  select: Callback<usize>,
) -> (KnobBinding, KnobBinding) {
  let (shelf, at) = shelf_at(shelves, index);
  let starts: Vec<usize> = shelves.iter().map(|shelf| shelf.start).collect();
  let count = shelves.len();
  let red = KnobBinding {
    label: "Category".into(),
    value_label: (!shelf.name.is_empty()).then(|| shelf.name.clone()),
    step: at as f64,
    steps: count.max(2),
    on_change: Callback::new({
      let select = select.clone();
      move |step: f64| {
        select.call(
          starts
            .get((step as usize).min(count.saturating_sub(1)))
            .copied()
            .unwrap_or(0),
        )
      }
    }),
    fine: false,
  };
  let blue = KnobBinding {
    label: "Pick".into(),
    value_label: (!name.is_empty()).then(|| name.to_owned()),
    step: (index - shelf.start) as f64,
    steps: shelf.count.max(2),
    on_change: Callback::new(move |step: f64| {
      select.call(shelf.start + (step as usize).min(shelf.count.saturating_sub(1)))
    }),
    fine: false,
  };
  (red, blue)
}

/// The page a picker's favorites lead on.
const FAVORITES: &str = "Favorites";
/// The page of Nishan's Picks, after the favorites.
const PICKS: &str = "Nishan's Picks";

/// An item a picker lists: its id, its name and the category it is filed
/// under.
#[derive(Clone, Debug, PartialEq)]
pub struct Entry {
  pub id: String,
  pub name: String,
  pub category: String,
}

/// An entry as the picker lists it: which, and on what page.
#[derive(Clone, Debug, PartialEq)]
pub struct Listed {
  pub entry: usize,
  pub page: String,
}

/// A picker's items led by its favorites, on a page of their own, and
/// Nishan's Picks on the next, then every one on its category's page.
pub fn list_favorites(entries: &[Entry], favorites: &[String], kind: FavoriteKind) -> Vec<Listed> {
  let page = |ids: &mut dyn Iterator<Item = &str>, name: &str| -> Vec<Listed> {
    ids
      .filter_map(|id| entries.iter().position(|entry| entry.id == id))
      .map(|entry| Listed {
        entry,
        page: name.into(),
      })
      .collect()
  };
  let mut listed = page(&mut favorites.iter().map(String::as_str), FAVORITES);
  listed.extend(page(&mut nishans_picks(kind).iter().copied(), PICKS));
  listed.extend(entries.iter().enumerate().map(|(entry, item)| Listed {
    entry,
    page: item.category.clone(),
  }));
  listed
}

/// A picker led by its favorites: its list, its pages and the item picked,
/// at `index` (or, where the pick is what plays, `picked`, wherever that
/// is). Mute stars the pick or lets it go.
pub struct Picker {
  pub kind: FavoriteKind,
  pub entries: Rc<Vec<Entry>>,
  pub listed: Rc<Vec<Listed>>,
  pub shelves: Vec<Shelf>,
  pub index: usize,
  pub favorites: Vec<String>,
  set_index: Callback<usize>,
  on_pick: Option<Callback<usize>>,
  picked: Option<String>,
}

impl Picker {
  /// A picker over `entries` for the favorites of `kind`, its highlight at
  /// `index` (or on `picked`, where the pick is what plays); `set_index` moves
  /// the highlight and `on_pick` hears the entry picked.
  pub fn new(
    a: &'static App,
    kind: FavoriteKind,
    entries: Vec<Entry>,
    index: usize,
    set_index: Callback<usize>,
    picked: Option<String>,
    on_pick: Option<Callback<usize>>,
  ) -> Self {
    let favorites = a
      .favorites
      .favorites
      .with(|favorites| favorites.get(kind).clone());
    let listed = list_favorites(&entries, &favorites, kind);
    let shelves = shelves_of(listed.iter().map(|listed| listed.page.as_str()));
    let at = index.min(listed.len().saturating_sub(1));
    let index = match &picked {
      Some(picked) if entries[listed[at].entry].id != *picked => listed
        .iter()
        .position(|listed| entries[listed.entry].id == *picked)
        .unwrap_or(0),
      _ => at,
    };
    Self {
      kind,
      entries: Rc::new(entries),
      listed: Rc::new(listed),
      shelves,
      index,
      favorites,
      set_index,
      on_pick,
      picked,
    }
  }

  /// The item the highlight is on, as listed.
  pub fn chosen(&self) -> &Listed {
    &self.listed[self.index]
  }

  /// The entry `listed` lists.
  pub fn entry(&self, listed: &Listed) -> &Entry {
    &self.entries[listed.entry]
  }

  /// The entry the highlight is on.
  pub fn chosen_entry(&self) -> &Entry {
    self.entry(self.chosen())
  }

  /// Whether the highlighted entry is starred.
  pub fn favorite(&self) -> bool {
    self.favorites.contains(&self.chosen_entry().id)
  }

  /// Picks the listed item at an index, passing its entry to the picker's
  /// `on_pick`.
  pub fn select(&self) -> Callback<usize> {
    let (listed, set_index, on_pick) = (
      self.listed.clone(),
      self.set_index.clone(),
      self.on_pick.clone(),
    );
    Callback::new(move |to: usize| {
      set_index.call(to);
      if let (Some(on_pick), Some(listed)) = (&on_pick, listed.get(to)) {
        on_pick.call(listed.entry);
      }
    })
  }

  /// The pick stays on its item, on the page it was on (its category's,
  /// from the favorites'), or, let go from the favorites' page, moves to
  /// the next favorite while any are left (unless it plays).
  pub fn mute(&self, a: &'static App) -> PadBinding {
    let favorite = self.favorite();
    let name = self.chosen_entry().name.clone();
    let (kind, entries, chosen, pick) = (
      self.kind,
      self.entries.clone(),
      self.chosen().clone(),
      self.index,
    );
    let (set_index, on_pick, picked) = (
      self.set_index.clone(),
      self.on_pick.clone(),
      self.picked.clone(),
    );
    PadBinding {
      label: if favorite {
        format!("Remove {name} from favorites")
      } else {
        format!("Add {name} to favorites")
      },
      icon: if favorite {
        Icon::Filled("Star")
      } else {
        Icon::Lucide("Star")
      },
      lit: favorite,
      ..PadBinding::new("", Icon::None, move |_| {
        let id = entries[chosen.entry].id.clone();
        let favorites = a.favorites.toggle(kind, &id);
        let next = list_favorites(&entries, &favorites, kind);
        let left = next
          .iter()
          .filter(|listed| listed.page == FAVORITES)
          .count();
        let stay = if chosen.page == FAVORITES {
          entries[chosen.entry].category.clone()
        } else {
          chosen.page.clone()
        };
        let to = if picked.is_none() && chosen.page == FAVORITES && left > 0 {
          pick.min(left - 1)
        } else {
          next
            .iter()
            .position(|listed| entries[listed.entry].id == id && listed.page == stay)
            .unwrap_or(0)
        };
        set_index.call(to);
        if entries[next[to].entry].id != id
          && let Some(on_pick) = &on_pick
        {
          on_pick.call(next[to].entry);
        }
        a.feedback.show_notice(if favorite {
          "Removed from favorites"
        } else {
          "Added to favorites"
        });
      })
    }
  }

  /// A star on a favorite, on its category's page.
  pub fn star(&self, listed: &Listed) -> Option<String> {
    (listed.page != FAVORITES && self.favorites.contains(&self.entry(listed).id))
      .then(|| "★".into())
  }
}

/// The green knob scrolling whatever the screen lists.
pub fn seek_knob(
  value_label: String,
  step: f64,
  steps: usize,
  on_change: Callback<f64>,
) -> KnobBinding {
  KnobBinding {
    label: "Seek".into(),
    value_label: (!value_label.is_empty()).then_some(value_label),
    step,
    steps,
    on_change,
    fine: false,
  }
}

/// ← and →: what they step through, shown with ⇧ while Shift is held so
/// their Shift job can be found even where they have none.
pub fn arrow_pad(
  a: &'static App,
  direction: i32,
  label: String,
  on_press: impl Fn() + 'static,
) -> PadBinding {
  PadBinding::new(
    label,
    Icon::Lucide(if direction < 0 {
      "ArrowLeft"
    } else {
      "ArrowRight"
    }),
    move |_| on_press(),
  )
  .shift_legend(a.shift.shift())
}

/// Binds ← and → to step by -1 and 1, labelled `previous` and `next`.
pub fn arrow_pads(
  b: &mut Bindings,
  a: &'static App,
  [previous, next]: [String; 2],
  step: impl Fn(i32) + 'static,
) {
  let step = Rc::new(step);
  let back = step.clone();
  b.set_pad(PadSlot::Left, arrow_pad(a, -1, previous, move || back(-1)));
  b.set_pad(PadSlot::Right, arrow_pad(a, 1, next, move || step(1)));
}

/// With Shift, Save keeps the tracks as MIDI from any view but the piano
/// roll and the drum grid, where it always keeps what's on them as a
/// track.
pub fn save_pad(
  a: &'static App,
  label: &str,
  icon: Option<Icon>,
  on_press: Option<Rc<dyn Fn()>>,
) -> PadBinding {
  let shift = a.shift.shift();
  PadBinding::new(
    if shift {
      "Save the tracks as MIDI".into()
    } else {
      label.to_owned()
    },
    if shift {
      Icon::Lucide("FileMusic")
    } else {
      icon.unwrap_or(Icon::Lucide("Save"))
    },
    move |shifted: Option<bool>| {
      if shifted.unwrap_or(shift) {
        a.mix.export_mix(true);
      } else if let Some(on_press) = &on_press {
        on_press();
      }
    },
  )
  .shift_legend(shift)
}

/// A job the Delete pad does on a second press.
#[derive(Clone)]
pub struct DeleteJob {
  pub label: String,
  pub key: String,
  pub prompt: String,
  pub run: Rc<dyn Fn()>,
}

impl DeleteJob {
  /// A job labelled `label` that `key` arms, asking `prompt` before it runs.
  pub fn new(
    label: impl Into<String>,
    key: impl Into<String>,
    prompt: impl Into<String>,
    run: impl Fn() + 'static,
  ) -> Self {
    Self {
      label: label.into(),
      key: key.into(),
      prompt: prompt.into(),
      run: Rc::new(run),
    }
  }
}

/// The dedicated Trash: deletes what the view has picked on a second
/// press. Shift + Delete opens Revert on the main screen, and in a view
/// with a reset of its own does that, also on a second press; in any other
/// view Shift leaves it the view's Delete. `own` comes with whether there
/// is anything to delete.
pub fn delete_pad(
  a: &'static App,
  own: Option<(DeleteJob, bool)>,
  reset: Option<DeleteJob>,
) -> PadBinding {
  let shift = a.shift.shift();
  let on_scope = a.views.view() == ScreenView::Scope;
  let revert = shift && on_scope;
  let resetting = if shift && !on_scope {
    reset.clone()
  } else {
    None
  };
  let pending = |job: Option<&DeleteJob>| job.is_some_and(|job| a.feedback.is_pending(&job.key));
  let label = if revert {
    "Open revert".to_owned()
  } else {
    resetting
      .as_ref()
      .map(|job| job.label.clone())
      .or_else(|| own.as_ref().map(|(job, _)| job.label.clone()))
      .unwrap_or_else(|| "Delete (nothing to delete here)".into())
  };
  let lit = pending(own.as_ref().map(|(job, _)| job)) || pending(reset.as_ref());
  PadBinding::new(
    label,
    Icon::Lucide(if revert || resetting.is_some() {
      "RotateCcw"
    } else {
      "Trash2"
    }),
    move |shifted: Option<bool>| {
      let shifted = shifted.unwrap_or(shift);
      if shifted && on_scope {
        a.shift.release();
        a.views.set_view(ScreenView::Revert);
        return;
      }
      if shifted && let Some(reset) = &reset {
        if a.feedback.confirm(&reset.key, &reset.prompt) {
          (reset.run)();
        }
        return;
      }
      let Some((job, when)) = &own else {
        return;
      };
      if !when {
        return;
      }
      if a.feedback.confirm(&job.key, &job.prompt) {
        (job.run)();
      }
    },
  )
  .lit(lit)
  .shift_legend(revert || resetting.is_some())
}

/// Play's icon: Pause while playing.
fn play_icon(playing: bool) -> Icon {
  Icon::Filled(if playing { "Pause" } else { "Play" })
}

/// Play and Stop for the drum pattern.
pub fn drum_grid_pads(b: &mut Bindings, a: &'static App) {
  let running = a.grid.pattern_running();
  let playing = running && !a.grid.recording_pattern();
  b.set_pad(
    PadSlot::Tool(Tool::Play),
    PadBinding::new(
      if playing {
        "Stop the pattern"
      } else {
        "Play the pattern"
      },
      play_icon(playing),
      move |_| {
        if playing {
          a.grid.stop_pattern();
        } else {
          a.grid.play_pattern(false);
        }
      },
    ),
  );
  b.set_pad(
    PadSlot::Tool(Tool::Stop),
    PadBinding::new(
      if running {
        "Stop the pattern"
      } else {
        "Back to the pattern's start"
      },
      Icon::Filled("Square"),
      move |_| {
        if running {
          a.grid.stop_pattern();
        } else {
          a.grid.move_step_head(0);
        }
      },
    ),
  );
}

/// Play and Stop in a picker, for its preview: Play plays the picked one
/// (`play`) or pauses it, and Stop lets it go.
pub fn preview_pads(b: &mut Bindings, a: &'static App, name: &str, play: impl Fn() + 'static) {
  let playing = a.preview.playing.value();
  b.set_pad(
    PadSlot::Tool(Tool::Play),
    PadBinding::new(
      if playing {
        "Pause the preview".to_owned()
      } else {
        format!("Play {name}")
      },
      play_icon(playing),
      move |_| {
        if playing {
          a.preview.pause();
        } else {
          play();
        }
      },
    ),
  );
  b.set_pad(
    PadSlot::Tool(Tool::Stop),
    PadBinding::new("Stop the preview", Icon::Filled("Square"), move |_| {
      a.preview.stop()
    }),
  );
}

/// Play and Stop for the tracks: the mix, from the top.
pub fn mix_pads(b: &mut Bindings, a: &'static App) {
  let playing = a.mix.playing.value();
  b.set_pad(
    PadSlot::Tool(Tool::Play),
    PadBinding::new(
      if playing {
        "Pause the tracks"
      } else {
        "Play the tracks"
      },
      play_icon(playing),
      move |_| a.mix.toggle_play(),
    ),
  );
  b.set_pad(
    PadSlot::Tool(Tool::Stop),
    PadBinding::new(
      "Stop and rewind the tracks",
      Icon::Filled("Square"),
      move |_| a.mix.rewind(),
    ),
  );
}

/// Opens or closes the tracks or the tapes. While recording it ends the
/// take, like Record.
fn open_tracks(a: &'static App, tapes: bool) {
  a.transport.set_roll_position(None);
  if fluid::untrack(|| a.transport.recording()) {
    a.transport.stop();
    return;
  }
  if tapes {
    a.shift.release();
  }
  a.views.toggle_view(if tapes {
    ScreenView::Tapes
  } else {
    ScreenView::Tracks
  });
}

/// Opens or closes the take (record mode), which Record also opens,
/// loading the picked track onto it; with `drum_grid` the drum grid. While
/// recording it ends the take.
fn open_take(a: &'static App, drum_grid: bool) {
  a.transport.set_roll_position(None);
  if fluid::untrack(|| a.transport.recording()) {
    a.transport.stop();
    return;
  }
  a.shift.release();
  // A track opens only where it was made: a played take in the piano roll,
  // a drawn pattern in the drum grid.
  let (view, focused, take_focused) = fluid::untrack(|| {
    (
      a.views.view(),
      a.lanes.focused_lane(),
      a.lanes.take_focused(),
    )
  });
  let (here, source) = if drum_grid {
    (ScreenView::DrumGrid, TrackSource::DrumGrid)
  } else {
    (ScreenView::Roll, TrackSource::Roll)
  };
  if view != here && !take_focused && track_source(&focused) != source {
    a.feedback.show_prompt(if drum_grid {
      "Open this track in the piano roll"
    } else {
      "Open this track in the drum grid"
    });
    return;
  }
  if drum_grid {
    a.grid.toggle_drum_grid();
    return;
  }
  if view == ScreenView::Roll {
    a.views.set_view(ScreenView::Scope);
    return;
  }
  fluid::batch(|| {
    if !take_focused {
      a.lanes.load_take(&focused);
    }
    a.views.set_view(ScreenView::Roll);
  });
}

/// The preset library, on the sound playing (on the favorites' page if it
/// is one), or with `params` the synth parameters; either closes on another
/// press.
fn open_synth(a: &'static App, params: bool) {
  let view = fluid::untrack(|| a.views.view());
  if view
    == (if params {
      ScreenView::Synth
    } else {
      ScreenView::Instruments
    })
  {
    a.views.set_view(ScreenView::Scope);
    return;
  }
  if params {
    a.views.set_view(ScreenView::Synth);
    return;
  }
  let index = fluid::untrack(|| {
    let paging = a.browse.preset_paging.value();
    let items = preset_pages(&a.sound.presets(), paging);
    let entries: Vec<Entry> = items
      .iter()
      .map(|preset| Entry {
        id: preset.id.clone(),
        name: preset.name.clone(),
        category: page_of(preset, paging).into(),
      })
      .collect();
    let favorites = a
      .favorites
      .favorites
      .with(|favorites| favorites.instruments.clone());
    let listed = list_favorites(&entries, &favorites, FavoriteKind::Instruments);
    let id = a.sound.preset_id();
    listed
      .iter()
      .position(|listed| entries[listed.entry].id == id)
      .unwrap_or(0)
  });
  fluid::batch(|| {
    a.browse.preset_index.set(index);
    a.views.set_view(ScreenView::Instruments);
  });
}

/// A module pad opens its view; with Shift it switches the module on or off
/// without leaving the current view.
fn module_pad(a: &'static App, id: ModuleId, icon: Icon) -> PadBinding {
  let label = id.module().label;
  let on = *a.lanes.modules().on.get(id);
  let shift = a.shift.shift();
  let open = a.views.view() == ScreenView::of_module(id);
  PadBinding::new(
    if shift {
      format!("Turn {label} {}", if on { "off" } else { "on" })
    } else {
      format!(
        "{} the {label} ({})",
        if open { "Close" } else { "Open" },
        if on { "on" } else { "off" }
      )
    },
    icon,
    move |_| {
      if shift {
        a.lanes.toggle_module(id);
      } else {
        a.views.toggle_module(id);
      }
    },
  )
  .lit(open)
  .indicator(on)
  .shift_legend(shift)
}

/// Like a module pad: it opens the tempo view, and with Shift starts or
/// stops the click without leaving the current view.
fn metronome_pad(a: &'static App) -> PadBinding {
  let shift = a.shift.shift();
  let on = a.transport.metronome.value();
  let open = a.views.view() == ScreenView::Tempo;
  PadBinding::new(
    if shift {
      format!("Turn metronome {}", if on { "off" } else { "on" })
    } else {
      format!(
        "{} the tempo (metronome {})",
        if open { "Close" } else { "Open" },
        if on { "on" } else { "off" }
      )
    },
    Icon::Lucide("Metronome"),
    move |_| {
      if shift {
        a.engine.unlock();
        a.transport.toggle_metronome();
        return;
      }
      a.transport.stop_tapping();
      a.views.toggle_view(ScreenView::Tempo);
    },
  )
  .lit(open)
  .indicator(on)
  .shift_legend(shift)
}

/// A pad that opens `opens`, lit and labelled to close it while it shows.
fn view_pad(
  a: &'static App,
  opens: ScreenView,
  [open, close]: [&str; 2],
  icon: Icon,
  on_press: impl Fn() + 'static,
) -> PadBinding {
  let lit = a.views.view() == opens;
  PadBinding::new(if lit { close } else { open }, icon, move |_| on_press()).lit(lit)
}

/// The tracks, tapes, piano roll and drum grid pads end a recording before
/// they open anything.
fn ends_recording(a: &'static App, pad: PadBinding) -> PadBinding {
  if a.transport.recording() {
    PadBinding {
      label: "Stop recording".into(),
      ..pad
    }
  } else {
    pad
  }
}

/// What every control does unless a mode rebinds it.
pub fn bindings(a: &'static App) -> Bindings {
  let shift = a.shift.shift();
  let recording = a.transport.recording();
  let playing = a.transport.playing();
  let armed = a.take.record_armed();
  let view = a.views.view();
  let mut pads = HashMap::new();
  let mut pad = |slot: PadSlot, binding: PadBinding| {
    pads.insert(slot, binding);
  };

  pad(
    PadSlot::Tool(Tool::Play),
    PadBinding::new(
      if recording {
        "Stop recording"
      } else if armed {
        "Start recording"
      } else if playing {
        "Pause the take"
      } else {
        "Play the take"
      },
      play_icon(playing),
      move |_| a.take.toggle_play(),
    ),
  );
  pad(
    PadSlot::Tool(Tool::Record),
    PadBinding::new(
      if recording {
        "Stop recording"
      } else if armed {
        "Disarm recording"
      } else {
        "Arm recording"
      },
      Icon::Filled("Circle"),
      move |_| a.take.toggle_record(),
    )
    .lit(recording || armed),
  );
  pad(
    PadSlot::Tool(Tool::Stop),
    PadBinding::new(
      if recording {
        "Stop recording"
      } else if armed {
        "Disarm recording"
      } else if playing {
        "Pause the take"
      } else if view == ScreenView::Roll {
        "Back to the take's start"
      } else {
        "Stop (nothing is playing)"
      },
      Icon::Filled("Square"),
      move |_| a.take.stop(),
    ),
  );
  // Save keeps what the view holds; here, without Shift, nothing.
  pad(
    PadSlot::Tool(Tool::Save),
    save_pad(a, "Save (not used here)", None, None),
  );
  pad(
    PadSlot::Tool(Tool::Tapes),
    ends_recording(
      a,
      view_pad(
        a,
        ScreenView::Tapes,
        ["Open the tapes", "Close the tapes"],
        Icon::Device("TapeDeck"),
        move || open_tracks(a, true),
      ),
    ),
  );
  pad(
    PadSlot::Tool(Tool::Tracks),
    ends_recording(
      a,
      view_pad(
        a,
        ScreenView::Tracks,
        ["Open the tracks", "Close the tracks"],
        Icon::Device("Tracks"),
        move || open_tracks(a, false),
      ),
    ),
  );
  // With Shift, the chord progressions.
  pad(
    PadSlot::Tool(Tool::Roll),
    if shift {
      let open = view == ScreenView::Progressions;
      PadBinding::new(
        if open {
          "Close the chord progressions"
        } else {
          "Open the chord progressions"
        },
        Icon::Lucide("ListMusic"),
        move |_| {
          a.shift.release();
          a.views.toggle_view(ScreenView::Progressions);
        },
      )
      .lit(open)
      .shift_legend(true)
    } else {
      ends_recording(
        a,
        view_pad(
          a,
          ScreenView::Roll,
          ["Open the piano roll", "Close the piano roll"],
          Icon::Device("PianoRoll"),
          move || open_take(a, false),
        ),
      )
    },
  );
  // With Shift, the drum beats.
  pad(
    PadSlot::Tool(Tool::DrumGrid),
    if shift {
      let open = view == ScreenView::Beats;
      PadBinding::new(
        if open {
          "Close the drum beats"
        } else {
          "Open the drum beats"
        },
        Icon::Lucide("Activity"),
        move |_| {
          a.shift.release();
          a.views.toggle_view(ScreenView::Beats);
        },
      )
      .lit(open)
      .shift_legend(true)
    } else {
      ends_recording(
        a,
        view_pad(
          a,
          ScreenView::DrumGrid,
          ["Open the drum grid", "Close the drum grid"],
          Icon::Device("DrumGrid"),
          move || open_take(a, true),
        ),
      )
    },
  );
  pad(
    PadSlot::Tool(Tool::Module(ModuleId::Adsr)),
    module_pad(a, ModuleId::Adsr, Icon::Device("Adsr")),
  );
  pad(
    PadSlot::Tool(Tool::Module(ModuleId::Lfo)),
    module_pad(a, ModuleId::Lfo, Icon::Lucide("WavesHorizontal")),
  );
  pad(
    PadSlot::Tool(Tool::Module(ModuleId::Fx)),
    module_pad(a, ModuleId::Fx, Icon::Lucide("AudioLines")),
  );
  pad(PadSlot::Tool(Tool::Metronome), metronome_pad(a));
  pad(
    PadSlot::Tool(Tool::Mute),
    unused_pad("Mute a track", Icon::Lucide("VolumeX")),
  );
  pad(
    PadSlot::Tool(Tool::Clip),
    unused_pad("Clip a track", Icon::Lucide("Scissors")),
  );
  pad(
    PadSlot::Up,
    PadBinding::new("Octave up", Icon::Lucide("ArrowUp"), move |_| {
      a.sound.shift_octave(1)
    }),
  );
  pad(
    PadSlot::Down,
    PadBinding::new("Octave down", Icon::Lucide("ArrowDown"), move |_| {
      a.sound.shift_octave(-1)
    }),
  );
  pad(PadSlot::Tool(Tool::Delete), delete_pad(a, None, None));
  pad(
    PadSlot::Tool(Tool::Instruments),
    view_pad(
      a,
      ScreenView::Instruments,
      ["Open the instruments", "Close the instruments"],
      Icon::Lucide("LayoutGrid"),
      move || open_synth(a, false),
    ),
  );
  pad(
    PadSlot::Tool(Tool::Synth),
    view_pad(
      a,
      ScreenView::Synth,
      ["Open the synth parameters", "Close the synth parameters"],
      Icon::Lucide("AudioWaveform"),
      move || open_synth(a, true),
    ),
  );
  pad(
    PadSlot::Tool(Tool::Chords),
    view_pad(
      a,
      ScreenView::Chords,
      ["Open the chords", "Close the chords"],
      Icon::Lucide("Music4"),
      move || a.views.toggle_view(ScreenView::Chords),
    ),
  );
  pad(
    PadSlot::Tool(Tool::PlayStyle),
    view_pad(
      a,
      ScreenView::PlayStyle,
      ["Open the play style", "Close the play style"],
      Icon::PlayStyle(a.chords.play_style.with(|style| style.id.clone())),
      move || a.views.toggle_view(ScreenView::PlayStyle),
    ),
  );

  let volume = a.output.volume_step.value();
  let selected = a.sound.selected();
  let value_steps = a.sound.value_steps();
  let knobs = [
    KnobBinding {
      label: "Volume".into(),
      value_label: Some(format!("{}%", volume * 10)),
      step: volume as f64,
      steps: KNOB_STEPS,
      on_change: Callback::new(move |step: f64| a.output.set_volume(step as usize)),
      fine: false,
    },
    seek_knob(
      String::new(),
      a.browse.idle_seek.value() as f64,
      KNOB_STEPS,
      Callback::new(move |step: f64| a.browse.idle_seek.set(step as usize)),
    ),
    param_knob(a),
    KnobBinding {
      label: "Value".into(),
      value_label: Some(format!(
        "{} {}",
        a.sound.selected_name(),
        a.sound.selected_display()
      )),
      step: value_to_step(selected, a.sound.selected_value(), value_steps) as f64,
      steps: value_steps,
      on_change: Callback::new(move |step: f64| a.sound.set_selected_value(step as usize)),
      fine: false,
    },
  ];

  let library = a.library.library.cloned();
  let preset_id = a.sound.preset_id();
  let instrument_pads = (0..6)
    .map(|index| {
      let bound = pad_preset(a, index);
      let current = bound.as_ref().is_some_and(|bound| bound.id == preset_id);
      let label = match &bound {
        Some(bound) if current => format!("{} (playing)", bound.name),
        Some(bound) => format!("Switch to {}", bound.name),
        None => format!(
          "Empty instrument pad {} (bind one in the instruments)",
          index + 1
        ),
      };
      // Lit while either of its two presets plays.
      let indicator = bound
        .as_ref()
        .map(|_| library.buttons[index] == preset_id || library.shift_buttons[index] == preset_id);
      let icon = bound
        .as_ref()
        .map_or(Icon::None, |bound| Icon::Preset(bound.icon.clone()));
      PadBinding {
        label,
        icon,
        indicator,
        shift_legend: shift,
        ..PadBinding::new("", Icon::None, move |_| {
          let Some(bound) = &bound else {
            return;
          };
          a.sound.select_preset(bound);
          if !shift {
            return;
          }
          // The alternate comes up to the pad's first layer, and a latched
          // Shift lets go once it's picked.
          a.library.swap_pad(index);
          a.shift.release();
        })
      }
    })
    .collect();

  let chords = a.performance.pad_chords();
  let latched = a.performance.chord.value();
  let active = a.performance.active_chord();
  let chord_pads = chords
    .iter()
    .enumerate()
    .map(|(index, chord)| PadBinding {
      label: if latched == Some(index) {
        format!("Let go of {} chords", chord.name)
      } else {
        format!("Play {} chords on the keys", chord.name)
      },
      icon: Icon::Text(chord.label.into()),
      pressed: Some(active == Some(index)),
      ..PadBinding::new("", Icon::None, move |_| a.performance.toggle_chord(index))
    })
    .collect();

  let mut bindings = Bindings {
    knobs,
    pads,
    instrument_pads,
    chord_pads,
    screen: ScreenBinding {
      title: a.sound.preset.with(|preset| preset.name.clone()),
      unsaved: a.sound.edits().is_some(),
      footer: (Rich::new(), Rich::new()),
      ..ScreenBinding::default()
    },
    key_press: None,
    preview_sound: None,
  };
  // Every other view shows over the main one, so Play and Stop act on what
  // it plays: the tracks, the pattern, or the take.
  match a.views.main_view() {
    MainView::Tracks => mix_pads(&mut bindings, a),
    MainView::DrumGrid => drum_grid_pads(&mut bindings, a),
    MainView::Roll => {}
  }
  arrow_pads(
    &mut bindings,
    a,
    if shift {
      ["Previous instrument".into(), "Next instrument".into()]
    } else {
      ["Octave down".into(), "Octave up".into()]
    },
    move |direction| {
      if shift {
        a.sound.step_preset(direction);
      } else {
        a.sound.shift_octave(direction);
      }
    },
  );
  bindings
}
