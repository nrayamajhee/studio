import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card } from "./Card";
import { Label } from "./Typography";

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
      "bg-surface-light text-stone-800 border-stone-200 dark:border-stone-800",
    labelClass: "text-stone-800",
  },
  {
    name: "Surface Dark",
    className: "bg-surface-dark text-white border-transparent",
    labelClass: "text-white",
  },
];

const fontColors = [
  {
    name: "Font",
    className: "bg-font text-white border-transparent",
    labelClass: "text-white",
  },
  {
    name: "Font Light",
    className: "bg-font-light text-white border-transparent",
    labelClass: "text-white",
  },
  {
    name: "Font Dark",
    className: "bg-font-dark text-white border-transparent",
    labelClass: "text-white",
  },
];

export const ColorPalette: StoryObj = {
  name: "Color Palette",
  render: () => (
    <div className="flex flex-col gap-8 items-start">
      <div className="flex flex-col gap-3">
        <Label>Button Colors</Label>
        <div className="flex flex-wrap gap-3 items-start">
          {buttonColors.map((color) => (
            <Card
              key={color.name}
              className={`w-32 h-24 flex items-center justify-center text-center ${color.className}`}
            >
              <Label className={color.labelClass}>{color.name}</Label>
            </Card>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Label>Surface Colors</Label>
        <div className="flex flex-wrap gap-3 items-start">
          {surfaceColors.map((color) => (
            <Card
              key={color.name}
              className={`w-32 h-24 flex items-center justify-center text-center ${color.className}`}
            >
              <Label className={color.labelClass}>{color.name}</Label>
            </Card>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Label>Font Colors</Label>
        <div className="flex flex-wrap gap-3 items-start">
          {fontColors.map((color) => (
            <Card
              key={color.name}
              className={`w-32 h-24 flex items-center justify-center text-center ${color.className}`}
            >
              <Label className={color.labelClass}>{color.name}</Label>
            </Card>
          ))}
        </div>
      </div>
    </div>
  ),
};
