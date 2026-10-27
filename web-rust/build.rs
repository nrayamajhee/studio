//! Renders the docs web-react serves at /docs (the repo's README and every
//! markdown file under docs/) to HTML at build time, with web-react's
//! classes on each element, its links and images resolved and each
//! heading's id, and writes them with the folders' tree to
//! `$OUT_DIR/docs.rs` for `src/docs/mod.rs` to include.

use std::collections::{BTreeMap, HashMap};
use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};

use pulldown_cmark::{CodeBlockKind, Event, HeadingLevel, Options, Parser, Tag, TagEnd};

#[allow(dead_code)]
mod style {
  include!("src/docs/style.rs");
}

const REPO: &str = "https://github.com/nrayamajhee/studio";

struct Doc {
  path: String,
  href: String,
  name: String,
  title: String,
  order: i64,
  markdown: String,
}

enum Node {
  File(usize),
  Folder {
    path: String,
    name: String,
    title: String,
    order: i64,
    children: Vec<Node>,
  },
}

fn main() {
  let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("..");
  println!("cargo:rerun-if-changed=../README.md");
  println!("cargo:rerun-if-changed=../docs");
  println!("cargo:rerun-if-changed=../web-react/public/docs");
  println!("cargo:rerun-if-changed=src/docs/style.rs");

  let mut files = vec![PathBuf::from("README.md")];
  collect(&root, Path::new("docs"), &mut files);
  let mut docs: Vec<Doc> = files.iter().map(|path| read_doc(&root, path)).collect();
  docs.sort_by(|a, b| a.path.cmp(&b.path));
  let hrefs: HashMap<String, String> = docs
    .iter()
    .map(|doc| (doc.path.clone(), doc.href.clone()))
    .collect();
  let tree = build_tree(&root, &docs);

  let mut out = String::from("pub static DOCS: &[Doc] = &[\n");
  for doc in &docs {
    let html = render(&root, &doc.markdown, &doc.path, &hrefs);
    writeln!(
      out,
      "  Doc {{ path: {:?}, href: {:?}, name: {:?}, title: {:?}, html: {:?} }},",
      doc.path, doc.href, doc.name, doc.title, html
    )
    .unwrap();
  }
  out.push_str("];\n\npub static TREE: &[Node] = ");
  write_nodes(&mut out, &tree);
  out.push_str(";\n");
  let target = PathBuf::from(std::env::var("OUT_DIR").unwrap()).join("docs.rs");
  fs::write(target, out).unwrap();
}

/// Every markdown file under `dir`, as paths from the repo's root.
fn collect(root: &Path, dir: &Path, files: &mut Vec<PathBuf>) {
  let mut entries: Vec<_> = fs::read_dir(root.join(dir)).unwrap().flatten().collect();
  entries.sort_by_key(|entry| entry.file_name());
  for entry in entries {
    let path = dir.join(entry.file_name());
    if entry.file_type().unwrap().is_dir() {
      collect(root, &path, files);
    } else if path.extension().is_some_and(|ext| ext == "md") {
      files.push(path);
    }
  }
}

/// A doc's TOML config sits between two `---` lines at the top.
fn front_matter(source: &str) -> (Option<&str>, &str) {
  let Some(rest) = source
    .strip_prefix("---\n")
    .or_else(|| source.strip_prefix("---\r\n"))
  else {
    return (None, source);
  };
  match rest.find("\n---") {
    Some(end) => {
      let after = &rest[end + 4..];
      let after = after.trim_start_matches([' ', '\t']);
      let after = after
        .strip_prefix("\r\n")
        .or_else(|| after.strip_prefix('\n'))
        .unwrap_or(after);
      (Some(&rest[..end]), after)
    }
    None => (None, source),
  }
}

fn order_of(config: &toml::Table, source: &str) -> i64 {
  config
    .get("order")
    .and_then(|order| {
      order
        .as_integer()
        .or_else(|| order.as_float().map(|order| order as i64))
    })
    .unwrap_or_else(|| panic!("{source}: its TOML config needs an `order` number"))
}

