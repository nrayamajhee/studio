import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowBigUp,
  ArrowLeft,
  ArrowRight,
  AudioWaveform,
  CassetteTape,
  Circle,
  Drum,
  Grid3x3,
  Guitar,
  KeyboardMusic,
  Metronome,
  Piano,
  Play,
  Square,
  Volume2,
  Waves,
  Wind,
  Zap,
} from "lucide-react";
import { synth, SYNTH_PRESETS, type SynthParams } from "../../lib/synth";
import { cn } from "../../lib/utils";
import { Key, Knob, Pad } from "../design-system-v2";
import { useTransport } from "./useTransport";
import styles from "./SynthDevice.module.css";

export interface SynthDeviceProps {
  className?: string;
}

type KnobParam = "osc1Wave" | "masterVol" | "release" | "cutoff";

const KNOBS = {
  osc1Wave: {
    label: "Waveform",
    detents: ["sine", "triangle", "sawtooth", "square"],
    values: ["Sine", "Triangle", "Saw", "Square"],
  },
  masterVol: {
    label: "Volume",
    detents: [0.25, 0.5, 0.75, 1],
    values: ["25%", "50%", "75%", "100%"],
  },
  release: {
    label: "Release",
    detents: [0.25, 0.6, 1.2, 2.4],
    values: ["0.25 s", "0.6 s", "1.2 s", "2.4 s"],
  },
  cutoff: {
    label: "Filter cutoff",
    detents: [500, 1400, 4000, 14000],
    values: ["500 Hz", "1.4 kHz", "4 kHz", "14 kHz"],
  },
} satisfies Record<
  KnobParam,
  { label: string; detents: SynthParams[KnobParam][]; values: string[] }
>;

const INSTRUMENTS = [
  {
    key: "grand_piano",
    name: "Piano",
    icon: Piano,
    family: ["grand_piano", "electronic_pino", "rhodes_piano", "lofi_keys"],
  },
  {
    key: "acoustic_guitar",
    name: "Guitar",
    icon: Guitar,
    family: [
      "acoustic_guitar",
      "electric_guitar",
      "classical_guitar",
      "ukelele",
    ],
  },
  {
    key: "base_guitar",
    name: "Bass",
    icon: Zap,
    family: ["base_guitar", "acid_bass"],
  },
  {
    key: "drum_set",
    name: "Drums",
    icon: Drum,
    family: [
      "drum_set",
      "drum_808",
      "trap_kit",
      "electronic_drums",
      "acoustic_percussion",
    ],
  },
  { key: "flute", name: "Flute", icon: Wind, family: ["flute"] },
  { key: "saxophone", name: "Sax", icon: Volume2, family: ["saxophone"] },
  {
    key: "vintage_synth",
    name: "Synth",
    icon: AudioWaveform,
    family: ["vintage_synth", "pluck_synth"],
  },
  {
    key: "strings_ensemble",
    name: "Strings",
    icon: Waves,
    family: ["strings_ensemble"],
  },
  { key: "organ", name: "Organ", icon: KeyboardMusic, family: ["organ"] },
];

const PRESET_KEYS = Object.keys(SYNTH_PRESETS);
const INITIAL_PRESET = "grand_piano";

const CHORDS = [
  { name: "Major", label: "Maj", intervals: [0, 4, 7] },
  { name: "Minor", label: "Min", intervals: [0, 3, 7] },
  { name: "Dominant 7", label: "Dom7", intervals: [0, 4, 7, 10] },
  { name: "Major 7", label: "Maj7", intervals: [0, 4, 7, 11] },
  { name: "Minor 7", label: "Min7", intervals: [0, 3, 7, 10] },
  { name: "Suspended 4", label: "Sus4", intervals: [0, 5, 7] },
  { name: "Power", label: "Power", intervals: [0, 7, 12] },
  { name: "Diminished", label: "Dim", intervals: [0, 3, 6] },
  { name: "Add 9", label: "Add9", intervals: [0, 4, 7, 14] },
];

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
const F3_MIDI = 53;
const WHITE_KEYS = [0, 2, 4, 6, 7, 9, 11, 12, 14, 16, 18, 19, 21, 23];
const BLACK_KEYS = [1, 3, 5, 8, 10, 13, 15, 17, 20, 22];

