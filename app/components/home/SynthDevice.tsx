import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
  type ComponentType,
} from "react";
import {
  ArrowBigUp,
  ArrowLeft,
  ArrowRight,
  CassetteTape,
  Circle,
  Drum,
  Grid3x3,
  Guitar,
  Metronome,
  Piano,
  Play,
  Square,
  Volume2,
  Wind,
  Zap,
} from "lucide-react";
import {
  formatParam,
  stepToValue,
  valueToStep,
} from "../../lib/physical/patches/format";
import { cn } from "../../lib/utils";
import { Key, Knob, Pad } from "../design-system-v2";
import {
  DEVICE_PRESETS,
  KNOB_STEPS,
  controlDefault,
  controlSpec,
  deviceEngine,
  findPreset,
  type DevicePreset,
} from "./deviceEngine";
import { UprightBassIcon, ViolinIcon } from "./instrumentIcons";
import { Oscilloscope } from "./Oscilloscope";
import { useTransport } from "./useTransport";
import styles from "./SynthDevice.module.css";

export interface SynthDeviceProps {
  className?: string;
}

const PRESET_ICONS: Record<string, ComponentType | string> = {
  piano: Piano,
  guitar: Guitar,
  bass: Zap,
  drums: Drum,
  flute: Wind,
  saxophone: Volume2,
  violin: ViolinIcon,
  uprightBass: UprightBassIcon,
  drums808: "808",
};

const INITIAL_PRESET = "piano";
const INITIAL_VOLUME_STEP = 8;

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

const octaveOf = (midi: number) => Math.floor(midi / 12) - 1;

const noteName = (midi: number) => `${NOTE_NAMES[midi % 12]}${octaveOf(midi)}`;

const spokenNote = (midi: number) =>
  `${NOTE_NAMES[midi % 12].replace("#", " sharp")} ${octaveOf(midi)}`;

const engravedNote = (midi: number) => {
  const name = NOTE_NAMES[midi % 12].replace("#", "♯");
  return name === "C" ? `C${octaveOf(midi)}` : name;
};

const defaultSteps = (preset: DevicePreset): [number, number] => [
  valueToStep(controlSpec(preset, 0), controlDefault(preset, 0), KNOB_STEPS),
  valueToStep(controlSpec(preset, 1), controlDefault(preset, 1), KNOB_STEPS),
];

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
  semitones: number[];
  midis: number[];
}

