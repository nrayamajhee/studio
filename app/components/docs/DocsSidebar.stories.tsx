import type { Meta, StoryObj } from "@storybook/react-vite";
import { DocsSidebar } from "./DocsSidebar";
import { SAMPLE_TREE, withDocs } from "./storybook/withDocs";

const meta = {
  title: "Docs/Sidebar",
  component: DocsSidebar,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The docs' file tree floating on the sky: README.md, with each folder's files labelled and indented under it, and the open doc marked.",
      },
    },
  },
  decorators: [withDocs],
  args: {
    tree: SAMPLE_TREE,
    className: "w-60",
  },
} satisfies Meta<typeof DocsSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
