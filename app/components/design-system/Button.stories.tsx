import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";
import { Label } from "./Typography";
import { Sparkles, ArrowRight, Plus, ChevronRight } from "lucide-react";

const meta: Meta<typeof Button> = {
  title: "Design System/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    variant: "solid",
    tone: "primary",
    size: "md",
    title: "Button",
    rounded: false,
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["solid", "outline", "ghost"],
      description: "Visual style variant of the button (Solid, Outline, Ghost)",
    },
    tone: {
      control: "select",
      options: [
        "primary",
        "info",
        "blue",
        "accent",
        "secondary",
        "success",
        "warning",
        "error",
      ],
      description: "Color tone preset for the button",
    },
    size: {
      control: "radio",
      options: ["sm", "md", "lg"],
      description: "Padding and sizing preset",
    },
    rounded: {
      control: "boolean",
      description: "Pill-shaped rounded button",
    },
    title: {
      control: "text",
      description: "Primary title text",
    },
    subtitle: {
      control: "text",
      description: "Helper subtitle underneath title",
    },
    isLoading: {
      control: "boolean",
      description: "Loading state with spinner",
    },
    disabled: {
      control: "boolean",
      description: "Disabled state",
    },
    fullWidth: {
      control: "boolean",
      description: "Span full width",
    },
    iconOnly: {
      control: "boolean",
      description: "Icon-only button styling (square aspect ratio)",
    },
    align: {
      control: "select",
      options: ["left", "center", "right", "between"],
      description: "Content and text alignment",
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Alignments: Story = {
  name: "Alignments with Full Width",
  render: () => (
    <div className="flex flex-col gap-4 w-80 items-stretch">
      <Button tone="primary" fullWidth align="left" title="Left Aligned" />
      <Button tone="primary" fullWidth align="center" title="Center Aligned" />
      <Button tone="primary" fullWidth align="right" title="Right Aligned" />
      <Button
        tone="secondary"
        fullWidth
        align="between"
        trailingIcon={<span className="w-2 h-2 rounded-full bg-primary" />}
      >
        <span>Between Aligned</span>
      </Button>
    </div>
  ),
};

export const ButtonVariants: Story = {
  name: "Button Variants",
  render: () => (
    <div className="flex flex-col gap-4 items-start">
      <div className="flex flex-wrap gap-4 items-center">
        <Button variant="solid" tone="primary" title="Solid" />
        <Button variant="outline" tone="primary" title="Outline" />
        <Button variant="ghost" tone="primary" title="Ghost" />
      </div>
      <div className="flex flex-wrap gap-4 items-center">
        <Button variant="solid" tone="primary" rounded title="Solid" />
        <Button variant="outline" tone="primary" rounded title="Outline" />
        <Button variant="ghost" tone="primary" rounded title="Ghost" />
      </div>
    </div>
  ),
};

export const LayoutCombinations: Story = {
  name: "Layout Combinations",
  render: () => (
    <div className="flex flex-col gap-6 items-start text-left">
      <div className="flex flex-col gap-2 items-start">
        <Label>Leading icon with title</Label>
        <Button
          tone="primary"
          title="Create New Project"
          leadingIcon={<Plus className="w-5 h-5" />}
        />
      </div>

      <div className="flex flex-col gap-2 items-start">
        <Label>Icon only</Label>
        <Button
          tone="primary"
          iconOnly
          title="Add New"
          leadingIcon={<Plus className="w-5 h-5" />}
        />
      </div>

      <div className="flex flex-col gap-2 items-start">
        <Label>Title with trailing icon</Label>
        <Button
          tone="primary"
          title="Explore Documentation"
          trailingIcon={<ArrowRight className="w-5 h-5" />}
        />
      </div>

      <div className="flex flex-col gap-2 items-start">
        <Label>Title with subtitle</Label>
        <Button
          tone="primary"
          title="Upgrade Workspace"
          subtitle="Access advanced agent workflows"
        />
      </div>

      <div className="flex flex-col gap-2 items-start">
        <Label>
          Full anatomy with leading icon, title, subtitle, and trailing icon
        </Label>
        <Button
          tone="primary"
          size="lg"
          title="Deploy Application Suite"
          subtitle="Automatic build & live verification"
          leadingIcon={<Sparkles className="w-5 h-5 text-amber-300" />}
          trailingIcon={<ChevronRight className="w-5 h-5" />}
        />
      </div>
    </div>
  ),
};

export const ButtonStates: Story = {
  name: "Button States",
  render: () => (
    <div className="flex flex-col gap-6 items-start text-left">
      <div className="flex flex-col gap-2 items-start">
        <Label>Loading state</Label>
        <div className="flex flex-wrap gap-4 items-start">
          <Button tone="primary" title="Loading..." isLoading />
        </div>
      </div>

      <div className="flex flex-col gap-2 items-start">
        <Label>Disabled state</Label>
        <div className="flex flex-wrap gap-4 items-start">
          <Button tone="primary" title="Disabled" disabled />
        </div>
      </div>
    </div>
  ),
};

export const ToneVariants: Story = {
  name: "Tone Variants",
  render: () => (
    <div className="flex flex-wrap gap-4 items-center">
      <Button tone="primary" title="Primary (Blue)" />
      <Button tone="info" title="Info (Blue)" />
      <Button tone="accent" title="Accent" />
      <Button tone="secondary" title="Secondary" />
      <Button tone="success" title="Success" />
      <Button tone="warning" title="Warning" />
      <Button tone="error" title="Error" />
    </div>
  ),
};

export const Sizes: Story = {
  name: "Button Sizes",
  render: () => (
    <div className="flex flex-col gap-6 items-start text-left">
      <div className="flex flex-col gap-2 items-start">
        <Label>Title only</Label>
        <div className="flex flex-wrap items-start gap-4">
          <Button tone="primary" size="sm" title="Small Button" />
          <Button tone="primary" size="md" title="Medium Button" />
          <Button tone="primary" size="lg" title="Large Button" />
        </div>
      </div>

      <div className="flex flex-col gap-2 items-start">
        <Label>With subtitle</Label>
        <div className="flex flex-wrap items-start gap-4">
          <Button
            tone="primary"
            size="sm"
            title="Small Button"
            subtitle="Compact padding"
          />
          <Button
            tone="primary"
            size="md"
            title="Medium Button"
            subtitle="Standard padding"
          />
          <Button
            tone="primary"
            size="lg"
            title="Large Button"
            subtitle="Generous padding"
          />
        </div>
      </div>
    </div>
  ),
};
