import type { Dispatch, SetStateAction } from "react";
import type { ScreenView } from "../components/home/DeviceScreen";
import type { FeedbackValue } from "../providers/FeedbackProvider";
import type { LanesValue } from "../providers/LanesProvider";
import type { MixValue } from "../providers/MixProvider";
import type { OutputValue } from "../providers/OutputProvider";
import type { PerformanceValue } from "../providers/PerformanceProvider";
import type { PreviewValue } from "../providers/PreviewProvider";
import type { ShiftValue } from "../providers/ShiftProvider";
import type { SoundValue } from "../providers/SoundProvider";
import type { StepsValue } from "../providers/StepsProvider";
import type { TapeValue } from "../providers/TapeProvider";
import type { TracksValue } from "../providers/TracksProvider";
import type { TransportValue } from "../providers/TransportProvider";
import type { ViewValue } from "../providers/ViewProvider";

// The tile pickers' highlighted tiles, and the green knob's resting place
// where it has nothing to move.
export type Browse = {
  iconIndex: number;
  setIconIndex: Dispatch<SetStateAction<number>>;
  presetIndex: number;
  setPresetIndex: Dispatch<SetStateAction<number>>;
  chordIndex: number;
  setChordIndex: Dispatch<SetStateAction<number>>;
  progressionIndex: number;
  setProgressionIndex: Dispatch<SetStateAction<number>>;
  beatIndex: number;
  setBeatIndex: Dispatch<SetStateAction<number>>;
  revertIndex: number;
  setRevertIndex: Dispatch<SetStateAction<number>>;
  idleSeek: number;
  setIdleSeek: Dispatch<SetStateAction<number>>;
};

// Everything a mode reads and acts on: the Device's state, from its
// providers.
export type Device = {
  view: ScreenView;
  shift: boolean;
  views: ViewValue;
  latch: ShiftValue;
  feedback: FeedbackValue;
  output: OutputValue;
  transport: TransportValue;
  sound: SoundValue;
  performance: PerformanceValue;
  lanes: LanesValue;
  steps: StepsValue;
  tracks: TracksValue;
  mix: MixValue;
  tape: TapeValue;
  preview: PreviewValue;
  browse: Browse;
};