// Indexed by keybed semitone (F3 = 0). Three zones, each with its white keys on
// one row and every black key on the row above, between its neighbours:
// F3–B3 on Q W E R (black keys 2 3 4), C4–B4 on Z X C V B N M (black keys
// S D G H J), and C5–E5 on P [ ] (black keys - =). Zones meet at B|C, where
// there is no black key to split between them.
const HOTKEYS = [
  "Q",
  "2",
  "W",
  "3",
  "E",
  "4",
  "R",
  "Z",
  "S",
  "X",
  "D",
  "C",
  "V",
  "G",
  "B",
  "H",
  "N",
  "J",
  "M",
  "P",
  "-",
  "[",
  "=",
  "]",
];

const KEY_CODES: Record<string, string> = {
  "-": "Minus",
  "=": "Equal",
  "[": "BracketLeft",
  "]": "BracketRight",
};

const keyCode = (hotkey: string) =>
  KEY_CODES[hotkey] ??
  (/^\d$/.test(hotkey) ? `Digit${hotkey}` : `Key${hotkey}`);

const HOTKEY_SEMITONES = new Map(
  HOTKEYS.map((hotkey, semitone) => [keyCode(hotkey), semitone]),
);

const WAVE_SHAPES: ((phase: number) => number)[] = [
  (phase) => Math.sin(phase * Math.PI * 2),
  (phase) =>
    phase < 0.25 ? phase * 4 : phase < 0.75 ? 2 - phase * 4 : phase * 4 - 4,
  (phase) => 1 - phase * 2,
  (phase) => (phase < 0.5 ? 1 : -1),
];

const WAVE_PATHS = WAVE_SHAPES.map((shape) => {
  const points = [];
  for (let x = 0; x <= 360; x += 3) {
    points.push(`${x} ${(50 - shape((x % 120) / 120) * 36).toFixed(1)}`);
  }
  return `M${points.join(" L")}`;
});

const octaveOf = (midi: number) => Math.floor(midi / 12) - 1;

const noteName = (midi: number) => `${NOTE_NAMES[midi % 12]}${octaveOf(midi)}`;

const spokenNote = (midi: number) =>
  `${NOTE_NAMES[midi % 12].replace("#", " sharp")} ${octaveOf(midi)}`;

const engravedNote = (midi: number) => {
  const name = NOTE_NAMES[midi % 12].replace("#", "♯");
  return name === "C" ? `C${octaveOf(midi)}` : name;
};

function detentOf(param: KnobParam, params: SynthParams) {
  const value = params[param];
  const detents: readonly (string | number)[] = KNOBS[param].detents;
  if (typeof value === "string") return Math.max(0, detents.indexOf(value));
  const distance = (detent: string | number) =>
    Math.abs(Math.log(value / Number(detent)));
  return detents.reduce<number>(
    (best, detent, index) =>
      distance(detent) < distance(detents[best]) ? index : best,
    0,
  );
}

function useFlash(ms: number) {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const flash = useCallback(() => {
    clearTimeout(timer.current);
    setOn(true);
    timer.current = setTimeout(() => setOn(false), ms);
  }, [ms]);

  return [on, flash] as const;
}

interface HeldKey {
  notes: number[];
  voices: { key: string; note: string }[];
}

