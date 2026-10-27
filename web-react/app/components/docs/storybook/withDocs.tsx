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
        name: "the-device",
        path: "docs/the-device",
        title: "The Device",
        order: 1,
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
            name: "screen-and-views.md",
            path: "docs/the-device/screen-and-views.md",
            href: "/docs/the-device/screen-and-views",
            title: "Screen and views",
            order: 2,
          },
        ],
      },
      {
        kind: "folder",
        name: "guides",
        path: "docs/guides",
        title: "Guides",
        order: 2,
        children: [
          {
            kind: "file",
            name: "introduction.md",
            path: "docs/guides/introduction.md",
            href: "/docs/guides/introduction",
            title: "Guides",
            order: 1,
          },
          {
            kind: "file",
            name: "play-notes-and-chords.md",
            path: "docs/guides/play-notes-and-chords.md",
            href: "/docs/guides/play-notes-and-chords",
            title: "Play notes and chords",
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
