// A markdown file baked into the /docs route: README.md at /docs, and
// docs/<path>.md at /docs/<path>. `order` comes from its TOML config.
export type DocFile = {
  kind: "file";
  name: string;
  path: string;
  href: string;
  title: string;
  order: number;
};

// A folder in docs/, titled and ordered by its _meta.toml.
export type DocFolder = {
  kind: "folder";
  name: string;
  path: string;
  title: string;
  order: number;
  children: DocNode[];
};

export type DocNode = DocFile | DocFolder;

export type Doc = DocFile & {
  markdown: string;
};
