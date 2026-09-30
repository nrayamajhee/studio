import type { CSSProperties, ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../design-system/Button";
import { Oscilloscope } from "./Oscilloscope";
import styles from "./DeviceScreen.module.css";

export type ScreenView =
  "scope" | "synth" | "save" | "presets" | "adsr" | "lfo" | "fx";

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

// One module knob's reading, in knob order (white, green, red, blue).
export interface ScreenReadout {
  label: string;
  display: string;
  // 0–1: the knob position (the level, for the ADSR's sustain).
  amount: number;
}

// Module readouts in the colours of the knobs that set them.
const KNOB_COLORS = [
  "#f4f3ef",
  "var(--synth-green, #4ba078)",
  "var(--synth-red, #cd5951)",
  "var(--synth-blue, #2f7de1)",
];

// Drawn across a fixed 100 × 40 box: attack, decay and release widen with their
// knobs, sustain fills the rest at its level, and decay and release curve like
// the engine's exponential segments.
function EnvelopeGraph({ stages }: { stages: readonly ScreenReadout[] }) {
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
      className={styles.moduleGraph}
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
          stroke={KNOB_COLORS[i]}
          strokeWidth={2.5}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

const LFO_CYCLE = 50;
const RANDOM_STEPS = [0.6, -0.35, 0.9, -0.8, 0.15, -0.55];

const lfoValue = (shape: number, x: number) => {
  const phase = (x / LFO_CYCLE) % 1;
  switch (shape) {
    case 0:
      return Math.sin(2 * Math.PI * phase);
    case 1:
      return 1 - 4 * Math.abs(phase - 0.5);
    case 2:
      return phase < 0.5 ? 1 : -1;
    default:
      return RANDOM_STEPS[Math.floor(x / LFO_CYCLE) % RANDOM_STEPS.length];
  }
};

// Two cycles of the LFO's shape across a 100 × 40 box, as tall as its depth,
// scrolling one cycle per LFO period (no faster than 10 Hz on screen).
function LfoGraph({
  shape,
  depth,
  rate,
}: {
  shape: number;
  depth: number;
  rate: number;
}) {
  const height = 17 * Math.max(0.08, depth);
  const points: string[] = [];
  for (let x = 0; x <= 3 * LFO_CYCLE; x += 0.5) {
    points.push(`${x} ${(20 - height * lfoValue(shape, x)).toFixed(2)}`);
  }
  return (
    <svg
      className={styles.moduleGraph}
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0 20 H100"
        stroke="rgb(244 243 239 / 0.12)"
        strokeDasharray="2 3"
        vectorEffect="non-scaling-stroke"
      />
      <path
        className={styles.lfoWave}
        style={
          {
            "--lfo-period": `${Math.max(1 / rate, 0.1)}s`,
          } as CSSProperties
        }
        d={`M${points.join(" L")}`}
        fill="none"
        stroke={KNOB_COLORS[1]}
        strokeWidth={2.5}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// The FX stages left to right, each level as a bar in its knob colour.
function FxMeters({ stages }: { stages: readonly ScreenReadout[] }) {
  return (
    <div className={styles.fxMeters} aria-hidden="true">
      {stages.map((stage, i) => (
        <div key={stage.label} className={styles.fxStage}>
          <div className={styles.fxTrack}>
            <div
              className={styles.fxFill}
              style={{
                height: `${Math.round(stage.amount * 100)}%`,
                background: KNOB_COLORS[i],
              }}
            />
          </div>
        </div>
      ))}
    </div>
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
  // The four knob readings for the ADSR, LFO and FX views.
  readouts?: readonly ScreenReadout[];
  // The LFO view's shape (0–3) and rate in Hz.
  lfoShape?: number;
  lfoRate?: number;
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
  readouts = [],
  lfoShape = 0,
  lfoRate = 1,
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

        {(view === "adsr" || view === "lfo" || view === "fx") &&
          readouts.length === 4 && (
            <div className={styles.module}>
              {view === "adsr" && <EnvelopeGraph stages={readouts} />}
              {view === "lfo" && (
                <LfoGraph
                  shape={lfoShape}
                  depth={readouts[1].amount}
                  rate={lfoRate}
                />
              )}
              {view === "fx" && <FxMeters stages={readouts} />}
              <div className={styles.stages}>
                {readouts.map((stage, i) => (
                  <span key={stage.label} className={styles.stage}>
                    <span>{stage.label}</span>
                    <span style={{ color: KNOB_COLORS[i] }}>
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
