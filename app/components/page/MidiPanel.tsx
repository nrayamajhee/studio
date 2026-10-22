import { useEffect, type ReactNode } from "react";
import { KeyboardMusic, Minus, Plus, X } from "lucide-react";
import { tv } from "../../lib/utils";
import { Button } from "../design-system/Button";
import {
  MIDI_KNOBS,
  MIDI_PADS,
  OCTAVE_RANGE,
  forgetMidi,
  learnMidi,
  sameTarget,
  setMidiEnabled,
  setMidiSettings,
  sourceName,
  targetName,
  useMidiConnection,
  useMidiLog,
  useMidiSettings,
  type MidiConnection,
  type MidiSettings,
  type MidiTarget,
} from "../home/input/midi";
import { CornerButton } from "./ThemeToggle";

export type MidiPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
};

const midiPanel = tv({
  slots: {
    base: "fixed inset-x-3 top-20 z-60 mx-auto flex max-h-[calc(100dvh-12rem)] max-w-[76rem] flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/65 text-white/80 shadow-high backdrop-blur-xl [color-scheme:dark] sm:inset-x-8 sm:max-h-[calc(100dvh-10rem)]",
    header:
      "flex min-w-0 items-center gap-3 border-b border-white/10 py-2 pr-2 pl-4 text-sm",
    body: "min-h-0 flex-1 overflow-y-auto md:grid md:grid-cols-[16rem_minmax(0,1fr)] md:overflow-hidden",
    settings:
      "flex flex-col gap-5 border-b border-white/10 p-4 md:overflow-y-auto md:border-r md:border-b-0",
    mapping: "flex min-w-0 flex-col gap-3 p-4 md:overflow-y-auto",
    heading: "font-mono text-[11px] tracking-wider text-white/45 uppercase",
    row: "flex min-h-7 items-center justify-between gap-3 text-xs",
    note: "text-xs leading-relaxed text-white/55",
    choice:
      "flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white/5",
    small:
      "rounded-md px-2 py-1 text-xs text-white/60 hover:bg-white/10 hover:text-white",
    cell: "flex min-h-12 flex-col items-start justify-between gap-1 rounded-lg border border-transparent px-1.5 py-1 text-left hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40",
    cellName: "flex items-center gap-1.5 text-[11px] leading-tight",
    cellSource: "font-mono text-[10px] text-white/40",
  },
  variants: {
    picked: {
      true: { choice: "bg-white/10 text-white hover:bg-white/10" },
    },
    mapped: {
      true: { cell: "bg-white/10 text-white", cellSource: "text-sky-300" },
      false: { cell: "bg-white/[0.03] text-white/60" },
    },
    learning: {
      true: {
        cell: "border-sky-400 bg-sky-400/15 text-white",
        cellSource: "animate-pulse text-sky-300",
      },
    },
  },
});
const ui = midiPanel();

const toggle = tv({
  slots: {
    track:
      "inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-white/15 transition-colors disabled:opacity-40",
    thumb:
      "size-4 translate-x-0.5 rounded-full bg-white shadow-low transition-transform",
  },
  variants: {
    on: {
      true: { track: "bg-emerald-500", thumb: "translate-x-4.5" },
    },
  },
});

const KNOB_COLORS = {
  chalk: "bg-synth-chalk",
  green: "bg-synth-green",
  red: "bg-synth-red",
  blue: "bg-synth-blue",
} as const;

