import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../design-system/Button";
import { NoteRoll } from "./NoteRoll";
import { Oscilloscope } from "./Oscilloscope";
import { DEFAULT_TIMING, type Timing } from "./noteRecorder";
import type { TrackClip } from "./tracks";
import type { RollFrame } from "../../hooks/useTransport";
import { keepFocus } from "../design-system";
import styles from "./DeviceScreen.module.css";

export type ScreenView =
  | "scope"
  | "synth"
  | "save"
  | "presets"
  | "chords"
  | "adsr"
  | "lfo"
  | "fx"
  | "tempo"
  | "roll"
  | "tracks";

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
  "var(--screen-ink)",
  "var(--screen-green)",
  "var(--screen-red)",
  "var(--screen-blue)",
];

// Drawn across a fixed 100 × 40 box: attack, decay and release widen with their
// knobs, sustain fills the rest at its level, and decay and release curve like
// the engine's exponential segments. A zero attack rises straight up; decay and
// release never reach zero, so they always curve. Both ends sit inside the box
// so their strokes aren't clipped.
function EnvelopeGraph({ stages }: { stages: readonly ScreenReadout[] }) {
  const [attack, decay, sustain, release] = stages.map(({ amount }) => amount);
  const top = 2;
  const bottom = 38;
  const level = bottom - (bottom - top) * sustain;
  const x0 = 2;
  const x1 = x0 + 23 * attack;
  const x2 = x1 + 2 + 23 * decay;
  const x4 = 98;
  const x3 = x4 - (2 + 28 * release);
  const decayPath = `Q${x1} ${level} ${x2} ${level}`;
  const releasePath = `Q${x3} ${bottom} ${x4} ${bottom}`;
  const segments = [
    `M${x0} ${bottom} L${x1} ${top}`,
    `M${x1} ${top} ${decayPath}`,
    `M${x2} ${level} L${x3} ${level}`,
    `M${x3} ${level} ${releasePath}`,
  ];
  return (
    <svg
      className={styles.moduleGraph}
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={`M${x0} ${bottom} L${x1} ${top} ${decayPath} L${x3} ${level} ${releasePath} Z`}
        style={{
          fill: "color-mix(in srgb, var(--screen-ink) 8%, transparent)",
        }}
      />
      {segments.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          style={{ stroke: KNOB_COLORS[i] }}
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
        style={{
          stroke: "color-mix(in srgb, var(--screen-ink) 15%, transparent)",
        }}
        strokeDasharray="2 3"
        vectorEffect="non-scaling-stroke"
      />
      <path
        className={styles.lfoWave}
        style={
          {
            "--lfo-period": `${Math.max(1 / rate, 0.1)}s`,
            stroke: KNOB_COLORS[1],
          } as CSSProperties
        }
        d={`M${points.join(" L")}`}
        fill="none"
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

// A caption along the bottom of the screen; with `on`, a switch's name and
// then On or Off in a pill.
export interface ScreenBadge {
  label: string;
  on?: boolean;
}

// A row of the tracks view: its take's clip, where it starts on the timeline
// (beats), and whether it's muted, soloed and heard.
export interface ScreenTrack {
  id: string;
  name: string;
  // The preset that plays it.
  detail: string;
  color: string;
  start: number;
  clip: TrackClip;
  // 0–1, drawn as a red bar beside the lane.
  volume: number;
  muted: boolean;
  soloed: boolean;
  audible: boolean;
  // The tape shown as a potential track: no mute or solo.
  potential?: boolean;
}

const TRACKS_PER_PAGE = 4;

// The tracks' rows, with the mix's playhead: each frame sets --playhead (0–1
// across the timeline, or -1 while stopped) for the lanes' playhead lines.
function TrackList({
  className,
  getPosition,
  span,
  children,
}: {
  className: string;
  getPosition: () => number | null;
  span: number;
  children: ReactNode;
}) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = list.current;
    if (!element) return;
    let frame = 0;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const at = getPosition();
      element.style.setProperty(
        "--playhead",
        String(at === null ? -1 : at / span),
      );
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [getPosition, span]);
  return (
    <div ref={list} className={className} role="group" aria-label="Tracks">
      {children}
      <span className={styles.playhead} aria-hidden="true" />
    </div>
  );
}

// A track's lane, like a clip on the studio's timeline: bar lines, the take's
// notes as short bars at their pitch within the take's range (at least an
// octave), and when it loops, fainter repeats out to the end.
function TrackLane({
  track,
  span,
  barBeats,
}: {
  track: ScreenTrack;
  span: number;
  barBeats: number;
}) {
  const { clip, start, color } = track;
  const passes: number[] = [];
  for (
    let at = start;
    clip.length > 0 && at < span && (passes.length === 0 || clip.loops);
    at += clip.length
  )
    passes.push(at);
  const pitches = clip.notes.map(({ note }) => note);
  let low = Math.min(...pitches);
  let high = Math.max(...pitches);
  if (high - low < 12) {
    const middle = (high + low) / 2;
    low = middle - 6;
    high = middle + 6;
  }
  const percent = (beats: number) => `${(beats / span) * 100}%`;
  return (
    <span
      className={styles.lane}
      style={{ "--bars": span / barBeats } as CSSProperties}
      aria-hidden="true"
    >
      {passes.map((at, pass) => (
        <span
          key={`pass-${pass}`}
          className={styles.pass}
          style={{
            left: percent(at),
            width: percent(Math.min(clip.length, span - at)),
            background: `color-mix(in srgb, ${color} 12%, transparent)`,
          }}
        />
      ))}
      {passes.flatMap((at, pass) =>
        clip.notes
          .filter((note) => at + note.start < span)
          .map((note, i) => (
            <span
              key={`${pass}-${i}`}
              className={styles.clipNote}
              data-repeat={pass > 0 || undefined}
              style={{
                left: percent(at + note.start),
                width: percent(
                  Math.min(note.length, clip.length - note.start, span - at),
                ),
                top: `${12 + (1 - (note.note - low) / (high - low)) * 70}%`,
                background: color,
              }}
            />
          )),
      )}
    </span>
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

// A level the red knob sets, in red.
export function ScreenLevel({ children }: { children: ReactNode }) {
  return <span className={styles.selectionLabel}>{children}</span>;
}

export interface DeviceScreenProps {
  view?: ScreenView;
  title: string;
  // The preset in the title has edits that aren't saved.
  unsaved?: boolean;
  status: ReactNode;
  footer: readonly [left: ReactNode, right: ReactNode];
  // Centred along the bottom in place of the footer.
  badges?: readonly ScreenBadge[];
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
  // Tempo, meter and grid, for the tempo view (a light per beat of the bar)
  // and the roll's lines; and the beat the metronome is on, or null while it
  // is stopped.
  timing?: Timing;
  beat?: number | null;
  // The tracks view's rows, and its timeline's length and bar, in beats; and
  // where the mix is playing (beats, or null), read every frame.
  tracks?: readonly ScreenTrack[];
  getTrackPosition?: () => number | null;
  trackSpan?: number;
  barBeats?: number;
  // The take for the roll view, read every frame, where it is scrolled to and
  // wheel scrolling over it (see NoteRoll).
  getRoll?: () => RollFrame;
  rollPosition?: number | null;
  onRollScroll?: (ms: number) => void;
  overlay?: ScreenOverlay;
  className?: string;
}

export const PARAMS_PER_PAGE = 15;
export const TILES_PER_PAGE: Record<string, number> = {
  save: 48,
  presets: 8,
  chords: 8,
};

const noAnalyser = () => null;
const EMPTY_ROLL: RollFrame = { now: 0, notes: [], state: "stopped" };
const noRoll = () => EMPTY_ROLL;
const noPosition = () => null;

// The Device's display: a live scope by default, or the synth parameters, the
// Save icon picker or the preset grid.
export function DeviceScreen({
  view = "scope",
  title,
  unsaved = false,
  status,
  footer,
  badges,
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
  timing = DEFAULT_TIMING,
  beat = null,
  tracks = [],
  getTrackPosition = noPosition,
  trackSpan = 16,
  barBeats = 4,
  getRoll = noRoll,
  rollPosition = null,
  onRollScroll,
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
          <span className={styles.title}>
            <span aria-live="polite">{title}</span>
            {unsaved && <span className={styles.unsaved}>Unsaved</span>}
          </span>
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

        {view === "tempo" && (
          <div className={styles.tempo}>
            <span className={styles.bpm}>
              <span className={styles.seeking}>{timing.bpm}</span>
              <span className={styles.bpmUnit}>BPM</span>
            </span>
            <span className={styles.beats} aria-hidden="true">
              {Array.from({ length: timing.meter.beats }, (_, i) => (
                <span
                  key={i}
                  className={styles.beat}
                  data-on={beat === i || undefined}
                />
              ))}
            </span>
          </div>
        )}

        {view === "tracks" && (
          <TrackList
            className={styles.tracks}
            getPosition={getTrackPosition}
            span={trackSpan}
          >
            {tracks.length === 0 ? (
              <span className={styles.tracksEmpty}>
                Save a take in record mode to add a track
              </span>
            ) : (
              tracks
                .slice(
                  Math.floor(selected / TRACKS_PER_PAGE) * TRACKS_PER_PAGE,
                  (Math.floor(selected / TRACKS_PER_PAGE) + 1) *
                    TRACKS_PER_PAGE,
                )
                .map((track, i) => {
                  const index =
                    Math.floor(selected / TRACKS_PER_PAGE) * TRACKS_PER_PAGE +
                    i;
                  return (
                    <Button
                      key={track.id}
                      variant="ghost"
                      tone="secondary"
                      aria-label={
                        track.potential
                          ? `${track.name}, tape`
                          : `${track.name}, ${track.detail}, volume ${Math.round(
                              track.volume * 100,
                            )}%${track.muted ? ", muted" : ""}${
                              track.soloed ? ", solo" : ""
                            }`
                      }
                      aria-pressed={index === selected}
                      className={styles.track}
                      data-quiet={!track.audible || undefined}
                      data-potential={track.potential || undefined}
                      {...keepFocus}
                      onClick={() => onSelect?.(index)}
                    >
                      <span className={styles.trackLabel} aria-hidden="true">
                        <span className={styles.trackName}>{track.name}</span>
                        {!track.potential && (
                          <span className={styles.trackFlags}>
                            <span data-on={track.muted || undefined}>M</span>
                            <span data-on={track.soloed || undefined}>S</span>
                          </span>
                        )}
                      </span>
                      <span
                        className={styles.trackVolume}
                        data-empty={track.potential || undefined}
                        aria-hidden="true"
                      >
                        {!track.potential && (
                          <span style={{ height: `${track.volume * 100}%` }} />
                        )}
                      </span>
                      <TrackLane
                        track={track}
                        span={trackSpan}
                        barBeats={barBeats}
                      />
                    </Button>
                  );
                })
            )}
          </TrackList>
        )}

        {view === "roll" && (
          <NoteRoll
            className={styles.roll}
            getFrame={getRoll}
            timing={timing}
            position={rollPosition}
            onScroll={onRollScroll}
          />
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
                  {...keepFocus}
                  onClick={() => onSelectParam?.(page * PARAMS_PER_PAGE + i)}
                >
                  <span className={styles.paramLabel}>{param.label}</span>
                  <span className={styles.paramValue}>{param.value}</span>
                </Button>
              ))}
          </div>
        )}

        {(view === "save" || view === "presets" || view === "chords") && (
          <div
            className={cn(styles.tiles, view === "save" && styles.iconTiles)}
            role="group"
            aria-label={
              view === "save"
                ? "Preset icon"
                : view === "chords"
                  ? "Chord palette"
                  : "Preset library"
            }
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
                  {...keepFocus}
                  onClick={() => onSelect?.(index)}
                >
                  <span className={styles.tileIcon} aria-hidden="true">
                    {tile.icon}
                  </span>
                  {(view === "presets" || view === "chords") && (
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

        {badges ? (
          <div className={styles.badges} aria-live="polite">
            {badges.map(({ label, on }) => (
              <span key={label} className={styles.switchLabel}>
                {label}
                {on !== undefined && (
                  <span className={styles.switch} data-on={on || undefined}>
                    {on ? "On" : "Off"}
                  </span>
                )}
              </span>
            ))}
          </div>
        ) : (
          // The roll's C labels take the footer's line.
          view !== "roll" && (
            <div className={cn(styles.readout, styles.readoutBottom)}>
              <span>{footer[0]}</span>
              <span>{footer[1]}</span>
            </div>
          )
        )}

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
