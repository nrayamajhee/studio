import type { CSSProperties } from "react";
import { tv } from "../../lib/utils";
import type { GraphScene, SceneLabel, Tone } from "./synthGraphs";

const TONES: Record<Tone, string> = {
  ink: "var(--color-screen-ink)",
  dim: "color-mix(in srgb, var(--color-screen-ink) 55%, transparent)",
  faint: "color-mix(in srgb, var(--color-screen-ink) 18%, transparent)",
  green: "var(--color-synth-green)",
  red: "var(--color-synth-red)",
  blue: "var(--color-synth-blue)",
};

const synthGraph = tv({
  slots: {
    base: "relative min-h-0 w-full flex-1",
    svg: "absolute inset-0 size-full overflow-visible",
    label:
      "pointer-events-none absolute font-screen text-[11px] leading-[13px] tracking-[0.02em] whitespace-nowrap",
  },
});
const ui = synthGraph();

const SHIFT_X = { start: "0", middle: "-50%", end: "-100%" } as const;
const SHIFT_Y = { top: "0", middle: "-50%", bottom: "-100%" } as const;

const labelStyle = ({
  x,
  y,
  tone = "dim",
  align = "start",
  anchor = "top",
}: SceneLabel): CSSProperties => ({
  left: `${x}%`,
  top: `${y}%`,
  color: TONES[tone],
  transform: `translate(${SHIFT_X[align]}, ${SHIFT_Y[anchor]})`,
});

export type SynthGraphProps = {
  scene: GraphScene;
  // What the graph shows, for screen readers.
  label: string;
  className?: string;
};

// A Synth page's graph: its lines stretched over the space they're given,
// keeping their pixel widths, with labels in screen type laid over them.
export function SynthGraph({ scene, label, className }: SynthGraphProps) {
  return (
    <div className={ui.base({ className })} role="img" aria-label={label}>
      <svg
        className={ui.svg()}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {scene.paths.map((path, i) => (
          <path
            key={i}
            d={path.d}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeDasharray={path.dashed ? "3 3" : undefined}
            style={
              path.fill
                ? {
                    fill: TONES[path.tone],
                    fillOpacity: path.solid ? 1 : 0.16,
                    stroke: "none",
                  }
                : {
                    fill: "none",
                    stroke: TONES[path.tone],
                    strokeWidth: path.width ?? 1,
                  }
            }
          />
        ))}
      </svg>
      {scene.labels.map((entry, i) => (
        <span
          key={i}
          className={ui.label()}
          style={labelStyle(entry)}
          aria-hidden="true"
        >
          {entry.text}
        </span>
      ))}
    </div>
  );
}
