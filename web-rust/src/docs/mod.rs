//! The docs web-react serves at /docs: the repo's README and the markdown
//! under docs/, rendered to HTML at build time by `build.rs`, with their
//! folders' tree.

pub mod store;
/// The classes the docs' HTML gets, as web-react's `DocsMarkdown` gives them:
/// build.rs `include!`s the file to set them, and Tailwind finds them here.
#[allow(dead_code)]
pub mod style;

/// A doc, as the build renders it: where it sits, its route, its name and
/// title, and its HTML.
pub struct Doc {
  /// Where the file sits in the repo.
  pub path: &'static str,
  /// Its route: `/docs` for the README, else `/docs/...` without `.md`.
  pub href: &'static str,
  /// The file's name, as the sidebar shows it.
  pub name: &'static str,
  /// Its first heading.
  pub title: &'static str,
  pub html: &'static str,
}

/// An entry in the docs' sidebar: a doc, or a folder of entries.
pub enum Node {
  /// An index into [`DOCS`].
  File(usize),
  /// A folder: its path, its title, and what it holds.
  Folder {
    path: &'static str,
    title: &'static str,
    children: &'static [Node],
  },
}

include!(concat!(env!("OUT_DIR"), "/docs.rs"));

/// The doc at `path` (`/docs` or `/docs/...`), if there is one.
pub fn find(path: &str) -> Option<&'static Doc> {
  let path = path.trim_end_matches('/');
  DOCS.iter().find(|doc| doc.href == path)
}

/// Every folder with a row of its own (all but the top one), by path.
pub fn folders(nodes: &'static [Node], depth: usize, out: &mut Vec<&'static str>) {
  for node in nodes {
    if let Node::Folder { path, children, .. } = node {
      if depth > 0 {
        out.push(path);
      }
      folders(children, depth + 1, out);
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn every_doc_has_a_route_and_a_place_in_the_tree() {
    assert_eq!(find("/docs").unwrap().path, "README.md");
    assert_eq!(find("/docs/guides/introduction/").unwrap().title, "Guides");
    let mut files = 0;
    fn count(nodes: &[Node], files: &mut usize) {
      for node in nodes {
        match node {
          Node::File(_) => *files += 1,
          Node::Folder { children, .. } => count(children, files),
        }
      }
    }
    count(TREE, &mut files);
    assert_eq!(files, DOCS.len());
    let mut all = Vec::new();
    folders(TREE, 0, &mut all);
    assert!(all.contains(&"docs/synth/physical-modeling"));
  }

  #[test]
  fn links_and_images_resolve() {
    let guides = find("/docs/guides/introduction").unwrap().html;
    assert!(guides.contains(r#"href="/docs/guides/play-notes-and-chords""#));
    assert!(guides.contains(r#"src="/public/docs/user-manual/device.dark.webp""#));
    let readme = find("/docs").unwrap().html;
    assert!(readme.contains(r#"src="/public/screenshot.png""#));
  }
}
