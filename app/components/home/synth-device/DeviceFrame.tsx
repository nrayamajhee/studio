import { deviceEngine } from "../deviceEngine";
import { cn } from "../../../lib/utils";
import { useFeedback } from "../../../providers/FeedbackProvider";
import styles from "../SynthDevice.module.css";
import { Grille } from "./Grille";
import { Keybed } from "./Keybed";
import { LeftKnobs } from "./LeftKnobs";
import { PadBanks } from "./PadBanks";
import { RightKnobs } from "./RightKnobs";
import { ScreenSlot } from "./ScreenSlot";

export function DeviceFrame({ className }: { className?: string }) {
  const { saving } = useFeedback();
  return (
    <div className={cn(styles.stage, className)}>
      <div className={styles.frame}>
        <div
          className={styles.device}
          role="group"
          aria-label="Synthesizer"
          aria-busy={saving !== null}
          inert={saving !== null}
          onPointerUp={() => deviceEngine.unlock()}
        >
          <div className={styles.topRow}>
            <LeftKnobs />
            <Grille />
            <ScreenSlot />
            <Grille />
            <RightKnobs />
          </div>
          <PadBanks />
          <Keybed />
        </div>
      </div>
    </div>
  );
}
