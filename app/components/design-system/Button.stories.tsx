import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";
import {
  Sparkles,
  ArrowRight,
  Plus,
  ChevronRight,
  Zap,
  Lock,
} from "lucide-react";

const meta: Meta<typeof Button> = {
  title: "Design System/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["solid", "outline", "ghost"],
      description: "Visual style variant of the button (Solid, Outline, Ghost)",
    },
    tone: {
      control: "select",
      options: ["primary", "accent", "secondary", "success", "warning", "error"],
      description: "Color tone preset for the button",
    },
    size: {
      control: "radio",
      options: ["sm", "md", "lg"],
      description: "Padding and sizing preset",
    },
    title: {
      control: "text",
      description: "16px primary title",
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
  },
  args: {
    variant: "solid",
    tone: "primary",
    size: "md",
  },
};

export default meta;

// ==========================================
// STORY 1: Button Variants (Solid, Outline, Ghost)
// ==========================================
export const ButtonVariants: StoryObj = {
  name: "Button Variants",
  render: () => (
    <div className="flex flex-wrap gap-4 items-center">
      <Button variant="solid" tone="primary" title="Solid" />
      <Button variant="outline" tone="primary" title="Outline" />
      <Button variant="ghost" tone="primary" title="Ghost" />
    </div>
  ),
};

// ==========================================
// STORY 2: Layout Combinations & Anatomy (with descriptive labels)
// ==========================================
export const LayoutCombinations: StoryObj = {
  name: "Layout Combinations",
  render: () => (
    <div className="flex flex-col gap-6 items-start text-left">
      {/* 1. Leading Icon + Title */}
      <div className="flex flex-col gap-2 items-start">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Leading Icon + Title
        </span>
        <Button
          tone="primary"
          title="Create New Project"
          leadingIcon={<Plus className="w-5 h-5" />}
        />
      </div>

      {/* 2. Title + Trailing Icon */}
      <div className="flex flex-col gap-2 items-start">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Title + Trailing Icon
        </span>
        <Button
          tone="primary"
          title="Explore Documentation"
          trailingIcon={<ArrowRight className="w-5 h-5" />}
        />
      </div>

      {/* 3. Title + Subtitle */}
      <div className="flex flex-col gap-2 items-start">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Title + Subtitle
        </span>
        <Button
          tone="primary"
          title="Upgrade Workspace"
          subtitle="Access advanced agent workflows"
        />
      </div>

      {/* 4. Full Anatomy (Leading Icon + Title + Subtitle + Trailing Icon) */}
      <div className="flex flex-col gap-2 items-start">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Full Anatomy (Leading Icon + Title + Subtitle + Trailing Icon)
        </span>
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

// ==========================================
// STORY 3: Button States (Loading & Disabled)
// ==========================================
export const ButtonStates: StoryObj = {
  name: "Button States",
  render: () => (
    <div className="flex flex-col gap-6 items-start text-left">
      {/* Loading State Section */}
      <div className="flex flex-col gap-2 items-start">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Loading State
        </span>
        <div className="flex flex-wrap gap-4 items-start">
          {/* 1. Loading with just title */}
          <Button tone="primary" title="Loading Title" isLoading />

          {/* 2. Loading with trailing icon */}
          <Button
            tone="primary"
            title="Loading Action"
            trailingIcon={<ArrowRight className="w-5 h-5" />}
            isLoading
          />

          {/* 3. Loading with title + subtitle + trailing icon */}
          <Button
            tone="primary"
            size="lg"
            title="Deploying Suite"
            subtitle="Please wait while building"
            trailingIcon={<ChevronRight className="w-5 h-5" />}
            isLoading
          />
        </div>
      </div>

      {/* Disabled State Section */}
      <div className="flex flex-col gap-2 items-start">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Disabled State
        </span>
        <div className="flex flex-wrap gap-4 items-start">
          {/* 1. Disabled with just title */}
          <Button tone="primary" title="Disabled Title" disabled />

          {/* 2. Disabled with leading icon (middle component) */}
          <Button
            tone="primary"
            title="Disabled Action"
            leadingIcon={<Lock className="w-5 h-5" />}
            disabled
          />

          {/* 3. Disabled with title + subtitle + trailing icon */}
          <Button
            tone="primary"
            size="lg"
            title="Disabled Suite"
            subtitle="Permission required to execute"
            trailingIcon={<ChevronRight className="w-5 h-5" />}
            disabled
          />
        </div>
      </div>
    </div>
  ),
};

// ==========================================
// STORY 4: Tone Variants (Primary, Accent, Secondary, Success, Warning, Error)
// ==========================================
export const ToneVariants: StoryObj = {
  name: "Tone Variants",
  render: () => (
    <div className="flex flex-wrap gap-4 items-center">
      <Button tone="primary" title="Primary" />
      <Button tone="accent" title="Accent" />
      <Button tone="secondary" title="Secondary" />
      <Button tone="success" title="Success" />
      <Button tone="warning" title="Warning" />
      <Button tone="error" title="Error" />
    </div>
  ),
};

// ==========================================
// STORY 5: Sizes (Small, Medium, Large)
// ==========================================
export const Sizes: StoryObj = {
  name: "Button Sizes",
  render: () => (
    <div className="flex flex-col gap-6 items-start text-left">
      {/* Row 1: Just title and leading icons */}
      <div className="flex flex-col gap-2 items-start">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Title only
        </span>
        <div className="flex flex-wrap items-start gap-4">
          <Button
            tone="primary"
            size="sm"
            title="Small Button"
            leadingIcon={<Plus className="w-4 h-4" />}
          />
          <Button
            tone="primary"
            size="md"
            title="Medium Button (16px)"
            leadingIcon={<Sparkles className="w-5 h-5 text-amber-300" />}
          />
          <Button
            tone="primary"
            size="lg"
            title="Large Button"
            leadingIcon={<Zap className="w-5 h-5 text-amber-300" />}
          />
        </div>
      </div>

      {/* Row 2: Title, subtitle + trailing icons */}
      <div className="flex flex-col gap-2 items-start">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          With subtitle
        </span>
        <div className="flex flex-wrap items-start gap-4">
          <Button
            tone="primary"
            size="sm"
            title="Small Button"
            subtitle="Compact padding"
            trailingIcon={<ArrowRight className="w-4 h-4" />}
          />
          <Button
            tone="primary"
            size="md"
            title="Medium Button (16px)"
            subtitle="Standard padding"
            trailingIcon={<ChevronRight className="w-5 h-5" />}
          />
          <Button
            tone="primary"
            size="lg"
            title="Large Button"
            subtitle="Generous padding"
            trailingIcon={<ArrowRight className="w-5 h-5" />}
          />
        </div>
      </div>
    </div>
  ),
};
