import type { Meta, StoryObj } from "@storybook/react-vite";
import { HotkeyProvider } from "../../providers/HotkeyProvider";
import { SynthDevice } from "./SynthDevice";

const meta = {
  title: "Home/Device",
  component: SynthDevice,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "**The Device**: a desktop synthesizer with four knobs, a screen, three rows of pads and a keybed. Every view is a mode that rebinds the same controls (see `modes/`); its state comes from `DeviceProviders`.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="h-[640px] w-full">
        <HotkeyProvider>
          <Story />
        </HotkeyProvider>
      </div>
    ),
  ],
} satisfies Meta<typeof SynthDevice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
