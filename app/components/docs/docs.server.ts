import type { Doc, DocFile, DocFolder, DocNode } from "../../types/docs";

// Every markdown file in docs/ and the README, read at build time.
const SOURCES = import.meta.glob<string>(["/README.md", "/docs/**/*.md"], {
  query: "?raw",
  import: "default",
  eager: true,
});

const hrefOf = (path: string) =>
  path === "README.md" ? "/docs" : `/${path.replace(/\.md$/, "")}`;

const titleOf = (markdown: string, name: string) =>
  markdown
    .replace(/^```[\s\S]*?^```/gm, "")
    .match(/^#\s+(.+)$/m)?.[1]
    .replace(/[`*_]/g, "")
    .trim() ?? name;

const DOCS: Doc[] = Object.entries(SOURCES).map(([key, markdown]) => {
  const path = key.replace(/^\//, "");
  const name = path.split("/").at(-1) ?? path;
  return {
    kind: "file",
    name,
    path,
    href: hrefOf(path),
    title: titleOf(markdown, name),
    markdown,
  };
});

const byHref = new Map(DOCS.map((doc) => [doc.href, doc]));

// Files before folders, each alphabetical, as a file browser lists them.
const sortTree = (nodes: DocNode[]) => {
  nodes.sort((a, b) =>
    a.kind === b.kind
      ? a.name.localeCompare(b.name)
      : a.kind === "file"
        ? -1
        : 1,
  );
  for (const node of nodes) if (node.kind === "folder") sortTree(node.children);
};

const buildTree = (docs: Doc[]) => {
  const root: DocFolder = { kind: "folder", name: "", path: "", children: [] };
  for (const { markdown: _markdown, ...file } of docs) {
    const dirs = file.path.split("/").slice(0, -1);
    let folder = root;
    dirs.forEach((dir, i) => {
      let next = folder.children.find(
        (node): node is DocFolder =>
          node.kind === "folder" && node.name === dir,
      );
      if (!next) {
        next = {
          kind: "folder",
          name: dir,
          path: dirs.slice(0, i + 1).join("/"),
          children: [],
        };
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
