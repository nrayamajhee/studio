import type { DocNode } from "../../types/docs";

const REPO = "https://github.com/nrayamajhee/studio";

export const sourceUrl = (path: string) => `${REPO}/blob/main/${path}`;

const isAbsolute = (url: string) => /^([a-z][a-z\d+.-]*:|\/\/)/i.test(url);

// A link's target as a repo path, read from the file it is written in
// (`synth-engine.md` from `docs/project/the-device.md` is
// `docs/project/synth-engine.md`).
export const resolvePath = (from: string, target: string) => {
  const parts = from.split("/").slice(0, -1);
  for (const part of target.split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }
  return parts.join("/");
};

// Each doc's repo path to its route.
export const docHrefs = (tree: DocNode[]) => {
  const hrefs = new Map<string, string>();
  const walk = (nodes: DocNode[]) => {
    for (const node of nodes) {
      if (node.kind === "file") hrefs.set(node.path, node.href);
      else walk(node.children);
    }
  };
  walk(tree);
  return hrefs;
};

export type DocLink = { to: string; external: boolean };

// Where a markdown link goes: another doc opens in the route, an anchor
// stays on the page, and any other repo file opens on GitHub.
export const docLink = (
  href: string,
  from: string,
  hrefs: Map<string, string>,
): DocLink => {
  if (href.startsWith("#") || href.startsWith("/"))
    return { to: href, external: false };
  if (isAbsolute(href)) return { to: href, external: true };
  const [target, hash] = href.split("#");
  const path = resolvePath(from, target);
  const doc = hrefs.get(path);
  const suffix = hash ? `#${hash}` : "";
  return doc
    ? { to: doc + suffix, external: false }
    : { to: sourceUrl(path) + suffix, external: true };
};

// Images in public/ are served from the site root; others come from GitHub.
export const docImage = (src: string, from: string) => {
  if (isAbsolute(src) || src.startsWith("/")) return src;
  const path = resolvePath(from, src);
  return path.startsWith("public/")
    ? path.slice("public".length)
    : `${REPO}/raw/main/${path}`;
};
