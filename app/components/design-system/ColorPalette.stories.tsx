import type { Meta, StoryObj } from "@storybook/react-vite";
import { Label } from "./Typography";
import { cn } from "../../lib/utils";

const meta: Meta = {
  title: "Design System/Color Palette",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;

const buttonColors = [
  {
    name: "Primary (Blue)",
    className: "bg-primary text-white border-transparent",
    labelClass: "text-white",
  },
  {
    name: "Info (Blue)",
    className: "bg-info text-white border-transparent",
    labelClass: "text-white",
  },
  {
    name: "Accent",
    className: "bg-accent text-white border-transparent",
    labelClass: "text-white",
  },
  {
    name: "Success",
    className: "bg-success text-white border-transparent",
    labelClass: "text-white",
  },
  {
    name: "Warning",
    className: "bg-warning text-white border-transparent",
    labelClass: "text-white",
  },
  {
    name: "Error",
    className: "bg-error text-white border-transparent",
    labelClass: "text-white",
  },
];

const surfaceColors = [
  {
    name: "Surface",
    className:
      "bg-surface text-stone-800 border-stone-300 dark:border-stone-700",
    labelClass: "text-stone-800",
  },
  {
    name: "Surface Light",
    className:
      "bg-surface-light text-stone-800 border-stone-200 dark:border-stone-700",
    labelClass: "text-stone-800",
  },
  {
    name: "Surface Dark",
    className: "bg-surface-dark text-white border-stone-700",
    labelClass: "text-white",
  },
];

const fontColors = [
  {
    name: "Font",
    className: "bg-font text-white border-stone-700",
    labelClass: "text-white",
  },
  {
    name: "Font Light",
    className: "bg-font-light text-white border-stone-600",
    labelClass: "text-white",
  },
  {
    name: "Font Dark",
    className: "bg-font-dark text-white border-stone-700",
    labelClass: "text-white",
  },
];

export const Default: StoryObj = {
  name: "Color Palette",
  render: () => (
    <div className="flex flex-col gap-8 items-start">
      <div className="flex flex-col gap-3">
        <Label>Button Colors</Label>
        <div className="flex flex-wrap gap-3 items-start">
          {buttonColors.map((color) => (
            <div
              key={color.name}
              className={cn(
                "w-32 h-24 rounded-lg flex items-center justify-center text-center shadow-sm border transition-all",
                color.className,
              )}
            >
              <Label className={color.labelClass}>{color.name}</Label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Label>Surface Colors</Label>
        <div className="flex flex-wrap gap-3 items-start">
          {surfaceColors.map((color) => (
            <div
              key={color.name}
              className={cn(
                "w-32 h-24 rounded-lg flex items-center justify-center text-center shadow-sm border transition-all",
                color.className,
              )}
            >
              <Label className={color.labelClass}>{color.name}</Label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Label>Font Colors</Label>
        <div className="flex flex-wrap gap-3 items-start">
          {fontColors.map((color) => (
            <div
              key={color.name}
              className={cn(
                "w-32 h-24 rounded-lg flex items-center justify-center text-center shadow-sm border transition-all",
                color.className,
              )}
            >
              <Label className={color.labelClass}>{color.name}</Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
};
