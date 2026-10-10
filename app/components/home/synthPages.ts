import { paramModules } from "../../lib/physical/patches/params";
import type { ParamSpec, SectionId } from "../../lib/physical/patches/types";

export type SynthPageId = "chain" | SectionId;

// Four knob slots, in knob order (chalk, green, red, blue); null where the
// page has nothing for that knob.
export type KnobSlots = readonly (ParamSpec | null)[];

export type SynthPage = {
  id: SynthPageId;
  label: string;
  // What the knobs set, and with Shift held.
  main: KnobSlots;
  shift: KnobSlots;
};

// The shared modules' params keep their knob on every instrument, so a knob's
// colour means the same thing whichever instrument is playing. A slot lists
// the ids that may fill it (the violin's measured body takes the Mix knob, a
// kit's stereo width the Size knob). A shared module's other params go to
// Shift; the model's own modules fill the knobs in order, then Shift.
const SLOTS: Partial<Record<SectionId, readonly (readonly string[])[]>> = {
  body: [
    ["body.size", "body.width"],
    ["body.resonance"],
    ["body.tone"],
    ["body.mix", "body.violin"],
  ],
  filter: [
    ["filter.cutoff"],
    ["filter.resonance"],
    ["filter.envAmount"],
    ["filter.envDecay"],
  ],
  envelope: [
    ["envelope.attack"],
    ["envelope.decay"],
    ["envelope.sustain"],
    ["envelope.release"],
  ],
  lfo: [["lfo.rate"], ["lfo.pitch"], ["lfo.level"], ["lfo.filter"]],
  output: [["output.drive"], ["output.level"], ["space.send"]],
};

const fill = (specs: readonly ParamSpec[]): KnobSlots =>
  Array.from({ length: 4 }, (_, i) => specs[i] ?? null);

export function knobSlots(module: SectionId, specs: readonly ParamSpec[]) {
  const slots = SLOTS[module];
  if (!slots) return { main: fill(specs), shift: fill(specs.slice(4)) };
  const main: (ParamSpec | null)[] = [null, null, null, null];
  const rest: ParamSpec[] = [];
  for (const spec of specs) {
    const slot = slots.findIndex((ids) => ids.includes(spec.id));
    if (slot >= 0) main[slot] = spec;
    else rest.push(spec);
  }
  return { main, shift: fill(rest) };
}

const CHAIN: SynthPage = {
  id: "chain",
  label: "Chain",
  main: fill([]),
  shift: fill([]),
};

// The overview, then a page per module the instrument has, in module order:
// the chain's stops (exciter, resonator, filter, body, output), then what
// modulates them (envelope, LFO).
export function synthPages(params: readonly ParamSpec[]): SynthPage[] {
  return [
    CHAIN,
    ...paramModules(params).map(({ id, label, specs }) => ({
      id,
      label,
      ...knobSlots(id, specs),
    })),
  ];
}

// The chain's stops in signal order; the envelope and LFO drive them.
export const CHAIN_STOPS: readonly SectionId[] = [
  "exciter",
  "resonator",
  "filter",
  "body",
  "output",
];

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

export const noteName = (midi: number) =>
  `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
