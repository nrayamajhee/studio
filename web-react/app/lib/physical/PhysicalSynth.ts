import type {
  DrumPieceId,
  EngineEvent,
  EngineStats,
  InstrumentId,
  KitId,
  ParamTarget,
  ProcessorOptions,
  WorkletMessage,
} from "./messages";
import { renderWorklet } from "./offline/renderOffline";
import { Scrubber } from "./Scrubber";
import { TrackMixer } from "./TrackMixer";

type Listener<T> = (value: T) => void;

export class PhysicalSynth {
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private analyser: AnalyserNode | null = null;
  // Where the worklet joins the output, ahead of the limiter and analyser.
  private output: AudioNode | null = null;
  // The system volume, after the limiter, so turning it up never clips.
  private volume: GainNode | null = null;
  private volumeLevel = 1;
  private booting: Promise<void> | null = null;
  private pending: EngineEvent[] = [];
  private statsListeners = new Set<Listener<EngineStats>>();
  private warningListeners = new Set<Listener<string>>();
  private isReady = false;
  private rate = 0;

  get ready() {
    return this.isReady;
  }

  get sampleRate() {
    return this.rate;
  }

  start(): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve();
    this.resume();
    this.booting ??= this.boot().catch((error: unknown) => {
      this.booting = null;
      this.warn(`Audio engine failed to start: ${String(error)}`);
    });
    return this.booting;
  }

  resume() {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  now() {
    return this.ctx?.currentTime ?? 0;
  }

  getAnalyser() {
    return this.analyser;
  }

  // The system volume (0–1), after the engine's master level and clipper and
  // the limiter; the analyser sees the output before it.
  setVolume(value: number) {
    this.volumeLevel = value;
    if (this.ctx && this.volume)
      this.volume.gain.setTargetAtTime(value, this.ctx.currentTime, 0.015);
  }

  noteOn(
    instrument: InstrumentId,
    note: number,
    velocity: number,
    time?: number,
  ) {
    this.send({ type: "noteOn", instrument, note, velocity, time });
  }

  noteOff(instrument: InstrumentId, note: number, time?: number) {
    this.send({ type: "noteOff", instrument, note, time });
  }

  hit(kit: KitId, piece: DrumPieceId, velocity: number, time?: number) {
    this.send({ type: "hit", kit, piece, velocity, time });
  }

  setSustain(instrument: InstrumentId, down: boolean, time?: number) {
    this.send({ type: "sustain", instrument, down, time });
  }

  metronomeTick(accent: boolean, time?: number) {
    this.send({ type: "tick", accent, time });
  }

  setParam(target: ParamTarget, id: string, value: number) {
    this.send({ type: "param", target, id, value });
  }

  allNotesOff() {
    this.send({ type: "allNotesOff" });
  }

  panic() {
    this.send({ type: "panic" });
  }

  // Renders events offline through the worklet at the live sample rate, e.g.
  // a take to scrub. Null until the engine has started.
  async render(
    events: EngineEvent[],
    duration: number,
    overrides?: ProcessorOptions["overrides"],
  ) {
    if (!this.ctx) return null;
    const { buffer } = await renderWorklet(
      events,
      this.ctx.sampleRate,
      duration,
      overrides,
    );
    return buffer;
  }

  // Plays a rendered buffer at a drag's speed into the live output.
  scrubber(buffer: AudioBuffer) {
    return this.ctx && this.output
      ? new Scrubber(this.ctx, this.output, buffer)
      : null;
  }

  // Plays rendered tracks together into the live output.
  mixer() {
    return this.ctx && this.output
      ? new TrackMixer(this.ctx, this.output)
      : null;
  }

  onStats(listener: Listener<EngineStats>) {
    this.statsListeners.add(listener);
    return () => {
      this.statsListeners.delete(listener);
    };
  }

  onWarning(listener: Listener<string>) {
    this.warningListeners.add(listener);
    return () => {
      this.warningListeners.delete(listener);
    };
  }

  private send(event: EngineEvent) {
    if (this.isReady && this.node) {
      this.node.port.postMessage([event]);
    } else if (event.type !== "param") {
      // Queued events play as soon as the worklet is ready, so a first tap
      // that boots the engine still sounds, just late. Params are re-sent by
      // their owners, so only the latest value matters and stale ones drop.
      this.pending.push({ ...event, time: undefined } as EngineEvent);
    } else {
      this.pending = this.pending.filter(
        (queued) =>
          !(
            queued.type === "param" &&
            queued.target === event.target &&
            queued.id === event.id
          ),
      );
      this.pending.push(event);
    }
  }

  private async boot() {
    const ctx = new AudioContext({ latencyHint: "interactive" });
    this.ctx = ctx;
    const { default: url } = await import("./processor.worklet.ts?worker&url");
    await ctx.audioWorklet.addModule(url);

    const node = new AudioWorkletNode(ctx, "physical-synth", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.1;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    const volume = ctx.createGain();
    volume.gain.value = this.volumeLevel;
    node
      .connect(limiter)
      .connect(analyser)
      .connect(volume)
      .connect(ctx.destination);

    await new Promise<void>((resolve) => {
      node.port.onmessage = (message: MessageEvent<WorkletMessage>) => {
        const data = message.data;
        if (data.type === "ready") {
          this.rate = data.sampleRate;
          resolve();
        } else if (data.type === "stats") {
          const { activeVoices, reverbAwake, load } = data;
          this.statsListeners.forEach((listener) =>
            listener({ activeVoices, reverbAwake, load }),
          );
        } else {
          this.warn(data.message);
        }
      };
    });

    this.node = node;
    this.analyser = analyser;
    this.output = limiter;
    this.volume = volume;
    this.isReady = true;
    if (this.pending.length > 0) {
      node.port.postMessage(this.pending);
      this.pending = [];
    }
    this.resume();
  }

  private warn(message: string) {
    if (this.warningListeners.size === 0) console.warn(message);
    this.warningListeners.forEach((listener) => listener(message));
  }
}
