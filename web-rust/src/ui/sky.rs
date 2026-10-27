//! The sky behind the page: the sunset gradient with its drifting glow,
//! cross-fading to blue hour in dark mode.

use fluid_macro::html;
use web_sys::Element;

pub fn sky() -> Element {
  html! {
    div aria-hidden="true" class="home-background pointer-events-none fixed inset-0 overflow-hidden" {
      div class="absolute inset-0 opacity-100 transition-opacity duration-400 ease-in-out dark:opacity-0" {
        div
        class="animate-sunset-traverse absolute -bottom-[60vmax] -left-[60vmax] h-[120vmax] w-[120vmax] mix-blend-screen"
        style="background: radial-gradient(circle closest-side at 50% 50%, rgba(255, 248, 221, 0.98) 0%, rgba(255, 232, 173, 0.88) 15%, rgba(255, 207, 134, 0.65) 32%, rgba(250, 183, 139, 0.36) 52%, rgba(239, 189, 184, 0.13) 72%, rgba(239, 189, 184, 0.025) 88%, rgba(239, 189, 184, 0) 100%)"
        {}
        div
        class="absolute inset-x-0 bottom-0 h-1/3"
        style="background: radial-gradient(ellipse 120% 60% at 50% 100%, rgba(246, 197, 163, 0.2) 0%, rgba(239, 189, 184, 0.07) 45%, rgba(239, 189, 184, 0) 100%)"
        {}
      }
      div class="absolute inset-0 opacity-0 transition-opacity duration-400 ease-in-out dark:opacity-100" {
        div
        class="animate-sunset-traverse absolute -bottom-[45vmax] -left-[45vmax] h-[90vmax] w-[90vmax] mix-blend-screen"
        style="background: radial-gradient(circle closest-side at 50% 50%, rgba(167, 185, 211, 0.3) 0%, rgba(144, 165, 196, 0.23) 18%, rgba(112, 137, 173, 0.14) 38%, rgba(89, 103, 129, 0.06) 60%, rgba(89, 103, 129, 0.015) 80%, rgba(89, 103, 129, 0) 100%)"
        {}
        div
        class="absolute inset-x-0 bottom-0 h-1/3"
        style="background: radial-gradient(ellipse 120% 60% at 50% 100%, rgba(124, 121, 140, 0.12) 0%, rgba(89, 103, 129, 0.04) 45%, rgba(89, 103, 129, 0) 100%)"
        {}
      }
    }
  }
}
