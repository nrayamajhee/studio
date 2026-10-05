import { Knob } from "../../design-system";
import styles from "../SynthDevice.module.css";
import { useKnobSpecs } from "./useKnobSpecs";

export function RightKnobs() {
  const [, , topRight, bottomRight] = useKnobSpecs();
  return (
    <div className={styles.knobColumn}>
      <Knob {...topRight} />
      <Knob {...bottomRight} />
    </div>
  );
}
