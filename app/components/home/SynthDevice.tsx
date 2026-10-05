import { DeviceFrame } from "./synth-device/DeviceFrame";
import { DeviceProviders } from "./synth-device/DeviceProviders";

export interface SynthDeviceProps {
  className?: string;
}

export function SynthDevice({ className }: SynthDeviceProps) {
  return (
    <DeviceProviders>
      <DeviceFrame className={className} />
    </DeviceProviders>
  );
}
