import { useEffect, useEffectEvent, useSyncExternalStore } from "react";
import { createEmitter } from "../../../lib/emitter";
import type { KnobSlot } from "../../../types/bindings";
import { KEY_VELOCITY } from "../deviceMath";
import { controlId, type Control } from "./keymap";

// A pad on the Device, by the control its key presses.
export type PadControl = Exclude<Control, { kind: "note" }>;

// A control on a MIDI device: a knob or button sending a CC, or a key or
// pad sending a note, on its channel (1–16).
export type MidiSource = {
  type: "cc" | "note";
  channel: number;
  number: number;
};

export type MidiTarget =
  { kind: "knob"; slot: KnobSlot } | { kind: "pad"; control: PadControl };

export type MidiMapping = { source: MidiSource; target: MidiTarget };

export type MidiSettings = {
  // Connect again on the next visit, if the browser still allows it.
  enabled: boolean;
  // The input listened to, by name, or null for every input.
  input: string | null;
  // The channel the keys play from, or null for any.
  channel: number | null;
  // Octaves added to every key.
  octave: number;
  // As played, or every key at the keybed's own velocity.
  velocity: "played" | "fixed";
  // CC 64 holds notes after their keys let go.
  sustain: boolean;
  // Channel 10 strikes a kit's pieces by their General MIDI keys.
  drums: boolean;
  mappings: readonly MidiMapping[];
};

export type MidiStatus = "unsupported" | "off" | "asking" | "blocked" | "on";

export type MidiPort = { id: string; name: string; manufacturer: string };

export type MidiConnection = {
  status: MidiStatus;
  ports: readonly MidiPort[];
  // The knob or pad waiting for a control to be moved, to map it.
  learning: MidiTarget | null;
};

export type MidiLogEntry = {
  id: number;
  port: string;
  channel: number;
  message: string;
  // What the Device did with it.
  use: string;
};

// What the Device is told: a key, a mapped knob turned to `value` (0–1), or
// a mapped pad pressed or let go. `id` pairs a let-go with its press.
export type MidiEvent =
  | {
      kind: "note";
      id: string;
      note: number;
      down: boolean;
      velocity: number;
      // On the drum channel, so a kit takes it by its General MIDI key.
      drums: boolean;
    }
  | { kind: "knob"; slot: KnobSlot; value: number }
  | { kind: "pad"; id: string; control: PadControl; down: boolean };

export const MIDI_KEY = "studio.midi";
export const DRUM_CHANNEL = 10;
export const OCTAVE_RANGE = 3;
const SUSTAIN_CC = 64;
const ALL_SOUND_OFF_CC = 120;
const ALL_NOTES_OFF_CC = 123;
const LOG_LENGTH = 8;

export const MIDI_KNOBS: readonly { slot: KnobSlot; name: string }[] = [
  { slot: "chalk", name: "White knob" },
  { slot: "green", name: "Green knob" },
  { slot: "red", name: "Red knob" },
  { slot: "blue", name: "Blue knob" },
];

const tool = (name: Extract<PadControl, { kind: "tool" }>["tool"]) =>
  ({ kind: "tool", tool: name }) as const;
const numbered = (kind: "instrument" | "chord", name: string, from: number) =>
  [0, 1, 2].map((offset) => ({
    control: { kind, index: from + offset } as PadControl,
    name: `${name} ${from + offset + 1}`,
  }));

// The pads, three rows of twelve as the Device lays them out.
export const MIDI_PADS: readonly (readonly {
  control: PadControl;
  name: string;
}[])[] = [
  [
    { control: tool("play"), name: "Play" },
    { control: tool("stop"), name: "Stop" },
    { control: tool("record"), name: "Record" },
    { control: tool("save"), name: "Save" },
    { control: tool("tapes"), name: "Tapes" },
    { control: tool("synth"), name: "Synth" },
    { control: tool("adsr"), name: "ADSR" },
    { control: tool("lfo"), name: "LFO" },
    { control: tool("fx"), name: "FX" },
    { control: tool("chords"), name: "Chords" },
    { control: tool("playStyle"), name: "Play style" },
    { control: tool("metronome"), name: "Tempo" },
  ],
  [
    { control: tool("clip"), name: "Clip" },
    { control: tool("mute"), name: "Mute" },
    { control: { kind: "pick", direction: -1 }, name: "↑" },
    { control: tool("delete"), name: "Delete" },
    { control: tool("tracks"), name: "Tracks" },
    { control: tool("roll"), name: "Piano roll" },
    ...numbered("instrument", "Instrument", 0),
    ...numbered("chord", "Chord", 0),
  ],
  [
    { control: { kind: "shift" }, name: "Shift" },
    { control: { kind: "step", direction: -1 }, name: "←" },
    { control: { kind: "pick", direction: 1 }, name: "↓" },
    { control: { kind: "step", direction: 1 }, name: "→" },
    { control: tool("instruments"), name: "Instruments" },
    { control: tool("drumGrid"), name: "Drum grid" },
    ...numbered("instrument", "Instrument", 3),
    ...numbered("chord", "Chord", 3),
  ],
];

