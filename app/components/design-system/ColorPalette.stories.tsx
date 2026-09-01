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
    name: "Primary",
    className: "bg-[#2554d7] text-white border-transparent",
    labelClass: "text-white",
  },
  {
    name: "Accent",
    className: "bg-[#7c3aed] text-white border-transparent",
    labelClass: "text-white",
  },
  {
    name: "Success",
    className: "bg-[#059669] text-white border-transparent",
    labelClass: "text-white",
  },
  {
    name: "Warning",
    className: "bg-[#ea580c] text-white border-transparent",
    labelClass: "text-white",
  },
  {
    name: "Error",
    className: "bg-[#dc2626] text-white border-transparent",
    labelClass: "text-white",
  },
];

const backgroundColors = [
  {
    name: "Canvas",
    className: "bg-[#f6f4f0] text-stone-800 border-stone-300 dark:border-stone-700",
    labelClass: "text-stone-800",
  },
  {
    name: "Surface",
    className: "bg-[#ffffff] text-stone-800 border-stone-200 dark:border-stone-800",
    labelClass: "text-stone-800",
  },
  {
    name: "Subtle",
    className: "bg-[#fdfbf7] text-stone-800 border-stone-200 dark:border-stone-800",
    labelClass: "text-stone-800",
  },
];

const textColors = [
  {
    name: "Primary Text",
    className: "bg-[#1c1917] text-white border-transparent",
    labelClass: "text-white",
  },
  {
    name: "Secondary Text",
    className: "bg-[#78716c] text-white border-transparent",
    labelClass: "text-white",
  },
  {
    name: "Muted Text",
    className: "bg-[#a8a29e] text-stone-900 border-transparent",
    labelClass: "text-stone-900",
  },
];

export const ColorPalette: StoryObj = {
  name: "Color Palette",
  render: () => (
    <div className="flex flex-col gap-8 items-start">
      {/* Row 1: Button Colors */}
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

      {/* Row 2: Background Colors */}
      <div className="flex flex-col gap-3">
        <Label>Background Colors</Label>
        <div className="flex flex-wrap gap-3 items-start">
          {backgroundColors.map((color) => (
            <Card
              key={color.name}
              className={`w-32 h-24 flex items-center justify-center text-center ${color.className}`}
            >
              <Label className={color.labelClass}>{color.name}</Label>
            </Card>
          ))}
        </div>
      </div>

      {/* Row 3: Text Colors */}
      <div className="flex flex-col gap-3">
        <Label>Text Colors</Label>
        <div className="flex flex-wrap gap-3 items-start">
          {textColors.map((color) => (
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
