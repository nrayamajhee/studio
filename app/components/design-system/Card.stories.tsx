import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card } from "./Card";
import { Label, Title, Subtitle, Paragraph, Caption } from "./Typography";

const meta: Meta<typeof Card> = {
  title: "Design System/Card",
  component: Card,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="max-w-md flex flex-col gap-2">
      <Label>Design System</Label>
      <Title>Card & Typography</Title>
      <Subtitle>Minimal, composable, accessible UI components.</Subtitle>
      <Paragraph>
        Built with React 19, Tailwind CSS v4, and Storybook. All components feature centralized atmospheric color tokens, strict typography hierarchy, and dark mode support.
      </Paragraph>
      <Caption>Updated 2 minutes ago • Studio v2.0</Caption>
    </Card>
  ),
};
