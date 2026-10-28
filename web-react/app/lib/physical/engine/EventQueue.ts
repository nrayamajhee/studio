import type { EngineEvent } from "../messages";

// Preallocated queue sorted by frame; equal frames keep arrival order.
export class EventQueue {
  private readonly frames: Float64Array;
  private readonly events: (EngineEvent | null)[];
  private head = 0;
  private tail = 0;

  constructor(capacity = 4096) {
    this.frames = new Float64Array(capacity);
    this.events = new Array<EngineEvent | null>(capacity).fill(null);
  }

  get size() {
    return this.tail - this.head;
  }

  push(event: EngineEvent, frame: number) {
    const capacity = this.frames.length;
    if (this.tail === capacity) {
      if (this.head === 0) return false;
      this.frames.copyWithin(0, this.head, this.tail);
      this.events.copyWithin(0, this.head, this.tail);
      this.tail -= this.head;
      this.head = 0;
    }
    let i = this.tail++;
    while (i > this.head && this.frames[i - 1] > frame) {
      this.frames[i] = this.frames[i - 1];
      this.events[i] = this.events[i - 1];
      i--;
    }
    this.frames[i] = frame;
    this.events[i] = event;
    return true;
  }

  peekFrame() {
    return this.head < this.tail ? this.frames[this.head] : Infinity;
  }

  pop() {
    const event = this.events[this.head];
    this.events[this.head] = null;
    this.head++;
    if (this.head === this.tail) this.head = this.tail = 0;
    return event;
  }

  clear() {
    for (let i = this.head; i < this.tail; i++) this.events[i] = null;
    this.head = this.tail = 0;
  }
}
