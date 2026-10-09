import type { Decorator } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import type { DocNode } from "../../../types/docs";

// The README with docs/ under it and its two folders, as the route bakes
// them from the repo.
export const SAMPLE_TREE: DocNode[] = [
  {
    kind: "file",
    name: "README.md",
    path: "README.md",
    href: "/docs",
    title: "Studio",
  },
  {
    kind: "folder",
    name: "docs",
    path: "docs",
    children: [
      {
        kind: "folder",
        name: "development",
        path: "docs/development",
        children: [
          {
            kind: "file",
            name: "installation.md",
            path: "docs/development/installation.md",
            href: "/docs/development/installation",
            title: "Installation",
          },
          {
            kind: "file",
            name: "storybook.md",
            path: "docs/development/storybook.md",
            href: "/docs/development/storybook",
            title: "Storybook",
          },
        ],
      },
      {
        kind: "folder",
        name: "project",
        path: "docs/project",
        children: [
          {
            kind: "file",
            name: "the-device.md",
            path: "docs/project/the-device.md",
            href: "/docs/project/the-device",
            title: "The Device (Home Page)",
          },
          {
            kind: "file",
            name: "synth-engine.md",
            path: "docs/project/synth-engine.md",
            href: "/docs/project/synth-engine",
            title: "Synth engine",
          },
        ],
      },
    ],
  },
];

// Docs parts link through the router, and their paper is made to sit on the
// sky, so they're shown on its gradient at
// /docs/development/installation.
export const withDocs: Decorator = (Story) => (
  <MemoryRouter initialEntries={["/docs/development/installation"]}>
    <div className="home-background rounded-xl p-8">
      <Story />
    </div>
  </MemoryRouter>
);
