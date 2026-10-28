//! The pickers' tiles, as web-react's `DeviceScreen` draws them: two rows
//! of 6 filling the view, near square, or for the icons four rows of 12, 48
//! a page. The page shown is the one holding the pick, which fills with the
//! colour of the knob that picks it. A tile clicked picks it; double-clicked,
//! does what Save would with it.

use fluid_macro::html;
use web_sys::Element;

use crate::modes::{self, SelectedBy};
use crate::state::view::ScreenView;
use crate::ui::{blur_active, markup};

/// The tiles a page holds in a view.
pub fn per_page(view: ScreenView) -> usize {
  if view == ScreenView::Save { 48 } else { 12 }
}

/// What a tile shows, and where on the page it sits: a tile is rebuilt
/// only when one of them changes, so a click that only moves the pick
/// leaves it in place for the second click of a double-click.
#[derive(Clone, PartialEq, Eq, Hash)]
struct Tile {
  index: usize,
  id: String,
  label: String,
  icon: String,
  badge: Option<String>,
}

#[derive(Clone, PartialEq)]
struct Grid {
  paged: bool,
  selected_by: SelectedBy,
}

const TILE: &str = "group relative flex min-w-0 cursor-pointer flex-col items-center justify-center gap-[4px] rounded-[8px] border border-screen-ink/12 text-center text-[11px] font-medium text-screen-ink/75 select-none aria-pressed:text-white focus-visible:border-synth-blue focus-visible:shadow-[inset_0_0_0_1px_var(--color-synth-blue)] focus-visible:outline-none";
const BY_GREEN: &str = "aria-pressed:border-synth-green aria-pressed:bg-synth-green aria-pressed:focus-visible:border-synth-blue";
const BY_BLUE: &str = "aria-pressed:border-synth-blue aria-pressed:bg-synth-blue aria-pressed:focus-visible:border-screen-ink aria-pressed:focus-visible:shadow-[inset_0_0_0_1px_var(--color-screen-ink)]";
// The icon and the name each keep two lines' room, their content centred in
// it, so icons line up along a row whatever the names' lengths. A text icon
// (a chord's symbol, a progression's numerals) wraps evenly, cut short with
// an ellipsis past two lines.
const ICON: &str = "flex h-[26px] max-w-full items-center justify-center overflow-hidden font-screen text-[11px] leading-[13px] font-bold text-balance [&>span]:line-clamp-2";

fn group_label(view: ScreenView) -> &'static str {
  match view {
    ScreenView::Save => "Instrument icon",
    ScreenView::Chords => "Chords",
    ScreenView::PlayStyle => "Play style",
    ScreenView::Progressions => "Progressions",
    ScreenView::Beats => "Beats",
    ScreenView::Tapes => "Tapes",
    ScreenView::Revert => "Revert",
    _ => "Instruments",
  }
}

fn tile(tile: Tile, icons: bool, selected_by: SelectedBy) -> Element {
  let Tile {
    index,
    label,
    icon,
    badge,
    ..
  } = tile;
  let class = format!(
    "{TILE} {} {}",
    if icons {
      "aspect-square h-full w-auto p-0"
    } else {
      "px-[6px]"
    },
    match selected_by {
      SelectedBy::Green => BY_GREEN,
      SelectedBy::Blue => BY_BLUE,
    }
  );
  let icon_class = format!(
    "{ICON} {}",
    if icons {
      "[&_svg]:size-[22px]"
    } else {
      "[&_svg]:size-[24px]"
    }
  );
  let selected = fluid::create_memo(|| modes::with(|bindings| bindings.screen.selected));
  let name = (!icons).then(|| {
    html! {
      span class="flex h-[26px] w-full items-center justify-center" aria-hidden="true" {
        span class="line-clamp-2 overflow-hidden font-screen text-[11px] leading-[13px] text-balance wrap-break-word first-letter:uppercase" {
          { label.clone() }
        }
      }
    }
  });
  let badge = badge.map(|badge| {
    html! {
      span class="absolute top-[3px] right-[4px] font-screen text-[11px] leading-[13px] font-bold text-synth-red group-aria-pressed:text-white" aria-hidden="true" {
        { badge }
      }
    }
  });
  html! {
    button
    type="button"
    aria-label={ label.as_str() }
    aria-pressed={ move || if *selected.get() == index { "true" } else { "false" } }
    class={ class }
    @mousedown.prevent={ |_| blur_active() }
    @click={ move |_| {
      if let Some(on_select) = &modes::current().screen.on_select {
        on_select.call(index);
      }
    } }
    @dblclick={ move |_| {
      if let Some(on_activate) = &modes::current().screen.on_activate {
        on_activate.call(index);
      }
    } }
    {
      span class={ icon_class } aria-hidden="true" { { markup(&icon) } }
      { name }
      { badge }
    }
  }
}

/// The page of tiles holding the pick.
pub fn tiles(view: ScreenView) -> Element {
  let icons = view == ScreenView::Save;
  let per_page = per_page(view);
  let grid = fluid::create_memo(move || {
    modes::with(|bindings| Grid {
      paged: bindings.screen.pager.is_some(),
      selected_by: bindings.screen.selected_by,
    })
  });
  let page = fluid::create_memo(move || {
    modes::with(|bindings| {
      let screen = &bindings.screen;
      let start = screen.selected / per_page * per_page;
      screen
        .tiles
        .iter()
        .enumerate()
        .skip(start)
        .take(per_page)
        .map(|(index, tile)| Tile {
          index,
          id: tile.id.clone(),
          label: tile.label.clone(),
          icon: tile.icon.markup(),
          badge: tile.badge.clone(),
        })
        .collect::<Vec<_>>()
    })
  });
  let body = fluid::show(
    move || grid.cloned(),
    move |Grid { paged, selected_by }| {
      let class = format!(
        "absolute right-[20px] bottom-[30px] left-[20px] m-0 {} {}",
        if paged { "top-[42px]" } else { "top-[30px]" },
        if icons {
          "grid grid-cols-12 grid-rows-4 justify-items-center gap-[6px] overflow-hidden"
        } else {
          "grid grid-cols-6 grid-rows-2 gap-[6px] overflow-hidden"
        }
      );
      let page = page.clone();
      let rows = fluid::each(
        move || page.cloned(),
        Tile::clone,
        move |entry| tile(entry, icons, selected_by),
      );
      html! {
        div class={ class } role="group" aria-label={ group_label(view) } { { rows } }
      }
    },
  );
  html! { div class="contents" { { body } } }
}
