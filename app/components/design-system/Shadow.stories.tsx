import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card } from "./Card";
import { Label } from "./Typography";

const meta: Meta<typeof Card> = {
  title: "Design System/Shadow",
  component: Card,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;

const shadowLevels: { name: string; elevation: "low" | "mid" | "high" }[] = [
  {
    name: "Low",
    elevation: "low",
  },
  {
    name: "Mid",
    elevation: "mid",
  },
  {
    name: "High",
    elevation: "high",
  },
];

export const ShadowLevels: StoryObj = {
  name: "Shadow Elevation",
  render: () => (
    <div className="flex flex-col gap-3 items-start">
      <Label>Elevation Levels</Label>
      <div className="flex flex-wrap gap-4 items-start">
        {shadowLevels.map((shadow) => (
          <Card
            key={shadow.name}
            elevation={shadow.elevation}
            className="w-32 h-24 flex items-center justify-center text-center"
          >
            <Label>{shadow.name}</Label>
          </Card>
        ))}
      </div>
    </div>
  ),
};
