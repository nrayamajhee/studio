import type { Decorator } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import type { DocNode } from "../../../types/docs";

// The README with docs/ under it and three of its folders, in the order
// their TOML gives, as the route bakes them from the repo.
export const SAMPLE_TREE: DocNode[] = [
  {
    kind: "file",
    name: "README.md",
    path: "README.md",
    href: "/docs",
    title: "Studio",
    order: 0,
  },
  {
    kind: "folder",
    name: "docs",
    path: "docs",
    title: "Docs",
    order: 1,
    children: [
      {
        kind: "folder",
        name: "user-manual",
        path: "docs/user-manual",
        title: "User manual",
        order: 1,
        children: [
          {
            kind: "file",
            name: "introduction.md",
            path: "docs/user-manual/introduction.md",
            href: "/docs/user-manual/introduction",
            title: "User manual",
            order: 1,
          },
          {
            kind: "file",
            name: "play-notes-and-chords.md",
            path: "docs/user-manual/play-notes-and-chords.md",
            href: "/docs/user-manual/play-notes-and-chords",
            title: "Play notes and chords",
            order: 2,
          },
        ],
      },
      {
        kind: "folder",
        name: "the-device",
        path: "docs/the-device",
        title: "The Device",
        order: 2,
        children: [
          {
            kind: "file",
            name: "overview.md",
            path: "docs/the-device/overview.md",
            href: "/docs/the-device/overview",
            title: "The Device",
            order: 1,
          },
          {
            kind: "file",
            name: "knobs.md",
            path: "docs/the-device/knobs.md",
            href: "/docs/the-device/knobs",
            title: "Knobs",
            order: 2,
          },
        ],
      },
      {
        kind: "folder",
        name: "development",
        path: "docs/development",
        title: "Development",
        order: 5,
        children: [
          {
            kind: "file",
            name: "installation.md",
            path: "docs/development/installation.md",
            href: "/docs/development/installation",
            title: "Installation",
            order: 1,
          },
          {
            kind: "file",
            name: "storybook.md",
            path: "docs/development/storybook.md",
            href: "/docs/development/storybook",
            title: "Storybook",
            order: 2,
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
