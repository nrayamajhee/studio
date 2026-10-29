//! The docs page, as web-react's /docs route lays it out: the sky, the theme
//! toggle, the docs' tree down the side (a menu over the doc on phones) and
//! the doc on a sheet of paper. The docs are HTML rendered at build time
//! (see `build.rs`); links between them move in place (see `router`).

use fluid_macro::html;
use gloo_utils::document;
use web_sys::Element;

use super::{icon, markup, sky};
use crate::docs::store::{collapsed, set_collapsed};
use crate::docs::{DOCS, Node, TREE, find, folders};
use crate::icons::{
  ARROW_LEFT, CHEVRON_RIGHT, CHEVRONS_DOWN_UP, CHEVRONS_UP_DOWN, FILE_TEXT, MENU,
};
use crate::router::router;

/// The paper the docs' panels are drawn on.
const PAPER: &str = "rounded-[3px] bg-paper paper-grain shadow-paper text-paper-ink";
/// The home footer's links: plain, underlined.
const FOOT_LINK: &str =
  "font-medium underline decoration-current/40 underline-offset-4 hover:decoration-current";

/// The docs page: the sidebar, the doc the path names (or Not found), and the
/// page's title following it.
pub fn page() -> Element {
  let router = router();
  // A doc's title names the page, as web-react's meta does.
  fluid::create_effect(move || {
    let title = match router.path.with(|path| find(path)) {
      None => "Not found - Studio".to_owned(),
      Some(doc) if doc.path == "README.md" => "Docs - Studio".to_owned(),
      Some(doc) => format!("{} - Studio", doc.title),
    };
    document().set_title(&title);
  });
  fluid::on_cleanup(|| document().set_title("Studio"));
  // Going to a doc opens the folders it is in, so it isn't hidden.
  fluid::create_effect(move || {
    let path = router.path.cloned();
    let now = fluid::untrack(|| collapsed().cloned());
    let open: Vec<String> = now
      .iter()
      .filter(|folder| !path.starts_with(&format!("/{folder}/")))
      .cloned()
      .collect();
    if open.len() < now.len() {
      fluid::untrack(|| set_collapsed(open));
    }
  });
  html! {
    div class="relative min-h-dvh" {
      { sky::sky() }
      { super::corner::theme_toggle() }
      div class="relative mx-auto flex max-w-6xl items-start gap-8 px-4 sm:px-8" {
        aside class="sticky top-6 mt-6 hidden h-[calc(100dvh-3rem)] w-60 shrink-0 lg:block" {
          { sidebar(false, "h-full") }
        }
        main class="min-w-0 flex-1 pt-16 pb-24 sm:pt-20" {
          // Rebuilt for each doc, so the phone's menu closes on the way.
          { fluid::show(move || router.path.cloned(), |path| content(&path)) }
        }
      }
    }
  }
}

/// The doc the path names, with a menu of the docs above it on small screens.
fn content(path: &str) -> Vec<Element> {
  let doc = find(path);
  let menu = html! {
    details class="mb-6 lg:hidden" {
      summary class={ format!("{PAPER} inline-flex cursor-pointer list-none items-center gap-2 px-3.5 py-2 text-xs font-medium [&::-webkit-details-marker]:hidden") } {
        { icon(MENU, "size-3.5") }
        { doc.map_or("Docs", |doc| doc.name) }
      }
      { sidebar(true, "mt-2 max-h-[70dvh]") }
    }
  };
  let article = match doc {
    Some(doc) => html! {
      article class={ format!("{PAPER} px-6 py-8 sm:px-12 sm:py-12 lg:px-16 lg:py-14") } { { markup(doc.html) } }
    },
    None => html! {
      article class={ format!("{PAPER} px-6 py-8 sm:px-12 sm:py-12 lg:px-16 lg:py-14") } {
        div class="leading-[1.7]" {
          h1 class="mb-4 text-[2.35rem] leading-tight font-semibold tracking-tight" { "Not found" }
          p {
            "There’s no doc at "
            code class="font-mono" { { path.to_owned() } }
            ". "
            a href="/docs" class="text-paper-link underline decoration-current/35 underline-offset-[3px] hover:decoration-current" { "Back to the README" }
            "."
          }
        }
      }
    },
  };
  vec![menu, article]
}

