import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Heading,
  Title,
  Subtitle,
  Paragraph,
  Label,
  Caption,
} from "./Typography";

const meta: Meta = {
  title: "Design System/Typography",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  subcomponents: {
    Heading: Heading as React.ComponentType<any>,
    Title: Title as React.ComponentType<any>,
    Subtitle: Subtitle as React.ComponentType<any>,
    Paragraph: Paragraph as React.ComponentType<any>,
    Label: Label as React.ComponentType<any>,
    Caption: Caption as React.ComponentType<any>,
  },
};

export default meta;

export const HeadingStory: StoryObj<typeof Heading> = {
  name: "Heading",
  render: (args) => <Heading {...args} />,
  args: {
    children: "Heading",
  },
  argTypes: {
    children: {
      control: "text",
    },
  },
};

export const TitleStory: StoryObj<typeof Title> = {
  name: "Title",
  render: (args) => <Title {...args} />,
  args: {
    children: "Title",
  },
  argTypes: {
    children: {
      control: "text",
    },
  },
};

export const SubtitleStory: StoryObj<typeof Subtitle> = {
  name: "Subtitle",
  render: (args) => <Subtitle {...args} />,
  args: {
    children: "Subtitle",
  },
  argTypes: {
    children: {
      control: "text",
    },
  },
};

export const ParagraphStory: StoryObj<typeof Paragraph> = {
  name: "Paragraph",
  render: (args) => <Paragraph {...args} />,
  args: {
    children: "Paragraph",
  },
  argTypes: {
    children: {
      control: "text",
    },
  },
};

export const LabelStory: StoryObj<typeof Label> = {
  name: "Label",
  render: (args) => <Label {...args} />,
  args: {
    children: "Label",
  },
  argTypes: {
    children: {
      control: "text",
    },
  },
};

export const CaptionStory: StoryObj<typeof Caption> = {
  name: "Caption",
  render: (args) => <Caption {...args} />,
  args: {
    children: "Caption",
  },
  argTypes: {
    children: {
      control: "text",
    },
  },
};

export const HierarchyStory: StoryObj = {
  name: "Hierarchy",
  render: () => (
    <div className="max-w-md flex flex-col gap-2">
      <Heading>Studio</Heading>
      <Label>Design System</Label>
      <Title>Card & Typography</Title>
      <Subtitle>Minimal, composable, accessible UI components.</Subtitle>
      <Paragraph>
        Built with React 19, Tailwind CSS v4, and Storybook. All components
        feature centralized atmospheric color tokens, strict typography
        hierarchy, and dark mode support.
      </Paragraph>
      <Caption>Updated 2 minutes ago • Studio v2.0</Caption>
    </div>
  ),
};
