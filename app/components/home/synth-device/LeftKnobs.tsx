import { Knob } from "../../design-system";
import styles from "../SynthDevice.module.css";
import { useKnobSpecs } from "./useKnobSpecs";

export function LeftKnobs() {
  const [topLeft, bottomLeft] = useKnobSpecs();
  return (
    <div className={styles.knobColumn}>
      <Knob {...topLeft} />
      <Knob {...bottomLeft} />
    </div>
  );
}