fn read_doc(root: &Path, path: &Path) -> Doc {
  let path = path.to_string_lossy().replace('\\', "/");
  let source = fs::read_to_string(root.join(&path)).unwrap();
  let (config, markdown) = front_matter(&source);
  let name = path.rsplit('/').next().unwrap().to_owned();
  // The README is GitHub's front page too, so it has no config; it leads.
  let order = if path == "README.md" {
    0
  } else {
    let config: toml::Table =
      toml::from_str(config.unwrap_or("")).unwrap_or_else(|error| panic!("{path}: {error}"));
    order_of(&config, &path)
  };
  Doc {
    href: if path == "README.md" {
      "/docs".into()
    } else {
      format!("/{}", path.trim_end_matches(".md"))
    },
    title: title_of(markdown, &name),
    name,
    path,
    order,
    markdown: markdown.to_owned(),
  }
}

/// The first `# ` heading outside code, without its markup.
fn title_of(markdown: &str, name: &str) -> String {
  let mut fenced = false;
  for line in markdown.lines() {
    if line.starts_with("```") {
      fenced = !fenced;
      continue;
    }
    if !fenced && let Some(title) = line.strip_prefix("# ") {
      return title.replace(['`', '*', '_'], "").trim().to_owned();
    }
  }
  name.to_owned()
}

fn build_tree(root: &Path, docs: &[Doc]) -> Vec<Node> {
  let mut top: Vec<Node> = Vec::new();
  for (index, doc) in docs.iter().enumerate() {
    let dirs: Vec<&str> = doc.path.split('/').collect();
    let dirs = &dirs[..dirs.len() - 1];
    let mut nodes = &mut top;
    for i in 0..dirs.len() {
      let at = nodes
        .iter()
        .position(|node| matches!(node, Node::Folder { name, .. } if name == dirs[i]));
      let at = match at {
        Some(at) => at,
        None => {
          nodes.push(folder_at(root, &dirs[..=i].join("/")));
          nodes.len() - 1
        }
      };
      let Node::Folder { children, .. } = &mut nodes[at] else {
        unreachable!()
      };
      nodes = children;
    }
    nodes.push(Node::File(index));
  }
  sort(&mut top, docs);
  top
}

fn folder_at(root: &Path, path: &str) -> Node {
  let source = fs::read_to_string(root.join(path).join("_meta.toml"))
    .unwrap_or_else(|_| panic!("{path}/ needs a _meta.toml with its `order`"));
  let meta: toml::Table = toml::from_str(&source).unwrap();
  let name = path.rsplit('/').next().unwrap().to_owned();
  let title = meta
    .get("title")
    .and_then(|title| title.as_str())
    .map(str::to_owned)
    .unwrap_or_else(|| {
      let mut title = name.replace(['-', '_'], " ");
      title[..1].make_ascii_uppercase();
      title
    });
  Node::Folder {
    order: order_of(&meta, &format!("{path}/_meta.toml")),
    path: path.to_owned(),
    name,
    title,
    children: Vec::new(),
  }
}

/// Each folder's files and folders by their `order`, then by name.
fn sort(nodes: &mut [Node], docs: &[Doc]) {
  let key = |node: &Node| match node {
    Node::File(index) => (docs[*index].order, docs[*index].name.to_lowercase()),
    Node::Folder { order, name, .. } => (*order, name.to_lowercase()),
  };
  nodes.sort_by_key(key);
  for node in nodes {
    if let Node::Folder { children, .. } = node {
      sort(children, docs);
    }
  }
}

fn write_nodes(out: &mut String, nodes: &[Node]) {
  out.push_str("&[");
  for node in nodes {
    match node {
      Node::File(index) => write!(out, "Node::File({index}), ").unwrap(),
      Node::Folder {
        path,
        title,
        children,
        ..
      } => {
        write!(
          out,
          "Node::Folder {{ path: {path:?}, title: {title:?}, children: "
        )
        .unwrap();
        write_nodes(out, children);
        out.push_str(" }, ");
      }
    }
  }
  out.push(']');
}

