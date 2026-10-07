import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  physicalSynth,
  type BusId,
  type DrumPieceId,
  type EngineStats,
  type InstrumentId,
  type KitId,
} from "../../lib/physical";
import { kitPieces } from "../../lib/physical/models/DrumKit";
import {
  decaySweep,
  drumLevels,
  lifecycleCheck,
  loudness,
  notesInRange,
  onsetCheck,
  stabilitySweep,
  stressCheck,
  tuningSweep,
  type DiagnosticRow,
} from "../../lib/physical/offline/diagnostics";
import { workletRenderer } from "../../lib/physical/offline/renderOffline";
import {
  MASTER_PARAMS,
  PATCH_BY_ID,
  PATCHES,
} from "../../lib/physical/patches";
import {
  formatParam,
  fromUnit,
  toUnit,
} from "../../lib/physical/patches/format";
import type {
  DrumKitPatch,
  ParamSpec,
  SectionId,
} from "../../lib/physical/patches/types";
import { cn } from "../../lib/utils";
import { Button } from "../design-system/Button";
import { Slider } from "../design-system/Slider";
import { Key, Pad } from "../design-system";
import { Oscilloscope } from "../home/Oscilloscope";

export type InstrumentLabProps = {
  initialInstrument?: BusId;
};

const SECTIONS: SectionId[] = [
  "exciter",
  "resonator",
  "body",
  "filter",
  "envelope",
  "space",
];
const isKit = (id: BusId): id is KitId => PATCH_BY_ID[id].family === "drums";

// Two octaves from C; A W S E D F T G Y H U J K play the first octave and a C.
const WHITE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23];
const BLACK = [1, 3, 6, 8, 10, 13, 15, 18, 20, 22];
const HOTKEYS: Record<string, number> = {
  KeyA: 0,
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12,
};
const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const METRONOME_MS = 500;

const getAnalyser = () => physicalSynth.getAnalyser();

const defaults = (specs: readonly ParamSpec[]) =>
  Object.fromEntries(specs.map((spec) => [spec.id, spec.default]));

type Values = Record<string, Record<string, number>>;

function ParamSlider({
  spec,
  value,
  onChange,
}: {
  spec: ParamSpec;
  value: number;
  onChange: (value: number) => void;
}) {
  const log = spec.scale === "log";
  return (
    <Slider
      label={spec.label}
      valueDisplay={formatParam(spec, value)}
      min={log ? 0 : spec.min}
      max={log ? 1 : spec.max}
      step={log ? 0.001 : spec.options ? 1 : (spec.max - spec.min) / 200}
      value={log ? toUnit(spec, value) : value}
      onChange={(next) => onChange(log ? fromUnit(spec, next) : next)}
    />
  );
}

