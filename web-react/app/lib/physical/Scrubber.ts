// Plays a rendered take at the speed it is dragged, like tape across a head or
// a record under a hand: pitch follows the speed, and dragging back plays it
// backwards. Left alone it spins down like a released record.

// Fastest playback, ×.
const MAX_RATE = 4;
// How quickly the speed follows the drag, and how long it spins down for (s).
const GLIDE = 0.03;
const SPIN_DOWN = 0.15;
// No move for this long (ms) lets it spin down.
const IDLE_MS = 90;
// Fades that keep a restart from clicking (s).
const FADE = 0.008;
// How far (s) the playhead may drift from the drag before it jumps.
const DRIFT = 0.12;

type Head = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  direction: 1 | -1;
};

export class Scrubber {
  private readonly ctx: AudioContext;
  private readonly output: AudioNode;
  private readonly forward: AudioBuffer;
  private readonly backward: AudioBuffer;
  private head: Head | null = null;
  // Where the playhead is estimated to be on the take (s), as of `at`.
  private position = 0;
  private rate = 0;
  private at = 0;
  private idle: ReturnType<typeof setTimeout> | undefined;

  constructor(ctx: AudioContext, output: AudioNode, buffer: AudioBuffer) {
    this.ctx = ctx;
    this.output = output;
    this.forward = buffer;
    this.backward = new AudioBuffer({
      numberOfChannels: buffer.numberOfChannels,
      length: buffer.length,
      sampleRate: buffer.sampleRate,
    });
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const reversed = buffer.getChannelData(c).slice().reverse();
      this.backward.copyToChannel(reversed, c);
    }
  }

  // The drag moved from `from` to `to` (s on the take) at `speed` (take
  // seconds per second; negative is backwards). It keeps playing until it
  // gets there, so a jump, like a knob detent, plays its whole stretch.
  move(from: number, to: number, speed: number) {
    const now = this.ctx.currentTime;
    this.position += (this.head?.direction ?? 1) * this.rate * (now - this.at);
    this.at = now;
    const direction = speed < 0 ? -1 : 1;
    const rate = Math.min(MAX_RATE, Math.abs(speed));
    if (
      !this.head ||
      this.head.direction !== direction ||
      Math.abs(this.position - from) > DRIFT
    )
      this.start(from, direction, now);
    const head = this.head;
    if (!head || rate === 0) return;
    head.source.playbackRate.cancelScheduledValues(now);
    head.source.playbackRate.setTargetAtTime(rate, now, GLIDE);
    this.rate = rate;
    const travel = (Math.abs(to - this.position) / rate) * 1000;
    clearTimeout(this.idle);
    this.idle = setTimeout(() => this.release(), Math.max(IDLE_MS, travel));
  }

  stop() {
    clearTimeout(this.idle);
    this.fadeOut(this.head);
    this.head = null;
    this.rate = 0;
  }

  private start(position: number, direction: 1 | -1, now: number) {
    this.fadeOut(this.head);
    this.head = null;
    const duration = this.forward.duration;
    const offset = direction > 0 ? position : duration - position;
    if (offset < 0 || offset >= duration) return;
    const source = new AudioBufferSourceNode(this.ctx, {
      buffer: direction > 0 ? this.forward : this.backward,
      playbackRate: this.rate || 1,
    });
    const gain = new GainNode(this.ctx, { gain: 0 });
    gain.gain.setTargetAtTime(1, now, FADE);
    source.connect(gain).connect(this.output);
    source.start(now, offset);
    const head: Head = { source, gain, direction };
    source.onended = () => {
      gain.disconnect();
      if (this.head === head) this.head = null;
    };
    this.head = head;
    this.position = position;
  }

  // Slows to a stop and fades, like a record let go.
  private release() {
    const head = this.head;
    if (!head) return;
    const now = this.ctx.currentTime;
    head.source.playbackRate.cancelScheduledValues(now);
    head.source.playbackRate.setTargetAtTime(0.01, now, SPIN_DOWN);
    head.gain.gain.setTargetAtTime(0, now + SPIN_DOWN, SPIN_DOWN / 2);
    head.source.stop(now + 4 * SPIN_DOWN);
    this.head = null;
    this.rate = 0;
  }

  private fadeOut(head: Head | null) {
    if (!head) return;
    const now = this.ctx.currentTime;
    head.gain.gain.cancelScheduledValues(now);
    head.gain.gain.setTargetAtTime(0, now, FADE);
    head.source.stop(now + 6 * FADE);
  }
}
