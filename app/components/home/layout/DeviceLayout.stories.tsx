import type { Meta, StoryObj } from "@storybook/react-vite";
import { Square } from "lucide-react";
import { FeedbackProvider } from "../../../providers/FeedbackProvider";
import { Knob, Pad } from "../../design-system";
import { DeviceScreen } from "../DeviceScreen";
import { Grille } from "../parts/Grille";
import {
  Bank,
  BankColumn,
  DeviceFrame,
  KnobColumn,
  PadBanks,
  TopRow,
} from "./DeviceLayout";

const pads = (count: number) =>
  Array.from({ length: count }, (_, i) => (
    <Pad key={i} label={`Pad ${i + 1}`}>
      <Square />
    </Pad>
  ));

// The case with every slot filled by a plain part: two knobs each side of
// the screen and its grilles, then a block of twelve pads beside a column of
// three eight-pad banks.
const skeleton = (
  <>
    <TopRow>
      <KnobColumn side="left">
        <Knob label="White" step={5} color="var(--color-synth-chalk)" />
        <Knob label="Green" step={5} color="var(--color-synth-green)" />
      </KnobColumn>
      <Grille />
      <DeviceScreen
        className="mt-[calc(var(--spacing-inset)_-_var(--spacing-bezel))]"
        title="Screen"
        status=""
        footer={["", ""]}
      />
      <Grille />
      <KnobColumn side="right">
        <Knob label="Red" step={5} color="var(--color-synth-red)" />
        <Knob label="Blue" step={5} color="var(--color-synth-blue)" />
      </KnobColumn>
    </TopRow>
    <PadBanks>
      <Bank label="Block" layout="block">
        {pads(12)}
      </Bank>
      <BankColumn>
        <Bank label="First row">{pads(8)}</Bank>
        <Bank label="Second row">{pads(8)}</Bank>
        <Bank label="Third row">{pads(8)}</Bank>
      </BankColumn>
    </PadBanks>
  </>
);

const meta = {
  title: "Home/Layout",
  component: DeviceFrame,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The case and its grid. `DeviceFrame` scales the fixed-size Device to fit and freezes it while the mix saves; `TopRow`, `KnobColumn`, `PadBanks`, `BankColumn` and `Bank` place the parts. Shown here with plain parts in every slot.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="h-[640px] w-full">
        <FeedbackProvider>
          <Story />
        </FeedbackProvider>
      </div>
    ),
  ],
  args: { children: skeleton },
  argTypes: { children: { control: false } },
} satisfies Meta<typeof DeviceFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
