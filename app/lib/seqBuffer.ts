import type { ServerMessage } from "../types";

/**
 * Buffers out-of-order server messages by seq and drains in order.
 * Deduplicates already-processed sequence numbers.
 */
export class SeqBuffer {
  private lastProcessedSeq = 0;
  private readonly buffer = new Map<number, ServerMessage>();
  private readonly seenSeqs = new Set<number>();
  private gapDetected = false;

  getLastProcessedSeq(): number {
    return this.lastProcessedSeq;
  }

  hasGap(): boolean {
    return this.gapDetected;
  }

  getMissingSeq(): number | null {
    if (!this.gapDetected) {
      return null;
    }
    return this.lastProcessedSeq + 1;
  }

  setLastProcessedSeq(seq: number): void {
    this.lastProcessedSeq = seq;
  }

  reset(lastSeq: number): void {
    this.lastProcessedSeq = lastSeq;
    this.buffer.clear();
    this.gapDetected = false;
  }

  enqueue(raw: unknown): ServerMessage[] {
    if (!isServerMessage(raw)) {
      return [];
    }

    const msg = raw;
    const { seq } = msg;

    if (seq <= this.lastProcessedSeq || this.seenSeqs.has(seq)) {
      return [];
    }

    if (this.buffer.has(seq)) {
      return [];
    }

    this.buffer.set(seq, msg);
    return this.drain();
  }

  private drain(): ServerMessage[] {
    const processed: ServerMessage[] = [];

    while (true) {
      const expected = this.lastProcessedSeq + 1;
      const next = this.buffer.get(expected);

      if (!next) {
        this.gapDetected = [...this.buffer.keys()].some((seq) => seq > expected);
        break;
      }

      this.buffer.delete(expected);
      this.lastProcessedSeq = expected;
      this.seenSeqs.add(expected);
      this.gapDetected = false;
      processed.push(next);
    }

    return processed;
  }
}

function isServerMessage(value: unknown): value is ServerMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return typeof obj.type === "string" && typeof obj.seq === "number";
}
