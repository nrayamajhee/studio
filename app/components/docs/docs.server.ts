import { parse } from "smol-toml";
import type { Doc, DocFile, DocFolder, DocNode } from "../../types/docs";

// Every markdown file in docs/ and the README, and each docs folder's
// _meta.toml, read at build time.
const SOURCES = import.meta.glob<string>(["/README.md", "/docs/**/*.md"], {
  query: "?raw",
  import: "default",
  eager: true,
});

const FOLDER_META = import.meta.glob<string>("/docs/**/_meta.toml", {
  query: "?raw",
  import: "default",
  eager: true,
});

// The screenshots with a dark twin beside them (`name.dark.webp` by
// `name.webp`), at the paths public/ serves them from. Only the paths are
// read; the images are served from public/ as they are.
export const DARK_IMAGES = Object.keys(
  import.meta.glob("/public/docs/**/*.dark.*", {
    query: "?url",
    import: "default",
    eager: true,
  }),
).map((key) => key.slice("/public".length));

// A doc's TOML config, between two `---` lines at the top of the file.
const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---[^\S\r\n]*(?:\r?\n|$)/;

const orderOf = (config: Record<string, unknown>, source: string) => {
  if (typeof config.order !== "number")
    throw new Error(`${source}: its TOML config needs an \`order\` number`);
  return config.order;
};

const hrefOf = (path: string) =>
  path === "README.md" ? "/docs" : `/${path.replace(/\.md$/, "")}`;

const titleOf = (markdown: string, name: string) =>
  markdown
    .replace(/^```[\s\S]*?^```/gm, "")
    .match(/^#\s+(.+)$/m)?.[1]
    .replace(/[`*_]/g, "")
    .trim() ?? name;

const DOCS: Doc[] = Object.entries(SOURCES).map(([key, source]) => {
  const path = key.replace(/^\//, "");
  const name = path.split("/").at(-1) ?? path;
  const [frontMatter = "", config = ""] = source.match(FRONT_MATTER) ?? [];
  const markdown = source.slice(frontMatter.length);
  return {
    kind: "file",
    name,
    path,
    href: hrefOf(path),
    title: titleOf(markdown, name),
    // The README is GitHub's front page too, so it has no config; it leads.
    order: path === "README.md" ? 0 : orderOf(parse(config), path),
    markdown,
  };
});

const byHref = new Map(DOCS.map((doc) => [doc.href, doc]));

const folderAt = (path: string): DocFolder => {
  const source = FOLDER_META[`/${path}/_meta.toml`];
  if (source === undefined)
    throw new Error(`${path}/ needs a _meta.toml with its \`order\``);
  const meta = parse(source);
  const name = path.split("/").at(-1) ?? path;
  return {
    kind: "folder",
    name,
    path,
    title:
      typeof meta.title === "string"
        ? meta.title
        : name.charAt(0).toUpperCase() + name.slice(1).replace(/[-_]/g, " "),
    order: orderOf(meta, `${path}/_meta.toml`),
    children: [],
  };
};

// Each folder's files and folders by their `order`, then by name.
const sortTree = (nodes: DocNode[]) => {
  nodes.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  for (const node of nodes) if (node.kind === "folder") sortTree(node.children);
};

const buildTree = (docs: Doc[]) => {
  const root: DocFolder = {
    kind: "folder",
    name: "",
    path: "",
    title: "",
    order: 0,
    children: [],
  };
  for (const { markdown: _markdown, ...file } of docs) {
    const dirs = file.path.split("/").slice(0, -1);
    let folder = root;
    dirs.forEach((dir, i) => {
      let next = folder.children.find(
        (node): node is DocFolder =>
          node.kind === "folder" && node.name === dir,
      );
      if (!next) {
        next = folderAt(dirs.slice(0, i + 1).join("/"));
        folder.children.push(next);
      }
      folder = next;
    });
    folder.children.push(file satisfies DocFile);
  }
  sortTree(root.children);
  return root.children;
};

export const DOCS_TREE = buildTree(DOCS);

// The doc at /docs/<splat>, or undefined.
export const findDoc = (splat: string) => {
  const rest = splat.replace(/^\/+|\/+$/g, "");
  return byHref.get(rest ? `/docs/${rest}` : "/docs");
};
