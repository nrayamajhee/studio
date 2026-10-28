//! The frosted round buttons pinned to the page's top-right corner: MIDI and
//! the light/dark switch.

use fluid_macro::html;
use web_sys::Element;

use super::{blur_active, markup};
use crate::chrome::Theme;
use crate::icons::{KEYBOARD_MUSIC, MOON, SUN};

const CORNER_BUTTON: &str = "relative inline-flex aspect-square w-auto cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-white/45 bg-white/50 p-2 text-center text-xs font-medium text-font shadow-low backdrop-blur-xl transition-all duration-400 ease-in-out select-none hover:bg-white/65 focus-visible:ring-2 focus-visible:ring-font-light focus-visible:ring-offset-2 focus-visible:outline-none active:translate-y-0.5 active:bg-stone-200 dark:border-white/15 dark:bg-white/50 dark:text-surface dark:hover:bg-white/65 dark:active:bg-surface-dark";
const ICON: &str = "inline-flex flex-shrink-0 items-center justify-center [&_svg]:size-4";

pub fn corner() -> Element {
  // TODO: the MIDI panel comes with MIDI input, the port's last step.
  html! {
    div class="fixed top-4 right-4 z-50 flex gap-2 sm:top-6 sm:right-6" {
      button aria-label="MIDI" aria-expanded="false" class={ CORNER_BUTTON } @mousedown.prevent={ |_| blur_active() } {
        span class={ ICON } { { markup(KEYBOARD_MUSIC) } }
      }
      { theme_button() }
    }
  }
}

/// The light/dark switch alone, as the docs page has it.
pub fn theme_toggle() -> Element {
  html! {
    div class="fixed top-4 right-4 z-50 flex gap-2 sm:top-6 sm:right-6" { { theme_button() } }
  }
}

fn theme_button() -> Element {
  let device = crate::chrome::chrome();
  let next = move || device.theme.value().next(device.system_dark.value());
  html! {
      button
      class={ CORNER_BUTTON }
      aria-label={ move || format!("Theme: {}. Click to switch to {}.", device.theme.value().name(), next().name()) }
      @click={ move |_| device.cycle_theme() }
      @mousedown.prevent={ |_| blur_active() }
      {
        span class={ ICON } {
          if |next| next() == Theme::Light { { markup(SUN) } } else { { markup(MOON) } }
        }
      }
  }
}
