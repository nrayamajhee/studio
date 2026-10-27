import type { Decorator } from "@storybook/react-vite";
import { DeviceProviders } from "../../../providers/DeviceProviders";
import { HotkeyProvider } from "../../../providers/HotkeyProvider";
import type { ScreenView } from "../DeviceScreen";

// A part inside the Device's providers, in the view `parameters.device.view`
// opens (the scope unless set).
export const withDevice: Decorator<object> = (Story, { parameters }) => (
  <HotkeyProvider>
    <DeviceProviders
      initialView={parameters.device?.view as ScreenView | undefined}
    >
      <Story />
    </DeviceProviders>
  </HotkeyProvider>
);
