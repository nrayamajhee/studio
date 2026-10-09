import type { ReactNode } from "react";
import type { ScreenView } from "../components/home/DeviceScreen";
import { FeedbackProvider } from "./FeedbackProvider";
import { LanesProvider } from "./LanesProvider";
import { MixProvider } from "./MixProvider";
import { ModeProvider } from "./ModeProvider";
import { OutputProvider } from "./OutputProvider";
import { PerformanceProvider } from "./PerformanceProvider";
import { PreviewProvider } from "./PreviewProvider";
import { ShiftProvider } from "./ShiftProvider";
import { SoundProvider } from "./SoundProvider";
import { StepsProvider } from "./StepsProvider";
import { TapeProvider } from "./TapeProvider";
import { TracksProvider } from "./TracksProvider";
import { TransportProvider } from "./TransportProvider";
import { ViewProvider } from "./ViewProvider";

// The Device's state, each provider reading only those around it. Inside a
// HotkeyProvider.
export function DeviceProviders({
  initialView,
  children,
}: {
  initialView?: ScreenView;
  children: ReactNode;
}) {
  return (
    <FeedbackProvider>
      <ShiftProvider>
        <ViewProvider initialView={initialView}>
          <TransportProvider>
            <OutputProvider>
              <SoundProvider>
                <PerformanceProvider>
                  <LanesProvider>
                    <StepsProvider>
                      <TracksProvider>
                        <MixProvider>
                          <TapeProvider>
                            <PreviewProvider>
                              <ModeProvider>{children}</ModeProvider>
                            </PreviewProvider>
                          </TapeProvider>
                        </MixProvider>
                      </TracksProvider>
                    </StepsProvider>
                  </LanesProvider>
                </PerformanceProvider>
              </SoundProvider>
            </OutputProvider>
          </TransportProvider>
        </ViewProvider>
      </ShiftProvider>
    </FeedbackProvider>
  );
}
