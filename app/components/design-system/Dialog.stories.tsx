import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "./Dialog";
import { Button } from "./Button";

const meta: Meta = {
  title: "Design System/Dialog",
  component: Dialog,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="solid" tone="primary" size="sm">
          Open Dialog
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>
            This is an accessible modal dialog built with Radix UI.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 text-sm text-stone-600 dark:text-stone-300">
          Dialog content goes here. It supports any arbitrary layout or inputs.
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" tone="secondary" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button variant="solid" tone="primary" size="sm">
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const CustomContent: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" tone="secondary" size="sm">
          Settings Modal
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Audio Settings</DialogTitle>
          <DialogDescription>
            Adjust your output device and sample rate settings.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <span className="text-xs font-medium text-stone-700 dark:text-stone-300">
              Output Device
            </span>
            <div className="p-2 text-xs rounded-lg border border-stone-200 dark:border-[#1f2533] bg-stone-50 dark:bg-[#06080c] text-stone-800 dark:text-stone-200">
              Default Audio Output (Speakers)
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="solid" tone="primary" size="sm">
              Done
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
