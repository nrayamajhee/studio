import { Fdn } from "../dsp/Fdn";
import { Smoother } from "../dsp/generators";
import { PeakLimiter } from "../dsp/PeakLimiter";
import type { BusId, EngineEvent, EngineStats, ParamTarget } from "../messages";
import { BarInstrument } from "../models/BarInstrument";
import { BoreInstrument } from "../models/BoreInstrument";
import { BowedInstrument } from "../models/BowedInstrument";
import { DrumKit, Woodblock } from "../models/DrumKit";
import { OscillatorInstrument } from "../models/OscillatorInstrument";
import { ReedInstrument } from "../models/ReedInstrument";
import { StringInstrument } from "../models/StringInstrument";
import { MASTER_PARAMS, PATCHES } from "../patches";
import type { Patch } from "../patches/types";
import { EventQueue } from "./EventQueue";
import { Instrument, MAX_BLOCK } from "./Instrument";
import { MasterFx } from "./MasterFx";
import { MasterLfo } from "./MasterLfo";
import { ParamSet } from "./ParamSet";

// The master limiter turns coherent chord transients (sub-millisecond, too
// fast for the browser's compressor) down to −3 dBFS. The tanh knee above it
// is a last resort, unity below −3 dBFS.
const CLIP_KNEE = 0.7;
const MIN_ATTACK = 0.001;
function safetyClip(x: number) {
  const level = x < 0 ? -x : x;
  if (level <= CLIP_KNEE) return x;
  const y =
    CLIP_KNEE +
    (1 - CLIP_KNEE) * Math.tanh((level - CLIP_KNEE) / (1 - CLIP_KNEE));
  return x < 0 ? -y : y;
}

export type Overrides = Partial<Record<ParamTarget, Record<string, number>>>;

function createInstrument(
  patch: Patch,
  fs: number,
  overrides?: Record<string, number>,
): Instrument {
  switch (patch.family) {
    case "string":
      return new StringInstrument(patch, fs, overrides);
    case "bore":
      return new BoreInstrument(patch, fs, overrides);
    case "bowed":
      return new BowedInstrument(patch, fs, overrides);
    case "drums":
      return new DrumKit(patch, fs, overrides);
    case "oscillator":
      return new OscillatorInstrument(patch, fs, overrides);
    case "reed":
      return new ReedInstrument(patch, fs, overrides);
    case "bar":
      return new BarInstrument(patch, fs, overrides);
  }
}

// Owns every instrument, the shared reverb and the master stage. render() is
// allocation-free; events are applied at their exact frame by splitting the
// block into segments.
export class Engine {
  readonly fs: number;
  readonly instruments: readonly Instrument[];
  readonly master: ParamSet;
  frame = 0;
  private readonly byId: Partial<Record<BusId, Instrument>> = {};
  private readonly queue = new EventQueue();
  private readonly reverb: Fdn;
  private readonly lfo: MasterLfo;
  private readonly fx: MasterFx;
  private readonly woodblock: Woodblock;
  private readonly reverbIn = new Float32Array(MAX_BLOCK);
  private readonly masterL = new Float32Array(MAX_BLOCK);
  private readonly masterR = new Float32Array(MAX_BLOCK);
  private readonly wetL = new Float32Array(MAX_BLOCK);
  private readonly wetR = new Float32Array(MAX_BLOCK);
  // The metronome joins after the LFO and FX, so its click stays steady.
  private readonly clickL = new Float32Array(MAX_BLOCK);
  private readonly clickR = new Float32Array(MAX_BLOCK);
  private readonly volume: Smoother;
  private readonly reverbReturn: Smoother;
  private readonly limiter: PeakLimiter;
  private readonly warnings: string[] = [];

  constructor(fs: number, overrides?: Overrides) {
    this.fs = fs;
    const warn = (message: string) => this.warn(message);
    this.instruments = PATCHES.map((patch) => {
      const instrument = createInstrument(patch, fs, overrides?.[patch.id]);
      instrument.warn = warn;
      this.byId[patch.id] = instrument;
      return instrument;
    });
    this.master = new ParamSet(MASTER_PARAMS, overrides?.master);
    this.reverb = new Fdn(fs);
    this.lfo = new MasterLfo(fs);
    this.fx = new MasterFx(fs);
    this.woodblock = new Woodblock(fs);
    this.volume = new Smoother(this.master.get("master.volume"), fs);
    this.reverbReturn = new Smoother(this.master.get("reverb.return"), fs);
    this.limiter = new PeakLimiter(fs, CLIP_KNEE);
    this.applyMaster();
  }

  instrument(id: BusId) {
    return this.byId[id];
  }

  // Frames are absolute sample positions; a missing time means "as soon as
  // possible", which the render loop clamps to the start of the next block.
  schedule(event: EngineEvent) {
    const time = "time" in event ? event.time : undefined;
    const frame = time === undefined ? -1 : Math.round(time * this.fs);
    if (!this.queue.push(event, frame)) this.warn("Event queue full");
  }

  drainWarnings() {
    return this.warnings.splice(0);
  }

