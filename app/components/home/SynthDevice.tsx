import { DeviceProviders } from "../../providers/DeviceProviders";
import { ChordBank } from "./banks/ChordBank";
import { ControlBank } from "./banks/ControlBank";
import { PresetBank } from "./banks/PresetBank";
import { ViewBank } from "./banks/ViewBank";
import {
  BankColumn,
  DeviceFrame,
  KnobColumn,
  PadBanks,
  TopRow,
} from "./layout/DeviceLayout";
import { DeviceKnob } from "./parts/DeviceKnob";
import { Display } from "./parts/Display";
import { Grille } from "./parts/Grille";
import { Keybed } from "./parts/Keybed";

export type SynthDeviceProps = {
  className?: string;
};

// The Device: knobs either side of the screen, three rows of pads and the
// keybed. Each view is a mode that rebinds them (see modes/).
export function SynthDevice({ className }: SynthDeviceProps) {
  return (
    <DeviceProviders>
      <DeviceFrame className={className}>
        <TopRow>
          <KnobColumn side="left">
            <DeviceKnob slot="chalk" />
            <DeviceKnob slot="green" />
          </KnobColumn>
          <Grille />
          <Display />
          <Grille />
          <KnobColumn side="right">
            <DeviceKnob slot="red" />
            <DeviceKnob slot="blue" />
          </KnobColumn>
        </TopRow>
        <PadBanks>
          <ControlBank />
          <BankColumn>
            <ViewBank />
            <PresetBank />
            <ChordBank />
          </BankColumn>
        </PadBanks>
        <Keybed />
      </DeviceFrame>
    </DeviceProviders>
  );
}
