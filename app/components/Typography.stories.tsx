import type { Meta, StoryObj } from "@storybook/react-vite";
import { Title, Subtitle, Paragraph, Caption, Label } from "./Typography";

const meta: Meta = {
  title: "Design System/Typography",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;

export const AllVariants: StoryObj = {
  render: () => (
    <>
      <Caption variant="uppercase">Title Variants</Caption>
      <Title level={1} size="display">
        Display Title
      </Title>
      <Title level={1}>Heading 1 (4xl)</Title>
      <Title level={2}>Heading 2 (3xl)</Title>
      <Title level={3}>Heading 3 (2xl)</Title>
      <Title level={4}>Heading 4 (xl)</Title>
      <Title level={5}>Heading 5 (lg)</Title>
      <Title level={6}>Heading 6 (md)</Title>
      <Title level={2} color="primary">
        Primary Colored Title
      </Title>
      <Title level={2} color="gradient">
        Gradient Title Variant
      </Title>
      <Title level={3} color="muted">
        Muted Title Variant
      </Title>

      <Caption variant="uppercase">Subtitle Variants</Caption>
      <Subtitle size="lg">Large Subtitle</Subtitle>
      <Subtitle size="md" color="default">
        Medium Default Subtitle
      </Subtitle>
      <Subtitle size="md" color="muted">
        Medium Muted Subtitle
      </Subtitle>
      <Subtitle size="sm" color="primary">
        Small Primary Subtitle
      </Subtitle>
      <Subtitle size="sm" color="subtle">
        Small Subtle Subtitle
      </Subtitle>

      <Caption variant="uppercase">Paragraph Variants</Caption>
      <Paragraph variant="lead">
        Lead Paragraph — Higher emphasis and comfortable line height.
      </Paragraph>
      <Paragraph size="lg">Large Body Paragraph</Paragraph>
      <Paragraph size="md">Medium Body Paragraph (Default)</Paragraph>
      <Paragraph size="sm" variant="secondary">
        Small Secondary Paragraph
      </Paragraph>
      <Paragraph size="xs" variant="muted">
        Extra Small Muted Paragraph
      </Paragraph>

      <Caption variant="uppercase">Label Variants</Caption>
      <Label size="lg">Large Label</Label>
      <Label size="md" required>
        Required Medium Label
      </Label>
      <Label size="sm" optional>
        Optional Small Label
      </Label>

      <Caption variant="uppercase">Caption Variants</Caption>
      <Caption variant="default">Default Caption</Caption>
      <Caption variant="muted">Muted Caption</Caption>
      <Caption variant="uppercase">Uppercase Metadata Caption</Caption>
      <Caption variant="mono">Mono Caption — sha256:7f83b2a</Caption>
    </>
  ),
};
