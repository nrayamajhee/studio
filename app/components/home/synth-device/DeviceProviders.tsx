import type { ReactNode } from "react";
import { DeviceProvider } from "../../../providers/DeviceProvider";
import { FeedbackProvider } from "../../../providers/FeedbackProvider";
import { HotkeyProvider } from "../../../providers/HotkeyProvider";
import { MasterLevelProvider } from "../../../providers/MasterLevelProvider";
import { ModuleProvider } from "../../../providers/ModuleProvider";
import { PerformanceProvider } from "../../../providers/PerformanceProvider";
import { SequencerProvider } from "../../../providers/SequencerProvider";
import { SoundProvider } from "../../../providers/SoundProvider";
import { TracksProvider } from "../../../providers/TracksProvider";
import { TransportProvider } from "../../../providers/TransportProvider";
import { ViewProvider } from "../../../providers/ViewProvider";

// The Device's state, outermost first: input, feedback, navigation, master
// level, transport, sound, sequencer, performance, tracks, modules, then the
// controller that composes them.
export function DeviceProviders({ children }: { children: ReactNode }) {
  return (
    <HotkeyProvider>
      <FeedbackProvider>
        <ViewProvider>
          <MasterLevelProvider>
            <TransportProvider>
              <SoundProvider>
                <SequencerProvider>
                  <PerformanceProvider>
                    <TracksProvider>
                      <ModuleProvider>
                        <DeviceProvider>{children}</DeviceProvider>
                      </ModuleProvider>
                    </TracksProvider>
                  </PerformanceProvider>
                </SequencerProvider>
              </SoundProvider>
            </TransportProvider>
          </MasterLevelProvider>
        </ViewProvider>
      </FeedbackProvider>
    </HotkeyProvider>
  );
}
