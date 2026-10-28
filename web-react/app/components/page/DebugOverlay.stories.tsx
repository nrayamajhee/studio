import type { Meta, StoryObj } from "@storybook/react-vite";
import { useArgs } from "storybook/preview-api";
import { fn } from "storybook/test";
import { DebugOverlay, type DebugOverlayProps } from "./DebugOverlay";

const meta = {
  title: "Page/Debug Overlay",
  component: DebugOverlay,
  tags: ["autodocs"],
  args: { open: true, onOpenChange: fn() },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A dark see-through panel showing the app's state kept in `localStorage`: its keys, and the picked one's state, read live from its store, as pretty-printed JSON; ⌘D (Ctrl D) or the footer's Debug link opens and closes it on the home page.",
      },
      story: { inline: false, iframeHeight: 560 },
    },
  },
} satisfies Meta<typeof DebugOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render(args) {
    const [, updateArgs] = useArgs<DebugOverlayProps>();
    return (
      <DebugOverlay
        {...args}
        onOpenChange={(open) => {
          updateArgs({ open });
          args.onOpenChange(open);
        }}
      />
    );
  },
};
