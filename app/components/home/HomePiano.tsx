import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { synth, SYNTH_PRESETS, type SynthParams } from "../../lib/synth";
import { cn } from "../../lib/utils";
import { Button } from "../design-system/Button";
import { Card, Key, Knob, Pad } from "../design-system-v2";
import { SYNTH_SECTIONS } from "./synthSections";
import { SynthScreen } from "./SynthScreen";
import styles from "./HomePiano.module.css";

export interface HomePianoProps {
  className?: string;
  startOctave?: number;
  playAudio?: boolean;
}

const WHITE_KEYS = ["C", "D", "E", "F", "G", "A", "B"];
const BLACK_KEYS = [
  { note: "C#", boundary: 1 },
  { note: "D#", boundary: 2 },
  { note: "F#", boundary: 4 },
  { note: "G#", boundary: 5 },
  { note: "A#", boundary: 6 },
];

const HOTKEYS: Record<string, string> = {
  C: "a",
  "C#": "w",
  D: "s",
  "D#": "e",
  E: "d",
  F: "f",
  "F#": "t",
  G: "g",
  "G#": "y",
  A: "h",
  "A#": "u",
  B: "j",
};

const HOTKEY_NOTES = Object.fromEntries(
  Object.entries(HOTKEYS).map(([note, key]) => [key, note]),
);

const PRESET_KEYS = Object.keys(SYNTH_PRESETS);

const DRUM_KITS = new Set([
  "drum_set",
  "drum_808",
  "trap_kit",
  "electronic_drums",
  "acoustic_percussion",
]);

const DRUM_PADS = [
  { note: "C1", hotkey: "i" },
  { note: "C#1", hotkey: "o" },
  { note: "D1", hotkey: "p" },
  { note: "D#1", hotkey: "[" },
  { note: "E1", hotkey: "]" },
  { note: "F1", hotkey: "k" },
  { note: "F#1", hotkey: "l" },
  { note: "G1", hotkey: ";" },
  { note: "G#1", hotkey: "m" },
  { note: "A1", hotkey: "," },
  { note: "A#1", hotkey: "." },
  { note: "B1", hotkey: "/" },
  { note: "C2", hotkey: "n" },
  { note: "C#2", hotkey: "b" },
  { note: "D2", hotkey: "v" },
  { note: "D#2", hotkey: "c" },
];

const DRUM_PAD_HOTKEYS = Object.fromEntries(
  DRUM_PADS.map((pad) => [pad.hotkey, pad.note]),
);

