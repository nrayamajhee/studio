import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./Card";
import { Button } from "./Button";
import { Title, Subtitle, Paragraph, Caption, Label } from "./Typography";
import { Sparkles, ArrowRight, Layers, Star, Check } from "lucide-react";

const meta: Meta<typeof Card> = {
  title: "Design System/Card",
  component: Card,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "bordered", "elevated", "ghost", "interactive", "gradient"],
      description: "Visual style of the card",
    },
    padding: {
      control: "radio",
      options: ["none", "sm", "md", "lg", "xl"],
      description: "Internal padding of the card container",
    },
    rounded: {
      control: "radio",
      options: ["none", "md", "lg", "xl"],
      description: "Corner radius preset",
    },
  },
  args: {
    variant: "bordered",
    padding: "md",
    rounded: "xl",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// 1. Default Card
export const Default: Story = {
  render: (args) => (
    <Card {...args} className="w-[380px]">
      <CardHeader>
        <CardTitle>Project Settings</CardTitle>
        <CardDescription>
          Manage your repository configuration and deployment targets.
        </CardDescription>
      </CardHeader>
      <CardContent className="my-2">
        <Paragraph size="sm" variant="muted">
          Your project is linked to the production cluster. All deployments will be automatically verified.
        </Paragraph>
      </CardContent>
      <CardFooter align="between" bordered>
        <Button variant="ghost" size="sm" title="Cancel" />
        <Button variant="primary" size="sm" title="Save Changes" />
      </CardFooter>
    </Card>
  ),
};

// 2. Full Showcase with all components (Typography, Button, Card)
export const CompleteShowcase: Story = {
  render: () => (
    <Card variant="gradient" padding="lg" rounded="xl" className="w-[420px]">
      <CardHeader bordered>
        <div className="flex items-center justify-between">
          <Caption variant="uppercase">Component Showcase</Caption>
          <div className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
            <Sparkles className="w-3 h-3" /> Pro
          </div>
        </div>
        <Title level={3} size="xl">
          Studio Design Suite
        </Title>
        <Subtitle size="sm">
          Seamlessly composable UI elements powered by Tailwind CSS and CVA.
        </Subtitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 my-2">
        <div className="flex flex-col gap-1">
          <Label size="sm" required>
            Workspace Name
          </Label>
          <input
            type="text"
            defaultValue="production-v2"
            className="w-full px-3 py-2 text-sm rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <Paragraph size="sm" variant="secondary">
          Features 2px bordered buttons, customizable icons, typography scale, and dark mode.
        </Paragraph>
      </CardContent>

      <CardFooter align="between" bordered>
        <Caption variant="mono">v2.0.0</Caption>
        <Button
          variant="primary"
          size="md"
          title="Get Started"
          trailingIcon={<ArrowRight className="w-4 h-4" />}
        />
      </CardFooter>
    </Card>
  ),
};

// 3. Interactive Card
export const Interactive: Story = {
  render: () => (
    <Card variant="interactive" padding="md" className="w-[360px]">
      <CardHeader>
        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-2">
          <Layers className="w-5 h-5" />
        </div>
        <CardTitle>Interactive Card</CardTitle>
        <CardDescription>
          Hover over this card to see smooth elevation and border transitions.
        </CardDescription>
      </CardHeader>
    </Card>
  ),
};

// 4. Elevated Card
export const Elevated: Story = {
  render: () => (
    <Card variant="elevated" padding="lg" className="w-[360px]">
      <CardHeader>
        <CardTitle>Elevated Elevation</CardTitle>
        <CardDescription>
          Subtle drop shadow suitable for modal dialogs and highlighted content.
        </CardDescription>
      </CardHeader>
      <CardFooter align="right">
        <Button variant="accent" size="sm" title="Action" />
      </CardFooter>
    </Card>
  ),
};
