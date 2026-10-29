//! The page's two routes, as web-react has them: the Device at `/` and the
//! docs under `/docs`. Links to either move in place, with the history, as
//! React Router's do.

use std::rc::Rc;

use fluid::{ListenerOptions, Signal, listen};
use gloo_utils::{document, window};
use wasm_bindgen::JsCast;
use web_sys::{Element, Event, MouseEvent};

/// The app's two pages.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Page {
  /// The Device, at `/`.
  Home,
  /// The docs, under `/docs`.
  Docs,
}

/// The two pages as a signal of the location's path, as web-react's routes are:
/// [`Router::page`] says which page shows, and [`Router::navigate`] moves
/// between them in place, with the history.
pub struct Router {
  /// The location's path, without its hash.
  pub path: Rc<Signal<String>>,
}

/// The router for the page's lifetime, shared through fluid's context.
pub fn router() -> &'static Router {
  fluid::use_context().expect("the router is provided at the root scope")
}

impl Router {
  /// Reads the location, follows the history and takes over in-app links.
  pub fn install() -> &'static Router {
    let router: &'static Router = Box::leak(Box::new(Router {
      path: Rc::new(Signal::new(location_path())),
    }));
    fluid::provide_context(router);

    listen(
      &window(),
      "popstate",
      ListenerOptions::new(),
      move |_: Event| {
        router.path.set_if_changed(location_path());
        router.scroll_to_hash();
      },
    )
    .forget();
    listen(
      &document(),
      "click",
      ListenerOptions::new(),
      move |event: MouseEvent| {
        if event.default_prevented()
          || event.button() != 0
          || event.meta_key()
          || event.ctrl_key()
          || event.shift_key()
          || event.alt_key()
        {
          return;
        }
        let Some(link) = event
          .target()
          .and_then(|target| target.dyn_into::<Element>().ok())
          .and_then(|target| target.closest("a[href]").ok().flatten())
        else {
          return;
        };
        let href = link.get_attribute("href").unwrap_or_default();
        if link.has_attribute("target") || link.has_attribute("download") || !is_route(&href) {
          return;
        }
        event.prevent_default();
        router.navigate(&href);
      },
    )
    .forget();
    router
  }

  /// The page the path shows, tracked.
  pub fn page(&self) -> Page {
    self.path.with(|path| page_of(path))
  }

  /// Goes to `href` (a path, maybe with a hash) and scrolls to the top, or
  /// to the hash's element.
  pub fn navigate(&self, href: &str) {
    if let Ok(history) = window().history() {
      let _ = history.push_state_with_url(&wasm_bindgen::JsValue::NULL, "", Some(href));
    }
    let path = href.split('#').next().unwrap_or(href);
    self.path.set_if_changed(path.to_owned());
    if !self.scroll_to_hash() {
      window().scroll_to_with_x_and_y(0., 0.);
    }
  }

  /// Scrolls the location's hash into view; false if it names nothing.
  fn scroll_to_hash(&self) -> bool {
    let hash = window().location().hash().unwrap_or_default();
    let id = hash.trim_start_matches('#');
    if id.is_empty() {
      return false;
    }
    let id = js_sys::decode_uri_component(id).map_or_else(|_| id.to_owned(), String::from);
    match document().get_element_by_id(&id) {
      Some(element) => {
        element.scroll_into_view();
        true
      }
      None => false,
    }
  }
}

/// The location's path.
fn location_path() -> String {
  window()
    .location()
    .pathname()
    .unwrap_or_else(|_| "/".into())
}

/// The page `path` shows.
pub fn page_of(path: &str) -> Page {
  if path == "/docs" || path.starts_with("/docs/") {
    Page::Docs
  } else {
    Page::Home
  }
}

/// Whether a link's `href` is one of the routes, which move in place.
pub fn is_route(href: &str) -> bool {
  let path = href.split('#').next().unwrap_or(href);
  path == "/" || page_of(path) == Page::Docs
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn routes() {
    assert_eq!(page_of("/"), Page::Home);
    assert_eq!(page_of("/docs"), Page::Docs);
    assert_eq!(page_of("/docs/guides/introduction"), Page::Docs);
    assert_eq!(page_of("/docsy"), Page::Home);
    assert!(is_route("/docs/synth/sound-pipeline#the-voice"));
    assert!(is_route("/"));
    assert!(!is_route("https://github.com/nrayamajhee/studio"));
    assert!(!is_route("/public/docs/the-device/pads.webp"));
    assert!(!is_route("#top"));
  }
}
