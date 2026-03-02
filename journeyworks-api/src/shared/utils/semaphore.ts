/**
 * Lightweight counting semaphore for concurrency limiting.
 *
 * Works like `p-limit` but avoids an external dependency.
 * Wraps async functions so that at most `maxConcurrency` run at once;
 * additional calls queue and execute FIFO when a slot opens.
 *
 * Ported from trade-search's agentic-investigation module and adapted
 * for general use across journeyworks services.
 *
 * Usage:
 *   const sem = new Semaphore(5);
 *   const result = await sem.run(() => fetchData());
 */
export class Semaphore {
  private running = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly maxConcurrency: number) {
    if (maxConcurrency < 1) {
      throw new Error('Semaphore maxConcurrency must be >= 1');
    }
  }

  /** Current number of in-flight tasks */
  get activeCount(): number {
    return this.running;
  }

  /** Number of tasks waiting for a slot */
  get pendingCount(): number {
    return this.queue.length;
  }

  /**
   * Execute `fn` once a concurrency slot is available.
   * Returns `fn`'s result (or re-throws its error).
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.running < this.maxConcurrency) {
      this.running++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      // Hand the slot directly to the next waiter (running count stays the same)
      next();
    } else {
      this.running--;
    }
  }
}
