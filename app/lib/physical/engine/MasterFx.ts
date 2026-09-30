import { DelayLine } from "../dsp/DelayLine";
import { DcBlocker, OnePoleLowpass } from "../dsp/filters";
import { Smoother } from "../dsp/generators";
import { TWO_PI } from "../dsp/math";
import { drive } from "../dsp/nonlinear";

// Chorus: two taps swept in quadrature around 15 ms.
const CHORUS_CENTRE = 0.015;
const CHORUS_SWEEP = 0.004;
const CHORUS_RATE = 0.8;
// Delay: a ping-pong echo on an eighth note at the Device's 120 BPM, each
// repeat darker than the last.
const ECHO_SECONDS = 0.25;
const ECHO_FEEDBACK = 0.45;
const ECHO_DAMPING_HZ = 3500;
const IDLE = 1e-4;

// The FX chain over the mix: drive, chorus, then delay (the reverb is the
// engine's shared FDN). Each stage is skipped while its amount is zero, and
// clears its lines on the way out so an old tail never replays.
export class MasterFx {
  private readonly fs: number;
  private readonly driveAmount: Smoother;
  private readonly chorusAmount: Smoother;
  private readonly echoAmount: Smoother;
  private readonly dcL: DcBlocker;
  private readonly dcR: DcBlocker;
  private readonly chorusL: DelayLine;
  private readonly chorusR: DelayLine;
  private readonly echoL: DelayLine;
  private readonly echoR: DelayLine;
  private readonly dampL = new OnePoleLowpass();
  private readonly dampR = new OnePoleLowpass();
  private chorusPhase = 0;
  private chorusIdle = true;
  private echoIdle = true;

  constructor(fs: number) {
    this.fs = fs;
    this.driveAmount = new Smoother(0, fs);
    this.chorusAmount = new Smoother(0, fs);
    this.echoAmount = new Smoother(0, fs);
    this.dcL = new DcBlocker(fs);
    this.dcR = new DcBlocker(fs);
    const chorusMax = (CHORUS_CENTRE + CHORUS_SWEEP) * fs + 8;
    this.chorusL = new DelayLine(chorusMax);
    this.chorusR = new DelayLine(chorusMax);
    this.echoL = new DelayLine(ECHO_SECONDS * fs + 8);
    this.echoR = new DelayLine(ECHO_SECONDS * fs + 8);
    this.dampL.setCutoff(ECHO_DAMPING_HZ, fs);
    this.dampR.setCutoff(ECHO_DAMPING_HZ, fs);
  }

  set(driveAmount: number, chorus: number, delay: number) {
    this.driveAmount.set(driveAmount);
    this.chorusAmount.set(chorus);
    this.echoAmount.set(delay);
  }

  process(left: Float32Array, right: Float32Array, n: number) {
    this.processDrive(left, right, n);
    this.processChorus(left, right, n);
    this.processEcho(left, right, n);
  }

  private processDrive(left: Float32Array, right: Float32Array, n: number) {
    const amount = this.driveAmount;
    if (amount.settled && amount.value < IDLE) return;
    for (let i = 0; i < n; i++) {
      const d = amount.process();
      left[i] = this.dcL.process(drive(left[i], d));
      right[i] = this.dcR.process(drive(right[i], d));
    }
  }

  private processChorus(left: Float32Array, right: Float32Array, n: number) {
    const amount = this.chorusAmount;
    if (amount.settled && amount.value < IDLE) {
      if (!this.chorusIdle) {
        this.chorusL.clear();
        this.chorusR.clear();
        this.chorusIdle = true;
      }
      return;
    }
    this.chorusIdle = false;
    const step = CHORUS_RATE / this.fs;
    const centre = CHORUS_CENTRE * this.fs;
    const sweep = CHORUS_SWEEP * this.fs;
    for (let i = 0; i < n; i++) {
      const a = amount.process();
      this.chorusPhase = (this.chorusPhase + step) % 1;
      const angle = TWO_PI * this.chorusPhase;
      const l = left[i];
      const r = right[i];
      this.chorusL.write(l);
      this.chorusR.write(r);
      const tapL = this.chorusL.readLagrange3(centre + sweep * Math.sin(angle));
      const tapR = this.chorusR.readLagrange3(centre + sweep * Math.cos(angle));
      left[i] = l * (1 - 0.25 * a) + 0.6 * a * tapL;
      right[i] = r * (1 - 0.25 * a) + 0.6 * a * tapR;
    }
  }

  private processEcho(left: Float32Array, right: Float32Array, n: number) {
    const amount = this.echoAmount;
    if (amount.settled && amount.value < IDLE) {
      if (!this.echoIdle) {
        this.echoL.clear();
        this.echoR.clear();
        this.dampL.clear();
        this.dampR.clear();
        this.echoIdle = true;
      }
      return;
    }
    this.echoIdle = false;
    const length = Math.round(ECHO_SECONDS * this.fs);
    for (let i = 0; i < n; i++) {
      const wet = 0.8 * amount.process();
      const l = left[i];
      const r = right[i];
      const echoL = this.echoL.readInt(length);
      const echoR = this.echoR.readInt(length);
      // Ping-pong: the mix enters on the left and each repeat crosses sides.
      this.echoL.write(
        0.5 * (l + r) + ECHO_FEEDBACK * this.dampR.process(echoR),
      );
      this.echoR.write(ECHO_FEEDBACK * this.dampL.process(echoL));
      left[i] = l + wet * echoL;
      right[i] = r + wet * echoR;
    }
  }
}