  stats(): EngineStats {
    return {
      activeVoices: this.activeVoices(),
      reverbAwake: !this.reverb.sleeping,
    };
  }

  activeVoices() {
    let count = 0;
    for (let i = 0; i < this.instruments.length; i++) {
      count += this.instruments[i].activeVoices();
    }
    return count + (this.woodblock.active ? 1 : 0);
  }

  render(left: Float32Array, right: Float32Array) {
    const total = left.length;
    for (let offset = 0; offset < total; offset += MAX_BLOCK) {
      const n = Math.min(MAX_BLOCK, total - offset);
      this.renderBlock(left, right, offset, n);
    }
  }

  private renderBlock(
    left: Float32Array,
    right: Float32Array,
    offset: number,
    n: number,
  ) {
    const start = this.frame;
    const end = start + n;
    const instruments = this.instruments;
    let segment = 0;
    while (this.queue.peekFrame() < end) {
      const at = Math.max(0, this.queue.peekFrame() - start);
      if (at > segment) {
        this.renderSegment(segment, at);
        segment = at;
      }
      const event = this.queue.pop();
      if (event) this.apply(event, start + at);
    }
    this.renderSegment(segment, n);

    const masterL = this.masterL;
    const masterR = this.masterR;
    const reverbIn = this.reverbIn;
    for (let i = 0; i < instruments.length; i++) {
      instruments[i].finish(n, masterL, masterR, reverbIn);
    }
    const wetL = this.wetL;
    const wetR = this.wetR;
    this.reverb.process(reverbIn, wetL, wetR, n);
    this.lfo.process(masterL, masterR, n);
    this.fx.process(masterL, masterR, n);
    const clickL = this.clickL;
    const clickR = this.clickR;
    const limiter = this.limiter;
    for (let i = 0; i < n; i++) {
      const g = this.volume.process();
      const wet = this.reverbReturn.process();
      limiter.process(
        g * (masterL[i] + clickL[i] + wet * wetL[i]),
        g * (masterR[i] + clickR[i] + wet * wetR[i]),
      );
      left[offset + i] = safetyClip(limiter.left);
      right[offset + i] = safetyClip(limiter.right);
    }
    masterL.fill(0, 0, n);
    masterR.fill(0, 0, n);
    clickL.fill(0, 0, n);
    clickR.fill(0, 0, n);
    reverbIn.fill(0, 0, n);
    wetL.fill(0, 0, n);
    wetR.fill(0, 0, n);
    this.frame = end;
  }

  private renderSegment(from: number, to: number) {
    if (to <= from) return;
    const instruments = this.instruments;
    for (let i = 0; i < instruments.length; i++)
      instruments[i].render(from, to);
    this.woodblock.render(this.clickL, this.clickR, from, to);
  }

  private apply(event: EngineEvent, frame: number) {
    const instruments = this.instruments;
    for (let i = 0; i < instruments.length; i++) instruments[i].clock = frame;
    switch (event.type) {
      case "noteOn":
        this.byId[event.instrument]?.noteOn(event.note, event.velocity);
        break;
      case "noteOff":
        this.byId[event.instrument]?.noteOff(event.note);
        break;
      case "sustain":
        this.byId[event.instrument]?.sustain(event.down);
        break;
      case "hit":
        this.byId[event.kit]?.hit(event.piece, event.velocity);
        break;
      case "tick":
        this.woodblock.hit(event.accent);
        break;
      case "param":
        if (event.target === "master") {
          if (this.master.set(event.id, event.value)) this.applyMaster();
          else this.warn(`Unknown master param "${event.id}"`);
        } else if (!this.byId[event.target]?.setParam(event.id, event.value)) {
          this.warn(`Unknown param "${event.id}" for ${event.target}`);
        }
        break;
      case "allNotesOff":
        for (let i = 0; i < instruments.length; i++)
          instruments[i].allNotesOff();
        break;
      case "panic":
        for (let i = 0; i < instruments.length; i++) instruments[i].panic();
        this.reverb.clear();
        break;
    }
  }

  private applyMaster() {
    const m = this.master;
    this.volume.set(m.get("master.volume"));
    this.reverbReturn.set(m.get("reverb.return"));
    this.reverb.setSize(m.get("reverb.size"));
    this.reverb.setDecay(m.get("reverb.decay"));
    this.reverb.setDamping(m.get("reverb.damping"));
    this.reverb.setPredelay(m.get("reverb.predelay"));
    this.lfo.set(
      m.get("lfo.rate"),
      m.get("lfo.depth"),
      Math.round(m.get("lfo.shape")),
      Math.round(m.get("lfo.target")),
    );
    this.fx.set(m.get("fx.drive"), m.get("fx.chorus"), m.get("fx.delay"));
    // The shortest attack means none, so the default adds no fade-in.
    const shape = m.envelope("adsr");
    if (shape.attack <= MIN_ATTACK) shape.attack = 0;
    for (let i = 0; i < this.instruments.length; i++) {
      this.instruments[i].setShape(shape);
    }
  }

  private warn(message: string) {
    if (this.warnings.length < 32) this.warnings.push(message);
  }
}
