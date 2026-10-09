import type { Meta, StoryObj } from "@storybook/react-vite";
import { DocsMarkdown } from "./DocsMarkdown";
import { DocsPaper } from "./DocsPaper";
import { SAMPLE_TREE, withDocs } from "./storybook/withDocs";

const SAMPLE = `# Installation

Studio runs in the browser. See [The Device](../project/the-device.md) for how it's built, or skip to [Checks](#checks).

> Run the app on port \`5173\` and Storybook on \`6006\`.

## Development

1. Install the dependencies.
2. Start the dev server:

\`\`\`bash
npm run dev
\`\`\`

## Checks

| Check      | Command              |
| ---------- | -------------------- |
| Typecheck  | \`npm run typecheck\` |
| Unit tests | \`npm run test:unit\` |

- **Lint**: \`npm run lint\`
- **Format**: \`npm run format\`
`;

const meta = {
  title: "Docs/Markdown",
  component: DocsMarkdown,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A doc's markdown (GFM, with inline HTML) set in the paper's ink. Links to other docs stay in the route; other repo files open on GitHub.",
      },
    },
  },
  decorators: [
    (Story) => (
      <DocsPaper className="max-w-3xl">
        <Story />
      </DocsPaper>
    ),
    withDocs,
  ],
  args: {
    markdown: SAMPLE,
    path: "docs/development/installation.md",
    tree: SAMPLE_TREE,
  },
  argTypes: {
    markdown: { control: "text" },
  },
} satisfies Meta<typeof DocsMarkdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