export function SynthDevice({ className }: SynthDeviceProps) {
  const [preset, setPreset] = useState(() => findPreset(INITIAL_PRESET));
  const [controlSteps, setControlSteps] = useState(() => defaultSteps(preset));
  const [volumeStep, setVolumeStep] = useState(INITIAL_VOLUME_STEP);
  const [seekStep, setSeekStep] = useState(0);
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
    deviceEngine.loadPreset(INITIAL_PRESET);
    deviceEngine.setVolume(INITIAL_VOLUME_STEP / (KNOB_STEPS - 1));
  }, []);

  useEffect(() => {
    const heldKeys = held.current;
    const releaseAll = () => {
      if (heldKeys.size === 0) return;
      heldKeys.clear();
      deviceEngine.allNotesOff();
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
      new Set([...held.current.values()].flatMap(({ semitones }) => semitones)),
    );

  const pressKey = (root: number) => {
    if (held.current.has(root)) return;
    deviceEngine.unlock();
    const intervals = chord === null ? [0] : CHORDS[chord].intervals;
    const semitones = intervals.map((interval) => root + interval);
    const midis = semitones.map((semitone) => {
      const midi = F3_MIDI + semitone + 12 * octave;
      deviceEngine.noteOn(midi, 0.8);
      transport.capture(noteName(midi), true);
      return midi;
    });
    held.current.set(root, { semitones, midis });
    syncLitNotes();
  };

  const releaseKey = (root: number) => {
    const entry = held.current.get(root);
    if (!entry) return;
    held.current.delete(root);
    for (const midi of entry.midis) {
      deviceEngine.noteOff(midi);
      transport.capture(noteName(midi), false);
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

  const selectPreset = (id: string) => {
    deviceEngine.unlock();
    const next = deviceEngine.loadPreset(id);
    deviceEngine.preview();
    setPreset(next);
    setControlSteps(defaultSteps(next));
  };

  const step = (direction: 1 | -1) => {
    if (shift) {
      const index = DEVICE_PRESETS.indexOf(preset) + direction;
      const count = DEVICE_PRESETS.length;
      selectPreset(DEVICE_PRESETS[(index + count) % count].id);
    } else {
      setOctave((current) => Math.min(2, Math.max(-2, current + direction)));
    }
  };

  const setControl = (slot: 0 | 1, next: number) => {
    deviceEngine.setControl(
      slot,
      stepToValue(controlSpec(preset, slot), next, KNOB_STEPS),
    );
    setControlSteps((current) => {
      const updated: [number, number] = [current[0], current[1]];
      updated[slot] = next;
      return updated;
    });
  };

  const controlReadout = (slot: 0 | 1) => {
    const spec = controlSpec(preset, slot);
    const value = stepToValue(spec, controlSteps[slot], KNOB_STEPS);
    return {
      label: preset.controls[slot].label,
      value: formatParam(spec, value),
    };
  };

  const renderControlKnob = (slot: 0 | 1, color: string) => {
    const { label, value } = controlReadout(slot);
    return (
      <Knob
        label={label}
        valueLabel={value}
        step={controlSteps[slot]}
        steps={KNOB_STEPS}
        color={color}
        onChange={(next) => setControl(slot, next)}
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
  const primary = controlReadout(0);
  const secondary = controlReadout(1);

  return (
    <div className={cn(styles.stage, className)}>
      <div className={styles.frame}>
        <div
          className={styles.device}
          role="group"
          aria-label="Synthesizer"
          onPointerUp={() => deviceEngine.unlock()}
        >
          <div className={styles.row}>
            <div
              className={cn(styles.pads, styles.bank)}
              role="group"
              aria-label="Presets"
            >
              {DEVICE_PRESETS.map(({ id, name }) => {
                const Icon = PRESET_ICONS[id];
                return (
                  <Pad
                    key={id}
                    label={name}
                    accent="var(--synth-orange)"
                    pressed={preset.id === id}
                    onPress={() => selectPreset(id)}
                  >
                    {typeof Icon === "string" ? Icon : <Icon />}
                  </Pad>
                );
              })}
            </div>

            <div className={styles.knobColumn}>
              <Knob
                label="Seek"
                step={seekStep}
                steps={KNOB_STEPS}
                color="var(--synth-ink)"
                onChange={setSeekStep}
              />
              <Knob
                label="Volume"
                valueLabel={`${volumeStep * 10}%`}
                step={volumeStep}
                steps={KNOB_STEPS}
                color="var(--synth-chalk)"
                markColor="#141413"
                onChange={(next) => {
                  setVolumeStep(next);
                  deviceEngine.setVolume(next / (KNOB_STEPS - 1));
                }}
              />
            </div>

            <div className={styles.screen}>
              <div className={styles.glass}>
                <div className={styles.readout}>
                  <span aria-live="polite">{preset.name}</span>
                  <span>{octaveLabel}</span>
                </div>
                <Oscilloscope
                  className={styles.scope}
                  getAnalyser={deviceEngine.getAnalyser}
                />
                <div className={cn(styles.readout, styles.readoutBottom)}>
                  <span>
                    {primary.label} {primary.value}
                  </span>
                  <span>
                    {secondary.label} {secondary.value}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.knobColumn}>
              {renderControlKnob(0, "var(--synth-orange)")}
              {renderControlKnob(1, "var(--synth-blue)")}
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
                  onPress={() => {
                    deviceEngine.unlock();
                    transport.play();
                  }}
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
                  onPress={() => {
                    deviceEngine.unlock();
                    transport.toggleMetronome();
                  }}
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
