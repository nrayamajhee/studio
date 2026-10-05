import { memo } from "react";
import styles from "../SynthDevice.module.css";

// Ten columns of holes, in rows along the screen's straight sides, with the
// four corner holes left undrilled so the field reads as rounded: a hole is
// drilled if it lies within a one-hole radius of the field's inner rectangle.
const GRILLE_COLUMNS = 10;
const GRILLE_ROWS = 52;
const GRILLE_RADIUS = 1;
const GRILLE_DRILLED = Array.from(
  { length: GRILLE_COLUMNS * GRILLE_ROWS },
  (_, hole) => {
    const column = hole % GRILLE_COLUMNS;
    const row = Math.floor(hole / GRILLE_COLUMNS);
    const x = Math.max(
      0,
      GRILLE_RADIUS - column,
      column - (GRILLE_COLUMNS - 1 - GRILLE_RADIUS),
    );
    const y = Math.max(
      0,
      GRILLE_RADIUS - row,
      row - (GRILLE_ROWS - 1 - GRILLE_RADIUS),
    );
    return x * x + y * y <= GRILLE_RADIUS * GRILLE_RADIUS;
  },
);

// A cosmetic speaker grille either side of the screen. Memoized: it never
// changes, and the Device re-renders on every knob turn.
export const Grille = memo(function Grille() {
  return (
    <span className={styles.grille} aria-hidden="true">
      {GRILLE_DRILLED.map((drilled, hole) => (
        <span key={hole} data-blank={!drilled || undefined} />
      ))}
    </span>
  );
});
