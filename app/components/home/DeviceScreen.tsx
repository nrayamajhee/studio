import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../design-system/Button";
import { Oscilloscope } from "./Oscilloscope";
import styles from "./DeviceScreen.module.css";

export type ScreenView = "scope" | "synth" | "save" | "presets" | "adsr";

export interface ScreenParam {
  id: string;
  label: string;
  value: string;
  // The param the red and blue knobs are editing.
  selected?: boolean;
}

export interface ScreenTile {
  id: string;
  label: string;
  icon: ReactNode;
  // Small caption on the tile, e.g. the pads a preset is bound to.
  badge?: string;
}

// One ADSR stage, in A, D, S, R order.
export interface ScreenEnvelopeStage {
  label: string;
  display: string;
  // 0–1: the knob position for times, the level for sustain.
  amount: number;
}

// A, D, S, R in the colours of the knobs that set them.
const STAGE_COLORS = [
  "#f4f3ef",
  "var(--synth-green, #4ba078)",
  "var(--synth-red, #cd5951)",
  "var(--synth-blue, #2f7de1)",
];

// Drawn across a fixed 100 × 40 box: attack, decay and release widen with their
// knobs, sustain fills the rest at its level, and decay and release curve like
// the engine's exponential segments.
function EnvelopeGraph({ stages }: { stages: readonly ScreenEnvelopeStage[] }) {
  const [attack, decay, sustain, release] = stages.map(({ amount }) => amount);
  const top = 2;
  const bottom = 38;
  const level = bottom - (bottom - top) * sustain;
  const x1 = 2 + 23 * attack;
  const x2 = x1 + 2 + 23 * decay;
  const x4 = 100;
  const x3 = x4 - (2 + 28 * release);
  const segments = [
    `M0 ${bottom} L${x1} ${top}`,
    `M${x1} ${top} Q${x1} ${level} ${x2} ${level}`,
    `M${x2} ${level} L${x3} ${level}`,
    `M${x3} ${level} Q${x3} ${bottom} ${x4} ${bottom}`,
  ];
  return (
    <svg
      className={styles.envelopeGraph}
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={`M0 ${bottom} L${x1} ${top} Q${x1} ${level} ${x2} ${level} L${x3} ${level} Q${x3} ${bottom} ${x4} ${bottom} Z`}
        fill="rgb(244 243 239 / 0.06)"
      />
      {segments.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={STAGE_COLORS[i]}
          strokeWidth={2.5}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

// A level shown over the current view, e.g. the volume while it changes.
export interface ScreenOverlay {
  label: string;
  // 0–1
  value: number;
  display: string;
}

// The setting the red knob picked (red) and its value, set by the blue knob
// (blue), for the footer.
export function ScreenSelection({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <>
      <span className={styles.selectionLabel}>{label}</span>{" "}
      <span className={styles.selectionValue}>{value}</span>
    </>
  );
}

// Whatever the green knob moves through (a page counter), in green.
export function ScreenSeek({ children }: { children: ReactNode }) {
  return <span className={styles.seeking}>{children}</span>;
}

export interface DeviceScreenProps {
  view?: ScreenView;
  title: string;
  status: ReactNode;
  footer: readonly [left: ReactNode, right: ReactNode];
  getAnalyser?: () => AnalyserNode | null;
  params?: readonly ScreenParam[];
  page?: number;
  tiles?: readonly ScreenTile[];
  selected?: number;
  onSelect?: (index: number) => void;
  // Tapping a param on the synth view selects it, like the red knob.
  onSelectParam?: (index: number) => void;
  envelope?: readonly ScreenEnvelopeStage[];
  overlay?: ScreenOverlay;
  className?: string;
}

export const PARAMS_PER_PAGE = 16;
export const TILES_PER_PAGE: Record<string, number> = {
  save: 22,
  presets: 8,
};

const noAnalyser = () => null;

// The Device's display: a live scope by default, or the synth parameters, the
// Save icon picker or the preset grid.
export function DeviceScreen({
  view = "scope",
  title,
  status,
  footer,
  getAnalyser = noAnalyser,
  params = [],
  page = 0,
  tiles = [],
  selected = 0,
  onSelect,
  onSelectParam,
  envelope = [],
  overlay,
  className,
}: DeviceScreenProps) {
  const perPage = TILES_PER_PAGE[view] ?? 1;
  const tilePage = Math.floor(selected / perPage);
  const visibleTiles = tiles.slice(
    tilePage * perPage,
    (tilePage + 1) * perPage,
  );

  return (
    <div className={cn(styles.screen, className)}>
      <div className={styles.glass}>
        <div className={styles.readout}>
          <span aria-live="polite">{title}</span>
          <span>{status}</span>
        </div>

        {view === "adsr" && envelope.length === 4 && (
          <div className={styles.envelope}>
            <EnvelopeGraph stages={envelope} />
            <div className={styles.stages}>
              {envelope.map((stage, i) => (
                <span key={stage.label} className={styles.stage}>
                  <span>{stage.label}</span>
                  <span style={{ color: STAGE_COLORS[i] }}>
                    {stage.display}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {view === "scope" && (
          <Oscilloscope className={styles.scope} getAnalyser={getAnalyser} />
        )}

        {view === "synth" && (
          <div className={styles.params} role="group" aria-label="Parameters">
            {params
              .slice(page * PARAMS_PER_PAGE, (page + 1) * PARAMS_PER_PAGE)
              .map((param, i) => (
                <Button
                  key={param.id}
                  variant="ghost"
                  tone="secondary"
                  aria-label={`${param.label}: ${param.value}`}
                  aria-pressed={param.selected ?? false}
                  className={cn(
                    styles.param,
                    param.selected && styles.selected,
                  )}
                  onClick={() => onSelectParam?.(page * PARAMS_PER_PAGE + i)}
                >
                  <span className={styles.paramLabel}>{param.label}</span>
                  <span className={styles.paramValue}>{param.value}</span>
                </Button>
              ))}
          </div>
        )}

        {(view === "save" || view === "presets") && (
          <div
            className={cn(styles.tiles, view === "save" && styles.iconTiles)}
            role="group"
            aria-label={view === "save" ? "Preset icon" : "Preset library"}
          >
            {visibleTiles.map((tile, i) => {
              const index = tilePage * perPage + i;
              return (
                <Button
                  key={tile.id}
                  variant="ghost"
                  tone="secondary"
                  aria-label={tile.label}
                  aria-pressed={index === selected}
                  className={styles.tile}
                  onClick={() => onSelect?.(index)}
                >
                  <span className={styles.tileIcon} aria-hidden="true">
                    {tile.icon}
                  </span>
                  {view === "presets" && (
                    <span className={styles.tileName} aria-hidden="true">
                      {tile.label}
                    </span>
                  )}
                  {tile.badge && (
                    <span className={styles.badge} aria-hidden="true">
                      {tile.badge}
                    </span>
                  )}
                </Button>
              );
            })}
          </div>
        )}

        <div className={cn(styles.readout, styles.readoutBottom)}>
          <span>{footer[0]}</span>
          <span>{footer[1]}</span>
        </div>

        {overlay && (
          <div className={styles.overlay} aria-hidden="true">
            <div className={styles.meter}>
              <div className={styles.meterLabel}>
                <span>{overlay.label}</span>
                <span>{overlay.display}</span>
              </div>
              <div className={styles.meterTrack}>
                <div
                  className={styles.meterFill}
                  style={{ width: `${Math.round(overlay.value * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
