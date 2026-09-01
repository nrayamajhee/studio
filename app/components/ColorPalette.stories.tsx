import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta = {
  title: "Design System/Color Palette",
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
};

export default meta;

export const ColorPalette: StoryObj = {
  name: "Color Palette",
  render: () => (
    <div className="flex flex-col gap-6 items-start">
      {/* Row 1: Button Colors */}
      <div className="flex flex-wrap gap-3 items-start">
        <div className="w-24 h-24 bg-[#2554d7]" />
        <div className="w-24 h-24 bg-[#7c3aed]" />
        <div className="w-24 h-24 bg-[#059669]" />
        <div className="w-24 h-24 bg-[#ea580c]" />
        <div className="w-24 h-24 bg-[#dc2626]" />
      </div>

      {/* Row 2: Background Colors & Cream Whites */}
      <div className="flex flex-wrap gap-3 items-start">
        <div className="w-24 h-24 bg-[#fdfbf7]" />
        <div className="w-24 h-24 bg-[#fffefc]" />
        <div className="w-24 h-24 bg-[#f9f7f2]" />
        <div className="w-24 h-24 bg-[#f6f4f0]" />
        <div className="w-24 h-24 bg-[#141211]" />
        <div className="w-24 h-24 bg-[#1c1917]" />
      </div>

      {/* Row 3: Text Colors */}
      <div className="flex flex-wrap gap-3 items-start">
        <div className="w-24 h-24 bg-[#1c1917]" />
        <div className="w-24 h-24 bg-[#78716c]" />
      </div>
    </div>
  ),
};