export function SynthDevice({ className }: SynthDeviceProps) {
  const [presetKey, setPresetKey] = useState(INITIAL_PRESET);
  const [params, setParams] = useState<SynthParams>(() => ({
    ...SYNTH_PRESETS[INITIAL_PRESET],
  }));
  const [octave, setOctave] = useState(0);
  const [shift, setShift] = useState(false);
  const [chord, setChord] = useState<number | null>(null);
  const [litNotes, setLitNotes] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const [stopLit, flashStop] = useFlash(140);
  const held = useRef(new Map<number, HeldKey>());
  const transport = useTransport();

  useEffect(() => {
    synth.loadPreset(INITIAL_PRESET);
  }, []);

  useEffect(() => {
    const heldKeys = held.current;
    const releaseAll = () => {
      heldKeys.forEach(({ voices }) =>
        voices.forEach(({ key }) => synth.stopNote(key)),
      );
      heldKeys.clear();
      setLitNotes(new Set());
    };
    const releaseWhenHidden = () => {
      if (document.hidden) releaseAll();
    };
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", releaseWhenHidden);
    return () => {
      releaseAll();
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", releaseWhenHidden);
    };
  }, []);

  const syncLitNotes = () =>
    setLitNotes(
      new Set([...held.current.values()].flatMap(({ notes }) => notes)),
    );

  const pressKey = (root: number) => {
    if (held.current.has(root)) return;
    const intervals = chord === null ? [0] : CHORDS[chord].intervals;
    const notes = intervals.map((interval) => root + interval);
    const voices = notes.map((semitone) => {
      const note = noteName(F3_MIDI + semitone + 12 * octave);
      const key = `key-${root}-${semitone}`;
      synth.playNote(note, undefined, undefined, 0.8, undefined, key);
      transport.capture(note, true);
      return { key, note };
    });
    held.current.set(root, { notes, voices });
    syncLitNotes();
  };

  const releaseKey = (root: number) => {
    const entry = held.current.get(root);
    if (!entry) return;
    held.current.delete(root);
    for (const { key, note } of entry.voices) {
      synth.stopNote(key);
      transport.capture(note, false);
    }
    syncLitNotes();
  };

  const onHotkey = useEffectEvent((event: KeyboardEvent, down: boolean) => {
    const semitone = HOTKEY_SEMITONES.get(event.code);
    if (semitone === undefined) return;
    if (!down) {
      releaseKey(semitone);
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (
      event.target instanceof Element &&
      event.target.closest("input, textarea, select, [contenteditable]")
    ) {
      return;
    }
    event.preventDefault();
    if (!event.repeat) pressKey(semitone);
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => onHotkey(event, true);
    const handleKeyUp = (event: KeyboardEvent) => onHotkey(event, false);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const selectPreset = (key: string) => {
    synth.loadPreset(key);
    synth.playNote("C4", undefined, 0.35);
    setPresetKey(key);
    setParams({ ...SYNTH_PRESETS[key] });
  };

  const step = (direction: 1 | -1) => {
    if (shift) {
      const index = PRESET_KEYS.indexOf(presetKey) + direction;
      selectPreset(
        PRESET_KEYS[(index + PRESET_KEYS.length) % PRESET_KEYS.length],
      );
    } else {
      setOctave((current) => Math.min(2, Math.max(-2, current + direction)));
    }
  };

  const setKnob = (param: KnobParam, detent: number) => {
    const value = KNOBS[param].detents[detent];
    synth.updateParam(param, value as never);
    setParams((current) => ({ ...current, [param]: value }));
  };

  const renderKnob = (param: KnobParam, color: string, markColor?: string) => {
    const detent = detentOf(param, params);
    return (
      <Knob
        label={KNOBS[param].label}
        valueLabel={KNOBS[param].values[detent]}
        step={detent}
        steps={KNOBS[param].detents.length}
        color={color}
        markColor={markColor}
        onChange={(next) => setKnob(param, next)}
      />
    );
  };

  const renderKey = (semitone: number, slot: number, black: boolean) => {
    const midi = F3_MIDI + semitone + 12 * octave;
    return (
      <Key
        key={semitone}
        variant={black ? "black" : "white"}
        label={spokenNote(midi)}
        note={engravedNote(midi)}
        hotkey={HOTKEYS[semitone]}
        lit={litNotes.has(semitone)}
        className={cn(styles.slot, black ? styles.blackSlot : styles.whiteSlot)}
        style={{ "--slot": slot } as CSSProperties}
        onPress={() => pressKey(semitone)}
        onRelease={() => releaseKey(semitone)}
      />
    );
  };

  const renderSparePads = (first: number, count: number) =>
    Array.from({ length: count }, (_, index) => (
      <Pad key={index} label={`Unassigned pad ${first + index}`} />
    ));

  const octaveLabel = `OCT ${octave > 0 ? "+" : octave < 0 ? "−" : "±"}${Math.abs(octave)}`;

  return (
    <div className={cn(styles.stage, className)}>
      <div className={styles.frame}>
        <div
          className={styles.device}
          role="group"
          aria-label="Synthesizer"
          onPointerUp={() => synth.ensureContext()}
        >
          <div className={styles.row}>
            <div
              className={cn(styles.pads, styles.bank)}
              role="group"
              aria-label="Presets"
            >
              {INSTRUMENTS.map(({ key, name, icon: Icon, family }) => (
                <Pad
                  key={key}
                  label={name}
                  accent="var(--synth-orange)"
                  pressed={family.includes(presetKey)}
                  onPress={() => selectPreset(key)}
                >
                  <Icon />
                </Pad>
              ))}
            </div>

            <div className={styles.knobColumn}>
              {renderKnob("osc1Wave", "var(--synth-ink)")}
              {renderKnob("masterVol", "var(--synth-chalk)", "#141413")}
            </div>

            <div className={styles.screen}>
              <div className={styles.glass}>
                <div className={styles.readout}>
                  <span aria-live="polite">{params.name}</span>
                  <span>{octaveLabel}</span>
                </div>
                <svg
                  className={styles.scope}
                  viewBox="0 0 360 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <line
                    x1="0"
                    y1="50"
                    x2="360"
                    y2="50"
                    stroke="#2a2a2a"
                    strokeWidth="1"
                    strokeDasharray="3 5"
                  />
                  <path
                    d={WAVE_PATHS[detentOf("osc1Wave", params)]}
                    fill="none"
                    stroke="#f4f3ef"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>

            <div className={styles.knobColumn}>
              {renderKnob("release", "var(--synth-orange)")}
              {renderKnob("cutoff", "var(--synth-blue)")}
            </div>

            <div
              className={cn(styles.pads, styles.bank)}
              role="group"
              aria-label="Chord macros"
            >
              {CHORDS.map(({ name, label }, index) => (
                <Pad
                  key={name}
                  label={`${name} chord`}
                  accent="var(--synth-blue)"
                  pressed={chord === index}
                  onPress={() =>
                    setChord((current) => (current === index ? null : index))
                  }
                >
                  {label}
                </Pad>
              ))}
            </div>
          </div>

          <div className={styles.row}>
            <div className={cn(styles.pads, styles.bank)}>
              <div
                className={styles.padRow}
                role="group"
                aria-label="Octave and preset navigation"
              >
                <Pad
                  label={shift ? "Previous preset" : "Octave down"}
                  accent="var(--synth-orange)"
                  lit={octave < 0}
                  onPress={() => step(-1)}
                >
                  <ArrowLeft />
                </Pad>
                <Pad
                  label={shift ? "Next preset" : "Octave up"}
                  accent="var(--synth-orange)"
                  lit={octave > 0}
                  onPress={() => step(1)}
                >
                  <ArrowRight />
                </Pad>
                <Pad
                  label="Shift"
                  accent="var(--synth-orange)"
                  pressed={shift}
                  onPress={() => setShift((on) => !on)}
                >
                  <ArrowBigUp />
                </Pad>
              </div>
              {renderSparePads(1, 3)}
              <div
                className={styles.padRow}
                role="group"
                aria-label="Transport"
              >
                <Pad
                  label="Play"
                  accent="var(--synth-green)"
                  lit={transport.state === "playing"}
                  onPress={transport.play}
                >
                  <Play fill="currentColor" />
                </Pad>
                <Pad
                  label="Stop"
                  accent="var(--synth-green)"
                  lit={stopLit}
                  onPress={() => {
                    transport.stop();
                    flashStop();
                  }}
                >
                  <Square fill="currentColor" />
                </Pad>
                <Pad
                  label="Record"
                  accent="var(--synth-orange)"
                  pressed={transport.state === "recording"}
                  onPress={transport.record}
                >
                  <Circle fill="currentColor" />
                </Pad>
              </div>
            </div>

            <div className={styles.keybed}>
              <div className={styles.keys} role="group" aria-label="Piano keys">
                {WHITE_KEYS.map((semitone, slot) =>
                  renderKey(semitone, slot, false),
                )}
                {BLACK_KEYS.map((semitone) =>
                  renderKey(
                    semitone,
                    WHITE_KEYS.indexOf(semitone - 1) + 1,
                    true,
                  ),
                )}
              </div>
            </div>

            <div className={cn(styles.pads, styles.bank)}>
              {renderSparePads(4, 6)}
              <div className={styles.padRow} role="group" aria-label="Recorder">
                <Pad
                  label="Tape"
                  accent="var(--synth-green)"
                  pressed={transport.mode === "tape"}
                  onPress={() => transport.setMode("tape")}
                >
                  <CassetteTape />
                </Pad>
                <Pad
                  label="Sequencer"
                  accent="var(--synth-green)"
                  pressed={transport.mode === "sequencer"}
                  onPress={() => transport.setMode("sequencer")}
                >
                  <Grid3x3 />
                </Pad>
                <Pad
                  label="Metronome"
                  accent="var(--synth-green)"
                  pressed={transport.metronome}
                  onPress={transport.toggleMetronome}
                >
                  <Metronome />
                </Pad>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
