import { useRef, useState, type ReactNode } from "react";
import type { ScreenOverlay } from "../components/home/DeviceScreen";
import { useMomentary } from "../hooks/useMomentary";
import { createStrictContext } from "./createStrictContext";

const NOTICE_MS = 1800;
const OVERLAY_MS = 1200;

function useFeedbackValue() {
  const [overlay, showOverlay] = useMomentary<ScreenOverlay>(OVERLAY_MS);
  const [notice, showFooterNotice] = useMomentary<string>(NOTICE_MS);
  // What needs attention shows over the screen, like the volume: "Press again
  // to…" for as long as the second press counts (whatever the press then does
  // clears it), and what to do first when a press can't act.
  const [prompt, showPrompt, hidePrompt] = useMomentary<string>(NOTICE_MS);
  // A press that acts only on a second press (delete, bind, revert…), armed
  // while its prompt shows.
  const [pending, arm, disarm] = useMomentary<string>(NOTICE_MS);
  // While the mix saves, the Device freezes under an overlay of its progress
  // (rendering the tracks, then the file), which goes once the file is
  // handed over.
  const busy = useRef(false);
  const [progress, setProgress] = useState<ScreenOverlay | null>(null);

  const showNotice = (message: string) => {
    hidePrompt();
    showFooterNotice(message);
  };

  return {
    notice,
    prompt,
    overlay,
    progress,
    pending,
    showNotice,
    showPrompt,
    showOverlay,
    // True on the second press of `key` while it is armed; otherwise arms it
    // and asks for that press.
    confirm: (key: string, message: string) => {
      if (pending === key) {
        disarm();
        return true;
      }
      arm(key);
      showPrompt(message);
      return false;
    },
    isBusy: () => busy.current,
    whileBusy: async (task: () => Promise<void>) => {
      busy.current = true;
      try {
        await task();
      } finally {
        busy.current = false;
        setProgress(null);
      }
    },
    showProgress: (done: number) =>
      setProgress({
        label: "Saving",
        value: done,
        display: `${Math.round(done * 100)}%`,
      }),
  };
}

export type FeedbackValue = ReturnType<typeof useFeedbackValue>;

const [FeedbackContext, useFeedback] =
  createStrictContext<FeedbackValue>("FeedbackProvider");
export { useFeedback };

// Notices, prompts, the level overlay and second-press confirmations on the
// Device's screen, and freezing it while the mix saves.
export function FeedbackProvider({ children }: { children: ReactNode }) {
  return (
    <FeedbackContext value={useFeedbackValue()}>{children}</FeedbackContext>
  );
}