function ParamGroup({
  specs,
  values,
  onChange,
}: {
  specs: readonly ParamSpec[];
  values: Record<string, number>;
  onChange: (id: string, value: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {specs.map((spec) => (
        <ParamSlider
          key={spec.id}
          spec={spec}
          value={values[spec.id] ?? spec.default}
          onChange={(value) => onChange(spec.id, value)}
        />
      ))}
    </div>
  );
}

function Spectrum({ className }: { className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    let frame = 0;
    let bins: Uint8Array<ArrayBuffer> | null = null;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const ratio = window.devicePixelRatio || 1;
      const width = Math.round(element.clientWidth * ratio);
      const height = Math.round(element.clientHeight * ratio);
      if (element.width !== width || element.height !== height) {
        element.width = width;
        element.height = height;
      }
      context.clearRect(0, 0, width, height);
      const analyser = physicalSynth.getAnalyser();
      if (!analyser) return;
      if (bins?.length !== analyser.frequencyBinCount) {
        bins = new Uint8Array(analyser.frequencyBinCount);
      }
      analyser.getByteFrequencyData(bins);
      const nyquist = analyser.context.sampleRate / 2;
      context.fillStyle = "#f4f3ef";
      // Log frequency axis from 20 Hz to Nyquist.
      for (let x = 0; x < width; x++) {
        const hz = 20 * (nyquist / 20) ** (x / width);
        const level =
          bins[
            Math.min(bins.length - 1, Math.round((hz / nyquist) * bins.length))
          ];
        const bar = (level / 255) * height;
        context.fillRect(x, height - bar, 1, bar);
      }
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={canvas} className={className} aria-hidden="true" />;
}

const DIAGNOSTICS: {
  label: string;
  run: () => Promise<DiagnosticRow[]>;
}[] = [
  {
    label: "Tuning sweep",
    run: async () => {
      const rows: DiagnosticRow[] = [];
      for (const fs of [44100, 48000]) {
        for (const id of [
          "piano",
          "guitar",
          "bass",
          "uprightBass",
          "sitar",
          "ukulele",
          "banjo",
        ] as InstrumentId[]) {
          rows.push(
            ...(await tuningSweep(workletRenderer, id, fs, notesInRange(id))),
          );
        }
        for (const id of [
          "violin",
          "saxophone",
          "clarinet",
          "trombone",
          "flute",
          "harmonium",
          "harmonica",
          "accordion",
          "xylophone",
          "steelPan",
          "kalimba",
        ] as InstrumentId[]) {
          rows.push(
            ...(await tuningSweep(
              workletRenderer,
              id,
              fs,
              notesInRange(id),
              10,
            )),
          );
        }
      }
      return rows;
    },
  },
  {
    label: "Decay sweep",
    run: async () => [
      ...(await decaySweep(
        workletRenderer,
        "piano",
        48000,
        [21, 36, 48, 60, 72, 84, 96, 108],
      )),
      ...(await decaySweep(
        workletRenderer,
        "guitar",
        48000,
        [40, 52, 64, 76, 84],
      )),
      ...(await decaySweep(workletRenderer, "bass", 48000, [28, 43, 55, 67])),
      ...(await decaySweep(
        workletRenderer,
        "uprightBass",
        48000,
        [28, 43, 55, 67],
      )),
    ],
  },
  {
    label: "Stability sweep",
    run: async () => {
      const rows: DiagnosticRow[] = [];
      for (const patch of PATCHES) {
        const subjects: (number | DrumPieceId)[] = isKit(patch.id)
          ? kitPieces(patch as DrumKitPatch)
          : notesInRange(patch.id as InstrumentId, 6);
        rows.push(
          ...(await stabilitySweep(workletRenderer, patch.id, 48000, subjects)),
        );
      }
      return rows;
    },
  },
  {
    label: "Levels",
    run: async () => {
      const rows: DiagnosticRow[] = [];
      for (const patch of PATCHES) {
        if (isKit(patch.id))
          rows.push(...(await drumLevels(workletRenderer, patch.id, 48000)));
        else
          rows.push(
            await loudness(workletRenderer, patch.id as InstrumentId, 48000),
          );
      }
      return rows;
    },
  },
  {
    label: "Onset + lifecycle",
    run: async () => [
      await onsetCheck(workletRenderer, 44100),
      await onsetCheck(workletRenderer, 48000),
      ...(await lifecycleCheck(workletRenderer, 48000)),
    ],
  },
  {
    label: "Stress",
    run: async () => [
      await stressCheck(workletRenderer, "piano", 48000),
      await stressCheck(workletRenderer, "guitar", 48000),
    ],
  },
];

function Diagnostics() {
  const [rows, setRows] = useState<DiagnosticRow[]>([]);
  const [running, setRunning] = useState<string | null>(null);

  const run = async (label: string, task: () => Promise<DiagnosticRow[]>) => {
    setRunning(label);
    setRows([]);
    try {
      setRows(await task());
    } finally {
      setRunning(null);
    }
  };

  const passed = rows.filter((row) => row.pass).length;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-font-light">
        Each sweep renders through an OfflineAudioContext with the real worklet.
      </p>
      <div className="flex flex-wrap gap-2">
        {DIAGNOSTICS.map(({ label, run: task }) => (
          <Button
            key={label}
            size="sm"
            variant="outline"
            tone="secondary"
            disabled={running !== null}
            onClick={() => void run(label, task)}
          >
            {label}
          </Button>
        ))}
      </div>
      <p aria-live="polite" className="text-sm font-medium">
        {running
          ? `Running ${running}…`
          : rows.length > 0
            ? `${passed}/${rows.length} passed`
            : "No results yet"}
      </p>
      {rows.length > 0 && (
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-stone-300 dark:border-stone-700">
              <th className="py-1 pr-3">Result</th>
              <th className="py-1 pr-3">Check</th>
              <th className="py-1 pr-3">Subject</th>
              <th className="py-1 pr-3">Measured</th>
              <th className="py-1">Expected</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={index}
                className="border-b border-stone-200 font-mono dark:border-stone-800"
              >
                <td
                  className={cn(
                    "py-1 pr-3 font-semibold",
                    row.pass ? "text-success" : "text-error",
                  )}
                >
                  {row.pass ? "PASS" : "FAIL"}
                </td>
                <td className="py-1 pr-3">{row.check}</td>
                <td className="py-1 pr-3">{row.subject}</td>
                <td className="py-1 pr-3">{row.measured}</td>
                <td className="py-1">{row.expected}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Dev-only harness for auditioning and tuning the physical-modeling engine.
// Nothing starts until "Start audio" is pressed.
export function InstrumentLab({
  initialInstrument = "piano",
}: InstrumentLabProps) {
  const [tab, setTab] = useState<"play" | "diagnostics">("play");
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState<EngineStats | null>(null);
  const [instrument, setInstrument] = useState<BusId>(initialInstrument);
  const [values, setValues] = useState<Values>(() =>
    Object.fromEntries(
      PATCHES.map((patch) => [patch.id, defaults(patch.params)]),
    ),
  );
  const [master, setMaster] = useState(() => defaults(MASTER_PARAMS));
  const [velocity, setVelocity] = useState(0.8);
  const [octave, setOctave] = useState(4);
  const [held, setHeld] = useState<ReadonlySet<number>>(() => new Set());
  const [metronome, setMetronome] = useState(false);
  const [copied, setCopied] = useState(false);
  const sounding = useRef(new Map<number, InstrumentId>());

  const patch =
    PATCHES.find((candidate) => candidate.id === instrument) ?? PATCHES[0];
  const kit = isKit(instrument);
  const base = (octave + 1) * 12;

  useEffect(() => physicalSynth.onStats(setStats), []);

  useEffect(() => {
    if (!metronome) return;
    let beat = 0;
    const tick = () => physicalSynth.metronomeTick(beat++ % 4 === 0);
    tick();
    const id = setInterval(tick, METRONOME_MS);
    return () => clearInterval(id);
  }, [metronome]);

  const start = async () => {
    await physicalSynth.start();
    setReady(physicalSynth.ready);
  };

  const press = (midi: number) => {
    if (kit || sounding.current.has(midi)) return;
    const target = instrument as InstrumentId;
    sounding.current.set(midi, target);
    physicalSynth.noteOn(target, midi, velocity);
    setHeld(new Set(sounding.current.keys()));
  };

  const release = (midi: number) => {
    const target = sounding.current.get(midi);
    if (!target) return;
    sounding.current.delete(midi);
    physicalSynth.noteOff(target, midi);
    setHeld(new Set(sounding.current.keys()));
  };

  const onKey = useEffectEvent((event: KeyboardEvent, down: boolean) => {
    if (
      event.target instanceof Element &&
      event.target.closest("input, textarea")
    )
      return;
    if (event.code === "Space") {
      event.preventDefault();
      if (!event.repeat && !kit)
        physicalSynth.setSustain(instrument as InstrumentId, down);
      return;
    }
    if (down && !event.repeat && event.code === "KeyZ")
      setOctave((o) => Math.max(0, o - 1));
    if (down && !event.repeat && event.code === "KeyX")
      setOctave((o) => Math.min(7, o + 1));
    const offset = HOTKEYS[event.code];
    if (offset === undefined || event.metaKey || event.ctrlKey) return;
    if (down && !event.repeat) press(base + offset);
    else if (!down) release(base + offset);
  });

  useEffect(() => {
    const down = (event: KeyboardEvent) => onKey(event, true);
    const up = (event: KeyboardEvent) => onKey(event, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const setParam = (id: string, value: number) => {
    physicalSynth.setParam(instrument, id, value);
    setValues((current) => ({
      ...current,
      [instrument]: { ...current[instrument], [id]: value },
    }));
  };

  const setMasterParam = (id: string, value: number) => {
    physicalSynth.setParam("master", id, value);
    setMaster((current) => ({ ...current, [id]: value }));
  };

  const copyPatch = async () => {
    const json = JSON.stringify(
      { id: instrument, params: values[instrument] },
      null,
      2,
    );
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const primary = patch.params.filter((spec) => spec.primary);
  const advanced = patch.params.filter((spec) => !spec.primary);

  return (
    <div className="flex flex-col gap-5 p-6 text-font dark:text-surface">
      <header className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void start()} disabled={ready}>
          {ready ? "Audio running" : "Start audio"}
        </Button>
        <p aria-live="polite" className="font-mono text-xs">
          {ready
            ? `${physicalSynth.sampleRate} Hz · voices ${stats?.activeVoices ?? 0} · reverb ${
                stats?.reverbAwake ? "awake" : "asleep"
              }${stats?.load === undefined ? "" : ` · load ${(stats.load * 100).toFixed(1)}%`}`
            : "Audio stopped"}
        </p>
        <div className="ml-auto flex gap-1" role="group" aria-label="View">
          {(["play", "diagnostics"] as const).map((view) => (
            <Button
              key={view}
              size="sm"
              variant={tab === view ? "solid" : "outline"}
              tone="secondary"
              aria-pressed={tab === view}
              onClick={() => setTab(view)}
            >
              {view === "play" ? "Play" : "Diagnostics"}
            </Button>
          ))}
        </div>
      </header>

      {tab === "diagnostics" ? (
        <Diagnostics />
      ) : (
        <>
          <div
            className="flex flex-wrap gap-1"
            role="group"
            aria-label="Instrument"
          >
            {PATCHES.map((candidate) => (
              <Button
                key={candidate.id}
                size="sm"
                variant={candidate.id === instrument ? "solid" : "outline"}
                tone="secondary"
                aria-pressed={candidate.id === instrument}
                onClick={() => {
                  physicalSynth.allNotesOff();
                  sounding.current.clear();
                  setHeld(new Set());
                  setInstrument(candidate.id);
                }}
              >
                {candidate.name}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-[#050505] p-3">
              <Oscilloscope className="h-32 w-full" getAnalyser={getAnalyser} />
            </div>
            <div className="rounded-lg bg-[#050505] p-3">
              <Spectrum className="h-32 w-full" />
            </div>
          </div>

          {kit ? (
            <div
              className="grid w-fit grid-cols-3 gap-[9px]"
              role="group"
              aria-label="Drum pads"
            >
              {kitPieces(PATCH_BY_ID[instrument] as DrumKitPatch).map(
                (piece) => (
                  <Pad
                    key={piece}
                    label={piece}
                    accent="#cd5951"
                    onPress={() =>
                      physicalSynth.hit(instrument as KitId, piece, velocity)
                    }
                  >
                    <span className="text-[10px]">{piece}</span>
                  </Pad>
                ),
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-font-light dark:text-stone-400">
                Keys A–K play C{octave}–C{octave + 1}; Z / X shift octaves; hold
                Space for sustain.
              </p>
              <div
                className="relative h-[210px] w-[752px]"
                role="group"
                aria-label="Keyboard"
              >
                {WHITE.map((offset, slot) => {
                  const midi = base + offset;
                  return (
                    <Key
                      key={offset}
                      label={`${NAMES[offset % 12]} ${Math.floor(midi / 12) - 1}`}
                      note={
                        offset % 12 === 0
                          ? `C${Math.floor(midi / 12) - 1}`
                          : NAMES[offset % 12]
                      }
                      lit={held.has(midi)}
                      className="absolute top-0"
                      style={{ left: slot * 54 } as CSSProperties}
                      onPress={() => press(midi)}
                      onRelease={() => release(midi)}
                    />
                  );
                })}
                {BLACK.map((offset) => {
                  const midi = base + offset;
                  const slot = WHITE.indexOf(offset - 1) + 1;
                  return (
                    <Key
                      key={offset}
                      variant="black"
                      label={`${NAMES[offset % 12].replace("♯", " sharp")} ${Math.floor(midi / 12) - 1}`}
                      note={NAMES[offset % 12]}
                      lit={held.has(midi)}
                      className="absolute top-0"
                      style={{ left: slot * 54 - 17 } as CSSProperties}
                      onPress={() => press(midi)}
                      onRelease={() => release(midi)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
            <Slider
              label="Velocity"
              valueDisplay={velocity.toFixed(2)}
              min={0.05}
              max={1}
              step={0.01}
              value={velocity}
              onChange={setVelocity}
            />
            <div className="flex items-end gap-2">
              <Button
                size="sm"
                variant={metronome ? "solid" : "outline"}
                tone="secondary"
                aria-pressed={metronome}
                onClick={() => setMetronome((on) => !on)}
              >
                Metronome 120 BPM
              </Button>
              <Button
                size="sm"
                variant="outline"
                tone="secondary"
                onClick={() => void copyPatch()}
              >
                {copied ? "Copied" : "Copy patch JSON"}
              </Button>
            </div>
          </div>

          <section
            className="flex flex-col gap-4"
            aria-label={`${patch.name} parameters`}
          >
            {SECTIONS.map((section) => {
              const specs = primary.filter((spec) => spec.section === section);
              if (specs.length === 0) return null;
              return (
                <div key={section} className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-font-light dark:text-stone-400">
                    {section}
                  </h3>
                  <ParamGroup
                    specs={specs}
                    values={values[instrument]}
                    onChange={setParam}
                  />
                </div>
              );
            })}
            {advanced.length > 0 && (
              <details className="flex flex-col gap-2">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-font-light dark:text-stone-400">
                  Advanced
                </summary>
                <div className="pt-2">
                  <ParamGroup
                    specs={advanced}
                    values={values[instrument]}
                    onChange={setParam}
                  />
                </div>
              </details>
            )}
          </section>

          <section className="flex flex-col gap-2" aria-label="Master">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-font-light dark:text-stone-400">
              Master
            </h3>
            <ParamGroup
              specs={MASTER_PARAMS}
              values={master}
              onChange={setMasterParam}
            />
          </section>

          <pre className="max-h-48 overflow-auto rounded-lg bg-stone-100 p-3 text-xs dark:bg-stone-900">
            {JSON.stringify(
              { id: instrument, params: values[instrument] },
              null,
              2,
            )}
          </pre>
        </>
      )}
    </div>
  );
}
