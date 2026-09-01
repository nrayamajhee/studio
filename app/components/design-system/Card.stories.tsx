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
  args: {
    elevation: "mid",
    children: "This is a default Card component with configurable elevation.",
  },
  argTypes: {
    elevation: {
      control: "select",
      options: ["low", "mid", "high"],
      description: "Elevation level preset (low, mid, high)",
    },
    children: {
      control: "text",
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithTypography: Story = {
  name: "With Typography",
  render: (args) => (
    <Card {...args} className="max-w-md flex flex-col gap-2">
      <Label>Design System</Label>
      <Title>Card & Typography</Title>
      <Subtitle>Minimal, composable, accessible UI components.</Subtitle>
      <Paragraph>
        Built with React 19, Tailwind CSS v4, and Storybook. All components
        feature centralized atmospheric color tokens, strict typography
        hierarchy, and dark mode support.
      </Paragraph>
      <Caption>Updated 2 minutes ago • Studio v2.0</Caption>
    </Card>
  ),
};
