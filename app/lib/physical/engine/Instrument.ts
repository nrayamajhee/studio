import type { AdsrStages } from "../dsp/Adsr";
import { DcBlocker } from "../dsp/filters";
import { Smoother } from "../dsp/generators";
import { softClip } from "../dsp/nonlinear";
import type { BusId, DrumPieceId } from "../messages";
import { Body } from "../models/Body";
import type { BasePatch } from "../patches/types";
import { ParamSet } from "./ParamSet";
import type { Voice } from "./Voice";

export const MAX_BLOCK = 2048;

// How long a bus keeps processing after its last voice ends, so the body can
// ring out.
const TAIL_SECONDS = 0.5;

// One instrument = one bus. Voices add their panned output into left/right;
// finish() then runs the body, drive and output gain, sums into the master and
// sends to the reverb.
export abstract class Instrument {
  readonly id: BusId;
  readonly name: string;
  readonly fs: number;
  readonly params: ParamSet;
  readonly left = new Float32Array(MAX_BLOCK);
  readonly right = new Float32Array(MAX_BLOCK);
  clock = 0;
  warn: (message: string) => void = () => {};
  protected readonly body: Body;
  private readonly outputGain: number;
  private readonly gain: Smoother;
  private readonly send: Smoother;
  private readonly drive: Smoother;
  // Drive is an odd curve, but asymmetric waveforms still come out with DC.
  private readonly driveDcL: DcBlocker;
  private readonly driveDcR: DcBlocker;
  private tail = Infinity;

  constructor(
    patch: BasePatch,
    fs: number,
    overrides?: Record<string, number>,
  ) {
    this.id = patch.id;
    this.name = patch.name;
    this.fs = fs;
    this.params = new ParamSet(patch.params, overrides);
    this.body = new Body(patch.body, fs);
    this.outputGain = patch.outputGain;
    this.gain = new Smoother(patch.outputGain, fs);
    this.send = new Smoother(0, fs);
    this.drive = new Smoother(0, fs);
    this.driveDcL = new DcBlocker(fs);
    this.driveDcR = new DcBlocker(fs);
  }

  abstract noteOn(note: number, velocity: number): void;
  abstract noteOff(note: number): void;
  abstract allNotesOff(): void;
  abstract panic(): void;
  abstract activeVoices(): number;
  protected abstract renderVoices(start: number, end: number): void;
  protected abstract freeFinished(): void;
  protected abstract allVoices(): readonly Voice[];

  sustain(_down: boolean) {}

  // The master ADSR: one amplitude envelope over every voice.
  setShape(stages: AdsrStages) {
    const voices = this.allVoices();
    for (let i = 0; i < voices.length; i++) voices[i].shape.setStages(stages);
  }

  hit(_piece: DrumPieceId, _velocity: number) {}

  setParam(id: string, value: number) {
    if (!this.params.set(id, value)) return false;
    this.applyParams();
    return true;
  }

  // Called after construction and after every param change; subclasses extend it.
  applyParams() {
    const p = this.params;
    this.send.set(p.get("space.send"));
    this.drive.set(p.has("output.drive") ? p.get("output.drive") : 0);
    this.gain.set(
      this.outputGain * (p.has("output.level") ? p.get("output.level") : 1),
    );
    this.body.configure(
      p.has("body.size") ? p.get("body.size") : 1,
      p.has("body.resonance") ? p.get("body.resonance") : 1,
      p.has("body.tone") ? p.get("body.tone") : 0,
      p.has("body.mix") ? p.get("body.mix") : 0,
    );
  }

  render(start: number, end: number) {
    if (this.activeVoices() > 0) this.renderVoices(start, end);
  }

  finish(
    n: number,
    masterL: Float32Array,
    masterR: Float32Array,
    reverbIn: Float32Array,
  ) {
    if (this.activeVoices() > 0) this.tail = 0;
    else this.tail += n;
    if (this.tail > TAIL_SECONDS * this.fs) return;

    const { left, right, gain, send, drive } = this;
    this.body.process(left, right, n);
    for (let i = 0; i < n; i++) {
      let l = left[i];
      let r = right[i];
      const d = drive.process();
      if (d > 0) {
        // softClip(x·(1 + 9·drive))/(1 + 2·drive)
        const pre = 1 + 9 * d;
        const post = 1 / (1 + 2 * d);
        l = this.driveDcL.process(softClip(l * pre) * post);
        r = this.driveDcR.process(softClip(r * pre) * post);
      }
      const g = gain.process();
      const s = send.process();
      l *= g;
      r *= g;
      masterL[i] += l;
      masterR[i] += r;
      reverbIn[i] += 0.5 * (l + r) * s;
    }
    left.fill(0, 0, n);
    right.fill(0, 0, n);
    this.freeFinished();
  }
}
