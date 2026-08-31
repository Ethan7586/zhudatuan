import { errorCause } from './ErrorCause';

interface Waiter {
  readonly resolve: (release: () => void) => void;
  readonly reject: (cause: unknown) => void;
  readonly signal?: AbortSignal;
  readonly abort?: () => void;
}

export class Semaphore {
  private active = 0;
  private readonly waiting: Waiter[] = [];

  constructor(
    readonly capacity: number,
    private readonly maximumQueue = Number.MAX_SAFE_INTEGER
  ) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error('SEMAPHORE_CAPACITY_INVALID');
    if (!Number.isSafeInteger(maximumQueue) || maximumQueue < 0) throw new Error('SEMAPHORE_QUEUE_INVALID');
  }

  get running(): number {
    return this.active;
  }
  get queued(): number {
    return this.waiting.length;
  }

  async use<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    const release = await this.acquire(signal);
    try {
      return await work();
    } finally {
      release();
    }
  }

  acquire(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) return Promise.reject(errorCause(signal.reason, 'OPERATION_ABORTED'));
    if (this.active < this.capacity) {
      this.active += 1;
      return Promise.resolve(this.releaser());
    }
    if (this.waiting.length >= this.maximumQueue) return Promise.reject(new Error('SEMAPHORE_QUEUE_FULL'));
    return new Promise((resolve, reject) => {
      const waiter: Waiter = { resolve, reject, ...(signal ? { signal } : {}) };
      if (signal) {
        const abort = () => {
          const index = this.waiting.indexOf(waiter);
          if (index >= 0) this.waiting.splice(index, 1);
          reject(errorCause(signal.reason, 'OPERATION_ABORTED'));
        };
        Reflect.set(waiter, 'abort', abort);
        signal.addEventListener('abort', abort, { once: true });
      }
      this.waiting.push(waiter);
    });
  }

  private releaser(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active -= 1;
      this.startNext();
    };
  }

  private startNext(): void {
    while (this.active < this.capacity) {
      const waiter = this.waiting.shift();
      if (!waiter) return;
      waiter.signal?.removeEventListener('abort', waiter.abort!);
      if (waiter.signal?.aborted) continue;
      this.active += 1;
      waiter.resolve(this.releaser());
    }
  }
}