const PADS = new Map(
  MIDI_PADS.flat().map((pad) => [controlId(pad.control), pad] as const),
);

export const targetName = (target: MidiTarget) =>
  target.kind === "knob"
    ? (MIDI_KNOBS.find(({ slot }) => slot === target.slot)?.name ?? "Knob")
    : (PADS.get(controlId(target.control))?.name ?? "Pad");

export const sameTarget = (a: MidiTarget, b: MidiTarget) =>
  a.kind === "knob"
    ? b.kind === "knob" && a.slot === b.slot
    : b.kind === "pad" && controlId(a.control) === controlId(b.control);

const sourceId = ({ type, channel, number }: MidiSource) =>
  `${type}:${channel}:${number}`;

const NOTE_NAMES = [
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
];
export const noteName = (note: number) =>
  `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1}`;

export const sourceName = ({ type, number }: MidiSource) =>
  type === "cc" ? `CC ${number}` : noteName(number);

const DEFAULTS: MidiSettings = {
  enabled: false,
  input: null,
  channel: null,
  octave: 0,
  velocity: "played",
  sustain: true,
  drums: true,
  mappings: [],
};

const isMidiNumber = (value: unknown, low = 0, high = 127) =>
  Number.isInteger(value) &&
  (value as number) >= low &&
  (value as number) <= high;

function readMapping(stored: unknown): MidiMapping | null {
  const { source, target } = (stored ?? {}) as Record<string, unknown>;
  const { type, channel, number } = (source ?? {}) as Record<string, unknown>;
  if (
    (type !== "cc" && type !== "note") ||
    !isMidiNumber(channel, 1, 16) ||
    !isMidiNumber(number)
  )
    return null;
  const { kind, slot, control } = (target ?? {}) as Record<string, unknown>;
  const knob = MIDI_KNOBS.find((candidate) => candidate.slot === slot);
  const pad =
    kind === "pad" && control && typeof control === "object"
      ? PADS.get(controlId(control as PadControl))
      : undefined;
  const mapped: MidiTarget | null =
    kind === "knob" && knob && type === "cc"
      ? { kind: "knob", slot: knob.slot }
      : pad
        ? { kind: "pad", control: pad.control }
        : null;
  return (
    mapped && {
      source: { type, channel, number } as MidiSource,
      target: mapped,
    }
  );
}

function readSettings(): MidiSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(MIDI_KEY) ?? "null");
    if (!stored || typeof stored !== "object") return DEFAULTS;
    return {
      enabled: stored.enabled === true,
      input: typeof stored.input === "string" ? stored.input : null,
      channel: isMidiNumber(stored.channel, 1, 16) ? stored.channel : null,
      octave: isMidiNumber(stored.octave, -OCTAVE_RANGE, OCTAVE_RANGE)
        ? stored.octave
        : 0,
      velocity: stored.velocity === "fixed" ? "fixed" : "played",
      sustain: stored.sustain !== false,
      drums: stored.drums !== false,
      mappings: Array.isArray(stored.mappings)
        ? stored.mappings.flatMap(
            (mapping: unknown) => readMapping(mapping) ?? [],
          )
        : [],
    };
  } catch {
    return DEFAULTS;
  }
}

let settings: MidiSettings | null = null;
let connection: MidiConnection = { status: "off", ports: [], learning: null };
let log: readonly MidiLogEntry[] = [];
const settingsListeners = new Set<() => void>();
const connectionListeners = new Set<() => void>();
const logListeners = new Set<() => void>();
const events = createEmitter<MidiEvent>();

const getSettings = () => (settings ??= readSettings());

function saveSettings(next: MidiSettings) {
  settings = next;
  try {
    localStorage.setItem(MIDI_KEY, JSON.stringify(next));
  } catch {
    // Storage can be unavailable (private mode); the change still applies.
  }
  settingsListeners.forEach((listener) => listener());
}

function setConnection(patch: Partial<MidiConnection>) {
  connection = { ...connection, ...patch };
  connectionListeners.forEach((listener) => listener());
}

let access: MIDIAccess | null = null;
let started = false;

const supported = () =>
  typeof navigator !== "undefined" && "requestMIDIAccess" in navigator;

