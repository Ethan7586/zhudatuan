import { Semaphore } from './Semaphore';

export class Bulkhead {
  private readonly semaphore: Semaphore;

  constructor(maximumConcurrency: number, maximumQueue: number) {
    this.semaphore = new Semaphore(maximumConcurrency, maximumQueue);
  }

  async run<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    try {
      return await this.semaphore.use(operation, signal);
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'SEMAPHORE_QUEUE_FULL') throw new Error('BULKHEAD_REJECTED', { cause });
      throw cause;
    }
  }

  snapshot(): Readonly<{ running: number; queued: number; capacity: number }> {
    return Object.freeze({ running: this.semaphore.running, queued: this.semaphore.queued, capacity: this.semaphore.capacity });
  }
}
