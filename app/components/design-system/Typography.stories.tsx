import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Caption,
  Heading,
  Label,
  Paragraph,
  Subtitle,
  Title,
} from "./Typography";

function Specimen() {
  return (
    <div className="flex flex-col gap-4">
      <Heading>Heading</Heading>
      <Title>Title</Title>
      <Subtitle>Subtitle</Subtitle>
      <Paragraph>Paragraph</Paragraph>
      <Label>Label</Label>
      <Caption>Caption</Caption>
    </div>
  );
}

const meta = {
  title: "Design System/Typography",
  component: Specimen,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Text styles: heading, title, subtitle, paragraph, label and caption.",
      },
    },
  },
} satisfies Meta<typeof Specimen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
