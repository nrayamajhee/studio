import { memo } from "react";
import { tv } from "../../../lib/utils";

// Ten columns of holes, in rows along the screen's straight sides, with the
// four corner holes left undrilled so the field reads as rounded: a hole is
// drilled if it lies within a one-hole radius of the field's inner rectangle.
const COLUMNS = 10;
const ROWS = 52;
const RADIUS = 1;
const DRILLED = Array.from({ length: COLUMNS * ROWS }, (_, hole) => {
  const column = hole % COLUMNS;
  const row = Math.floor(hole / COLUMNS);
  const x = Math.max(0, RADIUS - column, column - (COLUMNS - 1 - RADIUS));
  const y = Math.max(0, RADIUS - row, row - (ROWS - 1 - RADIUS));
  return x * x + y * y <= RADIUS * RADIUS;
});

// Whole-pixel gaps and a whole-pixel start keep the rows even on a 2×
// display; 52 rows leave the same margin at the bottom.
const grille = tv({
  slots: {
    field:
      "mt-[calc(var(--spacing-inset)_-_var(--spacing-bezel))] grid auto-rows-[2.5px] grid-cols-[repeat(10,2.5px)] content-start justify-center gap-[2px] overflow-hidden pt-[14px]",
    hole: "rounded-[50%] bg-grille-hole shadow-grille-hole",
  },
  variants: {
    // A corner left undrilled keeps its place in the grid.
    drilled: { false: { hole: "invisible" } },
  },
});

const { field } = grille();
const HOLES = DRILLED.map((drilled) => grille({ drilled }).hole());

// A cosmetic speaker grille, drilled into the case either side of the
// screen. Memoized: it never changes, and the Device re-renders on every
// knob turn.
export const Grille = memo(function Grille() {
  return (
    <span className={field()} aria-hidden="true">
      {HOLES.map((className, hole) => (
        <span key={hole} className={className} />
      ))}
    </span>
  );
});