/// The docs' file tree floating on the sky, in the order their TOML gives,
/// with the way back to the Device above it and the home footer's GitHub
/// and coffee links at the foot. `fold_all` adds a button that folds every
/// folder, or opens them all.
fn sidebar(fold_all: bool, class: &str) -> Element {
  let mut all = Vec::new();
  folders(TREE, 0, &mut all);
  let all_folded =
    move || collapsed().with(|folded| all.iter().all(|path| folded.iter().any(|f| f == path)));
  html! {
    nav aria-label="Docs" class={ format!("flex flex-col text-sky-ink {class}") } {
      div class="flex items-center justify-between gap-2" {
        a class="flex items-center gap-2 rounded px-2 py-1.5 text-[15px] font-semibold hover:bg-sky-well" href="/" {
          { icon(ARROW_LEFT, "size-3.5") }
          "Studio"
        }
        { fold_all.then(|| fold_button(all_folded.clone())) }
      }
      div class="mt-3 min-h-0 overflow-y-auto lg:overscroll-contain" { { tree(TREE, 0) } }
      div class="mt-auto px-2 pt-4 text-sm whitespace-nowrap" {
        a rel="noopener noreferrer" class={ FOOT_LINK } href="https://github.com/nrayamajhee/studio" target="_blank" { "GitHub" }
        " | "
        a rel="noopener noreferrer" class={ FOOT_LINK } href="https://buymeacoffee.com/nrayamajhee" target="_blank" { "Buy me a coffee!" }
      }
    }
  }
}

/// Folds every folder, or unfolds them all when they're all folded.
fn fold_button(all_folded: impl Fn() -> bool + Clone + 'static) -> Element {
  let (folded, label) = (all_folded.clone(), all_folded.clone());
  html! {
    button
    class="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium opacity-70 hover:bg-sky-well hover:opacity-100"
    @click={ move |_| {
      let mut all = Vec::new();
      folders(TREE, 0, &mut all);
      set_collapsed(if all_folded() { Vec::new() } else { all.into_iter().map(str::to_owned).collect() });
    } }
    {
      { move || if folded() { icon(CHEVRONS_UP_DOWN, "size-3.5") } else { icon(CHEVRONS_DOWN_UP, "size-3.5") } }
      span { #text{ |label| if label() { "Expand all" } else { "Collapse all" } } }
    }
  }
}

/// Each folder's files are indented under its parent's. The top folder
/// (docs/, the route itself) hangs under the README without a row of its
/// own; the folders inside it are labelled, and their labels fold them.
fn tree(nodes: &'static [Node], depth: usize) -> Element {
  let rows: Vec<Element> = nodes.iter().map(|node| row(node, depth)).collect();
  html! {
    ul class={ if depth > 0 { "pl-4" } else { "" } } { { rows } }
  }
}

/// A sidebar row: a doc's link, or a folder that folds.
fn row(node: &'static Node, depth: usize) -> Element {
  match node {
    Node::File(index) => {
      let doc = &DOCS[*index];
      let router = router();
      let here = move || {
        router
          .path
          .with(|path| path.trim_end_matches('/') == doc.href)
      };
      html! {
        li {
          a
          title={ doc.title }
          aria-current={ move || here().then_some("page") }
          class="flex items-center gap-2 rounded px-2 py-1.5 text-sm"
          class:"bg-sky-well font-semibold"=#{ |here| here() }
          class:"opacity-80 hover:bg-sky-well hover:opacity-100"=#{ |here| !here() }
          href={ doc.href }
          {
            { icon(FILE_TEXT, "size-3.5 shrink-0 opacity-70") }
            span class="truncate" { { doc.name } }
          }
        }
      }
    }
    Node::Folder {
      path,
      title,
      children,
    } => {
      let path: &'static str = path;
      let open = move || collapsed().with(|folded| !folded.iter().any(|f| f == path));
      let label = (depth > 0).then(|| {
        html! {
          button
          aria-expanded={ move || open().to_string() }
          class="flex w-full cursor-pointer items-center gap-1.5 rounded px-2 pt-3 pb-1 text-left text-xs font-semibold tracking-wide uppercase opacity-60 hover:opacity-100"
          @click={ move |_| {
            let mut folded = collapsed().cloned();
            match folded.iter().position(|f| f == path) {
              Some(at) => { folded.remove(at); }
              None => folded.push(path.to_owned()),
            }
            set_collapsed(folded);
          } }
          {
            { move || icon(CHEVRON_RIGHT, if open() { "size-3 shrink-0 transition-transform rotate-90" } else { "size-3 shrink-0 transition-transform" }) }
            { *title }
          }
        }
      });
      html! {
        li {
          { label }
          if |open| open() { { tree(children, depth + 1) } }
        }
      }
    }
  }
}
