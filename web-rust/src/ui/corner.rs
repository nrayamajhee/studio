//! The frosted round buttons pinned to the page's top-right corner: MIDI and
//! the light/dark switch.

use std::rc::Rc;

use fluid::Context;
use fluid_macro::html;
use wasm_bindgen::prelude::*;
use web_sys::Element;

use super::keep_focus;
use crate::device::{Device, Theme};
use crate::icons::{KEYBOARD_MUSIC, MOON, SUN};

const CORNER_BUTTON: &str = "relative inline-flex aspect-square w-auto cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-white/45 bg-white/50 p-2 text-center text-xs font-medium text-font shadow-low backdrop-blur-xl transition-all duration-400 ease-in-out select-none hover:bg-white/65 focus-visible:ring-2 focus-visible:ring-font-light focus-visible:ring-offset-2 focus-visible:outline-none active:translate-y-0.5 active:bg-stone-200 dark:border-white/15 dark:bg-white/50 dark:text-surface dark:hover:bg-white/65 dark:active:bg-surface-dark";
const ICON: &str = "inline-flex flex-shrink-0 items-center justify-center [&_svg]:size-4";

pub fn corner(ctx: &Context, device: &Rc<Device>) -> Result<Element, JsValue> {
  let corner = html! { div class="fixed top-4 right-4 z-50 flex gap-2 sm:top-6 sm:right-6" {} };

  // TODO: the MIDI panel comes with MIDI input, the port's last step.
  let midi = html! { button class={ CORNER_BUTTON } { span class={ ICON } {} } };
  midi.set_attribute("aria-label", "MIDI")?;
  midi.set_attribute("aria-expanded", "false")?;

  let theme = device.theme.clone();
  let system_dark = device.system_dark.clone();
  let on_theme = device.clone();
  let toggle = html! {
    button
    class={ CORNER_BUTTON }
    @click={ move |_| on_theme.cycle_theme() }
    {
      span class={ ICON } {
        #{ |theme, system_dark| match theme.get().next(*system_dark.get()) {
          Theme::Light => SUN,
          _ => MOON,
        } }
      }
    }
  };
  {
    let toggle = toggle.clone();
    let theme = device.theme.clone();
    let system_dark = device.system_dark.clone();
    ctx.create_effect(move || {
      let (theme, system_dark) = (*theme.get(), *system_dark.get());
      let label = format!(
        "Theme: {}. Click to switch to {}.",
        theme.name(),
        theme.next(system_dark).name()
      );
      let _ = toggle.set_attribute("aria-label", &label);
    });
  }

  for button in [midi, toggle] {
    keep_focus(&button);
    corner.append_child(&button)?;
  }
  if let Some(icon) = corner
    .first_element_child()
    .and_then(|midi| midi.first_element_child())
  {
    icon.set_inner_html(KEYBOARD_MUSIC);
  }
  Ok(corner)
}
