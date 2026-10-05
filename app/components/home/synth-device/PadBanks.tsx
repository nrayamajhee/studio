import styles from "../SynthDevice.module.css";
import { ChordBank } from "./ChordBank";
import { ControlsBank } from "./ControlsBank";
import { EditBank } from "./EditBank";
import { PresetBank } from "./PresetBank";
import { TransportBank } from "./TransportBank";
import { ViewsBank } from "./ViewsBank";

export function PadBanks() {
  return (
    <div
      className={styles.banks}
      data-focus-group="pads"
      data-focus-order="rows"
    >
      <div className={styles.padRow}>
        <TransportBank />
        <ViewsBank />
      </div>
      <div className={styles.padRow}>
        <EditBank />
        <PresetBank />
      </div>
      <div className={styles.padRow}>
        <ControlsBank />
        <ChordBank />
      </div>
    </div>
  );
}