fn is_absolute(url: &str) -> bool {
  url.starts_with("//")
    || url.split_once(':').is_some_and(|(scheme, _)| {
      !scheme.is_empty()
        && scheme
          .chars()
          .all(|c| c.is_ascii_alphanumeric() || "+.-".contains(c))
    })
}

/// A link's target as a repo path, read from the file it is written in.
fn resolve(from: &str, target: &str) -> String {
  let mut parts: Vec<&str> = from.split('/').collect();
  parts.pop();
  for part in target.split('/') {
    match part {
      ".." => {
        parts.pop();
      }
      "" | "." => {}
      part => parts.push(part),
    }
  }
  parts.join("/")
}

/// Where a link goes: another doc opens in the route, an anchor stays on
/// the page, and any other repo file opens on GitHub.
fn doc_link(href: &str, from: &str, hrefs: &HashMap<String, String>) -> (String, bool) {
  if href.starts_with('#') || href.starts_with('/') {
    return (href.to_owned(), false);
  }
  if is_absolute(href) {
    return (href.to_owned(), true);
  }
  let (target, hash) = href
    .split_once('#')
    .map_or((href, None), |(target, hash)| (target, Some(hash)));
  let path = resolve(from, target);
  let suffix = hash.map(|hash| format!("#{hash}")).unwrap_or_default();
  match hrefs.get(&path) {
    Some(doc) => (format!("{doc}{suffix}"), false),
    None => (format!("{REPO}/blob/main/{path}{suffix}"), true),
  }
}

/// Images in web-react's public/ are served under /public; others come from
/// GitHub.
fn doc_image(src: &str, from: &str) -> String {
  if is_absolute(src) || src.starts_with('/') {
    return src.to_owned();
  }
  let path = resolve(from, src);
  match path.strip_prefix("web-react/") {
    Some(public) if public.starts_with("public/") => format!("/{public}"),
    _ => format!("{REPO}/raw/main/{path}"),
  }
}