export function HomePiano({
  className,
  startOctave = 4,
  playAudio = true,
}: HomePianoProps) {
  const id = useId();
  const [presetIndex, setPresetIndex] = useState(0);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [overrides, setOverrides] = useState<Partial<SynthParams>>({});
  const [pressed, setPressed] = useState<Set<string>>(new Set());
  const [analyser] = useState(() => (playAudio ? synth.getAnalyser() : null));
  const voices = useRef(new Set<string>());

  const presetKey = PRESET_KEYS[presetIndex];
  const section = SYNTH_SECTIONS[sectionIndex];
  const params = useMemo(
    () => ({ ...SYNTH_PRESETS[presetKey], ...overrides }),
    [presetKey, overrides],
  );
  const modified = Object.keys(overrides).length > 0;
  const drumKit = DRUM_KITS.has(presetKey) ? presetKey : "drum_set";

  const selectPreset = useCallback((index: number) => {
    synth.loadPreset(PRESET_KEYS[index]);
    setOverrides({});
    setPresetIndex(index);
  }, []);

  const changePreset = useCallback(
    (direction: 1 | -1) => {
      const next =
        (presetIndex + direction + PRESET_KEYS.length) % PRESET_KEYS.length;
      selectPreset(next);
    },
    [presetIndex, selectPreset],
  );

  const stopAll = useCallback(() => {
    for (const note of voices.current) synth.stopNote(`${id}-${note}`);
    voices.current.clear();
  }, [id]);

  useEffect(() => {
    const reset = () => {
      stopAll();
      setPressed(new Set());
    };
    const handleVisibility = () => {
      if (document.hidden) reset();
    };
    reset();
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stopAll();
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [stopAll, startOctave, playAudio]);

  const play = useCallback(
    (note: string) => {
      if (voices.current.has(note)) return;
      voices.current.add(note);
      if (playAudio) {
        synth.playNote(
          note,
          undefined,
          undefined,
          0.8,
          params,
          `${id}-${note}`,
        );
      }
      setPressed(new Set(voices.current));
    },
    [id, playAudio, params],
  );

  const stop = useCallback(
    (note: string) => {
      if (!voices.current.has(note)) return;
      synth.stopNote(`${id}-${note}`);
      voices.current.delete(note);
      setPressed(new Set(voices.current));
    },
    [id],
  );

  const playDrum = useCallback(
    (note: string) => {
      if (voices.current.has(note)) return;
      voices.current.add(note);
      if (playAudio) {
        synth.playDrum(note, 0.85, drumKit, `${id}-drum-${note}`);
      }
      setPressed(new Set(voices.current));
    },
    [id, playAudio, drumKit],
  );

  const stopDrum = useCallback(
    (note: string) => {
      if (!voices.current.has(note)) return;
      synth.stopNote(`${id}-drum-${note}`);
      voices.current.delete(note);
      setPressed(new Set(voices.current));
    },
    [id],
  );

  const updateControl = (controlIndex: number, value: number) => {
    const patch = section.controls[controlIndex].update(value);
    setOverrides((prev) => ({ ...prev, ...patch }));
    for (const [key, value] of Object.entries(patch)) {
      synth.updateParam(key as keyof SynthParams, value as never);
    }
  };

  const changeSection = (direction: 1 | -1) => {
    setSectionIndex(
      (prev) =>
        (prev + direction + SYNTH_SECTIONS.length) % SYNTH_SECTIONS.length,
    );
  };

  useEffect(() => {
    const getPianoNote = (key: string) => {
      const pitch = HOTKEY_NOTES[key];
      return pitch ? `${pitch}${startOctave}` : undefined;
    };

    const isTextEntry = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      if (target instanceof HTMLTextAreaElement) return true;
      if (target instanceof HTMLSelectElement) return true;
      if (target instanceof HTMLInputElement) {
        return !["range", "checkbox", "radio", "button", "submit"].includes(
          target.type,
        );
      }
      return false;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      if (isTextEntry(event.target)) return;
      const key = event.key.toLowerCase();
      const pianoNote = getPianoNote(key);
      if (pianoNote) {
        event.preventDefault();
        play(pianoNote);
        return;
      }
      const drumNote = DRUM_PAD_HOTKEYS[key];
      if (drumNote) {
        event.preventDefault();
        playDrum(drumNote);
        return;
      }
      const sectionKey = Number(key);
      if (
        Number.isInteger(sectionKey) &&
        sectionKey >= 1 &&
        sectionKey <= SYNTH_SECTIONS.length
      ) {
        setSectionIndex(sectionKey - 1);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const pianoNote = getPianoNote(key);
      if (pianoNote) {
        stop(pianoNote);
        return;
      }
      const drumNote = DRUM_PAD_HOTKEYS[key];
      if (drumNote) stopDrum(drumNote);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [play, stop, playDrum, stopDrum, startOctave]);

  const renderKey = (pitch: string, boundary?: number) => {
    const note = `${pitch}${startOctave}`;
    return (
      <Key
        key={note}
        note={note}
        hotkey={HOTKEYS[pitch]}
        variant={boundary ? "black" : "white"}
        isPressed={pressed.has(note)}
        onPress={play}
        onRelease={stop}
        className={boundary ? styles.raisedKey : undefined}
        style={boundary ? { left: `${(boundary / 7) * 100}%` } : undefined}
      />
    );
  };

  return (
    <Card
      variant="glass"
      elevation="low"
      className={cn(styles.piano, "bg-white/50 dark:bg-white/50", className)}
      role="group"
      aria-label="Studio device"
    >
      <div className={styles.topRow}>
        <div className={styles.knobGroup}>
          {section.controls.slice(0, 2).map((control, index) => (
            <Knob
              key={control.label}
              label={control.label}
              value={control.value(params)}
              displayValue={control.display(params)}
              onChange={(value) => updateControl(index, value)}
            />
          ))}
        </div>

        <SynthScreen
          params={params}
          section={section}
          sectionIndex={sectionIndex}
          sectionCount={SYNTH_SECTIONS.length}
          modified={modified}
          showScope={playAudio}
          analyser={analyser}
          className={styles.screen}
        />

        <div className={styles.knobGroup}>
          {section.controls.slice(2).map((control, index) => (
            <Knob
              key={control.label}
              label={control.label}
              value={control.value(params)}
              displayValue={control.display(params)}
              onChange={(value) => updateControl(index + 2, value)}
            />
          ))}
        </div>
      </div>

      <div className={styles.transport}>
        <div
          className={styles.navGroup}
          role="group"
          aria-label="Synth section navigation"
        >
          <Button
            variant="outline"
            tone="secondary"
            size="sm"
            rounded
            onClick={() => changeSection(-1)}
            aria-label="Previous synth section"
            leadingIcon={<ChevronLeft className="w-4 h-4" />}
          />
          <span className={styles.navLabel} aria-live="polite">
            {String(sectionIndex + 1).padStart(2, "0")} /{" "}
            {String(SYNTH_SECTIONS.length).padStart(2, "0")} · {section.title}
          </span>
          <Button
            variant="outline"
            tone="secondary"
            size="sm"
            rounded
            onClick={() => changeSection(1)}
            aria-label="Next synth section"
            leadingIcon={<ChevronRight className="w-4 h-4" />}
          />
        </div>

        <div
          className={styles.navGroup}
          role="group"
          aria-label="Sound preset navigation"
        >
          <Button
            variant="outline"
            tone="secondary"
            size="sm"
            rounded
            onClick={() => changePreset(-1)}
            aria-label="Previous sound preset"
            leadingIcon={<ChevronLeft className="w-4 h-4" />}
          />
          <span className={styles.navLabel} aria-live="polite">
            {params.name} · {presetIndex + 1} / {PRESET_KEYS.length}
          </span>
          <Button
            variant="outline"
            tone="secondary"
            size="sm"
            rounded
            onClick={() => changePreset(1)}
            aria-label="Next sound preset"
            leadingIcon={<ChevronRight className="w-4 h-4" />}
          />
        </div>

        <div
          className={styles.sectionButtons}
          role="tablist"
          aria-label="Synth sections"
        >
          {SYNTH_SECTIONS.map((item, index) => (
            <Pad
              key={item.id}
              note={item.id}
              glyph={String(index + 1)}
              ariaLabel={item.title}
              isSelected={index === sectionIndex}
              onPress={() => setSectionIndex(index)}
              className={styles.navPad}
            />
          ))}
        </div>
      </div>

      <div className={styles.instruments}>
        <div className={styles.keybed} role="group" aria-label="Piano keys">
          <div className={styles.longKeys}>
            {WHITE_KEYS.map((note) => renderKey(note))}
          </div>
          {BLACK_KEYS.map(({ note, boundary }) => renderKey(note, boundary))}
        </div>

        <div className={styles.padGrid} role="group" aria-label="Drum pads">
          {DRUM_PADS.map((pad) => (
            <Pad
              key={pad.note}
              variant="black"
              note={pad.note}
              hotkey={pad.hotkey}
              isPressed={pressed.has(pad.note)}
              onPress={playDrum}
              onRelease={stopDrum}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}
