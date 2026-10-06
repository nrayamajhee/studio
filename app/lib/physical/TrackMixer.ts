// Plays rendered tracks together on the audio clock: each track's buffer at
// each of its pass starts, through its own gain, the whole arrangement
// looping (or once through). Notes ringing past a pass or the loop's end
// overlap what follows, as they would live.

// From play() to the first sound; how far ahead (s) passes are scheduled, and
// how often (s) the schedule is topped up, so an hour of repeats costs no
// more than a bar of them.
export const MIX_LEAD = 0.05;
const LEAD = MIX_LEAD;
const AHEAD = 1;
const TOP_UP = 0.25;
const FADE = 0.01;
const GLIDE = 0.02;

export type MixTrack = {
  id: string;
  buffer: AudioBuffer;
  // Where each pass starts in the arrangement (s).
  starts: readonly number[];
  gain: number;
};

export class TrackMixer {
  private readonly ctx: AudioContext;
  private readonly output: GainNode;
  private readonly gains = new Map<string, GainNode>();
  private sources = new Set<AudioBufferSourceNode>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  // The audio time of the arrangement's top on the first loop.
  private origin = 0;
  private span = 0;
  private running = false;
  private loops = true;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.output = new GainNode(ctx);
    this.output.connect(destination);
  }

  // Plays an arrangement `span` seconds long from `from` seconds into it,
  // looping unless `repeat` is false.
  play(tracks: readonly MixTrack[], span: number, from: number, repeat = true) {
    this.stop();
    if (span <= 0) return;
    const now = this.ctx.currentTime + LEAD;
    this.span = span;
    this.loops = repeat;
    this.origin = now - from;
    this.running = true;
    this.output.gain.cancelScheduledValues(now);
    this.output.gain.setValueAtTime(1, now);
    for (const track of tracks) this.gainOf(track.id).gain.value = track.gain;
    const passes = tracks
      .flatMap((track) => track.starts.map((start) => ({ track, start })))
      .sort((a, b) => a.start - b.start);
    // Everything starting before the horizon is scheduled.
    let horizon = now;
    let first = true;
    const topUp = () => {
      const until = Math.max(this.ctx.currentTime, now) + AHEAD;
      const firstLoop = Math.max(0, Math.floor((horizon - this.origin) / span));
      const lastLoop = repeat
        ? Math.floor((until - this.origin) / span)
        : firstLoop;
      for (let loop = firstLoop; loop <= lastLoop; loop++) {
        const top = this.origin + loop * span;
        for (const { track, start } of passes) {
          const at = top + start;
          if (at >= until) break;
          // At first, a pass already under way picks up mid-buffer.
          if (first ? at + track.buffer.duration <= now : at < horizon)
            continue;
          const source = new AudioBufferSourceNode(this.ctx, {
            buffer: track.buffer,
          });
          source.connect(this.gainOf(track.id));
          source.onended = () => {
            source.disconnect();
            this.sources.delete(source);
          };
          source.start(Math.max(at, now), Math.max(0, now - at));
          this.sources.add(source);
        }
      }
      first = false;
      horizon = until;
      if (!repeat && horizon >= this.origin + span) return;
      this.timer = setTimeout(topUp, TOP_UP * 1000);
    };
    topUp();
  }

  // Stops with a short fade; returns where in the arrangement it was (s).
  stop() {
    const position = this.position() ?? 0;
    clearTimeout(this.timer);
    const now = this.ctx.currentTime;
    this.output.gain.cancelScheduledValues(now);
    this.output.gain.setTargetAtTime(0, now, FADE / 3);
    for (const source of this.sources) source.stop(now + FADE);
    this.sources.clear();
    this.running = false;
    return position;
  }

  // Where the arrangement is (s), or null while stopped or once through.
  position() {
    if (!this.running) return null;
    const elapsed = this.ctx.currentTime - this.origin;
    if (!this.loops && elapsed >= this.span) return null;
    return elapsed < 0 ? 0 : elapsed % this.span;
  }

  setGain(id: string, gain: number) {
    this.gainOf(id).gain.setTargetAtTime(gain, this.ctx.currentTime, GLIDE);
  }

  private gainOf(id: string) {
    let gain = this.gains.get(id);
    if (!gain) {
      gain = new GainNode(this.ctx);
      gain.connect(this.output);
      this.gains.set(id, gain);
    }
    return gain;
  }
}