// Connects on the first listener, if MIDI was on last visit and the browser
// lets it in without asking (asking needs a click in the panel).
function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (!supported()) {
    setConnection({ status: "unsupported" });
    return;
  }
  if (!getSettings().enabled) return;
  void navigator.permissions
    .query({ name: "midi" as PermissionName })
    .then(
      ({ state }) => state === "granted",
      () => true,
    )
    .then((granted) => {
      if (granted) void connect();
    });
}

async function connect() {
  if (access || connection.status === "asking") return;
  setConnection({ status: "asking" });
  try {
    access = await navigator.requestMIDIAccess();
  } catch {
    saveSettings({ ...getSettings(), enabled: false });
    setConnection({ status: "blocked" });
    return;
  }
  access.onstatechange = (event) => {
    if ((event as MIDIConnectionEvent).port?.state === "disconnected")
      releaseAll();
    refreshPorts();
  };
  refreshPorts();
  setConnection({ status: "on" });
}

function disconnect() {
  releaseAll();
  if (access) {
    access.onstatechange = null;
    access.inputs.forEach((input) => {
      input.onmidimessage = null;
      void input.close();
    });
  }
  access = null;
  setConnection({ status: "off", ports: [], learning: null });
}

function refreshPorts() {
  const ports: MidiPort[] = [];
  access?.inputs.forEach((input) => {
    if (input.state !== "connected") return;
    input.onmidimessage = ({ data }) => {
      if (data) receive(input, data);
    };
    ports.push({
      id: input.id,
      name: input.name ?? "MIDI input",
      manufacturer: input.manufacturer ?? "",
    });
  });
  setConnection({ ports });
}

type HeldNote = { note: number; drums: boolean };

const heldNotes = new Map<string, HeldNote>();
// Let go of while the pedal is down: they sound until it comes up.
const sustainedNotes = new Map<string, HeldNote>();
const heldPads = new Map<string, PadControl>();
let pedal = false;

const noteOff = (id: string, { note, drums }: HeldNote) =>
  events.emit({ kind: "note", id, note, down: false, velocity: 0, drums });

function pressPad(id: string, control: PadControl, down: boolean) {
  if (heldPads.has(id) === down) return;
  if (down) heldPads.set(id, control);
  else heldPads.delete(id);
  events.emit({ kind: "pad", id, control, down });
}

function setPedal(down: boolean) {
  if (pedal === down) return;
  pedal = down;
  if (down) return;
  sustainedNotes.forEach((held, id) => noteOff(id, held));
  sustainedNotes.clear();
}

function releaseAll() {
  pedal = false;
  [...heldNotes, ...sustainedNotes].forEach(([id, held]) => noteOff(id, held));
  heldNotes.clear();
  sustainedNotes.clear();
  [...heldPads].forEach(([id, control]) => pressPad(id, control, false));
}

const mappingFor = (source: MidiSource) =>
  getSettings().mappings.find(
    (mapping) => sourceId(mapping.source) === sourceId(source),
  );

// Maps the control just moved to the knob or pad waiting for one (a knob
// takes only a CC), in place of whatever either was mapped to before.
function learnFrom(source: MidiSource): MidiTarget | null {
  const target = connection.learning;
  if (!target || (target.kind === "knob" && source.type !== "cc")) return null;
  const current = getSettings();
  saveSettings({
    ...current,
    mappings: [
      ...current.mappings.filter(
        (mapping) =>
          sourceId(mapping.source) !== sourceId(source) &&
          !sameTarget(mapping.target, target),
      ),
      { source, target },
    ],
  });
  setConnection({ learning: null });
  return target;
}

function receiveNote(channel: number, number: number, velocity: number) {
  const source: MidiSource = { type: "note", channel, number };
  const id = sourceId(source);
  const learned = velocity > 0 ? learnFrom(source) : null;
  if (learned) return `Mapped to ${targetName(learned)}`;
  const mapping = mappingFor(source);
  if (mapping?.target.kind === "pad") {
    pressPad(id, mapping.target.control, velocity > 0);
    return targetName(mapping.target);
  }
  if (velocity === 0) {
    const held = heldNotes.get(id);
    if (!held) return "Keys";
    heldNotes.delete(id);
    if (pedal && !held.drums) sustainedNotes.set(id, held);
    else noteOff(id, held);
    return "Keys";
  }
  const current = getSettings();
  const drums = current.drums && channel === DRUM_CHANNEL;
  if (!drums && current.channel !== null && channel !== current.channel)
    return "Not this channel";
  // A key struck again while it still sounds lets go of it first.
  const sounding = heldNotes.get(id) ?? sustainedNotes.get(id);
  if (sounding) {
    heldNotes.delete(id);
    sustainedNotes.delete(id);
    noteOff(id, sounding);
  }
  const note = drums
    ? number
    : Math.min(127, Math.max(0, number + 12 * current.octave));
  heldNotes.set(id, { note, drums });
  events.emit({
    kind: "note",
    id,
    note,
    down: true,
    velocity: current.velocity === "fixed" ? KEY_VELOCITY : velocity / 127,
    drums,
  });
  return drums ? "Drums" : "Keys";
}

