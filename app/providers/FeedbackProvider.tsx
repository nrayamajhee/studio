import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import type { ScreenOverlay } from "../components/home/DeviceScreen";
import { useMomentary } from "./useMomentary";

const NOTICE_MS = 1800;
const OVERLAY_MS = 1200;

export type PendingId = string | number;

interface FeedbackValue {
  overlay: ScreenOverlay | null;
  notice: string | null;
  prompt: string | null;
  // The confirm-to-arm id currently armed ("press again to…").
  pending: PendingId | null;
  saving: ScreenOverlay | null;
  exportingRef: { current: boolean };
  showOverlay: (overlay: ScreenOverlay) => void;
  showNotice: (message: string) => void;
  showPrompt: (message: string) => void;
  hidePrompt: () => void;
  armPending: (id: PendingId) => void;
  showSaving: (done: number) => void;
  setSaving: (overlay: ScreenOverlay | null) => void;
  // What the screen shows over it: saving, then the knob overlay, then a prompt.
  overlayForScreen: ScreenOverlay | undefined;
}

const FeedbackContext = createContext<FeedbackValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [overlay, showOverlay] = useMomentary<ScreenOverlay>(OVERLAY_MS);
  const [notice, showFooterNotice] = useMomentary<string>(NOTICE_MS);
  const [prompt, showPrompt, hidePrompt] = useMomentary<string>(NOTICE_MS);
  const [pending, armPending] = useMomentary<PendingId>(NOTICE_MS);
  const [saving, setSaving] = useState<ScreenOverlay | null>(null);
  const exportingRef = useRef(false);

  const showNotice = (message: string) => {
    hidePrompt();
    showFooterNotice(message);
  };

  const showSaving = (done: number) =>
    setSaving({
      label: "Saving",
      value: done,
      display: `${Math.round(done * 100)}%`,
    });

  const value: FeedbackValue = {
    overlay,
    notice,
    prompt,
    pending,
    saving,
    exportingRef,
    showOverlay,
    showNotice,
    showPrompt,
    hidePrompt,
    armPending,
    showSaving,
    setSaving,
    overlayForScreen:
      saving ?? overlay ?? (prompt ? { label: prompt } : undefined),
  };

  return (
    <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error("Wrap the Device in a FeedbackProvider");
  return context;
}
