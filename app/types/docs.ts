// A markdown file baked into the /docs route: README.md at /docs, and
// docs/<path>.md at /docs/<path>.
export type DocFile = {
  kind: "file";
  name: string;
  path: string;
  href: string;
  title: string;
};

export type DocFolder = {
  kind: "folder";
  name: string;
  path: string;
  children: DocNode[];
};

export type DocNode = DocFile | DocFolder;

export type Doc = DocFile & {
  markdown: string;
};