function receiveControl(channel: number, number: number, value: number) {
  const source: MidiSource = { type: "cc", channel, number };
  const learned = learnFrom(source);
  if (learned) return `Mapped to ${targetName(learned)}`;
  const mapping = mappingFor(source);
  if (mapping) {
    if (mapping.target.kind === "knob")
      events.emit({
        kind: "knob",
        slot: mapping.target.slot,
        value: value / 127,
      });
    else pressPad(sourceId(source), mapping.target.control, value >= 64);
    return targetName(mapping.target);
  }
  const current = getSettings();
  if (current.channel !== null && channel !== current.channel)
    return "Not this channel";
  if (number === SUSTAIN_CC && current.sustain) {
    setPedal(value >= 64);
    return "Sustain";
  }
  if (number === ALL_SOUND_OFF_CC || number === ALL_NOTES_OFF_CC) {
    releaseAll();
    return "All notes off";
  }
  return "Not mapped";
}

let logId = 0;

function receive(input: MIDIInput, data: Uint8Array) {
  const only = getSettings().input;
  if (only !== null && input.name !== only) return;
  const [status, number = 0, value = 0] = data;
  const type = status >> 4;
  // System messages (clock, active sensing…) carry no channel.
  if (type < 0x8 || type > 0xe) return;
  const channel = (status & 0x0f) + 1;
  let message: string;
  let use = "Not used";
  if (type === 0x9 && value > 0) {
    message = `Note on ${noteName(number)} · ${value}`;
    use = receiveNote(channel, number, value);
  } else if (type === 0x8 || type === 0x9) {
    message = `Note off ${noteName(number)}`;
    use = receiveNote(channel, number, 0);
  } else if (type === 0xb) {
    message = `CC ${number} · ${value}`;
    use = receiveControl(channel, number, value);
  } else if (type === 0xe) {
    message = "Pitch bend";
  } else if (type === 0xc) {
    message = `Program ${number}`;
  } else {
    message = "Pressure";
  }
  log = [
    { id: logId++, port: input.name ?? "", channel, message, use },
    ...log,
  ].slice(0, LOG_LENGTH);
  logListeners.forEach((listener) => listener());
}

const subscribeTo = (listeners: Set<() => void>) => (listener: () => void) => {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const subscribeSettings = subscribeTo(settingsListeners);
const subscribeConnection = subscribeTo(connectionListeners);
const subscribeLog = subscribeTo(logListeners);

export const useMidiSettings = () =>
  useSyncExternalStore(subscribeSettings, getSettings, () => DEFAULTS);

const OFF: MidiConnection = { status: "off", ports: [], learning: null };
export const useMidiConnection = () =>
  useSyncExternalStore(
    subscribeConnection,
    () => connection,
    () => OFF,
  );

const NO_LOG: readonly MidiLogEntry[] = [];
export const useMidiLog = () =>
  useSyncExternalStore(
    subscribeLog,
    () => log,
    () => NO_LOG,
  );

// Runs the handler on every key, mapped knob and mapped pad, as it happens.
export function useMidiListener(handler: (event: MidiEvent) => void) {
  const onEvent = useEffectEvent(handler);
  useEffect(() => {
    start();
    return events.subscribe((event) => onEvent(event));
  }, []);
}

// Turning MIDI on asks the browser for it, so it runs from a click.
export function setMidiEnabled(on: boolean) {
  saveSettings({ ...getSettings(), enabled: on });
  if (on) void connect();
  else disconnect();
}

export function setMidiSettings(
  patch: Partial<Omit<MidiSettings, "enabled" | "mappings">>,
) {
  const current = getSettings();
  // A key held on the old input or channel would never hear its let-go.
  if (
    (patch.input !== undefined && patch.input !== current.input) ||
    (patch.channel !== undefined && patch.channel !== current.channel)
  )
    releaseAll();
  if (patch.sustain === false) setPedal(false);
  saveSettings({ ...current, ...patch });
}

// Waits for a control to be moved to map it to `target`; null, or the same
// target again, stops waiting.
export function learnMidi(target: MidiTarget | null) {
  const waiting = connection.learning;
  setConnection({
    learning: target && waiting && sameTarget(waiting, target) ? null : target,
  });
}

export function forgetMidi(target: MidiTarget | null) {
  const current = getSettings();
  releaseAll();
  saveSettings({
    ...current,
    mappings: target
      ? current.mappings.filter(
          (mapping) => !sameTarget(mapping.target, target),
        )
      : [],
  });
}