/// An image, with its dark twin (`name.dark.webp` beside `name.webp`) laid
/// over it and faded in with the theme when it has one.
fn image(root: &Path, src: &str, alt: &str, title: Option<&str>, from: &str) -> String {
  let light = doc_image(src, from);
  let diagram = light.ends_with(".svg");
  let frame = if diagram {
    style::IMAGE.to_owned()
  } else {
    format!("{} {}", style::IMAGE, style::SCREENSHOT)
  };
  let title = title
    .filter(|title| !title.is_empty())
    .map(|title| format!(r#" title="{}""#, attr(title)))
    .unwrap_or_default();
  let dark = light
    .rsplit_once('.')
    .map(|(stem, ext)| format!("{stem}.dark.{ext}"));
  let twin = dark.filter(|dark| {
    dark.starts_with("/public/") && root.join("web-react").join(&dark[1..]).exists()
  });
  let Some(dark) = twin else {
    return format!(
      r#"<img src="{}" alt="{}"{title} class="{frame}">"#,
      attr(&light),
      attr(alt)
    );
  };
  let light_class = if diagram {
    format!("{} {}", style::LIGHT, style::LIGHT_DIAGRAM)
  } else {
    style::LIGHT.to_owned()
  };
  format!(
    r#"<span class="{} {frame}"><img src="{}" alt="{}"{title} class="{light_class}"><img src="{}" alt=""{title} class="{}"></span>"#,
    style::TWINS,
    attr(&light),
    attr(alt),
    attr(&dark),
    style::DARK
  )
}

/// Raw `<img>` tags (the README's screenshot) go through `image` too, as
/// web-react's do.
fn raw_html(root: &Path, html: &str, from: &str) -> String {
  let trimmed = html.trim();
  if !(trimmed.starts_with("<img ") && trimmed.ends_with('>')) {
    return html.to_owned();
  }
  let mut attrs = BTreeMap::new();
  let mut rest = trimmed
    .trim_start_matches("<img")
    .trim_end_matches('>')
    .trim_end_matches('/');
  while let Some(eq) = rest.find("=\"") {
    let name = rest[..eq].trim().to_owned();
    let value_start = eq + 2;
    let Some(end) = rest[value_start..].find('"') else {
      break;
    };
    attrs.insert(name, rest[value_start..value_start + end].to_owned());
    rest = &rest[value_start + end + 1..];
  }
  let Some(src) = attrs.get("src") else {
    return html.to_owned();
  };
  let image = image(
    root,
    src,
    attrs.get("alt").map_or("", String::as_str),
    attrs.get("title").map(String::as_str),
    from,
  );
  if html.ends_with('\n') {
    format!("{image}\n")
  } else {
    image
  }
}

fn escape(text: &str) -> String {
  text
    .replace('&', "&amp;")
    .replace('<', "&lt;")
    .replace('>', "&gt;")
}

fn attr(text: &str) -> String {
  escape(text).replace('"', "&quot;")
}

/// GitHub's heading ids (as rehype-slug makes them): lowercase, spaces to
/// dashes, punctuation dropped, repeats numbered.
fn slug(text: &str, seen: &mut HashMap<String, usize>) -> String {
  let base: String = text
    .to_lowercase()
    .chars()
    .filter_map(|c| match c {
      ' ' => Some('-'),
      c if c.is_alphanumeric() || c == '_' || c == '-' => Some(c),
      _ => None,
    })
    .collect();
  let count = seen.entry(base.clone()).or_insert(0);
  let slug = if *count == 0 {
    base.clone()
  } else {
    format!("{base}-{count}")
  };
  *count += 1;
  slug
}

fn heading_class(level: HeadingLevel) -> &'static str {
  match level {
    HeadingLevel::H1 => style::H1,
    HeadingLevel::H2 => style::H2,
    HeadingLevel::H3 => style::H3,
    HeadingLevel::H4 => style::H4,
    HeadingLevel::H5 => style::H5,
    HeadingLevel::H6 => style::H6,
  }
}

/// A doc's markdown (GFM, with inline HTML) as HTML set in the paper's ink.
fn render(root: &Path, markdown: &str, from: &str, hrefs: &HashMap<String, String>) -> String {
  let options = Options::ENABLE_TABLES
    | Options::ENABLE_STRIKETHROUGH
    | Options::ENABLE_TASKLISTS
    | Options::ENABLE_GFM;
  let events: Vec<Event> = Parser::new_ext(markdown, options).collect();
  let mut out = format!(r#"<div class="{}">"#, style::BODY);
  let mut seen = HashMap::new();
  let mut in_head = false;
  let mut i = 0;
  while i < events.len() {
    match &events[i] {
      Event::Start(tag) => match tag {
        Tag::Paragraph => write!(out, r#"<p class="{}">"#, style::P).unwrap(),
        Tag::Heading { level, .. } => {
          let mut text = String::new();
          for event in &events[i + 1..] {
            match event {
              Event::End(TagEnd::Heading(_)) => break,
              Event::Text(t) | Event::Code(t) => text.push_str(t),
              _ => {}
            }
          }
          write!(
            out,
            r#"<{level} id="{}" class="{}">"#,
            attr(&slug(&text, &mut seen)),
            heading_class(*level)
          )
          .unwrap();
        }
        Tag::BlockQuote(_) => write!(out, r#"<blockquote class="{}">"#, style::BLOCKQUOTE).unwrap(),
        Tag::CodeBlock(kind) => {
          let language = match kind {
            CodeBlockKind::Fenced(info) => info.split_whitespace().next().unwrap_or("").to_owned(),
            CodeBlockKind::Indented => String::new(),
          };
          let class = if language.is_empty() {
            style::CODE.to_owned()
          } else {
            format!("{} language-{}", style::CODE, attr(&language))
          };
          write!(out, r#"<pre class="{}"><code class="{class}">"#, style::PRE).unwrap();
        }
        Tag::List(None) => write!(out, r#"<ul class="{}">"#, style::UL).unwrap(),
        Tag::List(Some(1)) => write!(out, r#"<ol class="{}">"#, style::OL).unwrap(),
        Tag::List(Some(start)) => {
          write!(out, r#"<ol start="{start}" class="{}">"#, style::OL).unwrap()
        }
        Tag::Item => write!(out, r#"<li class="{}">"#, style::LI).unwrap(),
        Tag::Table(_) => write!(
          out,
          r#"<div class="{}"><table class="{}">"#,
          style::TABLE_WRAP,
          style::TABLE
        )
        .unwrap(),
        Tag::TableHead => {
          in_head = true;
          out.push_str("<thead><tr>");
        }
        Tag::TableRow => out.push_str("<tr>"),
        Tag::TableCell => {
          if in_head {
            write!(out, r#"<th class="{}">"#, style::TH).unwrap();
          } else {
            write!(out, r#"<td class="{}">"#, style::TD).unwrap();
          }
        }
        Tag::Emphasis => out.push_str("<em>"),
        Tag::Strong => write!(out, r#"<strong class="{}">"#, style::STRONG).unwrap(),
        Tag::Strikethrough => out.push_str("<del>"),
        Tag::Link {
          dest_url, title, ..
        } => {
          let (to, external) = doc_link(dest_url, from, hrefs);
          let title = if title.is_empty() {
            String::new()
          } else {
            format!(r#" title="{}""#, attr(title))
          };
          let target = if external {
            r#" target="_blank" rel="noopener noreferrer""#
          } else {
            ""
          };
          write!(
            out,
            r#"<a href="{}"{title}{target} class="{}">"#,
            attr(&to),
            style::LINK
          )
          .unwrap();
        }
        Tag::Image {
          dest_url, title, ..
        } => {
          let mut alt = String::new();
          i += 1;
          while i < events.len() && !matches!(events[i], Event::End(TagEnd::Image)) {
            if let Event::Text(text) | Event::Code(text) = &events[i] {
              alt.push_str(text);
            }
            i += 1;
          }
          out.push_str(&image(root, dest_url, &alt, Some(title), from));
        }
        Tag::HtmlBlock => {}
        _ => {}
      },
      Event::End(tag) => match tag {
        TagEnd::Paragraph => out.push_str("</p>"),
        TagEnd::Heading(level) => write!(out, "</{level}>").unwrap(),
        TagEnd::BlockQuote(_) => out.push_str("</blockquote>"),
        TagEnd::CodeBlock => out.push_str("</code></pre>"),
        TagEnd::List(false) => out.push_str("</ul>"),
        TagEnd::List(true) => out.push_str("</ol>"),
        TagEnd::Item => out.push_str("</li>"),
        TagEnd::Table => out.push_str("</tbody></table></div>"),
        TagEnd::TableHead => {
          in_head = false;
          out.push_str("</tr></thead><tbody>");
        }
        TagEnd::TableRow => out.push_str("</tr>"),
        TagEnd::TableCell => out.push_str(if in_head { "</th>" } else { "</td>" }),
        TagEnd::Emphasis => out.push_str("</em>"),
        TagEnd::Strong => out.push_str("</strong>"),
        TagEnd::Strikethrough => out.push_str("</del>"),
        TagEnd::Link => out.push_str("</a>"),
        _ => {}
      },
      Event::Text(text) => out.push_str(&escape(text)),
      Event::Code(code) => write!(
        out,
        r#"<code class="{}">{}</code>"#,
        style::CODE,
        escape(code)
      )
      .unwrap(),
      Event::Html(html) | Event::InlineHtml(html) => out.push_str(&raw_html(root, html, from)),
      Event::SoftBreak => out.push('\n'),
      Event::HardBreak => out.push_str("<br>\n"),
      Event::Rule => write!(out, r#"<hr class="{}">"#, style::HR).unwrap(),
      Event::TaskListMarker(checked) => write!(
        out,
        r#"<input type="checkbox" disabled{}> "#,
        if *checked { " checked" } else { "" }
      )
      .unwrap(),
      _ => {}
    }
    i += 1;
  }
  out.push_str("</div>");
  out
}
