import type { ReactNode } from "react";
import { tv } from "../../../lib/utils";
import { useFeedback } from "../../../providers/FeedbackProvider";
import { deviceEngine } from "../deviceEngine";

// The stage centres the Device with a page margin of twice the bezel on wide
// screens, narrowing with the viewport to half of it on phones. The frame is
// the Device's native size (1001px wide; the screen's height at
// --screen-aspect plus 517px of bezels, pad rows, insets and key well, less
// the 21px the screen reaches up into the bezel) scaled to fit: tan(atan2(a,
// b)) divides two lengths into a plain number, so it needs no JavaScript.
// The case is a flex column, clipping the key well that runs out through the
// bottom bezel to its rounded corners.
const device = tv({
  slots: {
    stage:
      "grid size-full place-items-center px-[clamp(calc(var(--spacing-bezel)_/_2),4.5vw,calc(2_*_var(--spacing-bezel)))] [--screen-aspect:2.39] [container-type:size]",
    frame:
      "relative h-[calc(var(--device-height)_*_var(--scale))] w-[calc(1001px_*_var(--scale))] [--device-height:calc(621px_/_var(--screen-aspect)_+_517px)] [--scale:min(1,tan(atan2(100cqw,1001px)),tan(atan2(100cqh,var(--device-height))))]",
    body: "absolute top-0 left-0 flex h-(--device-height) w-[1001px] origin-top-left scale-(--scale) flex-col gap-inset overflow-clip rounded-[88px] bg-device p-bezel shadow-device select-none [corner-shape:squircle]",
  },
});

// The top row spans the pad grid: the screen over the middle eight columns
// (621px wide at --screen-aspect, reaching up into the bezel), a speaker
// grille either side of it, and the knob pairs out past them.
const topRow =
  "grid h-[calc(621px_/_var(--screen-aspect)_-_var(--spacing-bezel)_+_var(--spacing-inset))] grid-cols-[91px_45px_621px_45px_91px] gap-x-inset";

// The knobs line up with the outer edge of the pads below, spread evenly
// over the full height from the Device's top edge to the first pad row.
const knobColumn = tv({
  base: "-mt-bezel -mb-inset flex flex-col justify-evenly [--knob-size:81.6px]",
  variants: {
    side: { left: "items-start", right: "items-end" },
  },
});

export type DeviceFrameProps = {
  className?: string;
  children: ReactNode;
};

// The Device's case, at its fixed native size and scaled uniformly to fit
// its container. It freezes, inert, while the mix saves.
export function DeviceFrame({ className, children }: DeviceFrameProps) {
  const { progress } = useFeedback();
  const busy = progress !== null;
  const { stage, frame, body } = device();
  return (
    <div className={stage({ className })}>
      <div className={frame()}>
        <div
          className={body()}
          role="group"
          aria-label="Synthesizer"
          aria-busy={busy}
          inert={busy}
          onPointerUp={() => deviceEngine.unlock()}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function TopRow({ children }: { children: ReactNode }) {
  return <div className={topRow}>{children}</div>;
}

export type KnobColumnProps = {
  side: "left" | "right";
  children: ReactNode;
};

export function KnobColumn({ side, children }: KnobColumnProps) {
  return <div className={knobColumn({ side })}>{children}</div>;
}