function Toggle({
  on,
  label,
  disabled,
  onChange,
}: {
  on: boolean;
  label: string;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  const styles = toggle({ on });
  return (
    <Button
      unstyled
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      className={styles.track()}
      onClick={() => onChange(!on)}
    >
      <span className={styles.thumb()} />
    </Button>
  );
}

function Setting({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={ui.row()}>
      <span>{label}</span>
      {children}
    </div>
  );
}

const STATUS: Readonly<Record<MidiConnection["status"], string>> = {
  unsupported: "Not in this browser",
  off: "Off",
  asking: "Asking the browser…",
  blocked: "Blocked by the browser",
  on: "On",
};

const HELP: Partial<Record<MidiConnection["status"], string>> = {
  unsupported:
    "This browser has no Web MIDI. Chrome, Edge and Firefox have it; Safari doesn't.",
  off: "Turn MIDI on and a controller plays the Device: its keys play the keybed, and the knobs and pads mapped here turn and press the Device's own. The browser asks first.",
  asking: "Allow MIDI in the browser's prompt.",
  blocked:
    "Allow MIDI for this site in the browser's site settings, then turn it on again.",
};

function Inputs({
  connection,
  settings,
}: {
  connection: MidiConnection;
  settings: MidiSettings;
}) {
  const help = HELP[connection.status];
  if (help) return <p className={ui.note()}>{help}</p>;
  const names = connection.ports.map(({ name }) => name);
  const missing =
    settings.input !== null && !names.includes(settings.input)
      ? settings.input
      : null;
  const choice = (input: string | null, label: string, detail?: string) => (
    <Button
      unstyled
      key={input ?? ""}
      role="radio"
      aria-checked={settings.input === input}
      className={ui.choice({ picked: settings.input === input })}
      onClick={() => setMidiSettings({ input })}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {detail && <span className="shrink-0 text-white/40">{detail}</span>}
    </Button>
  );
  return (
    <div role="radiogroup" aria-label="Input" className="-mx-2 flex flex-col">
      {choice(
        null,
        "Every input",
        connection.ports.length === 0 ? "none plugged in" : undefined,
      )}
      {connection.ports.map(({ name, manufacturer }) =>
        choice(name, name, manufacturer),
      )}
      {missing !== null && choice(missing, missing, "not plugged in")}
    </div>
  );
}

function Keys({ settings }: { settings: MidiSettings }) {
  return (
    <div className="flex flex-col gap-1">
      <Setting label="Channel">
        <select
          aria-label="Channel the keys play from"
          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white"
          value={settings.channel ?? ""}
          onChange={(event) =>
            setMidiSettings({
              channel: event.target.value ? Number(event.target.value) : null,
            })
          }
        >
          <option value="">Any</option>
          {Array.from({ length: 16 }, (_, index) => (
            <option key={index} value={index + 1}>
              {index + 1}
            </option>
          ))}
        </select>
      </Setting>
      <Setting label="Octave">
        <span className="flex items-center gap-1">
          <Button
            unstyled
            aria-label="Octave down"
            className={ui.small()}
            disabled={settings.octave <= -OCTAVE_RANGE}
            onClick={() => setMidiSettings({ octave: settings.octave - 1 })}
          >
            <Minus className="size-3.5" />
          </Button>
          <span className="w-6 text-center font-mono">
            {settings.octave > 0 ? `+${settings.octave}` : settings.octave}
          </span>
          <Button
            unstyled
            aria-label="Octave up"
            className={ui.small()}
            disabled={settings.octave >= OCTAVE_RANGE}
            onClick={() => setMidiSettings({ octave: settings.octave + 1 })}
          >
            <Plus className="size-3.5" />
          </Button>
        </span>
      </Setting>
      <Setting label="Velocity">
        <span
          role="radiogroup"
          aria-label="Velocity"
          className="flex rounded-lg bg-white/5 p-0.5"
        >
          {(
            [
              ["played", "As played"],
              ["fixed", "Fixed"],
            ] as const
          ).map(([velocity, label]) => (
            <Button
              unstyled
              key={velocity}
              role="radio"
              aria-checked={settings.velocity === velocity}
              className={ui.small({
                className:
                  settings.velocity === velocity
                    ? "bg-white/15 text-white"
                    : undefined,
              })}
              onClick={() => setMidiSettings({ velocity })}
            >
              <span>{label}</span>
            </Button>
          ))}
        </span>
      </Setting>
      <Setting label="Sustain pedal">
        <Toggle
          on={settings.sustain}
          label="Sustain pedal (CC 64) holds notes"
          onChange={(sustain) => setMidiSettings({ sustain })}
        />
      </Setting>
      <Setting label="Drums on channel 10">
        <Toggle
          on={settings.drums}
          label="Channel 10 plays a kit by its General MIDI drum keys"
          onChange={(drums) => setMidiSettings({ drums })}
        />
      </Setting>
    </div>
  );
}

function Monitor() {
  const log = useMidiLog();
  if (log.length === 0)
    return <p className={ui.note()}>Play something on the controller.</p>;
  return (
    <ol className="flex flex-col gap-1 font-mono text-[11px]">
      {log.map(({ id, port, channel, message, use }) => (
        <li
          key={id}
          className="grid grid-cols-[3rem_10rem_minmax(0,1fr)_auto] gap-3"
        >
          <span className="text-white/40">ch {channel}</span>
          <span className="truncate">{message}</span>
          <span
            className={
              use.startsWith("Not")
                ? "truncate text-white/35"
                : "truncate text-sky-300"
            }
          >
            {use}
          </span>
          <span className="max-w-48 truncate text-white/35">{port}</span>
        </li>
      ))}
    </ol>
  );
}

function Mapping({
  connection,
  settings,
}: {
  connection: MidiConnection;
  settings: MidiSettings;
}) {
  const { learning } = connection;
  const on = connection.status === "on";
  const sourceOf = (target: MidiTarget) =>
    settings.mappings.find((mapping) => sameTarget(mapping.target, target))
      ?.source;
  const learnt = learning && sourceOf(learning);

  const cell = (target: MidiTarget, name: string, swatch?: string) => {
    const source = sourceOf(target);
    const waiting = learning !== null && sameTarget(learning, target);
    const styles = midiPanel({ mapped: Boolean(source), learning: waiting });
    return (
      <Button
        unstyled
        key={name}
        aria-pressed={waiting}
        aria-label={`${name}: ${source ? sourceName(source) : "not mapped"}`}
        title={source && `${sourceName(source)} on channel ${source.channel}`}
        disabled={!on}
        className={styles.cell()}
        onClick={() => learnMidi(target)}
      >
        <span className={styles.cellName()}>
          {swatch && (
            <span className={`size-2.5 shrink-0 rounded-full ${swatch}`} />
          )}
          {name}
        </span>
        <span className={styles.cellSource()}>
          {waiting ? "Waiting…" : source ? sourceName(source) : "—"}
        </span>
      </Button>
    );
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h3 className={ui.heading()}>Mapping</h3>
        <Button
          unstyled
          className={ui.small()}
          disabled={settings.mappings.length === 0}
          onClick={() => forgetMidi(null)}
        >
          <span>Forget all</span>
        </Button>
      </div>
      <div
        role="status"
        className="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1 text-xs"
      >
        {learning ? (
          <>
            <span className="text-white">
              Turn a knob or press a pad on the controller for{" "}
              {targetName(learning)}.
            </span>
            {learnt && (
              <Button
                unstyled
                className={ui.small()}
                onClick={() => {
                  forgetMidi(learning);
                  learnMidi(null);
                }}
              >
                <span>Forget {sourceName(learnt)}</span>
              </Button>
            )}
            <Button
              unstyled
              className={ui.small()}
              onClick={() => learnMidi(null)}
            >
              <span>Cancel</span>
            </Button>
          </>
        ) : (
          <span className="text-white/55">
            Click a knob or pad, then move a control on the controller to map
            it. A mapped key presses its pad instead of playing a note.
          </span>
        )}
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-[54rem] flex-col gap-3">
          <div className="grid grid-cols-4 gap-1">
            {MIDI_KNOBS.map(({ slot, name }) =>
              cell({ kind: "knob", slot }, name, KNOB_COLORS[slot]),
            )}
          </div>
          <div
            role="group"
            aria-label="Pads"
            className="grid grid-cols-[repeat(12,minmax(4.25rem,1fr))] gap-1"
          >
            {MIDI_PADS.flat().map(({ control, name }) =>
              cell({ kind: "pad", control }, name),
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Panel({
  onClose,
  className,
}: {
  onClose: () => void;
  className?: string;
}) {
  const connection = useMidiConnection();
  const settings = useMidiSettings();
  const { status, ports } = connection;
  const on = status === "on";

  // Closing stops waiting for a control to map.
  useEffect(() => () => learnMidi(null), []);

  return (
    <aside aria-label="MIDI" className={ui.base({ className })}>
      <div className={ui.header()}>
        <span className="font-medium text-white">MIDI</span>
        <span className="min-w-0 flex-1 truncate text-xs text-white/50">
          {on
            ? ports.length === 0
              ? "No controller plugged in"
              : `${ports.length} ${ports.length === 1 ? "input" : "inputs"}`
            : STATUS[status]}
        </span>
        <Toggle
          on={on || status === "asking"}
          label="MIDI input"
          disabled={status === "unsupported" || status === "asking"}
          onChange={setMidiEnabled}
        />
        <Button
          variant="ghost"
          size="sm"
          className="text-white/60 hover:text-white"
          leadingIcon={<X className="size-4" />}
          aria-label="Close MIDI"
          onClick={onClose}
        />
      </div>
      <div className={ui.body()}>
        <div className={ui.settings()}>
          <section className="flex flex-col gap-2">
            <h3 className={ui.heading()}>Input</h3>
            <Inputs connection={connection} settings={settings} />
          </section>
          <section className="flex flex-col gap-2">
            <h3 className={ui.heading()}>Keys</h3>
            <Keys settings={settings} />
          </section>
        </div>
        <div className={ui.mapping()}>
          <Mapping connection={connection} settings={settings} />
          {on && (
            <section className="mt-3 flex flex-col gap-2">
              <h3 className={ui.heading()}>Monitor</h3>
              <Monitor />
            </section>
          )}
        </div>
      </div>
    </aside>
  );
}

// The button beside the theme toggle that opens and closes the MIDI panel,
// with a dot while a controller is plugged in.
export function MidiButton({ open, onOpenChange }: MidiPanelProps) {
  const { status, ports } = useMidiConnection();
  const live = status === "on" && ports.length > 0;
  return (
    <CornerButton
      aria-expanded={open}
      aria-label={live ? "MIDI (a controller is plugged in)" : "MIDI"}
      leadingIcon={
        <>
          <KeyboardMusic className="w-4 h-4" />
          {live && (
            <span className="absolute top-0.5 right-0.5 size-2 rounded-full bg-emerald-500" />
          )}
        </>
      }
      onClick={() => onOpenChange(!open)}
    />
  );
}

// A dark see-through panel over the page, as the debug overlay is, setting
// up MIDI: turning it on, the input and channel the keys play from, their
// octave, velocity, sustain pedal and drums, and mapping a controller's
// knobs and pads to the Device's, by clicking one and moving the control.
// The Device still plays under it, so a mapping can be tried at once.
export function MidiPanel({ open, onOpenChange, className }: MidiPanelProps) {
  if (!open) return null;
  return <Panel onClose={() => onOpenChange(false)} className={className} />;
}
